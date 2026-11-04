import { NextResponse } from "next/server";
import { syncHevyWorkouts } from "@/lib/hevy-client";

export async function POST() {
  try {
    const syncRes = await syncHevyWorkouts();

    if (!syncRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: syncRes.error || "No se pudo sincronizar con Hevy",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización completada: ${syncRes.result?.newWorkouts || 0} nuevos entrenamientos importados.`,
      result: syncRes.result,
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error in Hevy sync route:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al sincronizar con Hevy",
      },
      { status: 500 }
    );
  }
}

