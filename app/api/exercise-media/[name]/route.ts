import { NextResponse } from "next/server";
import { fetchExerciseMediaFromApi } from "@/lib/exercisedb-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);
    const media = await fetchExerciseMediaFromApi(decodedName);
    return NextResponse.json({ success: true, data: media });
  } catch (error: any) {
    console.error("Failed to fetch exercise media:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

