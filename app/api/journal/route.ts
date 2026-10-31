import { NextResponse } from "next/server";
import { getJournalWorkouts } from "@/lib/actions";

export async function GET() {
  try {
    const journal = await getJournalWorkouts();
    return NextResponse.json({ success: true, data: journal });
  } catch (error: any) {
    console.error("Failed to fetch journal workouts:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

