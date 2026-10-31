import { NextResponse } from "next/server";
import { getExercisesList } from "@/lib/actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const list = await getExercisesList(seasonId);
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Failed to fetch exercises list:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
