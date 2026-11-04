import { getDb, ensureSchema } from "./db";
import crypto from "node:crypto";

const SPANISH_MONTHS: Record<string, number> = {
  ene: 0, enero: 0,
  feb: 1, febrero: 1,
  mar: 2, marzo: 2,
  abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5,
  jul: 6, julio: 6,
  ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8,
  oct: 9, octubre: 9,
  nov: 10, noviembre: 10,
  dic: 11, diciembre: 11,
};

export function parseSpanishDate(str: string): number {
  if (!str) return 0;
  const trimmed = str.trim();

  // 1. Try standard JS Date parsing (covers "Nov 3, 2026, 8:39 PM", ISO, etc.)
  const nativeTs = Date.parse(trimmed);
  if (!Number.isNaN(nativeTs) && nativeTs > 0) {
    return nativeTs;
  }

  // 2. Try Spanish date formats ("3 nov 2026, 20:39", "3 nov. 2026, 20:39", "03 noviembre 2026, 20:39")
  const match = trimmed.match(
    /^(\d{1,2})\s+([a-zA-Záéíóú]+)\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i
  );
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const month = SPANISH_MONTHS[monthStr] ?? -1;
    if (month >= 0) {
      return new Date(year, month, day, hour, minute).getTime();
    }
  }

  return 0;
}

export const parseWorkoutDate = parseSpanishDate;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

export function determineMetricType(
  exerciseTitle: string
): "weight_reps" | "weighted_bodyweight" | "bodyweight_reps" | "seconds" | "cardio" {
  const lower = exerciseTitle.toLowerCase().trim();
  if (lower.includes("dead hang")) return "seconds";
  if (lower.includes("treadmill") || lower.includes("running") || lower.includes("cinta")) return "cardio";
  if (lower.includes("pull up") || lower.includes("chin up") || lower.includes("dip")) {
    return "weighted_bodyweight";
  }
  if (
    lower.includes("front lever") ||
    lower.includes("bodyweight") ||
    lower.includes("push up")
  ) {
    return "bodyweight_reps";
  }
  return "weight_reps";
}

export interface ImportResult {
  totalRows: number;
  newWorkouts: number;
  skippedWorkouts: number;
  newSets: number;
}

export async function importCsvToDb(csvText: string): Promise<ImportResult> {
  const db = getDb();
  await ensureSchema(db);

  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    return { totalRows: 0, newWorkouts: 0, skippedWorkouts: 0, newSets: 0 };
  }

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const colIndex = (name: string) => header.indexOf(name);

  const idxTitle = colIndex("title");
  const idxStartTime = colIndex("start_time");
  const idxEndTime = colIndex("end_time");
  const idxDesc = colIndex("description");
  const idxExercise = colIndex("exercise_title");
  const idxExerciseNotes = colIndex("exercise_notes");
  const idxSetIndex = colIndex("set_index");
  const idxSetType = colIndex("set_type");
  const idxWeight = colIndex("weight_kg");
  const idxReps = colIndex("reps");
  const idxDist = colIndex("distance_km");
  const idxDuration = colIndex("duration_seconds");
  const idxRpe = colIndex("rpe");

  type RawSet = {
    exerciseTitle: string;
    exerciseNotes: string;
    setIndex: number;
    setType: string;
    weightKg: number | null;
    reps: number | null;
    distanceKm: number | null;
    durationSeconds: number | null;
    rpe: number | null;
  };

  type RawWorkout = {
    title: string;
    startTimeStr: string;
    startTimestamp: number;
    endTimeStr: string;
    durationSeconds: number;
    description: string;
    sets: RawSet[];
  };

  const workoutsMap = new Map<string, RawWorkout>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = (row[idxTitle] || "").trim();
    const startTimeStr = (row[idxStartTime] || "").trim();
    if (!title && !startTimeStr) continue;

    const key = `${startTimeStr}___${title}`;
    let workout = workoutsMap.get(key);

    if (!workout) {
      const endTimeStr = (row[idxEndTime] || "").trim();
      const desc = (row[idxDesc] || "").trim();
      const startMs = parseSpanishDate(startTimeStr);
      const endMs = parseSpanishDate(endTimeStr);
      const durationSec = endMs > startMs ? Math.round((endMs - startMs) / 1000) : 0;

      workout = {
        title: title || "Entrenamiento",
        startTimeStr,
        startTimestamp: Math.floor(startMs / 1000),
        endTimeStr,
        durationSeconds: durationSec,
        description: desc,
        sets: [],
      };
      workoutsMap.set(key, workout);
    }

    const exTitle = (row[idxExercise] || "").trim();
    if (!exTitle) continue;

    const weightVal = row[idxWeight]?.trim();
    const repsVal = row[idxReps]?.trim();
    const distVal = row[idxDist]?.trim();
    const durVal = row[idxDuration]?.trim();
    const rpeVal = row[idxRpe]?.trim();

    workout.sets.push({
      exerciseTitle: exTitle,
      exerciseNotes: (row[idxExerciseNotes] || "").trim(),
      setIndex: parseInt(row[idxSetIndex] || "0", 10) || 0,
      setType: (row[idxSetType] || "normal").trim(),
      weightKg: weightVal !== "" && !isNaN(Number(weightVal)) ? parseFloat(weightVal) : null,
      reps: repsVal !== "" && !isNaN(Number(repsVal)) ? parseInt(repsVal, 10) : null,
      distanceKm: distVal !== "" && !isNaN(Number(distVal)) ? parseFloat(distVal) : null,
      durationSeconds: durVal !== "" && !isNaN(Number(durVal)) ? parseInt(durVal, 10) : null,
      rpe: rpeVal !== "" && !isNaN(Number(rpeVal)) ? parseFloat(rpeVal) : null,
    });
  }

  // Find existing workouts to skip duplicates
  const existingRes = await db.execute("SELECT start_time, title FROM workouts");
  const existingSet = new Set(
    existingRes.rows.map((r) => `${r.start_time}___${r.title}`)
  );

  // Cache existing exercises
  const exRes = await db.execute("SELECT id, name FROM exercises");
  const exerciseMap = new Map<string, string>();
  for (const r of exRes.rows) {
    exerciseMap.set(String(r.name), String(r.id));
  }

  let newWorkouts = 0;
  let skippedWorkouts = 0;
  let newSets = 0;

  const batchStatements: { sql: string; args: any[] }[] = [];

  for (const workout of workoutsMap.values()) {
    const key = `${workout.startTimeStr}___${workout.title}`;
    if (existingSet.has(key)) {
      skippedWorkouts++;
      continue;
    }

    const workoutId = crypto.randomUUID();
    batchStatements.push({
      sql: `INSERT INTO workouts (id, title, start_time, start_timestamp, end_time, duration_seconds, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        workoutId,
        workout.title,
        workout.startTimeStr,
        workout.startTimestamp,
        workout.endTimeStr,
        workout.durationSeconds,
        workout.description,
      ],
    });
    newWorkouts++;

    // Group sets by exercise & notes
    const exerciseGroups: {
      exerciseTitle: string;
      exerciseNotes: string;
      sets: RawSet[];
    }[] = [];

    let currentGroup: {
      exerciseTitle: string;
      exerciseNotes: string;
      sets: RawSet[];
    } | null = null;

    for (const s of workout.sets) {
      if (
        !currentGroup ||
        currentGroup.exerciseTitle !== s.exerciseTitle ||
        currentGroup.exerciseNotes !== s.exerciseNotes
      ) {
        currentGroup = {
          exerciseTitle: s.exerciseTitle,
          exerciseNotes: s.exerciseNotes,
          sets: [s],
        };
        exerciseGroups.push(currentGroup);
      } else {
        currentGroup.sets.push(s);
      }
    }

    let orderIdx = 0;
    for (const group of exerciseGroups) {
      let exId = exerciseMap.get(group.exerciseTitle);
      if (!exId) {
        exId = crypto.randomUUID();
        exerciseMap.set(group.exerciseTitle, exId);
        const metricType = determineMetricType(group.exerciseTitle);
        batchStatements.push({
          sql: "INSERT OR IGNORE INTO exercises (id, name, metric_type) VALUES (?, ?, ?)",
          args: [exId, group.exerciseTitle, metricType],
        });
      }

      const weId = crypto.randomUUID();
      batchStatements.push({
        sql: "INSERT INTO workout_exercises (id, workout_id, exercise_id, exercise_notes, order_index) VALUES (?, ?, ?, ?, ?)",
        args: [weId, workoutId, exId, group.exerciseNotes, orderIdx++],
      });

      for (const s of group.sets) {
        const setId = crypto.randomUUID();
        batchStatements.push({
          sql: `INSERT INTO exercise_sets (id, workout_exercise_id, set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            setId,
            weId,
            s.setIndex,
            s.setType,
            s.weightKg,
            s.reps,
            s.distanceKm,
            s.durationSeconds,
            s.rpe,
          ],
        });
        newSets++;
      }
    }
  }

  // Execute in chunks of 200 statements
  const CHUNK_SIZE = 200;
  for (let i = 0; i < batchStatements.length; i += CHUNK_SIZE) {
    const chunk = batchStatements.slice(i, i + CHUNK_SIZE);
    await db.batch(chunk, "write");
  }

  return {
    totalRows: rows.length - 1,
    newWorkouts,
    skippedWorkouts,
    newSets,
  };
}
