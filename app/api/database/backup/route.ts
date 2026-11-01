import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb, ensureSchema } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    await ensureSchema(db);

    // Flush any pending WAL pages to the primary database file
    try {
      await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch (e) {
      console.warn("[Backup] Advertencia en wal_checkpoint:", e);
    }

    const dbPath = path.join(process.cwd(), "data", "bytehevy.db");
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { success: false, error: "El archivo de base de datos bytehevy.db no existe aún." },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `bytehevy-backup-${dateStr}.db`;

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[Backup] Error al exportar base de datos:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al exportar base de datos" },
      { status: 500 }
    );
  }
}
