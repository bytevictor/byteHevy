import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { getDb, resetDb, ensureSchema } from "@/lib/db";
import { resolveExerciseMediaFromCatalog } from "@/lib/exercise-catalog";

function findExistingLocalMedia(
  exerciseName: string,
  cachedMedia?: { gifUrl?: string; posterUrl?: string },
  resolvedMedia?: { gifUrl?: string; posterUrl?: string }
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

export async function POST(request: Request) {
  const dataDir = path.join(process.cwd(), "data");
  const tempDbPath = path.join(dataDir, "bytehevy_restore_temp.db");
  const targetDbPath = path.join(dataDir, "bytehevy.db");
  const backupDbPath = path.join(dataDir, "bytehevy_backup_pre_restore.db");
  const walPath = `${targetDbPath}-wal`;
  const shmPath = `${targetDbPath}-shm`;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo para restaurar." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      return NextResponse.json(
        { success: false, error: "El archivo es demasiado pequeño o está dañado." },
        { status: 400 }
      );
    }

    // 1. Validar la cabecera mágica de SQLite (16 bytes: 'SQLite format 3\0')
    const magicHeader = buffer.subarray(0, 16).toString("utf8");
    if (!magicHeader.startsWith("SQLite format 3")) {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo subido no es una base de datos SQLite válida (cabecera incompatible).",
        },
        { status: 400 }
      );
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 2. Guardar archivo temporal para validación de integridad
    fs.writeFileSync(tempDbPath, buffer);

    // 3. Probar integridad usando cliente LibSQL temporal
    const tempClient = createClient({
      url: `file:${tempDbPath}`,
    });

    try {
      const integrityRes = await tempClient.execute("PRAGMA integrity_check;");
      const integrityVal = String(integrityRes.rows[0]?.[0] || "");
      if (integrityVal !== "ok") {
        tempClient.close();
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        return NextResponse.json(
          {
            success: false,
            error: `La comprobación de integridad de SQLite falló: ${integrityVal}`,
          },
          { status: 400 }
        );
      }

      // Comprobar que contiene al menos alguna de las tablas esperadas de ByteHevy
      const tablesRes = await tempClient.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workouts', 'exercises', 'goals', 'seasons', 'exercisedb_cache')"
      );
      if (tablesRes.rows.length === 0) {
        tempClient.close();
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        return NextResponse.json(
          {
            success: false,
            error: "La base de datos SQLite no contiene tablas reconocibles de entrenamientos o ejercicios de ByteHevy.",
          },
          { status: 400 }
        );
      }
    } finally {
      tempClient.close();
    }

    // 4. Desconectar la base de datos actual para liberar cerraduras de archivo
    resetDb();

    // 5. Crear copia de seguridad automática previa a la restauración
    if (fs.existsSync(targetDbPath)) {
      try {
        fs.copyFileSync(targetDbPath, backupDbPath);
      } catch (backupErr) {
        console.warn("[Restore] No se pudo crear backup de respaldo antes de restaurar:", backupErr);
      }
    }

    // 6. Limpiar ficheros auxiliares WAL y SHM del archivo anterior para evitar inconsistencias
    if (fs.existsSync(walPath)) {
      try {
        fs.unlinkSync(walPath);
      } catch {}
    }
    if (fs.existsSync(shmPath)) {
      try {
        fs.unlinkSync(shmPath);
      } catch {}
    }

    // 7. Reemplazar la base de datos objetivo con el archivo validado
    fs.copyFileSync(tempDbPath, targetDbPath);
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }

    // 8. Inicializar la nueva conexión y aplicar migraciones pendientes si las hubiera
    resetDb();
    const db = getDb();
    await ensureSchema(db);

    // 9. Extraer estadísticas de los datos restaurados
    let workoutsCount = 0;
    let exercisesCount = 0;
    let setsCount = 0;
    let seasonsCount = 0;
    let goalsCount = 0;
    let cachedMediaRows = 0;

    try {
      const wRes = await db.execute("SELECT COUNT(*) as c FROM workouts");
      workoutsCount = Number(wRes.rows[0]?.c || 0);
    } catch {}

    try {
      const eRes = await db.execute("SELECT COUNT(*) as c FROM exercises");
      exercisesCount = Number(eRes.rows[0]?.c || 0);
    } catch {}

    try {
      const sRes = await db.execute("SELECT COUNT(*) as c FROM exercise_sets");
      setsCount = Number(sRes.rows[0]?.c || 0);
    } catch {}

    try {
      const seRes = await db.execute("SELECT COUNT(*) as c FROM seasons");
      seasonsCount = Number(seRes.rows[0]?.c || 0);
    } catch {}

    try {
      const gRes = await db.execute("SELECT COUNT(*) as c FROM goals");
      goalsCount = Number(gRes.rows[0]?.c || 0);
    } catch {}

    try {
      const cRes = await db.execute("SELECT COUNT(*) as c FROM exercisedb_cache");
      cachedMediaRows = Number(cRes.rows[0]?.c || 0);
    } catch {}

    // 10. Evaluar el estado de las imágenes y carátulas 3D en disco
    let mediaPresentCount = 0;
    let mediaMissingCount = 0;
    const missingExercises: string[] = [];

    try {
      const allExercises = await db.execute("SELECT name FROM exercises ORDER BY name ASC");
      const cacheRows = await db.execute("SELECT exercise_name, data_json FROM exercisedb_cache");
      const cacheMap = new Map<string, { gifUrl?: string; posterUrl?: string }>();
      for (const row of cacheRows.rows) {
        try {
          cacheMap.set(String(row.exercise_name).toLowerCase().trim(), JSON.parse(String(row.data_json)));
        } catch {}
      }

      for (const row of allExercises.rows) {
        const name = String(row.name);
        const cached = cacheMap.get(name.toLowerCase().trim());
        const resolved = resolveExerciseMediaFromCatalog(name);
        const match = findExistingLocalMedia(name, cached, resolved);

        if (match) {
          mediaPresentCount++;
        } else {
          mediaMissingCount++;
          if (missingExercises.length < 15) {
            missingExercises.push(name);
          }
        }
      }
    } catch (auditErr) {
      console.warn("[Restore] Error al auditar carátulas:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Base de datos SQLite (.db) restaurada con éxito",
      data: {
        workoutsCount,
        exercisesCount,
        setsCount,
        seasonsCount,
        goalsCount,
        cachedMediaRows,
        mediaPresentCount,
        mediaMissingCount,
        missingExercises,
        fileSizeFormatted: `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[Restore] Error al restaurar base de datos:", err);
    // Limpiar fichero temporal si quedó huérfano
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
    resetDb();
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Error al procesar la restauración de la base de datos",
      },
      { status: 500 }
    );
  }
}
