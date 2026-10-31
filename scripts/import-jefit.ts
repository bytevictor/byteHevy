import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, ensureSchema } from "../lib/db";

const CSV_PATH = path.join(process.cwd(), "data", "seed_data", "insanebytee_20261030.csv");
const text = fs.readFileSync(CSV_PATH, "utf8");
const lines = text.split("\n");

function getSectionLines(name: string, nextName?: string): string[] {
  const startIdx = lines.findIndex((l) => l.includes(`### ${name} `));
  if (startIdx === -1) return [];
  let endIdx = lines.length;
  if (nextName) {
    const nextIdx = lines.findIndex((l) => l.includes(`### ${nextName} `));
    if (nextIdx !== -1) endIdx = nextIdx;
  }
  return lines.slice(startIdx + 1, endIdx).filter((l) => l.trim().length > 0 && !l.startsWith("###") && !l.startsWith("####"));
}

const SPANISH_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
function formatSpanishDate(date: Date): string {
  const day = date.getDate();
  const month = SPANISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hour}:${min}`;
}

const JEFIT_EXERCISE_MAPPING: Record<string, string> = {
  // Curls unificados en Alternating Hammer Curl
  "dumbbell alternating hammer curl": "Alternating Hammer Curl",
  "dumbbell alternating bicep curl": "Alternating Hammer Curl",
  "biceps": "Alternating Hammer Curl",

  // Dominadas
  "pull-up": "Pull Up (Weighted)",
  "pull ups": "Pull Up (Weighted)",
  "weighted pull-up": "Pull Up (Weighted)",
  "wide grip rear pull-up": "Pull Up (Weighted)",

  // Aperturas / Pec Deck
  "machine fly": "Butterfly (Pec Deck)",
  "machine butterfly": "Butterfly (Pec Deck)",
  "rear deltoid & butterfly": "Butterfly (Pec Deck)",

  // Remo
  "cable seated row": "Seated Cable Row - Bar Grip",

  // Tríceps polea
  "cable rope tricep pushdown": "Triceps Pushdown",
  "cable tricep pushdown (rope)": "Triceps Pushdown",
  "cable rope triceps pushdown": "Triceps Pushdown",

  // Fondos
  "dip": "Triceps Dip (Weighted)",

  // Pecho máquinas (Decidido: Decline a Chest Press, Leverage a Iso-Lateral)
  "machine decline chest press": "Chest Press (Machine)",
  "leverage incline chest press": "Iso-Lateral Chest Press (Machine)",
  "machine inner chest press": "Machine Inner Chest Press",

  // Flexiones
  "push-up": "Push Up (Weighted)",
  "push up": "Push Up (Weighted)",

  // Piernas
  "machine leg press": "Leg Press Horizontal (Machine)",
  "machine leg extension": "Leg Extension (Machine)",
  "machine seated leg curl": "Lying Leg Curl (Machine)",
  "seated leg curl": "Lying Leg Curl (Machine)",
  "machine single-leg curl": "Lying Leg Curl (Machine)",
  "prisoner squat": "Squat (Bodyweight)",

  // Hombro máquina
  "machine shoulder press": "Seated Shoulder Press (Machine)",

  // Antebrazo
  "dumbbell wrist curl (palms up)": "Curl Antebrazo (Sulek Curl)",

  // Cardio
  "treadmill running": "Treadmill",

  // Suspensión
  "one-arm hang": "Dead Hang",

  // Ejercicios nuevos independientes
  "barbell bench press": "Barbell Bench Press",
  "barbell shoulder press": "Barbell Shoulder Press",
  "barbell squat": "Barbell Squat",
  "hack squat": "Hack Squat",
  "barbell incline bench press": "Barbell Incline Bench Press",
  "cable reverse fly": "Cable Reverse Fly",
  "machine assisted pull-up": "Machine Assisted Pull-Up",
  "leg raise": "Leg Raise",
  "twists": "Twists",
};

// Target exercise metric types
const EXERCISE_METRIC_TYPES: Record<string, string> = {
  "Alternating Hammer Curl": "weight_reps",
  "Barbell Bench Press": "weight_reps",
  "Barbell Shoulder Press": "weight_reps",
  "Barbell Squat": "weight_reps",
  "Hack Squat": "weight_reps",
  "Barbell Incline Bench Press": "weight_reps",
  "Cable Reverse Fly": "weight_reps",
  "Machine Assisted Pull-Up": "weight_reps",
  "Machine Inner Chest Press": "weight_reps",
  "Leg Raise": "bodyweight_reps",
  "Twists": "bodyweight_reps",
};

async function main() {
  const db = getDb();
  await ensureSchema(db);

  console.log("=== INICIANDO MIGRACIÓN JEFIT -> BYTEHEVY ===");

  // 1. Unificar ejercicios de bíceps/martillo existentes en Hevy
  console.log("\n[1/5] Unificando ejercicios de bíceps existentes en SQLite...");
  
  // Buscar o crear Alternating Hammer Curl
  let altHammerRes = await db.execute({
    sql: "SELECT id FROM exercises WHERE name = ?",
    args: ["Alternating Hammer Curl"],
  });

  let altHammerId: string;
  if (altHammerRes.rows.length === 0) {
    // Si existe Cross Body Hammer Curl, lo renombramos a Alternating Hammer Curl
    const crossRes = await db.execute({
      sql: "SELECT id FROM exercises WHERE name = ?",
      args: ["Cross Body Hammer Curl"],
    });

    if (crossRes.rows.length > 0) {
      altHammerId = String(crossRes.rows[0].id);
      await db.execute({
        sql: "UPDATE exercises SET name = ? WHERE id = ?",
        args: ["Alternating Hammer Curl", altHammerId],
      });
      console.log(`✓ Renombrado 'Cross Body Hammer Curl' -> 'Alternating Hammer Curl' (ID: ${altHammerId})`);
    } else {
      altHammerId = crypto.randomUUID();
      await db.execute({
        sql: "INSERT INTO exercises (id, name, metric_type) VALUES (?, ?, ?)",
        args: [altHammerId, "Alternating Hammer Curl", "weight_reps"],
      });
      console.log(`✓ Creado 'Alternating Hammer Curl' (ID: ${altHammerId})`);
    }
  } else {
    altHammerId = String(altHammerRes.rows[0].id);
    console.log(`✓ Usando 'Alternating Hammer Curl' existente (ID: ${altHammerId})`);
  }

  // Fusionar workout_exercises que apunten a 'Bicep Curl (Dumbbell)' o 'Cross Body Hammer Curl'
  const oldCurlsRes = await db.execute({
    sql: "SELECT id, name FROM exercises WHERE name IN ('Bicep Curl (Dumbbell)', 'Cross Body Hammer Curl')",
    args: [],
  });

  for (const row of oldCurlsRes.rows) {
    const oldId = String(row.id);
    const oldName = String(row.name);
    if (oldId !== altHammerId) {
      const updated = await db.execute({
        sql: "UPDATE workout_exercises SET exercise_id = ? WHERE exercise_id = ?",
        args: [altHammerId, oldId],
      });
      console.log(`✓ Reasignadas ${updated.rowsAffected} referencias de '${oldName}' a 'Alternating Hammer Curl'`);
      await db.execute({
        sql: "DELETE FROM exercises WHERE id = ?",
        args: [oldId],
      });
      console.log(`✓ Eliminado ejercicio redundante '${oldName}'`);
    }
  }

  // 2. Asegurar que todos los ejercicios destino existan en la tabla exercises
  console.log("\n[2/5] Comprobando catálogo de ejercicios en SQLite...");
  for (const [targetName, metricType] of Object.entries(EXERCISE_METRIC_TYPES)) {
    const exists = await db.execute({
      sql: "SELECT id FROM exercises WHERE name = ?",
      args: [targetName],
    });
    if (exists.rows.length === 0) {
      const newId = crypto.randomUUID();
      await db.execute({
        sql: "INSERT INTO exercises (id, name, metric_type) VALUES (?, ?, ?)",
        args: [newId, targetName, metricType],
      });
      console.log(`✓ Añadido nuevo ejercicio: '${targetName}' (${metricType})`);
    }
  }

  // Cargar mapa name -> id de todos los ejercicios
  const allExercisesRes = await db.execute("SELECT id, name, metric_type FROM exercises;");
  const exerciseIdMap = new Map<string, { id: string; metricType: string }>();
  for (const row of allExercisesRes.rows) {
    exerciseIdMap.set(String(row.name), {
      id: String(row.id),
      metricType: String(row.metric_type),
    });
  }

  // 3. Parsear metadatos de Jefit (Rutinas, Notas, Cardio)
  console.log("\n[3/5] Parseando datos de soporte Jefit...");

  // Rutinas
  const routineLines = getSectionLines("ROUTINES", "WORKOUT SESSIONS");
  const routineMap = new Map<string, string>();
  for (const line of routineLines) {
    if (line.includes("package,_id,name,day,dayIndex")) continue;
    const match = line.match(/^\d+,\d+,"[^"]*",\d+,(\d+),"([^"]+)"/);
    if (match) {
      routineMap.set(match[1], match[2].trim());
    }
  }

  // Notas
  const noteLines = getSectionLines("NOTES");
  const notesMap = new Map<string, string>();
  for (const line of noteLines.slice(1)) {
    const match = line.match(/^\d+,"[^"]*",\d+,\d+,(\d+),\d+,"([\s\S]*?)",[^,]*,([^,]*),/);
    if (match) {
      const eid = match[1];
      const mynote = match[2].trim();
      const mydate = match[3].trim();
      if (mynote) {
        notesMap.set(`${mydate}_${eid}`, mynote);
      }
    }
  }

  // Cardio
  const cardioLines = getSectionLines("CARDIO LOGS", "CARDIO EXERCISE LOGS");
  const cardioMap = new Map<string, { duration: number; distance: number }>();
  for (const line of cardioLines.slice(1)) {
    const parts = line.split(",");
    if (parts.length >= 13) {
      const mydate = parts[12].trim();
      const duration = parseFloat(parts[8]) || 0;
      const distance = parseFloat(parts[10]) || 0;
      cardioMap.set(mydate, { duration, distance });
    }
  }

  // 4. Parsear sesiones y logs de ejercicios
  console.log("\n[4/5] Parseando sesiones y logs de Jefit...");
  const sessionLines = getSectionLines("WORKOUT SESSIONS", "EXERCISE LOGS");
  interface SessionData {
    id: string;
    dayId: string;
    title: string;
    totalTime: number;
    startTimeSec: number;
    endTimeSec: number;
    startTimeStr: string;
    endTimeStr: string;
  }

  const sessionsMap = new Map<string, SessionData>();
  for (const line of sessionLines.slice(1)) {
    const parts = line.split(",");
    if (parts.length >= 14) {
      const id = parts[1].trim();
      const dayId = parts[4].trim();
      const totalTime = parseInt(parts[5].trim(), 10) || 0;
      const startTimeSec = parseInt(parts[12].trim(), 10) || 0;
      const endTimeSec = parseInt(parts[13].trim(), 10) || (startTimeSec + totalTime);

      if (startTimeSec > 0) {
        const routineName = routineMap.get(dayId) || "Entrenamiento Jefit";
        const startDate = new Date(startTimeSec * 1000);
        const endDate = new Date(endTimeSec * 1000);

        sessionsMap.set(id, {
          id,
          dayId,
          title: routineName,
          totalTime,
          startTimeSec,
          endTimeSec,
          startTimeStr: formatSpanishDate(startDate),
          endTimeStr: formatSpanishDate(endDate),
        });
      }
    }
  }

  const logLines = getSectionLines("EXERCISE LOGS", "EXERCISE SET LOGS");
  const sessionExercises = new Map<string, any[]>();

  for (const line of logLines.slice(1)) {
    const match = line.match(/^(\d+),("[^"]*"),(\d+),(".*?"|[^,]*),(\d+),([^,]*),([^,]*),(\d+),(".*?"|[^,]*),([^,]*),([^,]*),(\d+),/);
    if (match) {
      const rawLogs = match[4].replace(/^"|"$/g, "").trim();
      const mydate = match[7].trim();
      const eid = match[8].trim();
      const ename = match[9].replace(/^"|"$/g, "").trim();
      const belongsession = match[11].trim();

      const normalizedName = ename.toLowerCase().trim();
      const targetName = JEFIT_EXERCISE_MAPPING[normalizedName];
      if (targetName) {
        if (!sessionExercises.has(belongsession)) {
          sessionExercises.set(belongsession, []);
        }
        sessionExercises.get(belongsession)!.push({
          ename,
          targetName,
          rawLogs,
          mydate,
          eid,
        });
      }
    }
  }

  // 5. Inserción en base de datos
  console.log("\n[5/5] Insertando entrenamientos, ejercicios y series en SQLite...");

  let workoutsInserted = 0;
  let exercisesInserted = 0;
  let setsInserted = 0;

  for (const [sessionId, exercises] of sessionExercises.entries()) {
    const session = sessionsMap.get(sessionId);
    if (!session || exercises.length === 0) continue;

    // Comprobar si ya existe una sesión con este start_time y título
    const existing = await db.execute({
      sql: "SELECT id FROM workouts WHERE start_time = ? AND title = ?",
      args: [session.startTimeStr, session.title],
    });

    if (existing.rows.length > 0) {
      continue; // Ya importada
    }

    const workoutId = crypto.randomUUID();
    const duration = session.totalTime > 0 ? session.totalTime : (session.endTimeSec - session.startTimeSec);

    await db.execute({
      sql: `INSERT INTO workouts (id, title, start_time, start_timestamp, end_time, duration_seconds, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
      args: [
        workoutId,
        session.title,
        session.startTimeStr,
        session.startTimeSec,
        session.endTimeStr,
        duration,
        "Importado históricamente desde Jefit",
      ],
    });
    workoutsInserted++;

    // Insertar ejercicios de la sesión
    for (let orderIndex = 0; orderIndex < exercises.length; orderIndex++) {
      const item = exercises[orderIndex];
      const targetEx = exerciseIdMap.get(item.targetName);
      if (!targetEx) {
        console.warn(`Ejercicio no encontrado en mapa: ${item.targetName}`);
        continue;
      }

      const workoutExerciseId = crypto.randomUUID();
      const note = notesMap.get(`${item.mydate}_${item.eid}`) || null;

      await db.execute({
        sql: `INSERT INTO workout_exercises (id, workout_id, exercise_id, exercise_notes, order_index)
              VALUES (?, ?, ?, ?, ?)`,
        args: [workoutExerciseId, workoutId, targetEx.id, note, orderIndex],
      });
      exercisesInserted++;

      // Parsear series
      const rawSets = item.rawLogs.split(",").filter((s: string) => s.trim().length > 0);
      for (let setIdx = 0; setIdx < rawSets.length; setIdx++) {
        const rawSet = rawSets[setIdx].trim();
        const [wStr, rStr] = rawSet.split("x");
        let weight = parseFloat(wStr) || 0;
        const reps = parseInt(rStr, 10) || 0;

        let weightKg: number | null = null;
        let repsVal: number | null = null;
        let distanceKm: number | null = null;
        let durationSec: number | null = null;

        if (item.ename === "Pull-Up" || item.ename === "Pull Ups" || item.ename === "Wide Grip Rear Pull-Up") {
          // Dominadas de 2021 a mediados de 2024: Jefit ponía "10" como placeholder de peso corporal.
          // El peso extra es 0 (BW libre / asistido), las repeticiones son el segundo número.
          weightKg = null;
          repsVal = reps > 0 ? reps : null;
        } else if (item.ename === "Weighted Pull-Up") {
          // Dominadas lastradas explícitas desde septiembre 2024:
          if (weight === 100) weight = 10; // Errata tipográfica corregida en Jefit (100 en vez de 10)
          weightKg = weight > 0 ? weight : null;
          repsVal = reps > 0 ? reps : null;
        } else if (item.ename === "Dip") {
          // En Jefit, los fondos antes de nov 2024 se hacían en máquina asistida (placas de 41, 35, 28, 21, 14, 7 kg).
          // A partir de nov 2024 se hacen libres (0 kg) o con lastre (+10 kg).
          if (item.mydate < "2024-11-01" && weight >= 7) {
            weightKg = null; // Asistencia en máquina (no lastre)
            repsVal = reps > 0 ? reps : null;
          } else {
            weightKg = weight > 0 ? weight : null;
            repsVal = reps > 0 ? reps : null;
          }
        } else if (
          item.ename === "Push-Up" ||
          item.ename === "Push Up" ||
          item.ename === "Prisoner Squat" ||
          item.ename === "Leg Raise"
        ) {
          // Ejercicios estrictamente corporales donde Jefit rellenaba "10" por defecto:
          weightKg = null;
          repsVal = reps > 0 ? reps : null;
        } else if (targetEx.metricType === "seconds") {
          durationSec = reps > 0 ? reps : (weight > 0 ? weight : 60);
        } else if (targetEx.metricType === "cardio") {
          const cLog = cardioMap.get(item.mydate);
          distanceKm = cLog && cLog.distance > 0 ? cLog.distance : (reps > 0 ? reps : null);
          durationSec = cLog && cLog.duration > 0 ? cLog.duration : (weight > 0 ? weight : null);
        } else if (targetEx.metricType === "weighted_bodyweight" || targetEx.metricType === "bodyweight_reps") {
          weightKg = weight > 0 ? weight : null;
          repsVal = reps > 0 ? reps : null;
        } else {
          // weight_reps por defecto
          weightKg = weight > 0 ? weight : null;
          repsVal = reps > 0 ? reps : null;
        }

        const setId = crypto.randomUUID();
        await db.execute({
          sql: `INSERT INTO exercise_sets (id, workout_exercise_id, set_index, set_type, weight_kg, reps, distance_km, duration_seconds)
                VALUES (?, ?, ?, 'normal', ?, ?, ?, ?)`,
          args: [setId, workoutExerciseId, setIdx, weightKg, repsVal, distanceKm, durationSec],
        });
        setsInserted++;
      }
    }
  }

  // Verificación final
  const totalWorkouts = await db.execute("SELECT count(*) as c FROM workouts;");
  const totalExercises = await db.execute("SELECT count(*) as c FROM exercises;");
  const totalSets = await db.execute("SELECT count(*) as c FROM exercise_sets;");

  console.log("\n==========================================");
  console.log("✓ MIGRACIÓN COMPLETADA CON ÉXITO");
  console.log("==========================================");
  console.log(`• Nuevos entrenamientos insertados: ${workoutsInserted}`);
  console.log(`• Nuevas entradas de ejercicios:   ${exercisesInserted}`);
  console.log(`• Nuevas series registradas:        ${setsInserted}`);
  console.log("------------------------------------------");
  console.log(`TOTAL ENTRENAMIENTOS EN BASE DE DATOS: ${totalWorkouts.rows[0].c}`);
  console.log(`TOTAL EJERCICIOS ACTIVOS:              ${totalExercises.rows[0].c}`);
  console.log(`TOTAL SERIES REGISTRADAS:              ${totalSets.rows[0].c}`);
  console.log("==========================================\n");
}

main().catch(console.error);

