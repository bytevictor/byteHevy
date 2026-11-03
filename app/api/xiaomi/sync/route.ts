import { NextResponse } from "next/server";
import {
  getXiaomiAuthRecord,
  getLatestScaleMeasurementTimestamp,
  saveScaleMeasurements,
  setXiaomiAuthExpired,
} from "@/lib/xiaomi-db";
import { syncXiaomiScale } from "@/lib/xiaomi-client";

export async function POST(request: Request) {
  try {
    const auth = await getXiaomiAuthRecord();

    if (!auth.isAuthenticated || !auth.passToken || !auth.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "NOT_AUTHENTICATED",
          message: "No hay sesión iniciada en Xiaomi. Conéctate primero mediante el código QR.",
        },
        { status: 401 }
      );
    }

    // Obtener el último timestamp registrado en la base de datos para sincronización incremental
    const lastTimestamp = await getLatestScaleMeasurementTimestamp();

    // Sincronizar con el servicio de Xiaomi
    const syncRes = await syncXiaomiScale(
      auth.userId,
      auth.passToken,
      auth.region,
      auth.scaleModel,
      lastTimestamp
    );

    if (!syncRes.success) {
      if (syncRes.error === "SESSION_EXPIRED") {
        await setXiaomiAuthExpired();
        return NextResponse.json(
          {
            success: false,
            error: "SESSION_EXPIRED",
            message: "La sesión de Xiaomi ha caducado. Vuelve a iniciar sesión con el código QR.",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: syncRes.error || "SYNC_FAILED",
          message: syncRes.message || "Error al sincronizar con Xiaomi Cloud",
        },
        { status: 500 }
      );
    }

    // Guardar los nuevos registros tanto en scale_measurements como en weight_records
    const saveResult = await saveScaleMeasurements(syncRes.records);

    let lastSyncFormatted: string | null = null;
    if (saveResult.lastTimestampMs > 0) {
      lastSyncFormatted = new Date(saveResult.lastTimestampMs).toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return NextResponse.json({
      success: true,
      new_count: saveResult.insertedCount,
      last_sync: lastSyncFormatted,
      last_sync_timestamp_ms: saveResult.lastTimestampMs || auth.lastSyncTimestampMs,
      message:
        saveResult.insertedCount > 0
          ? `Se han sincronizado ${saveResult.insertedCount} pesaje(s) nuevos de Xiaomi Cloud.`
          : "Tu historial ya está al día. No hay pesajes nuevos en Xiaomi Cloud.",
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error in Xiaomi sync route:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message || "Error interno al sincronizar con Xiaomi",
      },
      { status: 500 }
    );
  }
}
