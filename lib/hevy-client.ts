import fs from "node:fs";
import path from "node:path";
import {
  getHevyAuthRecord,
  saveHevyAuthTokens,
  updateHevyLastSync,
  disconnectHevyAuth,
  HevyAuthRecord,
} from "./hevy-db";
import { importCsvToDb, ImportResult, formatSpanishDate } from "./csv-parser";

const SESSION_DIR = path.join(process.cwd(), "data");

/**
 * Convierte un array de entrenamientos devueltos por la API de Hevy
 * (/workouts_batch) al formato CSV estándar para su ingesta en ByteHevy.
 */
function workoutsBatchToCsv(workouts: any[]): string {
  const headers = [
    "title",
    "start_time",
    "end_time",
    "description",
    "exercise_title",
    "superset_id",
    "exercise_notes",
    "set_index",
    "set_type",
    "weight_kg",
    "reps",
    "distance_km",
    "duration_seconds",
    "rpe",
  ];

  const rows: string[] = [headers.map((h) => `"${h}"`).join(",")];

  for (const w of workouts) {
    const title = (w.name || "Entrenamiento").trim();
    const startDate = formatSpanishDate(w.start_time * 1000);
    const endDate = w.end_time
      ? formatSpanishDate(w.end_time * 1000)
      : startDate;
    const description = (w.description || "").trim();

    if (w.exercises && Array.isArray(w.exercises)) {
      for (const ex of w.exercises) {
        const exTitle = (ex.title || "Ejercicio").trim();
        const supersetId = ex.superset_id != null ? String(ex.superset_id) : "";
        const notes = (ex.notes || "").trim();

        if (ex.sets && Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            const setIndex = s.index != null ? s.index : 0;
            const setType = s.indicator || "normal";
            const weightKg = s.weight_kg != null ? s.weight_kg : "";
            const reps = s.reps != null ? s.reps : "";
            const distanceKm =
              s.distance_meters != null
                ? (s.distance_meters / 1000).toFixed(2)
                : "";
            const durationSec =
              s.duration_seconds != null ? s.duration_seconds : "";
            const rpe = s.rpe != null ? s.rpe : "";

            const row = [
              `"${title.replace(/"/g, '""')}"`,
              `"${startDate}"`,
              `"${endDate}"`,
              `"${description.replace(/"/g, '""')}"`,
              `"${exTitle.replace(/"/g, '""')}"`,
              supersetId ? `"${supersetId}"` : "",
              `"${notes.replace(/"/g, '""')}"`,
              setIndex,
              `"${setType}"`,
              weightKg,
              reps,
              distanceKm,
              durationSec,
              rpe,
            ];
            rows.push(row.join(","));
          }
        }
      }
    }
  }

  return rows.join("\n");
}

/**
 * Descarga todos los entrenamientos de la cuenta de Hevy usando el token
 * de acceso directamente contra la API interna de Hevy (/workouts_batch).
 */
async function fetchAllWorkoutsViaApi(
  accessToken: string
): Promise<{ success: boolean; csvText?: string; error?: string; status?: number }> {
  try {
    let lastIndex = 0;
    const allWorkouts: any[] = [];

    while (true) {
      const res = await fetch(
        `https://api.hevyapp.com/workouts_batch/${lastIndex}`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
            "auth-token": accessToken,
            "x-api-key": "shelobs_hevy_web",
            "hevy-platform": "web",
          },
        }
      );

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          status: res.status,
          error: "Token de acceso expirado o inválido en Hevy",
        };
      }

      if (!res.ok) {
        return {
          success: false,
          status: res.status,
          error: `Error del servidor de Hevy: ${res.statusText} (${res.status})`,
        };
      }

      const batch = await res.json();
      if (!batch || !Array.isArray(batch) || batch.length === 0) {
        break;
      }

      allWorkouts.push(...batch);
      // Avanzar al siguiente índice
      const lastItem = batch[batch.length - 1];
      if (lastItem && typeof lastItem.index === "number") {
        lastIndex = lastItem.index + 1;
      } else {
        break;
      }
    }

    const csvText = workoutsBatchToCsv(allWorkouts);
    return { success: true, csvText };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al conectar con la API de Hevy",
    };
  }
}

/**
 * Valida un token de sesión contra la API de Hevy y lo guarda en SQLite.
 */
export async function verifyAndSaveHevyToken(params: {
  accessToken: string;
  refreshToken?: string | null;
  userId?: string | null;
  username?: string | null;
  email?: string | null;
}): Promise<{
  success: boolean;
  userId?: string;
  username?: string;
  error?: string;
}> {
  let token = params.accessToken.trim();
  if (!token) {
    return { success: false, error: "El token no puede estar vacío." };
  }

  // Sanitizar si el usuario pegó el encabezado completo o con comillas
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  if (token.toLowerCase().startsWith("auth-token:")) {
    token = token.slice(11).trim();
  }
  if (token.toLowerCase().startsWith("authorization:")) {
    token = token.slice(14).trim();
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.slice(7).trim();
    }
  }
  if (token.startsWith("{") && token.endsWith("}")) {
    try {
      const parsed = JSON.parse(token);
      token = parsed.access_token || parsed.auth_token || parsed.token || token;
    } catch {}
  }
  token = token.replace(/^["']|["']$/g, "").trim();

  try {
    // 1. Probar el token contra el endpoint de workouts_batch para verificar validez
    const res = await fetch("https://api.hevyapp.com/workouts_batch/0", {
      headers: {
        authorization: `Bearer ${token}`,
        "auth-token": token,
        "x-api-key": "shelobs_hevy_web",
        "hevy-platform": "web",
      },
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        error: "El token no es válido o ha expirado en Hevy.",
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: `Error al verificar con Hevy: ${res.statusText} (${res.status})`,
      };
    }

    let username = params.username || null;
    let userId = params.userId || null;

    // Si falta el username, intentar obtenerlo de user_preferences
    if (!username) {
      try {
        const prefRes = await fetch("https://api.hevyapp.com/user_preferences", {
          headers: {
            authorization: `Bearer ${token}`,
            "auth-token": token,
            "x-api-key": "shelobs_hevy_web",
            "hevy-platform": "web",
          },
        });
        if (prefRes.ok) {
          const prefData = await prefRes.json();
          if (prefData?.username) username = prefData.username;
          if (prefData?.user_id && !userId) userId = prefData.user_id;
        }
      } catch {}
    }

    // 2. Guardar en SQLite
    await saveHevyAuthTokens({
      accessToken: token,
      refreshToken: params.refreshToken,
      userId: userId,
      username: username,
      email: params.email,
    });

    return {
      success: true,
      userId: userId || undefined,
      username: username || undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error de conexión con Hevy: ${err.message || err}`,
    };
  }
}

/**
 * Sincroniza entrenamientos desde Hevy usando el token guardado en SQLite.
 * Utiliza peticiones HTTP puras sin requerir navegadores ni Playwright en el servidor.
 */
export async function syncHevyWorkouts(): Promise<{
  success: boolean;
  result?: ImportResult;
  error?: string;
}> {
  const authRecord = await getHevyAuthRecord();
  if (!authRecord.isAuthenticated || !authRecord.accessToken) {
    return {
      success: false,
      error: "No hay una cuenta de Hevy conectada. Inicia sesión primero.",
    };
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // 1. Descargar entrenamientos usando el token guardado
  const apiRes = await fetchAllWorkoutsViaApi(authRecord.accessToken);
  if (apiRes.success && apiRes.csvText) {
    // Guardar respaldo de los datos obtenidos en workouts.csv
    const backupCsvPath = path.join(SESSION_DIR, "workouts.csv");
    fs.writeFileSync(backupCsvPath, apiRes.csvText, "utf-8");

    // Ingerir en SQLite
    const importResult = await importCsvToDb(apiRes.csvText);
    await updateHevyLastSync(Date.now(), importResult.newWorkouts);

    return {
      success: true,
      result: importResult,
    };
  }

  if (apiRes.status === 401 || apiRes.status === 403) {
    await disconnectHevyAuth();
    return {
      success: false,
      error: "La sesión de Hevy ha expirado. Por favor, vuelve a vincular tu cuenta.",
    };
  }

  return {
    success: false,
    error: apiRes.error || "No se pudo sincronizar los entrenamientos con Hevy.",
  };
}
