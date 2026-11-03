import { spawn } from "node:child_process";
import path from "node:path";
import { ScaleMeasurementRecord } from "./xiaomi-db";

const SCRIPT_PATH = path.join(process.cwd(), "services", "xiaomi_service.py");

interface PythonResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runPython(args: string[], timeoutMs = 25000): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_PATH || "python3";
    const proc = spawn(/*turbopackIgnore: true*/ pythonBin, [SCRIPT_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Timeout al ejecutar servicio de Xiaomi (${timeoutMs}ms)`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export interface StartQrResponse {
  success: boolean;
  loginUrl: string;
  qrImageUrl: string;
  lpUrl: string;
  error?: string;
}

export async function startXiaomiQr(): Promise<StartQrResponse> {
  const res = await runPython(["start_qr"], 18000);
  if (res.code !== 0 && !res.stdout) {
    throw new Error(res.stderr || "Error al iniciar flujo de código QR de Xiaomi");
  }

  const json = JSON.parse(res.stdout);
  if (!json.success) {
    throw new Error(json.error || "No se pudo obtener el código QR de Xiaomi");
  }

  return {
    success: true,
    loginUrl: json.login_url,
    qrImageUrl: json.qr_image_url,
    lpUrl: json.lp_url,
  };
}

export interface CheckQrResponse {
  success: boolean;
  confirmed: boolean;
  userId?: string;
  passToken?: string;
  error?: string;
}

export async function checkXiaomiQr(lpUrl: string): Promise<CheckQrResponse> {
  const res = await runPython(["check_qr", "--lp-url", lpUrl], 12000);
  if (!res.stdout) {
    return { success: false, confirmed: false, error: res.stderr || "Error al verificar QR" };
  }

  try {
    const json = JSON.parse(res.stdout);
    return {
      success: Boolean(json.success),
      confirmed: Boolean(json.confirmed),
      userId: json.user_id,
      passToken: json.pass_token,
      error: json.error,
    };
  } catch (e: any) {
    return { success: false, confirmed: false, error: e.message };
  }
}

export interface SyncXiaomiResult {
  success: boolean;
  records: ScaleMeasurementRecord[];
  count: number;
  error?: "SESSION_EXPIRED" | "SYNC_FAILED" | string;
  message?: string;
}

export async function syncXiaomiScale(
  userId: string,
  passToken: string,
  region = "de",
  model = "yunmai.scales.ms104",
  sinceMs = 0
): Promise<SyncXiaomiResult> {
  const args = [
    "sync",
    "--user-id",
    userId,
    "--pass-token",
    passToken,
    "--region",
    region,
    "--model",
    model,
    "--since",
    String(sinceMs),
  ];

  const res = await runPython(args, 60000);

  if (res.stdout) {
    try {
      const json = JSON.parse(res.stdout);
      if (json.error === "SESSION_EXPIRED") {
        return {
          success: false,
          records: [],
          count: 0,
          error: "SESSION_EXPIRED",
          message: json.message || "La sesión de Xiaomi ha caducado.",
        };
      }

      if (!json.success) {
        return {
          success: false,
          records: [],
          count: 0,
          error: json.error || "SYNC_FAILED",
          message: json.message || "Error al sincronizar con Xiaomi Cloud",
        };
      }

      return {
        success: true,
        records: json.records || [],
        count: json.count || (json.records ? json.records.length : 0),
      };
    } catch (e: any) {
      // ignore, caer al fallback
    }
  }

  if (res.code === 2 || res.stderr.includes("SESSION_EXPIRED") || res.stderr.includes("PermissionError")) {
    return {
      success: false,
      records: [],
      count: 0,
      error: "SESSION_EXPIRED",
      message: "Sesión caducada en Xiaomi Cloud.",
    };
  }

  throw new Error(res.stderr || "Error desconocido al ejecutar sincronización de Xiaomi.");
}
