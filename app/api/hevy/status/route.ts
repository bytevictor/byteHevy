import { NextResponse } from "next/server";
import { getHevyAuthRecord, disconnectHevyAuth } from "@/lib/hevy-db";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const auth = await getHevyAuthRecord();

    let formattedLastSync: string | null = null;
    if (auth.lastSyncTimestamp > 0) {
      const dt = new Date(auth.lastSyncTimestamp);
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
        is_connected: auth.isAuthenticated && Boolean(auth.accessToken),
        last_sync: formattedLastSync,
        last_sync_timestamp: auth.lastSyncTimestamp,
        last_sync_workouts_count: auth.lastSyncWorkoutsCount,
        user_id: auth.userId,
        username: auth.username,
        email: auth.email,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error fetching Hevy status:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener estado de Hevy" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "disconnect") {
      await disconnectHevyAuth();

      // Eliminar archivo de sesión en disco si existe
      const sessionFile = path.join(process.cwd(), "data", "hevy_session.json");
      if (fs.existsSync(sessionFile)) {
        try {
          fs.unlinkSync(sessionFile);
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: "Cuenta de Hevy desconectada correctamente",
      });
    }

    return NextResponse.json(
      { success: false, error: "Acción no reconocida" },
      { status: 400 }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error in Hevy status POST:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar acción" },
      { status: 500 }
    );
  }
}

