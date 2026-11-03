import { NextResponse } from "next/server";
import { getXiaomiAuthRecord, disconnectXiaomiAuth, getLatestScaleMeasurementTimestamp } from "@/lib/xiaomi-db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getXiaomiAuthRecord();
    const lastTs = auth.lastSyncTimestampMs > 0 ? auth.lastSyncTimestampMs : await getLatestScaleMeasurementTimestamp();

    let formattedLastSync: string | null = null;
    if (lastTs > 0) {
      const dt = new Date(lastTs);
      formattedLastSync = dt.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return NextResponse.json(
      {
        success: true,
        is_connected: auth.isAuthenticated && Boolean(auth.passToken),
        last_sync: formattedLastSync,
        last_sync_timestamp_ms: lastTs,
        user_id: auth.userId,
        region: auth.region,
        scale_model: auth.scaleModel,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error fetching Xiaomi status:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener estado de Xiaomi" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "disconnect") {
      await disconnectXiaomiAuth();
      return NextResponse.json({
        success: true,
        message: "Sesión de Xiaomi cerrada y tokens eliminados de la base de datos.",
      });
    }

    return NextResponse.json({ success: false, error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar solicitud" },
      { status: 500 }
    );
  }
}
