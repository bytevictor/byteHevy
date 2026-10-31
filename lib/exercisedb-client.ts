import { ExerciseMedia, MuscleGroup } from "@/types/exercise-media";
import { getDb, ensureSchema } from "./db";
import { getExerciseMedia as getLocalFallbackMedia } from "./exercise-media";
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
 * Normaliza nombres de Hevy a términos de búsqueda reconocidos por ExerciseDB:
 * Ej: "Chest Press (Machine)" -> "lever chest press" o "chest press"
 * "Pull Up (Weighted)" -> "pull up"
 * "Curl Antebrazo (Sulek Curl)" -> "wrist curl"
 */
export function normalizeExerciseNameForApi(name: string): string {
  const lower = name.toLowerCase().trim();

  if (lower.includes("chest press")) return "lever chest press";
  if (lower.includes("pull up") || lower.includes("dominada")) return "pull-up";
  if (lower.includes("cable row") || lower.includes("seated row")) return "cable seated row";
  if (lower.includes("shoulder press")) return "lever shoulder press";
  if (lower.includes("triceps pushdown") || lower.includes("triceps cable")) return "cable pushdown";
  if (lower.includes("dead hang")) return "dead hang";
  if (lower.includes("preacher curl")) return "dumbbell preacher curl";
  if (lower.includes("bicep curl")) return "dumbbell bicep curl";
  if (lower.includes("triceps dip") || lower.includes("dip")) return "chest dip";
  if (lower.includes("leg press")) return "sled horizontal leg press";
  if (lower.includes("leg extension")) return "lever leg extension";
  if (lower.includes("leg curl")) return "lever lying leg curl";
  if (lower.includes("sulek") || lower.includes("antebrazo")) return "dumbbell seated palms up wrist curl";
  if (lower.includes("treadmill") || lower.includes("cinta")) return "running treadmill";
  if (lower.includes("pec deck") || lower.includes("butterfly")) return "lever seated fly";
  if (lower.includes("front lever")) return "front lever";
  if (lower.includes("push up")) return "push-up";

  // Quitar paréntesis típicos de Hevy: " (Machine)", " (Weighted)", " (Dumbbell)"
  return lower.replace(/\s*\([^)]*\)/g, "").trim();
}

/**
 * Obtiene la información visual desde ExerciseDB API con persistencia local en SQLite.
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

  // 2. Comprobar caché local
  const cached = await db.execute({
    sql: "SELECT data_json FROM exercisedb_cache WHERE exercise_name = ?",
    args: [cacheKey],
  });

  if (cached.rows.length > 0 && cached.rows[0].data_json) {
    try {
      return JSON.parse(String(cached.rows[0].data_json)) as ExerciseMedia;
    } catch {
      // Si el JSON falla, continuar con fetch
    }
  }

  // 3. Fallback si no hay API key configurada
  const apiKey = process.env.EXERCISEDB_API_KEY || process.env.RAPIDAPI_KEY;
  const apiHost = process.env.EXERCISEDB_API_HOST || "exercisedb.p.rapidapi.com";
  const baseUrl = process.env.EXERCISEDB_API_URL || `https://${apiHost}`;

  if (!apiKey) {
    // Usar catálogo offline integrado y persistir sus archivos en local
    const fallback = getLocalFallbackMedia(exerciseName);
    const localized = await localizeExerciseMedia(fallback);

    await db.execute({
      sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
            VALUES (?, ?, strftime('%s', 'now'))`,
      args: [cacheKey, JSON.stringify(localized)],
    });

    return localized;
  }

  // 4. Consultar ExerciseDB API
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
      console.warn(`ExerciseDB API HTTP ${response.status} for "${queryTerm}", usando fallback`);
      const fallback = getLocalFallbackMedia(exerciseName);
      const localized = await localizeExerciseMedia(fallback);
      return localized;
    }

    const items: ExerciseDbItem[] = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      const fallback = getLocalFallbackMedia(exerciseName);
      const localized = await localizeExerciseMedia(fallback);
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
      videoUrl: item.videoUrl,
      posterUrl: item.gifUrl,
      difficulty: "intermediate",
    };

    // 5. Descargar los ficheros (video/gif/poster) a public/media/exercises/
    const localized = await localizeExerciseMedia(mediaResult);

    // 6. Guardar en SQLite caché para consultas futuras (0ms y 0 peticiones posteriores)
    await db.execute({
      sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
            VALUES (?, ?, strftime('%s', 'now'))`,
      args: [cacheKey, JSON.stringify(localized)],
    });

    return localized;
  } catch (error) {
    console.error(`Error al conectar con ExerciseDB API para "${exerciseName}":`, error);
    const fallback = getLocalFallbackMedia(exerciseName);
    return await localizeExerciseMedia(fallback);
  }
}
