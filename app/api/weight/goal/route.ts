import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getWeightGoal, saveWeightGoal, deleteWeightGoal } from "@/lib/actions";

export async function GET() {
  try {
    const goal = await getWeightGoal();
    const db = getDb();
    const latestRes = await db.execute({
      sql: "SELECT weight, date, timestamp FROM weight_records ORDER BY timestamp DESC LIMIT 1",
    });
    const latestRow = latestRes.rows[0] as any;
    const latestWeight = latestRow
      ? { weight: Number(latestRow.weight), date: String(latestRow.date) }
      : null;

    return NextResponse.json(
      { success: true, data: goal, latestWeight },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Failed to fetch weight goal:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body.targetWeight !== "number" || isNaN(body.targetWeight)) {
      return NextResponse.json(
        { success: false, error: "El peso objetivo debe ser un número válido." },
        { status: 400 }
      );
    }
    const result = await saveWeightGoal(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Failed to save weight goal:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await deleteWeightGoal();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete weight goal:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
