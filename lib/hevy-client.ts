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
 * Procesa cualquier formato de entrada proporcionado por el usuario:
 * - Cookie completa de hevy.com (contiene auth2.0-token=...)
 * - Cookie auth2.0-token en formato JSON decodificado o URL-encoded
 * - Encabezado HTTP (Bearer ..., auth-token: ..., authorization: ...)
 * - Token plano de acceso
 */
export function parseHevyTokenInput(rawInput: string): {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
} {
  let text = (rawInput || "").trim();

  // Caso 1: String que contiene auth2.0-token=... (formato cookie completa de document.cookie)
  if (text.includes("auth2.0-token=")) {
    const match = text.match(/auth2\.0-token=([^;]+)/);
    if (match) {
      text = match[1].trim();
    }
  }

  // Caso 2: Si está URL-encoded (ej: {%22access_token%22...} o %7B%22...%22%7D)
  if (text.includes("%22") || text.includes("%7B") || text.includes("%7b")) {
    try {
      text = decodeURIComponent(text);
    } catch {}
  }

  // Quitar posibles comillas externas
  text = text.replace(/^["']|["']$/g, "").trim();

  // Caso 3: Es un JSON con tokens ({ "access_token": ... })
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text);
      const accessToken =
        parsed.access_token || parsed.auth_token || parsed.token || "";
      const refreshToken = parsed.refresh_token || parsed.refreshToken || null;
      const expiresAt = parsed.expires_at || parsed.expiresAt || null;

      if (accessToken) {
        return {
          accessToken: String(accessToken).trim(),
          refreshToken: refreshToken ? String(refreshToken).trim() : null,
          expiresAt: expiresAt ? String(expiresAt).trim() : null,
        };
      }
    } catch {}
  }

  // Caso 4: Si empieza con prefijos de encabezado HTTP
  let token = text;
  if (token.toLowerCase().startsWith("authorization:")) {
    token = token.slice(14).trim();
  }
  if (token.toLowerCase().startsWith("auth-token:")) {
    token = token.slice(11).trim();
  }
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  token = token.replace(/^["']|["']$/g, "").trim();

  return { accessToken: token };
}

/**
 * Refresca la sesión de Hevy utilizando el refresh_token almacenado en SQLite.
 * Hevy rota ambos tokens (access_token y refresh_token) y extiende la expiración.
 */
export async function refreshHevySession(): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  error?: string;
}> {
  const authRecord = await getHevyAuthRecord();
  if (!authRecord.refreshToken) {
    return {
      success: false,
      error: "No hay token de refresco (refresh_token) guardado en ByteHevy.",
    };
  }

  try {
    const res = await fetch("https://api.hevyapp.com/auth/refresh_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "shelobs_hevy_web",
        "Hevy-Platform": "web",
        ...(authRecord.accessToken
          ? { authorization: `Bearer ${authRecord.accessToken}` }
          : {}),
        "x-client-time": String(Math.floor(Date.now() / 1000)),
      },
      body: JSON.stringify({
        refresh_token: authRecord.refreshToken,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Error al refrescar sesión en Hevy (${res.status}): ${errText}`,
      };
    }

    const data = await res.json();
    if (!data.access_token) {
      return {
        success: false,
        error: "Respuesta de refresco inválida desde Hevy (falta access_token).",
      };
    }

    await saveHevyAuthTokens({
      userId: data.user_id || authRecord.userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || authRecord.refreshToken,
      expiresAt: data.expires_at || null,
      username: authRecord.username,
      email: authRecord.email,
    });

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || authRecord.refreshToken,
      expiresAt: data.expires_at,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error de red al refrescar sesión de Hevy: ${err.message || err}`,
    };
  }
}

/**
 * Descarga todos los entrenamientos de la cuenta de Hevy usando el token
 * de acceso directamente contra la API interna de Hevy (/workouts_batch).
 * Si el token expira (401/403) y hay refresh_token disponible, refresca automáticamente y reintenta.
 */
async function fetchAllWorkoutsViaApi(
  accessToken: string,
  allowRefresh = true
): Promise<{ success: boolean; csvText?: string; error?: string; status?: number }> {
  try {
    let lastIndex = 0;
    const allWorkouts: any[] = [];
    let currentToken = accessToken;

    while (true) {
      const res = await fetch(
        `https://api.hevyapp.com/workouts_batch/${lastIndex}`,
        {
          headers: {
            authorization: `Bearer ${currentToken}`,
            "auth-token": currentToken,
            "x-api-key": "shelobs_hevy_web",
            "hevy-platform": "web",
          },
        }
      );

      if (res.status === 401 || res.status === 403) {
        if (allowRefresh) {
          const refreshRes = await refreshHevySession();
          if (refreshRes.success && refreshRes.accessToken) {
            // Reintentar recursivamente con el nuevo token rotado
            return fetchAllWorkoutsViaApi(refreshRes.accessToken, false);
          }
        }
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
 * Valida un token o cookie de sesión contra la API de Hevy y lo guarda en SQLite.
 * Admite formatos JSON (con access_token y refresh_token), cookie document.cookie o Bearer header.
 */
export async function verifyAndSaveHevyToken(params: {
  accessToken?: string;
  rawTokenInput?: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  userId?: string | null;
  username?: string | null;
  email?: string | null;
}): Promise<{
  success: boolean;
  userId?: string;
  username?: string;
  hasRefreshToken?: boolean;
  error?: string;
}> {
  const inputStr = params.rawTokenInput || params.accessToken || "";
  const parsed = parseHevyTokenInput(inputStr);

  let token = parsed.accessToken;
  let refreshToken = params.refreshToken || parsed.refreshToken || null;
  let expiresAt = params.expiresAt || parsed.expiresAt || null;

  if (!token && !refreshToken) {
    return {
      success: false,
      error: "No se encontró ningún token de acceso o sesión válida en el texto introducido.",
    };
  }

  let isVerified = false;
  let username = params.username || null;
  let userId = params.userId || null;

  try {
    // 1. Probar el token actual contra workouts_batch
    if (token) {
      const res = await fetch("https://api.hevyapp.com/workouts_batch/0", {
        headers: {
          authorization: `Bearer ${token}`,
          "auth-token": token,
          "x-api-key": "shelobs_hevy_web",
          "hevy-platform": "web",
        },
      });

      if (res.ok) {
        isVerified = true;
      }
    }

    // 2. Si el token falló o expiró, pero tenemos refresh_token, intentar refrescarlo de inmediato
    if (!isVerified && refreshToken) {
      const refreshRes = await fetch("https://api.hevyapp.com/auth/refresh_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "shelobs_hevy_web",
          "Hevy-Platform": "web",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "x-client-time": String(Math.floor(Date.now() / 1000)),
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          refreshToken = refreshData.refresh_token || refreshToken;
          expiresAt = refreshData.expires_at || expiresAt;
          if (refreshData.user_id) userId = refreshData.user_id;
          isVerified = true;
        }
      }
    }

    if (!isVerified || !token) {
      return {
        success: false,
        error: "El token o sesión de Hevy no es válida o ha caducado por completo.",
      };
    }

    // 3. Si falta el username, obtenerlo de user_preferences
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

    // 4. Guardar en SQLite con tokens de refresco
    await saveHevyAuthTokens({
      accessToken: token,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
      userId: userId,
      username: username,
      email: params.email,
    });

    return {
      success: true,
      userId: userId || undefined,
      username: username || undefined,
      hasRefreshToken: Boolean(refreshToken),
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
 * Si el token está próximo a expirar o expirado, lo refresca de forma transparente antes de sincronizar.
 */
export async function syncHevyWorkouts(): Promise<{
  success: boolean;
  result?: ImportResult;
  error?: string;
}> {
  let authRecord = await getHevyAuthRecord();
  if (!authRecord.isAuthenticated || !authRecord.accessToken) {
    return {
      success: false,
      error: "No hay una cuenta de Hevy conectada. Inicia sesión primero.",
    };
  }

  // Refresco proactivo si el token expira pronto (< 2 minutos) o ya expiró
  if (authRecord.refreshToken && authRecord.expiresAt) {
    const expiresMs = new Date(authRecord.expiresAt).getTime();
    if (!isNaN(expiresMs) && Date.now() >= expiresMs - 120_000) {
      const refreshed = await refreshHevySession();
      if (refreshed.success && refreshed.accessToken) {
        authRecord = await getHevyAuthRecord();
      }
    }
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // 1. Descargar entrenamientos usando el token guardado
  const apiRes = await fetchAllWorkoutsViaApi(authRecord.accessToken!);
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
