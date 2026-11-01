import fs from "node:fs";
import path from "node:path";
import { ExerciseMedia, MuscleGroup } from "@/types/exercise-media";
import { getDb, ensureSchema } from "./db";
import { resolveExerciseMediaFromCatalog } from "./exercise-catalog";
import { translateExerciseNameToEnglish } from "./exercise-translator";
import { localizeExerciseMedia } from "./media-cache";

// ExerciseDB API schema interface
export interface ExerciseDbItem {
  id: string;
  name: string;
  target: string;
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  videoUrl?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
}

// Map ExerciseDB anatomical target muscles to our MuscleGroup
export function mapExerciseDbTarget(target: string, bodyPart?: string): MuscleGroup {
  const t = (target || "").toLowerCase();
  const b = (bodyPart || "").toLowerCase();

  if (t.includes("pectoral") || b.includes("chest")) return "chest";
  if (t.includes("lat") || t.includes("dorsal")) return "lats";
  if (t.includes("trap") || t.includes("rhomboid") || b.includes("back")) return "upper_back";
  if (t.includes("bicep") || t.includes("brachii")) return "biceps";
  if (t.includes("tricep")) return "triceps";
  if (t.includes("forearm") || t.includes("wrist") || t.includes("grip")) return "forearms";
  if (t.includes("delt") || b.includes("shoulder")) return "shoulders";
  if (t.includes("quad") || b.includes("upper leg")) return "quads";
  if (t.includes("hamstring") || t.includes("glute")) return "hamstrings";
  if (t.includes("calve") || b.includes("lower leg")) return "calves";
  if (t.includes("ab") || t.includes("core") || b.includes("waist")) return "abs";
  if (b.includes("cardio")) return "cardio";

  return "chest";
}

/**
 * Normaliza y traduce nombres de ejercicios (Español, Hevy, Jefit) a términos en inglés
 * reconocidos por ExerciseDB y por el catálogo anatómico 3D.
 */
export function normalizeExerciseNameForApi(name: string): string {
  const translation = translateExerciseNameToEnglish(name);
  return translation.englishQuery;
}

/**
 * Obtiene la información visual desde ExerciseDB API o el catálogo GymVisual integrado
 * con traducción en inglés y persistencia local en SQLite.
 */
export async function fetchExerciseMediaFromApi(exerciseName: string): Promise<ExerciseMedia> {
  const db = getDb();
  await ensureSchema(db);

  // 1. Asegurar tabla de caché en SQLite
  await db.execute(`
    CREATE TABLE IF NOT EXISTS exercisedb_cache (
      exercise_name TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  const cacheKey = exerciseName.toLowerCase().trim();

  // 2. Comprobar caché local existente
  const cached = await db.execute({
    sql: "SELECT data_json FROM exercisedb_cache WHERE exercise_name = ?",
    args: [cacheKey],
  });

  if (cached.rows.length > 0 && cached.rows[0].data_json) {
    try {
      const data = JSON.parse(String(cached.rows[0].data_json)) as ExerciseMedia;

      // Validar que no sea un chest press erróneo asignado por un bug anterior a ejercicios de otro músculo
      const isBogusChestPress =
        (data.gifUrl?.includes("chest-press") || data.gifUrl?.includes("lever-chest-press")) &&
        data.primaryMuscle !== "chest" &&
        !cacheKey.includes("chest") &&
        !cacheKey.includes("pecho");

      // Validar si apunta a un archivo local ausente en disco (típico en despliegue de LXC nuevo)
      let fileMissing = false;
      if (data.gifUrl?.startsWith("/media/exercises/")) {
        const localPath = path.join(process.cwd(), "public", data.gifUrl);
        if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
          fileMissing = true;
        }
      }

      if (!isBogusChestPress && !fileMissing) {
        return data;
      }
      console.log(`[ExerciseDbClient] Re-resolviendo multimedia para "${exerciseName}" (isBogusChestPress: ${isBogusChestPress}, fileMissing: ${fileMissing})`);
    } catch {
      // Si el JSON falla, continuar con fetch
    }
  }

  // 3. Fallback / Modo offline si no hay API key de RapidAPI
  const apiKey = process.env.EXERCISEDB_API_KEY || process.env.RAPIDAPI_KEY;
  const apiHost = process.env.EXERCISEDB_API_HOST || "exercisedb.p.rapidapi.com";
  const baseUrl = process.env.EXERCISEDB_API_URL || `https://${apiHost}`;

  if (!apiKey) {
    // Buscar en inglés en el catálogo offline de 1,323 GymVisual y guardar en SQLite y disco local
    const catalogMedia = resolveExerciseMediaFromCatalog(exerciseName);
    const localized = await localizeExerciseMedia(catalogMedia);

    await db.execute({
      sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
            VALUES (?, ?, strftime('%s', 'now'))`,
      args: [cacheKey, JSON.stringify(localized)],
    });

    return localized;
  }

  // 4. Consultar ExerciseDB API usando el nombre traducido al inglés
  const queryTerm = normalizeExerciseNameForApi(exerciseName);
  try {
    const url = `${baseUrl}/exercises/name/${encodeURIComponent(queryTerm)}?limit=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": apiHost,
      },
      next: { revalidate: 86400 }, // 24h caché Next.js
    });

    if (!response.ok) {
      console.warn(`ExerciseDB API HTTP ${response.status} for "${queryTerm}", usando catálogo integrado`);
      const fallback = resolveExerciseMediaFromCatalog(exerciseName);
      const localized = await localizeExerciseMedia(fallback);
      await db.execute({
        sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
              VALUES (?, ?, strftime('%s', 'now'))`,
        args: [cacheKey, JSON.stringify(localized)],
      });
      return localized;
    }

    const items: ExerciseDbItem[] = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      const fallback = resolveExerciseMediaFromCatalog(exerciseName);
      const localized = await localizeExerciseMedia(fallback);
      await db.execute({
        sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
              VALUES (?, ?, strftime('%s', 'now'))`,
        args: [cacheKey, JSON.stringify(localized)],
      });
      return localized;
    }

    const item = items[0];
    const primaryMuscle = mapExerciseDbTarget(item.target, item.bodyPart);
    const secondaryMuscles: MuscleGroup[] = (item.secondaryMuscles || []).map((m) =>
      mapExerciseDbTarget(m)
    );

    const mediaResult: ExerciseMedia = {
      id: item.id || `exdb-${queryTerm.replace(/\s+/g, "-")}`,
      name: exerciseName,
      aliases: [item.name, queryTerm],
      primaryMuscle,
      secondaryMuscles,
      equipment: item.equipment || "Gimnasio",
      gifUrl: item.gifUrl,
      cdnUrl: item.gifUrl,
      videoUrl: item.videoUrl,
      posterUrl: item.gifUrl,
      difficulty: "intermediate",
    };

    // 5. Descargar los ficheros (video/gif/poster) a public/media/exercises/
    const localized = await localizeExerciseMedia(mediaResult);

    // 6. Guardar en SQLite caché para consultas futuras
    await db.execute({
      sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
            VALUES (?, ?, strftime('%s', 'now'))`,
      args: [cacheKey, JSON.stringify(localized)],
    });

    return localized;
  } catch (error) {
    console.error(`Error al conectar con ExerciseDB API para "${exerciseName}":`, error);
    const fallback = resolveExerciseMediaFromCatalog(exerciseName);
    const localized = await localizeExerciseMedia(fallback);
    await db.execute({
      sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
            VALUES (?, ?, strftime('%s', 'now'))`,
      args: [cacheKey, JSON.stringify(localized)],
    });
    return localized;
  }
}
