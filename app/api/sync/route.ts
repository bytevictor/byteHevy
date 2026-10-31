import { NextResponse } from "next/server";
import { importCsvToDb } from "@/lib/csv-parser";
import { clearDatabase } from "@/lib/actions";

export async function POST(request: Request) {
  try {
    const { csvText } = await request.json();
    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ success: false, error: "Contenido CSV inválido" }, { status: 400 });
    }
    const result = await importCsvToDb(csvText);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Failed to import CSV:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearDatabase();
    return NextResponse.json({ success: true, message: "Base de datos reiniciada" });
  } catch (error: any) {
    console.error("Failed to clear database:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

