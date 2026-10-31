import { NextResponse } from "next/server";
import { getExerciseDetail } from "@/lib/actions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const detail = await getExerciseDetail(id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Ejercicio no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: detail });
  } catch (error: any) {
    console.error("Failed to fetch exercise detail:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

