import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb, ensureSchema } from "@/lib/db";
import { resolveExerciseMediaFromCatalog } from "@/lib/exercise-catalog";
import { localizeExerciseMedia } from "@/lib/media-cache";
import { ExerciseMedia } from "@/types/exercise-media";

export async function GET(request: Request) {
  try {
    const db = getDb();
    await ensureSchema(db);

    // 1. Obtener lista de ejercicios ordenados por frecuencia de uso (más sesiones primero)
    const exercisesRes = await db.execute(`
      SELECT e.id, e.name, e.metric_type, 
             COUNT(DISTINCT we.workout_id) as session_count,
             COALESCE(MAX(w.start_timestamp), 0) as latest_timestamp
      FROM exercises e
      LEFT JOIN workout_exercises we ON we.exercise_id = e.id
      LEFT JOIN workouts w ON w.id = we.workout_id
      GROUP BY e.id, e.name, e.metric_type
      ORDER BY session_count DESC, latest_timestamp DESC, e.name ASC
    `);

    // 2. Obtener caché de ExerciseDB / carátulas asignadas
    const cacheRes = await db.execute(
      "SELECT exercise_name, data_json, updated_at FROM exercisedb_cache"
    );

    const cacheMap = new Map<string, { data: ExerciseMedia; updatedAt: number }>();
    for (const row of cacheRes.rows) {
      const key = String(row.exercise_name).toLowerCase().trim();
      try {
        const parsed = JSON.parse(String(row.data_json)) as ExerciseMedia;
        // Ignorar filas corruptas con chest press universal para ejercicios que no son de pecho
        const isBogusChestPress =
          (parsed.gifUrl?.includes("chest-press") || parsed.gifUrl?.includes("lever-chest-press")) &&
          parsed.primaryMuscle !== "chest" &&
          !key.includes("chest") &&
          !key.includes("pecho");

        if (!isBogusChestPress) {
          cacheMap.set(key, {
            data: parsed,
            updatedAt: Number(row.updated_at || 0),
          });
        }
      } catch {
        // Ignorar filas con JSON corrupto
      }
    }

    // 3. Cruzar datos
    const results = await Promise.all(
      exercisesRes.rows.map(async (row) => {
        const name = String(row.name);
        const id = String(row.id);
        const metricType = String(row.metric_type);
        const sessionCount = Number(row.session_count || 0);
        const latestTimestamp = Number(row.latest_timestamp || 0);
        const cacheKey = name.toLowerCase().trim();

        const cached = cacheMap.get(cacheKey);
        let media: ExerciseMedia;
        let hasCustomMedia = false;

        if (cached) {
          media = cached.data;
          hasCustomMedia = true;

          // Si el archivo en disco falta (ej. LXC vacío) pero tiene cdnUrl, descargarlo en segundo plano
          if (media.gifUrl?.startsWith("/media/exercises/")) {
            const localPath = path.join(process.cwd(), "public", media.gifUrl);
            if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
              try {
                media = await localizeExerciseMedia(media);
              } catch (e) {
                // Continuar si falla
              }
            }
          }
        } else {
          // Resolver buscando en inglés en el catálogo de 1,323 GymVisual
          const resolved = resolveExerciseMediaFromCatalog(name);
          try {
            // Descargar el fichero localmente si es posible
            media = await localizeExerciseMedia(resolved);
            // Guardar en caché SQLite
            await db.execute({
              sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
                    VALUES (?, ?, strftime('%s', 'now'))`,
              args: [cacheKey, JSON.stringify(media)],
            });
            hasCustomMedia = true;
          } catch {
            media = resolved;
          }
        }

        return {
          id,
          name,
          metricType,
          sessionCount,
          latestTimestamp,
          media,
          hasCustomMedia,
          updatedAt: cached?.updatedAt || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error("[ExerciseMediaList] Error fetching list:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener lista de carátulas" },
      { status: 500 }
    );
  }
}
