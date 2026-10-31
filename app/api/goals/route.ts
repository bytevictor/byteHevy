import { NextResponse } from "next/server";
import { getGoals, saveGoal, deleteGoal } from "@/lib/actions";

export async function GET(request: Request) {
  try {
    const goals = await getGoals();
    return NextResponse.json({ success: true, data: goals });
  } catch (error: any) {
    console.error("Failed to fetch goals:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await saveGoal(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Failed to save goal:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }
    await deleteGoal(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete goal:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
