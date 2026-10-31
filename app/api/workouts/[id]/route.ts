import { NextRequest, NextResponse } from "next/server";
import { getWorkoutDetail } from "@/lib/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workout = await getWorkoutDetail(id);

    if (!workout) {
      return NextResponse.json(
        { success: false, error: "Entrenamiento no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: workout });
  } catch (error: any) {
    console.error("Error fetching workout detail:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

