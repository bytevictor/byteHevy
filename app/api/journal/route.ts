import { NextResponse } from "next/server";
import { getJournalWorkouts } from "@/lib/actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const journal = await getJournalWorkouts(seasonId);
    return NextResponse.json({ success: true, data: journal });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Failed to fetch journal workouts:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
