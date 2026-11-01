import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb, ensureSchema } from "@/lib/db";
import { ExerciseMedia } from "@/types/exercise-media";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const exerciseName = formData.get("exerciseName") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo de imagen." },
        { status: 400 }
      );
    }

    ensureMediaDir();

    const fileName = file.name;
    // Sanitizar el nombre del fichero
    const ext = path.extname(fileName).toLowerCase() || ".gif";
    const baseName = path.basename(fileName, ext);

    const safeBaseName = (exerciseName || baseName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_");

    const finalFileName = `${safeBaseName}_anim${ext}`;
    const targetPath = path.join(MEDIA_DIR, finalFileName);
    const publicUrl = `/media/exercises/${finalFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));

    // Si se especificó un exerciseName, actualizar la caché en SQLite
    if (exerciseName) {
      const db = getDb();
      await ensureSchema(db);
      const cacheKey = exerciseName.toLowerCase().trim();

      const existingRes = await db.execute({
        sql: "SELECT data_json FROM exercisedb_cache WHERE exercise_name = ?",
        args: [cacheKey],
      });

      let mediaObj: Partial<ExerciseMedia> = {};
      if (existingRes.rows.length > 0) {
        try {
          mediaObj = JSON.parse(String(existingRes.rows[0].data_json));
        } catch {}
      }

      mediaObj.gifUrl = publicUrl;
      mediaObj.posterUrl = publicUrl;

      await db.execute({
        sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at)
              VALUES (?, ?, strftime('%s', 'now'))`,
        args: [cacheKey, JSON.stringify(mediaObj)],
      });
    }

    return NextResponse.json({
      success: true,
      message: "Imagen guardada correctamente en el almacenamiento local",
      data: {
        fileName: finalFileName,
        url: publicUrl,
        sizeBytes: arrayBuffer.byteLength,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[MediaUpload] Error subiendo imagen:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al subir imagen" },
      { status: 500 }
    );
  }
}
