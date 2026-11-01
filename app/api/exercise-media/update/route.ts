import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb, ensureSchema } from "@/lib/db";
import { ExerciseMedia } from "@/types/exercise-media";
import { mapCategoryToMuscleGroup, detectEquipmentFromTitle } from "@/lib/exercise-catalog";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exerciseName, gifUrl, title, category } = body;

    if (!exerciseName || !gifUrl) {
      return NextResponse.json(
        { success: false, error: "exerciseName y gifUrl son requeridos" },
        { status: 400 }
      );
    }

    ensureMediaDir();

    // 1. Sanitizar nombre de ejercicio para el archivo local
    const sanitized = exerciseName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_");

    const fileName = `${sanitized}_anim.gif`;
    const localFilePath = path.join(MEDIA_DIR, fileName);
    const localPublicUrl = `/media/exercises/${fileName}`;

    let finalGifUrl = localPublicUrl;
    let savedLocally = false;

    // 2. Descargar el archivo localmente si es una URL remota
    if (gifUrl.startsWith("http")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(gifUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "ByteHevy-ArtworkDownloader/1.0",
          },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(localFilePath, buffer);
          savedLocally = true;
          finalGifUrl = localPublicUrl;
          console.log(`[ExerciseMedia] Descargado y guardado en: ${localFilePath}`);
        } else {
          console.warn(`[ExerciseMedia] HTTP ${res.status} al descargar ${gifUrl}, usando URL remota.`);
          finalGifUrl = gifUrl;
        }
      } catch (dlError) {
        console.warn(`[ExerciseMedia] Error al descargar ${gifUrl}:`, dlError);
        // Si ya existía un archivo en disco, lo usamos; si no, dejamos la URL remota como fallback
        if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
          finalGifUrl = localPublicUrl;
          savedLocally = true;
        } else {
          finalGifUrl = gifUrl;
        }
      }
    } else {
      // Ya es una ruta local
      finalGifUrl = gifUrl;
      savedLocally = true;
    }

    // 3. Crear el objeto ExerciseMedia
    const primaryMuscle = mapCategoryToMuscleGroup(category || "");
    const equipment = detectEquipmentFromTitle(title || exerciseName);

    const updatedMedia: ExerciseMedia = {
      id: `custom-${sanitized}`,
      name: exerciseName,
      aliases: [exerciseName, title || ""].filter(Boolean),
      primaryMuscle,
      secondaryMuscles: [],
      equipment,
      gifUrl: finalGifUrl,
      cdnUrl: gifUrl.startsWith("http") ? gifUrl : undefined,
      posterUrl: finalGifUrl,
      difficulty: "intermediate",
    };

    // 4. Guardar en SQLite (tabla exercisedb_cache)
    const db = getDb();
    await ensureSchema(db);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS exercisedb_cache (
        exercise_name TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    const cacheKey = exerciseName.toLowerCase().trim();

    await db.execute({
      sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
            VALUES (?, ?, strftime('%s', 'now'))`,
      args: [cacheKey, JSON.stringify(updatedMedia)],
    });

    console.log(`[ExerciseMedia] Caché SQLite actualizado para: "${cacheKey}"`);

    return NextResponse.json({
      success: true,
      message: "Carátula actualizada y asignada correctamente",
      savedLocally,
      localPublicUrl: finalGifUrl,
      data: updatedMedia,
    });
  } catch (error: any) {
    console.error("[ExerciseMedia] Error al actualizar carátula:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al actualizar la carátula" },
      { status: 500 }
    );
  }
}

