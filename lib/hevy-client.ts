import { chromium, type Browser } from "playwright";
import fs from "node:fs";
import path from "node:path";
import {
  getHevyAuthRecord,
  saveHevyAuthTokens,
  updateHevyLastSync,
  disconnectHevyAuth,
  HevyAuthRecord,
} from "./hevy-db";
import { importCsvToDb, ImportResult } from "./csv-parser";

const SESSION_DIR = path.join(process.cwd(), "data");
const SESSION_FILE = path.join(SESSION_DIR, "hevy_session.json");

/**
 * Convierte un array de entrenamientos devueltos por la API de Hevy
 * (tanto /workouts_batch interno como /v1/workouts oficial) al formato CSV estándar para su ingesta.
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
    const title = (w.name || w.title || "Entrenamiento").trim();

    let startDate = "";
    if (typeof w.start_time === "number") {
      startDate = new Date(w.start_time > 1e11 ? w.start_time : w.start_time * 1000).toISOString();
    } else if (w.start_time) {
      startDate = new Date(w.start_time).toISOString();
    } else {
      startDate = new Date().toISOString();
    }

    let endDate = startDate;
    if (typeof w.end_time === "number") {
      endDate = new Date(w.end_time > 1e11 ? w.end_time : w.end_time * 1000).toISOString();
    } else if (w.end_time) {
      endDate = new Date(w.end_time).toISOString();
    }

    const description = (w.description || "").trim();

    if (w.exercises && Array.isArray(w.exercises)) {
      for (const ex of w.exercises) {
        const exTitle = (ex.title || ex.name || "Ejercicio").trim();
        const supersetId = ex.superset_id != null ? String(ex.superset_id) : "";
        const notes = (ex.notes || "").trim();

        if (ex.sets && Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            const setIndex = s.index != null ? s.index : 0;
            const setType = s.type || s.indicator || "normal";
            const weightKg = s.weight_kg != null ? s.weight_kg : "";
            const reps = s.reps != null ? s.reps : "";
            const distanceKm =
              s.distance_meters != null
                ? (s.distance_meters / 1000).toFixed(2)
                : (s.distance_km != null ? s.distance_km : "");
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
 * o API Key directamente mediante HTTP fetch. Soporta tanto la Developer API
 * oficial (/v1/workouts) como la API interna web (/workouts_batch).
 */
async function fetchAllWorkoutsViaApi(
  accessToken: string
): Promise<{ success: boolean; csvText?: string; error?: string; status?: number }> {
  try {
    const allWorkouts: any[] = [];

    // 1. Probar primero si es una Developer API Key oficial (GET /v1/workouts)
    try {
      const testDevRes = await fetch("https://api.hevyapp.com/v1/workouts?page=1&pageSize=10", {
        headers: {
          "api-key": accessToken,
          Accept: "application/json",
        },
      });

      if (testDevRes.ok) {
        const firstPage = await testDevRes.json();
        if (firstPage && Array.isArray(firstPage.workouts)) {
          allWorkouts.push(...firstPage.workouts);
        }
        const pageCount = Number(firstPage.page_count) || 1;
        for (let p = 2; p <= pageCount; p++) {
          const pageRes = await fetch(`https://api.hevyapp.com/v1/workouts?page=${p}&pageSize=10`, {
            headers: {
              "api-key": accessToken,
              Accept: "application/json",
            },
          });
          if (pageRes.ok) {
            const pageData = await pageRes.json();
            if (pageData && Array.isArray(pageData.workouts)) {
              allWorkouts.push(...pageData.workouts);
            }
          }
        }

        const csvText = workoutsBatchToCsv(allWorkouts);
        return { success: true, csvText };
      }
    } catch {}

    // 2. Si no es API Key oficial, usar el endpoint de Web App (/workouts_batch)
    let lastIndex = 0;
    while (true) {
      const res = await fetch(
        `https://api.hevyapp.com/workouts_batch/${lastIndex}`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
            "x-api-key": "shelobs_hevy_web",
            "hevy-platform": "web",
          },
        }
      );

      if (res.status === 401 || res.status === 403) {
        return { success: false, status: res.status, error: "Token o API Key de acceso expirado o inválido" };
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
    return { success: false, error: err.message || "Error al conectar con la API de Hevy" };
  }
}

/**
 * Valida y guarda un token o Developer API Key de Hevy introducido directamente por el usuario.
 * No requiere navegador ni Playwright; funciona 100% en servidores headless/LXC.
 */
export async function connectWithToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  username?: string;
  error?: string;
}> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, error: "El token o API Key no puede estar vacío." };
  }

  // 1. Probar como Developer API Key oficial (/v1/workouts)
  try {
    const devRes = await fetch("https://api.hevyapp.com/v1/workouts?page=1&pageSize=1", {
      headers: {
        "api-key": cleanToken,
        Accept: "application/json",
      },
    });

    if (devRes.ok) {
      await saveHevyAuthTokens({
        accessToken: cleanToken,
        username: "Developer API",
      });
      return {
        success: true,
        username: "Developer API",
      };
    }
  } catch {}

  // 2. Probar como Bearer token web (/workouts_batch)
  try {
    const webRes = await fetch("https://api.hevyapp.com/workouts_batch/0", {
      headers: {
        authorization: `Bearer ${cleanToken}`,
        "x-api-key": "shelobs_hevy_web",
        "hevy-platform": "web",
      },
    });

    if (webRes.ok) {
      await saveHevyAuthTokens({
        accessToken: cleanToken,
        username: "Sesión Web",
      });
      return {
        success: true,
        username: "Sesión Web",
      };
    }
  } catch {}

  return {
    success: false,
    error:
      "El token o API Key introducido no es válido o ha expirado. Por favor, verifica que lo hayas copiado correctamente desde la app de Hevy (Ajustes ➔ Developer API) o hevy.com.",
  };
}

/**
 * Lanza una ventana interactiva de Chromium para que el usuario inicie sesión en Hevy.
 * Captura el token devuelto por Hevy, guarda la sesión en SQLite y data/hevy_session.json,
 * y cierra la ventana automáticamente.
 */
export async function launchHevyLogin(): Promise<{
  success: boolean;
  userId?: string;
  username?: string;
  error?: string;
}> {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({
        headless: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
    } catch (launchErr: any) {
      const msg = String(launchErr?.message || launchErr || "");
      if (
        msg.includes("Executable doesn't exist") ||
        msg.includes("playwright install") ||
        msg.includes("Target closed") ||
        msg.includes("Missing X server") ||
        msg.includes("DISPLAY")
      ) {
        return {
          success: false,
          error:
            "En este entorno de servidor (despliegue headless/LXC) no hay un navegador gráfico disponible para inicio de sesión interactivo. Por favor, introduce tu API Key oficial de Hevy (en tu app móvil: Ajustes ➔ Developer API) o introduce tu token directamente.",
        };
      }
      throw launchErr;
    }

    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 850 },
    });

    const page = await context.newPage();

    let capturedUserId: string | null = null;
    let capturedAccessToken: string | null = null;
    let capturedRefreshToken: string | null = null;
    let capturedExpiresAt: string | null = null;
    let capturedUsername: string | null = null;

    // Escuchar respuestas de red para capturar el login y username
    page.on("response", async (res) => {
      const url = res.url();

      if (url.includes("api.hevyapp.com/login") && res.status() >= 200 && res.status() < 300) {
        try {
          const json = await res.json();
          capturedUserId = json.user_id || null;
          capturedAccessToken = json.access_token || null;
          capturedRefreshToken = json.refresh_token || null;
          capturedExpiresAt = json.expires_at || null;
        } catch {}
      }

      if (url.includes("user_workouts_paged") || url.includes("user_preferences")) {
        try {
          const parsedUrl = new URL(url);
          const u = parsedUrl.searchParams.get("username");
          if (u) capturedUsername = u;
        } catch {}
      }
    });

    await page.goto("https://hevy.com/login", { waitUntil: "networkidle" });

    // Esperar a que el usuario complete el login (la URL cambia o recibimos token)
    const loginSuccess = await new Promise<boolean>((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          if (!browser || !browser.isConnected()) {
            clearInterval(checkInterval);
            resolve(false);
            return;
          }

          const currentUrl = page.url();
          if (capturedAccessToken && !currentUrl.includes("/login")) {
            clearInterval(checkInterval);
            await page.waitForTimeout(1500);
            resolve(true);
          }
        } catch {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);

      browser?.on("disconnected", () => {
        clearInterval(checkInterval);
        resolve(Boolean(capturedAccessToken));
      });

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 5 * 60 * 1000);
    });

    if (!loginSuccess || !capturedAccessToken) {
      if (browser.isConnected()) await browser.close();
      return {
        success: false,
        error: "El inicio de sesión fue cancelado o no se detectó el token de Hevy.",
      };
    }

    // Guardar el estado de la sesión completa de Playwright (cookies + localStorage)
    await context.storageState({ path: SESSION_FILE });

    // Guardar en la base de datos SQLite
    await saveHevyAuthTokens({
      userId: capturedUserId,
      accessToken: capturedAccessToken,
      refreshToken: capturedRefreshToken,
      expiresAt: capturedExpiresAt,
      username: capturedUsername,
    });

    if (browser.isConnected()) {
      await browser.close();
    }

    return {
      success: true,
      userId: capturedUserId || undefined,
      username: capturedUsername || undefined,
    };
  } catch (err: any) {
    if (browser && browser.isConnected()) {
      try {
        await browser.close();
      } catch {}
    }
    return {
      success: false,
      error: err.message || "Error al iniciar sesión con Hevy.",
    };
  }
}

/**
 * Sincroniza entrenamientos desde Hevy usando el token guardado en SQLite.
 * Intenta primero la vía rápida de API directa (1-2s).
 * Si requiere regenerar sesión, recurre a Playwright headless.
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

  // 1. Intentar la vía directa de API con el accessToken guardado
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

  // 2. Si la API devolvió 401 (token expirado) y tenemos sesión de Playwright en disco, intentar vía headless
  if (apiRes.status === 401 && fs.existsSync(SESSION_FILE)) {
    let browser: Browser | null = null;
    try {
      try {
        browser = await chromium.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        });
      } catch {
        // En servidores sin Playwright instalado, marcar como expirado para reconexión con API Key
        await disconnectHevyAuth();
        return {
          success: false,
          error:
            "La sesión o API Key de Hevy ha expirado. Por favor, renueva tu API Key o Token desde los ajustes de Hevy.",
        };
      }

      const context = await browser.newContext({
        storageState: SESSION_FILE,
        acceptDownloads: true,
      });

      const page = await context.newPage();

      let refreshedToken: string | null = null;
      page.on("response", async (res) => {
        if (res.url().includes("api.hevyapp.com/login") && res.ok()) {
          try {
            const j = await res.json();
            if (j.access_token) refreshedToken = j.access_token;
          } catch {}
        }
      });

      await page.goto("https://hevy.com/settings?export=", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      if (page.url().includes("/login")) {
        await disconnectHevyAuth();
        await browser.close();
        return {
          success: false,
          error: "La sesión de Hevy ha expirado. Por favor, vuelve a conectar tu cuenta.",
        };
      }

      const exportBtn = page
        .locator(
          'button:has-text("Export Workouts"), button:has-text("Exportar entrenamientos"), button:has-text("Export Data"), button:has-text("Exportar datos"), button:has-text("Export"), button:has-text("Exportar")'
        )
        .first();

      await exportBtn.waitFor({ state: "visible", timeout: 15000 });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 45000 }),
        exportBtn.click(),
      ]);

      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const csvText = Buffer.concat(chunks).toString("utf-8");

      // Si se refrescó el token, actualizarlo
      if (refreshedToken) {
        await saveHevyAuthTokens({ accessToken: refreshedToken });
      }

      await context.storageState({ path: SESSION_FILE });
      await browser.close();

      const importResult = await importCsvToDb(csvText);
      await updateHevyLastSync(Date.now(), importResult.newWorkouts);

      return { success: true, result: importResult };
    } catch (err: any) {
      if (browser && browser.isConnected()) {
        try {
          await browser.close();
        } catch {}
      }
      return {
        success: false,
        error: `Error al sincronizar con Hevy: ${err.message || err}`,
      };
    }
  }

  if (apiRes.status === 401) {
    await disconnectHevyAuth();
    return {
      success: false,
      error: "La sesión de Hevy ha expirado. Por favor, vuelve a iniciar sesión con 1 clic.",
    };
  }

  return {
    success: false,
    error: apiRes.error || "No se pudo sincronizar los entrenamientos con Hevy.",
  };
}
