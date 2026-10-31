import { NextResponse } from "next/server";
import { getExercisesList } from "@/lib/actions";

export async function GET() {
  try {
    const list = await getExercisesList();
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Failed to fetch exercises list:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

