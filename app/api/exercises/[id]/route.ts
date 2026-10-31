import { NextResponse } from "next/server";
import { getExerciseDetail } from "@/lib/actions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const detail = await getExerciseDetail(id, seasonId);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Ejercicio no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: detail });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Failed to fetch exercise detail:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

