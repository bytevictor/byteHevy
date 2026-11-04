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

export const SPANISH_SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sept", "oct", "nov", "dic",
];

/**
 * Parsea una fecha en la zona horaria de España (Europe/Madrid).
 */
function parseDateInMadrid(year: number, month: number, day: number, hour: number, minute: number): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  const targetIso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
  const testDate = new Date(`${year}-${pad(month)}-${pad(day)}T12:00:00Z`);
  const madridHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "numeric",
    hour12: false,
  }).format(testDate);
  const offsetHours = parseInt(madridHourStr, 10) - 12;
  const offsetSign = offsetHours >= 0 ? "+" : "-";
  const offsetStr = `${offsetSign}${pad(Math.abs(offsetHours))}:00`;
  const parsed = Date.parse(`${targetIso}${offsetStr}`);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formatea cualquier fecha o timestamp al formato canónico estándar de ByteHevy:
 * Ej: "28 oct 2026, 17:12"
 */
export function formatSpanishDate(dateOrTimestamp: Date | number): string {
  const d = typeof dateOrTimestamp === "number" ? new Date(dateOrTimestamp) : dateOrTimestamp;
  if (!d || isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const day = parseInt(partMap.day || "1", 10);
  const monthIdx = (parseInt(partMap.month || "1", 10) - 1 + 12) % 12;
  const monthStr = SPANISH_SHORT_MONTHS[monthIdx];
  const year = partMap.year || "2026";
  const hour = (partMap.hour || "00").padStart(2, "0");
  const minute = (partMap.minute || "00").padStart(2, "0");

  return `${day} ${monthStr} ${year}, ${hour}:${minute}`;
}

export function parseSpanishDate(str: string): number {
  if (!str) return 0;
  const trimmed = str.trim();

  // 1. Try standard JS Date parsing (covers ISO 8601 "2026-10-28T16:12:24.000Z", etc.)
  if (trimmed.includes("T") || trimmed.endsWith("Z")) {
    const nativeTs = Date.parse(trimmed);
    if (!Number.isNaN(nativeTs) && nativeTs > 0) {
      return nativeTs;
    }
  }

  // 2. Try Spanish date formats ("28 oct 2026, 17:12", "3 nov. 2026, 20:39", "03 noviembre 2026, 20:39")
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
      return parseDateInMadrid(year, month + 1, day, hour, minute);
    }
  }

  // 3. Fallback to standard Date parsing
  const fallbackTs = Date.parse(trimmed);
  if (!Number.isNaN(fallbackTs) && fallbackTs > 0) {
    return fallbackTs;
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
    const rawStartTimeStr = (row[idxStartTime] || "").trim();
    if (!title && !rawStartTimeStr) continue;

    const startMs = parseSpanishDate(rawStartTimeStr);
    const normalizedStartTime = startMs > 0 ? formatSpanishDate(startMs) : rawStartTimeStr;

    const key = `${normalizedStartTime}___${title}`;
    let workout = workoutsMap.get(key);

    if (!workout) {
      const rawEndTimeStr = (row[idxEndTime] || "").trim();
      const endMs = parseSpanishDate(rawEndTimeStr);
      const normalizedEndTime = endMs > 0 ? formatSpanishDate(endMs) : rawEndTimeStr;
      const desc = (row[idxDesc] || "").trim();
      const durationSec = endMs > startMs ? Math.round((endMs - startMs) / 1000) : 0;

      workout = {
        title: title || "Entrenamiento",
        startTimeStr: normalizedStartTime,
        startTimestamp: Math.floor(startMs / 1000),
        endTimeStr: normalizedEndTime,
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
  const existingRes = await db.execute("SELECT start_time, start_timestamp, title FROM workouts");
  const existingSet = new Set(
    existingRes.rows.map((r) => `${r.start_time}___${r.title}`)
  );
  const existingByTitle = new Map<string, number[]>();
  for (const r of existingRes.rows) {
    const t = String(r.title).trim();
    const ts = Number(r.start_timestamp);
    if (!existingByTitle.has(t)) existingByTitle.set(t, []);
    existingByTitle.get(t)!.push(ts);
  }

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
    let isDuplicate = existingSet.has(key);

    if (!isDuplicate) {
      const timestamps = existingByTitle.get(workout.title);
      if (timestamps) {
        // Tolerancia de 120s para capturar pequeñas diferencias entre export CSV (sin segundos) y API (con segundos)
        if (timestamps.some((ts) => Math.abs(ts - workout.startTimestamp) <= 120)) {
          isDuplicate = true;
        }
      }
    }

    if (isDuplicate) {
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
