import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb, ensureSchema } from "@/lib/db";
import { resolveExerciseMediaFromCatalog } from "@/lib/exercise-catalog";
import { MUSCLE_FALLBACK_GIFS } from "@/lib/exercise-media";
import { ExerciseMedia } from "@/types/exercise-media";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

function getDiskStats() {
  ensureMediaDir();
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    let totalBytes = 0;
    let count = 0;
    for (const f of files) {
      const fullPath = path.join(MEDIA_DIR, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          totalBytes += stat.size;
          count++;
        }
      } catch {}
    }
    return { count, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

function findExistingLocalMedia(
  exerciseName: string,
  cachedMedia?: ExerciseMedia,
  resolvedMedia?: ExerciseMedia
): string | null {
  const candidates: (string | undefined)[] = [
    cachedMedia?.gifUrl,
    resolvedMedia?.gifUrl,
    `/media/exercises/${exerciseName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_")}_anim.gif`,
    `/media/exercises/${exerciseName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")}_anim.gif`,
    cachedMedia?.posterUrl,
    resolvedMedia?.posterUrl,
  ];

  for (const c of candidates) {
    if (c && c.startsWith("/media/exercises/")) {
      const p = path.join(process.cwd(), "public", c);
      if (fs.existsSync(p)) {
        try {
          if (fs.statSync(p).size > 0) {
            return c;
          }
        } catch {}
      }
    }
  }
  return null;
}

export async function GET() {
  try {
    const db = getDb();
    await ensureSchema(db);

    const exercisesRes = await db.execute("SELECT id, name, metric_type FROM exercises ORDER BY name ASC");
    const cacheRes = await db.execute("SELECT exercise_name, data_json FROM exercisedb_cache");

    const cacheMap = new Map<string, ExerciseMedia>();
    for (const row of cacheRes.rows) {
      try {
        cacheMap.set(String(row.exercise_name).toLowerCase().trim(), JSON.parse(String(row.data_json)));
      } catch {}
    }

    let cachedCount = 0;
    let missingCount = 0;
    const missingList: string[] = [];

    for (const row of exercisesRes.rows) {
      const name = String(row.name);
      const cacheKey = name.toLowerCase().trim();
      const cached = cacheMap.get(cacheKey);
      const resolved = resolveExerciseMediaFromCatalog(name);

      const localPath = findExistingLocalMedia(name, cached, resolved);

      if (localPath) {
        cachedCount++;
      } else {
        missingCount++;
        missingList.push(name);
      }
    }

    const diskStats = getDiskStats();

    return NextResponse.json({
      success: true,
      data: {
        totalExercises: exercisesRes.rows.length,
        cachedCount,
        missingCount,
        missingList: missingList.slice(0, 30),
        diskFilesCount: diskStats.count,
        diskUsageBytes: diskStats.totalBytes,
        diskUsageFormatted: `${(diskStats.totalBytes / (1024 * 1024)).toFixed(1)} MB`,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[MediaRestore] Error getting media status:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al obtener estado de caché multimedia" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force); // Si es true, re-descarga todas las imágenes incluso si ya existen en disco

    const db = getDb();
    await ensureSchema(db);
    ensureMediaDir();

    const exercisesRes = await db.execute("SELECT id, name, metric_type FROM exercises ORDER BY name ASC");
    const cacheRes = await db.execute("SELECT exercise_name, data_json FROM exercisedb_cache");

    const cacheMap = new Map<string, ExerciseMedia>();
    for (const row of cacheRes.rows) {
      try {
        cacheMap.set(String(row.exercise_name).toLowerCase().trim(), JSON.parse(String(row.data_json)));
      } catch {}
    }

    let processed = 0;
    let downloaded = 0;
    let alreadyValid = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of exercisesRes.rows) {
      processed++;
      const name = String(row.name);
      const cacheKey = name.toLowerCase().trim();
      let media = cacheMap.get(cacheKey);
      const resolved = resolveExerciseMediaFromCatalog(name);

      const existingLocalUrl = findExistingLocalMedia(name, media, resolved);

      // Si no es forzado y el archivo ya es válido en disco, lo mantenemos y sincronizamos la ruta en la caché
      if (existingLocalUrl && !force) {
        alreadyValid++;
        if (!media || media.gifUrl !== existingLocalUrl) {
          const syncMedia: ExerciseMedia = {
            ...(media || resolved),
            gifUrl: existingLocalUrl,
            posterUrl: existingLocalUrl,
          };
          await db.execute({
            sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
                  VALUES (?, ?, strftime('%s', 'now'))`,
            args: [cacheKey, JSON.stringify(syncMedia)],
          });
        }
        continue;
      }

      // Si no tenemos media o no tiene cdnUrl válida, resolverlo desde el catálogo de GymVisual
      if (!media || !media.cdnUrl || !media.cdnUrl.startsWith("http")) {
        media = resolved;
      }

      let remoteUrl = media.cdnUrl;
      if (!remoteUrl || !remoteUrl.startsWith("http")) {
        // Fallback por grupo muscular
        remoteUrl = MUSCLE_FALLBACK_GIFS[media.primaryMuscle] || MUSCLE_FALLBACK_GIFS.chest;
      }

      // Sanitizar identificador de archivo para guardarlo
      const sanitized = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, "_")
        .replace(/_+/g, "_");

      const localFileName = `${sanitized}_anim.gif`;
      const localFilePath = path.join(MEDIA_DIR, localFileName);
      const localPublicUrl = `/media/exercises/${localFileName}`;

      // Descargar desde CDN remoto
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(remoteUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "ByteHevy-ImageCacheRestorer/1.0",
          },
        });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} al descargar de ${remoteUrl}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          throw new Error("El archivo descargado tiene 0 bytes");
        }

        fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
        downloaded++;

        // Actualizar datos en SQLite cache
        const updatedMedia: ExerciseMedia = {
          ...media,
          gifUrl: localPublicUrl,
          cdnUrl: remoteUrl,
          posterUrl: localPublicUrl,
        };

        await db.execute({
          sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at) 
                VALUES (?, ?, strftime('%s', 'now'))`,
          args: [cacheKey, JSON.stringify(updatedMedia)],
        });
      } catch (err: unknown) {
        const fetchErr = err as Error;
        console.warn(`[MediaRestore] Falló descarga para '${name}' (${remoteUrl}):`, fetchErr?.message);
        failed++;
        if (errors.length < 10) {
          errors.push(`${name}: ${fetchErr?.message || "Error desconocido"}`);
        }
      }
    }

    const diskStats = getDiskStats();

    return NextResponse.json({
      success: true,
      message: force
        ? "Caché de imágenes 3D regenerada por completo desde el CDN"
        : "Imágenes 3D faltantes descargadas y sincronizadas",
      data: {
        processed,
        downloaded,
        alreadyValid,
        failed,
        errors,
        diskFilesCount: diskStats.count,
        diskUsageFormatted: `${(diskStats.totalBytes / (1024 * 1024)).toFixed(1)} MB`,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[MediaRestore] Error restaurando imágenes:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al restaurar imágenes multimedia" },
      { status: 500 }
    );
  }
}
