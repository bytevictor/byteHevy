import { getDb, ensureSchema } from "./db";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getExerciseMedia } from "./exercise-media";
import { ExerciseMedia, MuscleGroup } from "@/types/exercise-media";
import { WeightRecord, enrichWithMovingAverages, parseWeightCsv } from "./mock-weight-data";

export type { WeightRecord };

export interface Season {
  id: string;
  name: string;
  startDate: string;
  startTimestamp: number;
  endDate: string | null;
  endTimestamp: number | null;
  description?: string;
  color?: string | null;
  workoutCount?: number;
  createdAt?: number;
}

export interface ExerciseSummary {
  id: string;
  name: string;
  metricType: "weight_reps" | "weighted_bodyweight" | "bodyweight_reps" | "seconds" | "cardio";
  sessionCount: number;
  latestTimestamp: number;
  latestDate: string;
  bestValue: number;
  bestLabel: string;
  latestTopSetLabel: string;
  seasonSessionCount?: number;
  seasonBestLabel?: string | null;
  seasonBestValue?: number | null;
  inSeason?: boolean;
  gifUrl?: string;
  primaryMuscle?: MuscleGroup;
}

export interface SetDetail {
  id: string;
  setIndex: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

export interface ExerciseSessionHistory {
  workoutId: string;
  workoutTitle: string;
  startTime: string;
  startTimestamp: number;
  workoutDescription: string;
  exerciseNotes: string;
  sets: SetDetail[];
  topSet: {
    primaryValue: number;
    secondaryValue?: number;
    label: string;
    isPR: boolean;
    isSeasonPR?: boolean;
    isAllTimePR?: boolean;
  };
  avg1RM?: number;
  avgReps?: number;
}

export interface ChartPoint {
  date: string;
  timestamp: number;
  primaryValue: number;
  secondaryValue?: number;
  label: string;
  isPR: boolean;
  isSeasonPR?: boolean;
  isAllTimePR?: boolean;
  workoutTitle: string;
  workoutId: string;
  avgReps?: number;
  totalVolume?: number;
  topWeight?: number;
  topReps?: number;
  setsCount?: number;
  est1RM?: number;
  avg1RM?: number;
}

export interface ExerciseDetailData {
  exercise: {
    id: string;
    name: string;
    metricType: "weight_reps" | "weighted_bodyweight" | "bodyweight_reps" | "seconds" | "cardio";
    media?: ExerciseMedia;
    allTimeBest: {
      value: number;
      label: string;
      date: string;
      workoutId?: string;
    } | null;
    seasonBest?: {
      value: number;
      label: string;
      date: string;
      workoutId?: string;
    } | null;
    allTimeBestAvg1RM?: {
      value: number;
      label: string;
      date: string;
      workoutId?: string;
    } | null;
    seasonBestAvg1RM?: {
      value: number;
      label: string;
      date: string;
      workoutId?: string;
    } | null;
    allTimeMax1RM?: {
      value: number;
      label: string;
      setLabel?: string;
      date: string;
      workoutId?: string;
    } | null;
    seasonMax1RM?: {
      value: number;
      label: string;
      setLabel?: string;
      date: string;
      workoutId?: string;
    } | null;
    estimated1RM: number | null;
    allTimeEstimated1RM?: number | null;
    allTimeMaxAvg1RM?: number | null;
    activeSeason?: {
      id: string;
      name: string;
      startDate: string;
      endDate: string | null;
    } | null;
    targetGoal?: {
      targetWeight?: number;
      targetReps?: number;
      target1RM?: number;
      targetLabel?: string;
    } | null;
  };
  chartPoints: ChartPoint[];
  sessions: ExerciseSessionHistory[];
}

export function calculate1RM(weight: number, reps: number): number {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1) return weight;
  if (reps > 15) return Math.round(weight * 1.5 * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function parseDateInputToTimestamp(dateStr: string, isEnd = false): number {
  if (!dateStr) return 0;
  const parts = dateStr.trim().split("-").map((p) => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2];
    const d = isEnd ? new Date(year, month, day, 23, 59, 59) : new Date(year, month, day, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
  const d = new Date(dateStr);
  return Math.floor(d.getTime() / 1000);
}

export async function getSeasons(): Promise<Season[]> {
  const db = getDb();
  await ensureSchema(db);

  const res = await db.execute(`
    SELECT s.id, s.name, s.start_date, s.start_timestamp, s.end_date, s.end_timestamp, s.description, s.color, s.created_at,
           (
             SELECT COUNT(*) FROM workouts w
             WHERE w.start_timestamp >= s.start_timestamp
               AND (s.end_timestamp IS NULL OR w.start_timestamp <= s.end_timestamp)
           ) as workout_count
    FROM seasons s
    ORDER BY s.start_timestamp DESC
  `);

  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    startDate: String(r.start_date),
    startTimestamp: Number(r.start_timestamp),
    endDate: r.end_date ? String(r.end_date) : null,
    endTimestamp: r.end_timestamp !== null && r.end_timestamp !== undefined ? Number(r.end_timestamp) : null,
    description: r.description ? String(r.description) : "",
    color: r.color ? String(r.color) : null,
    workoutCount: Number(r.workout_count) || 0,
    createdAt: Number(r.created_at) || 0,
  }));
}

export async function getSeasonById(id: string): Promise<Season | null> {
  const db = getDb();
  await ensureSchema(db);

  const res = await db.execute({
    sql: `SELECT s.id, s.name, s.start_date, s.start_timestamp, s.end_date, s.end_timestamp, s.description, s.color, s.created_at,
                 (
                   SELECT COUNT(*) FROM workouts w
                   WHERE w.start_timestamp >= s.start_timestamp
                     AND (s.end_timestamp IS NULL OR w.start_timestamp <= s.end_timestamp)
                 ) as workout_count
          FROM seasons s
          WHERE s.id = ?`,
    args: [id],
  });

  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: String(r.id),
    name: String(r.name),
    startDate: String(r.start_date),
    startTimestamp: Number(r.start_timestamp),
    endDate: r.end_date ? String(r.end_date) : null,
    endTimestamp: r.end_timestamp !== null && r.end_timestamp !== undefined ? Number(r.end_timestamp) : null,
    description: r.description ? String(r.description) : "",
    color: r.color ? String(r.color) : null,
    workoutCount: Number(r.workout_count) || 0,
    createdAt: Number(r.created_at) || 0,
  };
}

export async function createSeason(data: {
  name: string;
  startDate: string;
  endDate?: string | null;
  description?: string;
  color?: string | null;
}): Promise<Season> {
  const db = getDb();
  await ensureSchema(db);

  const id = crypto.randomUUID();
  const startTimestamp = parseDateInputToTimestamp(data.startDate, false);
  const endTimestamp = data.endDate && data.endDate.trim() !== "" ? parseDateInputToTimestamp(data.endDate, true) : null;

  await db.execute({
    sql: `INSERT INTO seasons (id, name, start_date, start_timestamp, end_date, end_timestamp, description, color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.name.trim(),
      data.startDate.trim(),
      startTimestamp,
      data.endDate && data.endDate.trim() !== "" ? data.endDate.trim() : null,
      endTimestamp,
      data.description ? data.description.trim() : "",
      data.color && data.color.trim() !== "" ? data.color.trim() : null,
    ],
  });

  return (await getSeasonById(id))!;
}

export async function updateSeason(
  id: string,
  data: {
    name: string;
    startDate: string;
    endDate?: string | null;
    description?: string;
    color?: string | null;
  }
): Promise<Season | null> {
  const db = getDb();
  await ensureSchema(db);

  const startTimestamp = parseDateInputToTimestamp(data.startDate, false);
  const endTimestamp = data.endDate && data.endDate.trim() !== "" ? parseDateInputToTimestamp(data.endDate, true) : null;

  await db.execute({
    sql: `UPDATE seasons 
          SET name = ?, start_date = ?, start_timestamp = ?, end_date = ?, end_timestamp = ?, description = ?, color = ?
          WHERE id = ?`,
    args: [
      data.name.trim(),
      data.startDate.trim(),
      startTimestamp,
      data.endDate && data.endDate.trim() !== "" ? data.endDate.trim() : null,
      endTimestamp,
      data.description ? data.description.trim() : "",
      data.color && data.color.trim() !== "" ? data.color.trim() : null,
      id,
    ],
  });

  return await getSeasonById(id);
}

export async function deleteSeason(id: string): Promise<boolean> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: "DELETE FROM seasons WHERE id = ?",
    args: [id],
  });
  return true;
}

export async function getCachedMediaMap(db: ReturnType<typeof getDb>): Promise<Map<string, ExerciseMedia>> {
  const map = new Map<string, ExerciseMedia>();
  try {
    const res = await db.execute("SELECT exercise_name, data_json FROM exercisedb_cache");
    for (const row of res.rows) {
      const key = String(row.exercise_name).toLowerCase().trim();
      try {
        const parsed = JSON.parse(String(row.data_json)) as ExerciseMedia;
        const isBogusChestPress =
          (parsed.gifUrl?.includes("chest-press") || parsed.gifUrl?.includes("lever-chest-press")) &&
          parsed.primaryMuscle !== "chest" &&
          !key.includes("chest") &&
          !key.includes("pecho");

        if (!isBogusChestPress) {
          map.set(key, parsed);
        }
      } catch {}
    }
  } catch (e) {
    // Cache table might not exist or empty
  }
  return map;
}

export async function getExercisesList(seasonId?: string | null): Promise<ExerciseSummary[]> {
  const db = getDb();
  await ensureSchema(db);

  const cacheMap = await getCachedMediaMap(db);

  let season: Season | null = null;
  if (seasonId && seasonId !== "all") {
    season = await getSeasonById(seasonId);
  }

  const exercisesRes = await db.execute(
    "SELECT id, name, metric_type FROM exercises ORDER BY name ASC"
  );

  const results: ExerciseSummary[] = [];

  for (const exRow of exercisesRes.rows) {
    const exId = String(exRow.id);
    const exName = String(exRow.name);
    const exMetric = String(exRow.metric_type) as ExerciseSummary["metricType"];

    const sessionsRes = await db.execute({
      sql: `SELECT w.id as workout_id, w.start_time, w.start_timestamp, 
                   s.weight_kg, s.reps, s.duration_seconds, s.distance_km
            FROM workouts w
            JOIN workout_exercises we ON we.workout_id = w.id
            JOIN exercise_sets s ON s.workout_exercise_id = we.id
            WHERE we.exercise_id = ?
            ORDER BY w.start_timestamp ASC`,
      args: [exId],
    });

    if (sessionsRes.rows.length === 0) continue;

    const workoutsMap = new Map<string, {
      startTime: string;
      startTimestamp: number;
      sets: typeof sessionsRes.rows;
    }>();

    for (const r of sessionsRes.rows) {
      const wId = String(r.workout_id);
      if (!workoutsMap.has(wId)) {
        workoutsMap.set(wId, {
          startTime: String(r.start_time),
          startTimestamp: Number(r.start_timestamp),
          sets: [],
        });
      }
      workoutsMap.get(wId)!.sets.push(r);
    }

    const uniqueWorkouts = Array.from(workoutsMap.values()).sort(
      (a, b) => a.startTimestamp - b.startTimestamp
    );

    // 1. Calculate All-Time best
    let allTimeBestVal = 0;
    let allTimeBestLabel = "";

    for (const w of uniqueWorkouts) {
      for (const s of w.sets) {
        const wt = s.weight_kg !== null && s.weight_kg !== undefined ? Number(s.weight_kg) : 0;
        const rp = s.reps !== null && s.reps !== undefined ? Number(s.reps) : 0;
        const dur = s.duration_seconds !== null && s.duration_seconds !== undefined ? Number(s.duration_seconds) : 0;
        const dist = s.distance_km !== null && s.distance_km !== undefined ? Number(s.distance_km) : 0;

        if (exMetric === "seconds") {
          if (dur > allTimeBestVal) {
            allTimeBestVal = dur;
            allTimeBestLabel = `${dur}s`;
          }
        } else if (exMetric === "cardio") {
          if (dist > allTimeBestVal) {
            allTimeBestVal = dist;
            allTimeBestLabel = `${dist} km`;
          }
        } else if (exMetric === "weighted_bodyweight") {
          const score = wt > 0 ? 100000 + wt * 1000 + rp : (wt === 0 ? 10000 + rp : 10000 + wt * 100 + rp);
          if (score > allTimeBestVal && rp > 0) {
            allTimeBestVal = score;
            allTimeBestLabel = wt > 0 ? `+${wt} kg × ${rp}` : `0kg + BW × ${rp}`;
          }
        } else if (exMetric === "bodyweight_reps") {
          if (rp > allTimeBestVal) {
            allTimeBestVal = rp;
            allTimeBestLabel = `${rp} reps`;
          }
        } else {
          // weight_reps
          const score = wt * 100 + rp;
          if (score > allTimeBestVal) {
            allTimeBestVal = score;
            allTimeBestLabel = `${wt} kg × ${rp}`;
          }
        }
      }
    }

    // 2. Calculate Season workouts & Season best (if season active)
    const seasonWorkouts = season
      ? uniqueWorkouts.filter(
          (w) =>
            w.startTimestamp >= season!.startTimestamp &&
            (!season!.endTimestamp || w.startTimestamp <= season!.endTimestamp)
        )
      : uniqueWorkouts;

    let seasonBestVal = 0;
    let seasonBestLabel = "";

    for (const w of seasonWorkouts) {
      for (const s of w.sets) {
        const wt = s.weight_kg !== null && s.weight_kg !== undefined ? Number(s.weight_kg) : 0;
        const rp = s.reps !== null && s.reps !== undefined ? Number(s.reps) : 0;
        const dur = s.duration_seconds !== null && s.duration_seconds !== undefined ? Number(s.duration_seconds) : 0;
        const dist = s.distance_km !== null && s.distance_km !== undefined ? Number(s.distance_km) : 0;

        if (exMetric === "seconds") {
          if (dur > seasonBestVal) {
            seasonBestVal = dur;
            seasonBestLabel = `${dur}s`;
          }
        } else if (exMetric === "cardio") {
          if (dist > seasonBestVal) {
            seasonBestVal = dist;
            seasonBestLabel = `${dist} km`;
          }
        } else if (exMetric === "weighted_bodyweight") {
          const score = wt > 0 ? 100000 + wt * 1000 + rp : (wt === 0 ? 10000 + rp : 10000 + wt * 100 + rp);
          if (score > seasonBestVal && rp > 0) {
            seasonBestVal = score;
            seasonBestLabel = wt > 0 ? `+${wt} kg × ${rp}` : `0kg + BW × ${rp}`;
          }
        } else if (exMetric === "bodyweight_reps") {
          if (rp > seasonBestVal) {
            seasonBestVal = rp;
            seasonBestLabel = `${rp} reps`;
          }
        } else {
          const score = wt * 100 + rp;
          if (score > seasonBestVal) {
            seasonBestVal = score;
            seasonBestLabel = `${wt} kg × ${rp}`;
          }
        }
      }
    }

    const latest = seasonWorkouts.length > 0
      ? seasonWorkouts[seasonWorkouts.length - 1]
      : (uniqueWorkouts.length > 0 ? uniqueWorkouts[uniqueWorkouts.length - 1] : null);

    let latestTopLabel = "-";
    if (latest && latest.sets.length > 0) {
      if (exMetric === "seconds") {
        const maxSec = Math.max(...latest.sets.map((s) => Number(s.duration_seconds) || 0));
        latestTopLabel = `${maxSec}s`;
      } else if (exMetric === "cardio") {
        const maxDist = Math.max(...latest.sets.map((s) => Number(s.distance_km) || 0));
        latestTopLabel = `${maxDist} km`;
      } else if (exMetric === "weighted_bodyweight") {
        let top = latest.sets[0];
        let maxScore = -999999;
        for (const s of latest.sets) {
          const w = s.weight_kg !== null && s.weight_kg !== undefined ? Number(s.weight_kg) : 0;
          const r = Number(s.reps) || 0;
          const sc = w > 0 ? 100000 + w * 1000 + r : (w === 0 ? 10000 + r : 10000 + w * 100 + r);
          if (sc > maxScore && r > 0) {
            maxScore = sc;
            top = s;
          }
        }
        const tw = top?.weight_kg !== null && top?.weight_kg !== undefined ? Number(top.weight_kg) : 0;
        const tr = Number(top?.reps) || 0;
        latestTopLabel = tw > 0 ? `+${tw} kg × ${tr}` : `0kg + BW × ${tr}`;
      } else if (exMetric === "bodyweight_reps") {
        const maxReps = Math.max(...latest.sets.map((s) => Number(s.reps) || 0));
        latestTopLabel = `${maxReps} reps`;
      } else {
        let top = latest.sets[0];
        let maxScore = -1;
        for (const s of latest.sets) {
          const w = Number(s.weight_kg) || 0;
          const r = Number(s.reps) || 0;
          const sc = w * 100 + r;
          if (sc > maxScore) {
            maxScore = sc;
            top = s;
          }
        }
        latestTopLabel = `${top.weight_kg} kg × ${top.reps}`;
      }
    }

    const cachedMedia = cacheMap.get(exName.toLowerCase().trim());
    const fallbackMedia = getExerciseMedia(exName);
    const resolvedGifUrl = cachedMedia?.gifUrl || fallbackMedia.gifUrl;
    const resolvedPrimaryMuscle = cachedMedia?.primaryMuscle || fallbackMedia.primaryMuscle;

    results.push({
      id: exId,
      name: exName,
      metricType: exMetric,
      sessionCount: season ? seasonWorkouts.length : uniqueWorkouts.length,
      latestTimestamp: latest ? latest.startTimestamp : 0,
      latestDate: latest ? latest.startTime : "-",
      bestValue: allTimeBestVal,
      bestLabel: allTimeBestLabel,
      latestTopSetLabel: latestTopLabel,
      seasonSessionCount: seasonWorkouts.length,
      seasonBestLabel: season ? (seasonBestVal > 0 ? seasonBestLabel : null) : allTimeBestLabel,
      seasonBestValue: season ? (seasonBestVal > 0 ? seasonBestVal : null) : allTimeBestVal,
      inSeason: season ? seasonWorkouts.length > 0 : true,
      gifUrl: resolvedGifUrl,
      primaryMuscle: resolvedPrimaryMuscle,
    });
  }

  return results.sort((a, b) => {
    if (season) {
      if (a.inSeason !== b.inSeason) return a.inSeason ? -1 : 1;
    }
    return b.sessionCount - a.sessionCount || b.latestTimestamp - a.latestTimestamp;
  });
}

export async function getExerciseDetail(
  exerciseId: string,
  seasonId?: string | null
): Promise<ExerciseDetailData | null> {
  const db = getDb();
  await ensureSchema(db);

  const exRes = await db.execute({
    sql: "SELECT id, name, metric_type FROM exercises WHERE id = ?",
    args: [exerciseId],
  });

  if (exRes.rows.length === 0) return null;
  const ex = exRes.rows[0];
  const metricType = String(ex.metric_type) as ExerciseDetailData["exercise"]["metricType"];

  const rowsRes = await db.execute({
    sql: `SELECT w.id as workout_id, w.title as workout_title, w.start_time, w.start_timestamp,
                 w.description as workout_description,
                 we.id as we_id, we.exercise_notes,
                 s.id as set_id, s.set_index, s.set_type, s.weight_kg, s.reps, s.distance_km, s.duration_seconds, s.rpe
          FROM workouts w
          JOIN workout_exercises we ON we.workout_id = w.id
          JOIN exercise_sets s ON s.workout_exercise_id = we.id
          WHERE we.exercise_id = ?
          ORDER BY w.start_timestamp ASC, s.set_index ASC`,
    args: [exerciseId],
  });

  const workoutMap = new Map<string, {
    workoutId: string;
    workoutTitle: string;
    startTime: string;
    startTimestamp: number;
    workoutDescription: string;
    exerciseNotes: string;
    sets: SetDetail[];
  }>();

  for (const r of rowsRes.rows) {
    const wId = String(r.workout_id);
    if (!workoutMap.has(wId)) {
      workoutMap.set(wId, {
        workoutId: wId,
        workoutTitle: String(r.workout_title),
        startTime: String(r.start_time),
        startTimestamp: Number(r.start_timestamp),
        workoutDescription: r.workout_description ? String(r.workout_description) : "",
        exerciseNotes: r.exercise_notes ? String(r.exercise_notes) : "",
        sets: [],
      });
    }

    workoutMap.get(wId)!.sets.push({
      id: String(r.set_id),
      setIndex: Number(r.set_index),
      setType: String(r.set_type || "normal"),
      weightKg: r.weight_kg !== null && r.weight_kg !== undefined ? Number(r.weight_kg) : null,
      reps: r.reps !== null && r.reps !== undefined ? Number(r.reps) : null,
      distanceKm: r.distance_km !== null && r.distance_km !== undefined ? Number(r.distance_km) : null,
      durationSeconds: r.duration_seconds !== null && r.duration_seconds !== undefined ? Number(r.duration_seconds) : null,
      rpe: r.rpe !== null && r.rpe !== undefined ? Number(r.rpe) : null,
    });
  }

  const chronologicalWorkouts = Array.from(workoutMap.values()).sort(
    (a, b) => a.startTimestamp - b.startTimestamp
  );

  // 1. Calculate All-Time Best Record across ALL workouts
  let allTimeBestRecord: { value: number; label: string; date: string; workoutId: string } | null = null;
  let allTimeBestScore = -999999;
  let allTimeMaxEst1RM = 0;
  let allTimeMaxAvg1RM = 0;
  let allTimeBestAvg1RMRecord: { value: number; label: string; date: string; workoutId: string } | null = null;
  let allTimeMax1RM = 0;
  let allTimeMax1RMRecord: {
    value: number;
    label: string;
    setLabel?: string;
    date: string;
    workoutId: string;
  } | null = null;

  for (const w of chronologicalWorkouts) {
    let topVal = 0;
    let est1RM: number | undefined = undefined;
    let label = "";
    let score = -999999;

    if (metricType === "seconds") {
      topVal = Math.max(...w.sets.map((s) => s.durationSeconds || 0));
      label = `${topVal}s`;
      score = topVal;
    } else if (metricType === "cardio") {
      topVal = Math.max(...w.sets.map((s) => s.distanceKm || 0));
      label = `${topVal} km`;
      score = topVal;
    } else if (metricType === "weighted_bodyweight") {
      let top = w.sets[0];
      let bestScore = -999999;
      for (const s of w.sets) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sc = wt > 0 ? 100000 + wt * 1000 + rp : (wt === 0 ? 10000 + rp : 10000 + wt * 100 + rp);
        if (sc > bestScore && rp > 0) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top?.weightKg ?? 0;
      score = bestScore;
      const topReps = Number(top?.reps) || 0;
      if (topVal > 0) {
        label = `+${topVal} kg × ${topReps}`;
        if (topReps > 0) est1RM = calculate1RM(topVal, topReps);
      } else {
        label = `0kg + BW × ${topReps}`;
      }
    } else if (metricType === "bodyweight_reps") {
      topVal = Math.max(...w.sets.map((s) => s.reps || 0));
      label = `${topVal} reps`;
      score = topVal;
    } else {
      let top = w.sets[0];
      let bestScore = -1;
      for (const s of w.sets) {
        const wt = s.weightKg || 0;
        const rp = s.reps || 0;
        const sc = wt * 100 + rp;
        if (sc > bestScore) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top?.weightKg || 0;
      score = bestScore;
      label = `${topVal} kg × ${top?.reps ?? 0}`;
      if (topVal > 0 && top?.reps) {
        est1RM = calculate1RM(topVal, top.reps);
      }
    }

    if (est1RM && est1RM > allTimeMaxEst1RM) {
      allTimeMaxEst1RM = est1RM;
    }

    let wMax1RM = 0;
    let wMax1RMSet: SetDetail | null = null;
    for (const s of w.sets) {
      const wt = Number(s.weightKg) || 0;
      const rp = Number(s.reps) || 0;
      if (wt > 0 && rp > 0) {
        const s1RM = calculate1RM(wt, rp);
        if (s1RM > wMax1RM) {
          wMax1RM = s1RM;
          wMax1RMSet = s;
        }
      }
    }

    if (wMax1RM > allTimeMaxEst1RM) {
      allTimeMaxEst1RM = wMax1RM;
    }

    if (wMax1RM > 0 && wMax1RM > allTimeMax1RM) {
      allTimeMax1RM = wMax1RM;
      const isWeightedBw = metricType === "weighted_bodyweight";
      const sLabel = wMax1RMSet
        ? (isWeightedBw ? `+${wMax1RMSet.weightKg} kg × ${wMax1RMSet.reps}` : `${wMax1RMSet.weightKg} kg × ${wMax1RMSet.reps}`)
        : undefined;
      allTimeMax1RMRecord = {
        value: wMax1RM,
        label: `${wMax1RM} kg 1RM`,
        setLabel: sLabel,
        date: w.startTime,
        workoutId: w.workoutId,
      };
    }

    const workingSets = w.sets.filter((s) => s.setType !== "warmup");
    const setsToEvaluate = workingSets.length > 0 ? workingSets : w.sets;
    const set1RMs: number[] = [];
    for (const s of setsToEvaluate) {
      const wt = Number(s.weightKg) || 0;
      const rp = Number(s.reps) || 0;
      if (wt > 0 && rp > 0) {
        const sEst = calculate1RM(wt, rp);
        if (sEst > 0) set1RMs.push(sEst);
      }
    }
    const avg1RM = set1RMs.length > 0
      ? Number((set1RMs.reduce((sum, val) => sum + val, 0) / set1RMs.length).toFixed(1))
      : (est1RM ? Number(est1RM.toFixed(1)) : undefined);

    const setsWithReps = w.sets.filter((s) => s.reps !== null && s.reps !== undefined && Number(s.reps) > 0);
    const totalReps = setsWithReps.reduce((sum, s) => sum + Number(s.reps), 0);
    const avgReps = setsWithReps.length > 0 ? Number((totalReps / setsWithReps.length).toFixed(1)) : undefined;

    let avgMetricVal = 0;
    let avgMetricLabel = "";
    if (metricType === "bodyweight_reps") {
      if (avgReps && avgReps > 0) {
        avgMetricVal = avgReps;
        avgMetricLabel = `${avgReps} reps/serie`;
      }
    } else {
      if (avg1RM && avg1RM > 0) {
        avgMetricVal = avg1RM;
        avgMetricLabel = `${avg1RM} kg 1RM`;
      }
    }

    if (avgMetricVal > 0 && avgMetricVal > allTimeMaxAvg1RM) {
      allTimeMaxAvg1RM = avgMetricVal;
      allTimeBestAvg1RMRecord = {
        value: avgMetricVal,
        label: avgMetricLabel,
        date: w.startTime,
        workoutId: w.workoutId,
      };
    } else if (avg1RM && avg1RM > allTimeMaxAvg1RM) {
      allTimeMaxAvg1RM = avg1RM;
    }

    if (score > allTimeBestScore && (topVal > 0 || score > 0)) {
      allTimeBestScore = score;
      allTimeBestRecord = {
        value: topVal,
        label,
        date: w.startTime,
        workoutId: w.workoutId,
      };
    }
  }

  // 2. Resolve Active Season (if provided)
  let season: Season | null = null;
  if (seasonId && seasonId !== "all") {
    season = await getSeasonById(seasonId);
  }

  const activeWorkouts = season
    ? chronologicalWorkouts.filter(
        (w) =>
          w.startTimestamp >= season!.startTimestamp &&
          (!season!.endTimestamp || w.startTimestamp <= season!.endTimestamp)
      )
    : chronologicalWorkouts;

  const chartPoints: ChartPoint[] = [];
  const sessions: ExerciseSessionHistory[] = [];

  let seasonRunningBestScore = -999999;
  let seasonBestRecord: { value: number; label: string; date: string; workoutId: string } | null = null;
  let seasonMaxEst1RM = 0;
  let seasonMaxAvg1RM = 0;
  let seasonBestAvg1RMRecord: { value: number; label: string; date: string; workoutId: string } | null = null;
  let seasonMax1RM = 0;
  let seasonMax1RMRecord: {
    value: number;
    label: string;
    setLabel?: string;
    date: string;
    workoutId: string;
  } | null = null;

  for (const w of activeWorkouts) {
    let topVal = 0;
    let est1RM: number | undefined = undefined;
    let label = "";
    let score = -999999;

    if (metricType === "seconds") {
      topVal = Math.max(...w.sets.map((s) => s.durationSeconds || 0));
      label = `${topVal}s`;
      score = topVal;
    } else if (metricType === "cardio") {
      topVal = Math.max(...w.sets.map((s) => s.distanceKm || 0));
      label = `${topVal} km`;
      score = topVal;
    } else if (metricType === "weighted_bodyweight") {
      let top = w.sets[0];
      let bestScore = -999999;
      for (const s of w.sets) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sc = wt > 0 ? 100000 + wt * 1000 + rp : (wt === 0 ? 10000 + rp : 10000 + wt * 100 + rp);
        if (sc > bestScore && rp > 0) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top?.weightKg ?? 0;
      score = bestScore;
      const topReps = Number(top?.reps) || 0;
      if (topVal > 0) {
        label = `+${topVal} kg × ${topReps}`;
        if (topReps > 0) est1RM = calculate1RM(topVal, topReps);
      } else {
        label = `0kg + BW × ${topReps}`;
      }
    } else if (metricType === "bodyweight_reps") {
      topVal = Math.max(...w.sets.map((s) => s.reps || 0));
      label = `${topVal} reps`;
      score = topVal;
    } else {
      let top = w.sets[0];
      let bestScore = -1;
      for (const s of w.sets) {
        const wt = s.weightKg || 0;
        const rp = s.reps || 0;
        const sc = wt * 100 + rp;
        if (sc > bestScore) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top?.weightKg || 0;
      score = bestScore;
      label = `${topVal} kg × ${top?.reps ?? 0}`;
      if (topVal > 0 && top?.reps) {
        est1RM = calculate1RM(topVal, top.reps);
      }
    }

    if (est1RM && est1RM > seasonMaxEst1RM) {
      seasonMaxEst1RM = est1RM;
    }

    let sWMax1RM = 0;
    let sWMax1RMSet: SetDetail | null = null;
    for (const s of w.sets) {
      const wt = Number(s.weightKg) || 0;
      const rp = Number(s.reps) || 0;
      if (wt > 0 && rp > 0) {
        const s1RM = calculate1RM(wt, rp);
        if (s1RM > sWMax1RM) {
          sWMax1RM = s1RM;
          sWMax1RMSet = s;
        }
      }
    }

    if (sWMax1RM > seasonMaxEst1RM) {
      seasonMaxEst1RM = sWMax1RM;
    }

    if (sWMax1RM > 0 && sWMax1RM > seasonMax1RM) {
      seasonMax1RM = sWMax1RM;
      const isWeightedBw = metricType === "weighted_bodyweight";
      const sLabel = sWMax1RMSet
        ? (isWeightedBw ? `+${sWMax1RMSet.weightKg} kg × ${sWMax1RMSet.reps}` : `${sWMax1RMSet.weightKg} kg × ${sWMax1RMSet.reps}`)
        : undefined;
      seasonMax1RMRecord = {
        value: sWMax1RM,
        label: `${sWMax1RM} kg 1RM`,
        setLabel: sLabel,
        date: w.startTime,
        workoutId: w.workoutId,
      };
    }

    const isPR = score > seasonRunningBestScore && (topVal > 0 || score > 0);
    if (isPR) {
      seasonRunningBestScore = score;
      seasonBestRecord = {
        value: topVal,
        label,
        date: w.startTime,
        workoutId: w.workoutId,
      };
    }

    const isAllTimePR = allTimeBestRecord
      ? (w.workoutId === allTimeBestRecord.workoutId || (allTimeBestScore > 0 && score >= allTimeBestScore))
      : false;

    // Calculate Average Reps, Volume, and Top Set details for this session
    const setsWithReps = w.sets.filter((s) => s.reps !== null && s.reps !== undefined && Number(s.reps) > 0);
    const totalReps = setsWithReps.reduce((sum, s) => sum + Number(s.reps), 0);
    const avgReps = setsWithReps.length > 0 ? Number((totalReps / setsWithReps.length).toFixed(1)) : undefined;

    // Filter working sets (ignore warmup sets if present)
    const workingSets = w.sets.filter((s) => s.setType !== "warmup");
    const setsToEvaluate = workingSets.length > 0 ? workingSets : w.sets;

    // Calculate Average 1RM across working sets of the session
    const set1RMs: number[] = [];
    for (const s of setsToEvaluate) {
      const wt = Number(s.weightKg) || 0;
      const rp = Number(s.reps) || 0;
      if (wt > 0 && rp > 0) {
        const sEst = calculate1RM(wt, rp);
        if (sEst > 0) {
          set1RMs.push(sEst);
        }
      }
    }
    const avg1RM = set1RMs.length > 0
      ? Number((set1RMs.reduce((sum, val) => sum + val, 0) / set1RMs.length).toFixed(1))
      : (est1RM ? Number(est1RM.toFixed(1)) : undefined);

    let seasonAvgMetricVal = 0;
    let seasonAvgMetricLabel = "";
    if (metricType === "bodyweight_reps") {
      if (avgReps && avgReps > 0) {
        seasonAvgMetricVal = avgReps;
        seasonAvgMetricLabel = `${avgReps} reps/serie`;
      }
    } else {
      if (avg1RM && avg1RM > 0) {
        seasonAvgMetricVal = avg1RM;
        seasonAvgMetricLabel = `${avg1RM} kg 1RM`;
      }
    }

    if (seasonAvgMetricVal > 0 && seasonAvgMetricVal > seasonMaxAvg1RM) {
      seasonMaxAvg1RM = seasonAvgMetricVal;
      seasonBestAvg1RMRecord = {
        value: seasonAvgMetricVal,
        label: seasonAvgMetricLabel,
        date: w.startTime,
        workoutId: w.workoutId,
      };
    }

    let totalVol = 0;
    for (const s of w.sets) {
      const wt = Number(s.weightKg) || 0;
      const rp = Number(s.reps) || 0;
      if (wt > 0 && rp > 0) {
        totalVol += wt * rp;
      } else if (rp > 0) {
        totalVol += rp;
      }
    }
    const totalVolume = totalVol > 0 ? Math.round(totalVol) : undefined;

    let topWeightVal: number | undefined = undefined;
    let topRepsVal: number | undefined = undefined;
    if (metricType === "weighted_bodyweight" || metricType === "weight_reps") {
      let top = w.sets[0];
      let bestScore = -999999;
      for (const s of w.sets) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sc = metricType === "weighted_bodyweight"
          ? (wt > 0 ? 100000 + wt * 1000 + rp : (wt === 0 ? 10000 + rp : 10000 + wt * 100 + rp))
          : (wt * 100 + rp);
        if (sc > bestScore && rp > 0) {
          bestScore = sc;
          top = s;
        }
      }
      topWeightVal = top?.weightKg !== null && top?.weightKg !== undefined ? Number(top.weightKg) : 0;
      topRepsVal = top?.reps !== null && top?.reps !== undefined ? Number(top.reps) : undefined;
    } else if (metricType === "bodyweight_reps") {
      topRepsVal = topVal;
    }

    const point: ChartPoint = {
      date: w.startTime,
      timestamp: w.startTimestamp,
      primaryValue: topVal,
      secondaryValue: est1RM,
      label,
      isPR,
      isAllTimePR,
      workoutTitle: w.workoutTitle,
      workoutId: w.workoutId,
      avgReps,
      totalVolume,
      topWeight: topWeightVal,
      topReps: topRepsVal,
      setsCount: w.sets.length,
      est1RM,
      avg1RM,
    };

    chartPoints.push(point);

    sessions.push({
      ...w,
      topSet: {
        primaryValue: topVal,
        secondaryValue: est1RM,
        label,
        isPR,
        isAllTimePR,
      },
      avg1RM,
      avgReps,
    });
  }

  // Mark Season PR (if season is active and seasonBestRecord was achieved)
  if (season && seasonBestRecord) {
    for (const pt of chartPoints) {
      if (pt.workoutId === seasonBestRecord.workoutId) {
        if (!pt.isAllTimePR) {
          pt.isSeasonPR = true;
        }
      }
    }
    for (const sess of sessions) {
      if (sess.workoutId === seasonBestRecord.workoutId) {
        if (!sess.topSet.isAllTimePR) {
          sess.topSet.isSeasonPR = true;
        }
      }
    }
  }

  sessions.reverse();

  const exNameKey = String(ex.name).toLowerCase().trim();
  let exerciseMedia: ExerciseMedia | undefined = undefined;
  try {
    const cacheRow = await db.execute({
      sql: "SELECT data_json FROM exercisedb_cache WHERE exercise_name = ?",
      args: [exNameKey],
    });
    if (cacheRow.rows.length > 0 && cacheRow.rows[0].data_json) {
      exerciseMedia = JSON.parse(String(cacheRow.rows[0].data_json));
    }
  } catch {}
  if (!exerciseMedia) {
    exerciseMedia = getExerciseMedia(String(ex.name));
  }

  // Fetch target goal for this exercise if configured with weight and repetitions
  let targetGoal: {
    targetWeight?: number;
    targetReps?: number;
    target1RM?: number;
    targetLabel?: string;
  } | null = null;

  try {
    const goalRes = await db.execute({
      sql: `SELECT target_weight, target_reps, target_seconds, target_distance_km, metric_type
            FROM goals
            WHERE exercise_id = ?`,
      args: [exerciseId],
    });

    if (goalRes.rows.length > 0) {
      const g = goalRes.rows[0];
      const gWeight = g.target_weight !== null && g.target_weight !== undefined ? Number(g.target_weight) : undefined;
      const gReps = g.target_reps !== null && g.target_reps !== undefined ? Number(g.target_reps) : undefined;
      if (gWeight !== undefined && gReps !== undefined && gWeight > 0 && gReps > 0) {
        const g1RM = calculate1RM(gWeight, gReps);
        targetGoal = {
          targetWeight: gWeight,
          targetReps: gReps,
          target1RM: g1RM,
          targetLabel: `${gWeight} kg × ${gReps}`,
        };
      }
    }
  } catch (e) {
    console.error("Error fetching goal for exercise detail:", e);
  }

  return {
    exercise: {
      id: String(ex.id),
      name: String(ex.name),
      metricType,
      media: exerciseMedia,
      allTimeBest: allTimeBestRecord,
      seasonBest: season ? seasonBestRecord : allTimeBestRecord,
      allTimeBestAvg1RM: allTimeBestAvg1RMRecord,
      seasonBestAvg1RM: season ? seasonBestAvg1RMRecord : allTimeBestAvg1RMRecord,
      allTimeMax1RM: allTimeMax1RMRecord,
      seasonMax1RM: season ? seasonMax1RMRecord : allTimeMax1RMRecord,
      estimated1RM: season ? (seasonMaxEst1RM > 0 ? seasonMaxEst1RM : null) : (allTimeMaxEst1RM > 0 ? allTimeMaxEst1RM : null),
      allTimeEstimated1RM: allTimeMaxEst1RM > 0 ? allTimeMaxEst1RM : null,
      allTimeMaxAvg1RM: allTimeMaxAvg1RM > 0 ? allTimeMaxAvg1RM : null,
      activeSeason: season ? {
        id: season.id,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
      } : null,
      targetGoal,
    },
    chartPoints,
    sessions,
  };
}

export interface GoalItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  metricType: "weight_reps" | "weighted_bodyweight" | "bodyweight_reps" | "seconds" | "cardio";

  // Season Record
  seasonLabel: string;
  season1RM?: number;
  seasonWeight?: number;
  seasonReps?: number;
  hasSeasonData: boolean;

  // All-time Record
  allTimeLabel: string;
  allTime1RM?: number;
  allTimeWeight?: number;
  allTimeReps?: number;
  hasAllTimeData: boolean;
  allTimeReached: boolean;

  // Target Goal
  targetLabel: string;
  target1RM?: number;
  targetWeight?: number;
  targetReps?: number;
  targetSeconds?: number;
  targetDistanceKm?: number;

  // Baseline Reference (Mínimo de la season si hay season, o mínimo histórico)
  baselineLabel: string;
  baseline1RM?: number;
  baselineWeight?: number;
  baselineReps?: number;
  baselineType: "season" | "all_time";

  // Progress metrics
  progressPct: number;
  isCompleted: boolean;
  remainingGapLabel?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  activeSeasonName?: string;
  activeSeasonColor?: string;

  // Backwards compatibility fields
  currentWeight?: number;
  currentReps?: number;
  currentSeconds?: number;
  currentDistanceKm?: number;
  current1RM?: number;
  currentLabel: string;
  gifUrl?: string;
  primaryMuscle?: MuscleGroup;
}

export async function getGoals(seasonId?: string | null): Promise<GoalItem[]> {
  const db = getDb();
  await ensureSchema(db);

  const cacheMap = await getCachedMediaMap(db);

  const isExplicitSeason = Boolean(seasonId && seasonId !== "all");
  let season: Season | null = null;
  if (isExplicitSeason) {
    season = await getSeasonById(seasonId!);
  } else {
    // If viewing all, still find the current/latest season for display purposes
    const allSeasons = await getSeasons();
    season = allSeasons.find((s) => !s.endDate || s.endDate.toLowerCase() === "actualidad") || allSeasons[0] || null;
  }

  const goalsRes = await db.execute(
    `SELECT g.id, g.exercise_id, e.name as exercise_name, g.metric_type,
            g.target_weight, g.target_reps, g.target_seconds, g.target_distance_km,
            g.notes, g.created_at, g.updated_at
     FROM goals g
     JOIN exercises e ON e.id = g.exercise_id
     ORDER BY g.created_at DESC`
  );

  const results: GoalItem[] = [];

  for (const g of goalsRes.rows) {
    const exId = String(g.exercise_id);
    const exName = String(g.exercise_name);
    const metricType = String(g.metric_type) as GoalItem["metricType"];

    const targetWeight = g.target_weight !== null && g.target_weight !== undefined ? Number(g.target_weight) : undefined;
    const targetReps = g.target_reps !== null && g.target_reps !== undefined ? Number(g.target_reps) : undefined;
    const targetSeconds = g.target_seconds !== null && g.target_seconds !== undefined ? Number(g.target_seconds) : undefined;
    const targetDistanceKm = g.target_distance_km !== null && g.target_distance_km !== undefined ? Number(g.target_distance_km) : undefined;

    let targetLabel = "";
    let target1RM: number | undefined = undefined;

    if (metricType === "weight_reps") {
      targetLabel = `${targetWeight ?? 0} kg × ${targetReps ?? 0} reps`;
      if (targetWeight && targetReps) {
        target1RM = calculate1RM(targetWeight, targetReps);
      }
    } else if (metricType === "weighted_bodyweight") {
      targetLabel = targetWeight && targetWeight > 0 ? `+${targetWeight} kg × ${targetReps ?? 0} reps` : `0kg + BW × ${targetReps ?? 0} reps`;
      if (targetWeight && targetReps) {
        target1RM = calculate1RM(targetWeight, targetReps);
      }
    } else if (metricType === "bodyweight_reps") {
      targetLabel = `${targetReps ?? 0} reps`;
    } else if (metricType === "seconds") {
      targetLabel = `${targetSeconds ?? 0}s`;
    } else if (metricType === "cardio") {
      targetLabel = `${targetDistanceKm ?? 0} km`;
    }

    const setsRes = await db.execute({
      sql: `SELECT s.weight_kg, s.reps, s.duration_seconds, s.distance_km, s.set_type,
                   w.id as workout_id, w.start_time, w.start_timestamp
            FROM exercise_sets s
            JOIN workout_exercises we ON we.id = s.workout_exercise_id
            JOIN workouts w ON w.id = we.workout_id
            WHERE we.exercise_id = ?
            ORDER BY w.start_timestamp ASC`,
      args: [exId],
    });

    // Group sets by workout to evaluate session-level Top Sets
    const workoutMap = new Map<string, {
      workoutId: string;
      startTime: string;
      startTimestamp: number;
      sets: {
        weightKg: number | null;
        reps: number | null;
        durationSeconds: number | null;
        distanceKm: number | null;
        setType: string;
      }[];
    }>();

    for (const r of setsRes.rows) {
      const wId = String(r.workout_id);
      if (!workoutMap.has(wId)) {
        workoutMap.set(wId, {
          workoutId: wId,
          startTime: String(r.start_time),
          startTimestamp: Number(r.start_timestamp),
          sets: [],
        });
      }
      workoutMap.get(wId)!.sets.push({
        weightKg: r.weight_kg !== null && r.weight_kg !== undefined ? Number(r.weight_kg) : null,
        reps: r.reps !== null && r.reps !== undefined ? Number(r.reps) : null,
        durationSeconds: r.duration_seconds !== null && r.duration_seconds !== undefined ? Number(r.duration_seconds) : null,
        distanceKm: r.distance_km !== null && r.distance_km !== undefined ? Number(r.distance_km) : null,
        setType: String(r.set_type || "normal"),
      });
    }

    const allWorkouts = Array.from(workoutMap.values());
    const seasonWorkouts = season
      ? allWorkouts.filter(
          (w) =>
            w.startTimestamp >= season!.startTimestamp &&
            (!season!.endTimestamp || w.startTimestamp <= season!.endTimestamp)
        )
      : [];

    // Helper to evaluate the Top Set of a given workout
    const getTopSetOfWorkout = (w: typeof allWorkouts[0]) => {
      const nonWarmup = w.sets.filter((s) => s.setType !== "warmup");
      const setsToUse = nonWarmup.length > 0 ? nonWarmup : w.sets;

      let bestW = 0;
      let bestR = 0;
      let bestSec = 0;
      let bestDist = 0;
      let best1RM = 0;
      let bestScore = -Infinity;
      let label = "";

      for (const s of setsToUse) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sec = s.durationSeconds ?? 0;
        const dist = s.distanceKm ?? 0;

        let score = -Infinity;
        let s1rm = 0;

        if (metricType === "weight_reps") {
          if (wt > 0 && rp > 0) {
            s1rm = calculate1RM(wt, rp);
            score = s1rm > 0 ? s1rm : (wt * 100 + rp);
          } else {
            continue;
          }
        } else if (metricType === "weighted_bodyweight") {
          if (rp > 0) {
            s1rm = wt > 0 ? calculate1RM(wt, rp) : 0;
            score = wt > 0 ? (10000 + s1rm) : (wt === 0 ? rp : (-10000 + wt * 100 + rp));
          } else {
            continue;
          }
        } else if (metricType === "bodyweight_reps") {
          if (rp > 0) {
            score = rp;
          } else {
            continue;
          }
        } else if (metricType === "seconds") {
          if (sec > 0) {
            score = sec;
          } else {
            continue;
          }
        } else if (metricType === "cardio") {
          if (dist > 0) {
            score = dist;
          } else {
            continue;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestW = wt;
          bestR = rp;
          bestSec = sec;
          bestDist = dist;
          best1RM = s1rm;
        }
      }

      if (bestScore === -Infinity) return null;

      if (metricType === "weight_reps") {
        label = `${bestW} kg × ${bestR}`;
      } else if (metricType === "weighted_bodyweight") {
        if (bestW > 0) label = `+${bestW} kg × ${bestR}`;
        else label = `0kg + BW × ${bestR}`;
      } else if (metricType === "bodyweight_reps") {
        label = `${bestR} reps`;
      } else if (metricType === "seconds") {
        label = `${bestSec}s`;
      } else if (metricType === "cardio") {
        label = `${bestDist} km`;
      }

      return {
        workoutId: w.workoutId,
        startTimestamp: w.startTimestamp,
        startTime: w.startTime,
        weight: bestW,
        reps: bestR,
        seconds: bestSec,
        distanceKm: bestDist,
        est1RM: best1RM,
        score: bestScore,
        label,
      };
    };

    // Helper to summarize workouts (calculating Best and Min Top Set)
    const summarizeWorkouts = (workouts: typeof allWorkouts) => {
      const topSets = workouts
        .map(getTopSetOfWorkout)
        .filter((ts): ts is NonNullable<typeof ts> => ts !== null);

      if (topSets.length === 0) {
        return {
          hasData: false,
          best: null,
          min: null,
          label: "Sin registros",
          est1RM: undefined,
          weight: 0,
          reps: 0,
          seconds: 0,
          distanceKm: 0,
          minLabel: "Sin registros",
          min1RM: undefined,
          minWeight: 0,
          minReps: 0,
          minSeconds: 0,
          minDistanceKm: 0,
        };
      }

      let best = topSets[0];
      let min = topSets[0];

      for (const ts of topSets) {
        if (ts.score > best.score) best = ts;
        if (ts.score < min.score) min = ts;
      }

      return {
        hasData: true,
        best,
        min,
        label: best.label,
        est1RM: best.est1RM > 0 ? best.est1RM : (best.weight > 0 && best.reps > 0 ? calculate1RM(best.weight, best.reps) : undefined),
        weight: best.weight,
        reps: best.reps,
        seconds: best.seconds,
        distanceKm: best.distanceKm,
        minLabel: min.label,
        min1RM: min.est1RM > 0 ? min.est1RM : (min.weight > 0 && min.reps > 0 ? calculate1RM(min.weight, min.reps) : undefined),
        minWeight: min.weight,
        minReps: min.reps,
        minSeconds: min.seconds,
        minDistanceKm: min.distanceKm,
      };
    };

    const allTimeStats = summarizeWorkouts(allWorkouts);
    const seasonStats = summarizeWorkouts(seasonWorkouts);

    // Active baseline & current for progress calculation
    const useSeasonContext = isExplicitSeason && seasonStats.hasData;
    const activeCurrent = useSeasonContext ? seasonStats : allTimeStats;
    const activeBaseline = useSeasonContext
      ? {
          label: seasonStats.minLabel,
          est1RM: seasonStats.min1RM,
          weight: seasonStats.minWeight,
          reps: seasonStats.minReps,
          seconds: seasonStats.minSeconds,
          distanceKm: seasonStats.minDistanceKm,
          type: "season" as const,
        }
      : {
          label: allTimeStats.minLabel,
          est1RM: allTimeStats.min1RM,
          weight: allTimeStats.minWeight,
          reps: allTimeStats.minReps,
          seconds: allTimeStats.minSeconds,
          distanceKm: allTimeStats.minDistanceKm,
          type: "all_time" as const,
        };

    // Check completion against target
    const checkCompletion = (stats: typeof allTimeStats) => {
      if (!stats.hasData) return false;
      if (metricType === "weight_reps" || metricType === "weighted_bodyweight") {
        const tW = targetWeight ?? 0;
        const tR = targetReps ?? 0;
        const t1 = target1RM ?? 0;
        const c1 = stats.est1RM ?? (stats.weight > 0 && stats.reps > 0 ? calculate1RM(stats.weight, stats.reps) : 0);
        return (stats.weight >= tW && stats.reps >= tR) || (t1 > 0 && c1 >= t1);
      } else if (metricType === "bodyweight_reps") {
        return stats.reps >= (targetReps ?? 0) && (targetReps ?? 0) > 0;
      } else if (metricType === "seconds") {
        return stats.seconds >= (targetSeconds ?? 0) && (targetSeconds ?? 0) > 0;
      } else if (metricType === "cardio") {
        return stats.distanceKm >= (targetDistanceKm ?? 0) && (targetDistanceKm ?? 0) > 0;
      }
      return false;
    };

    const allTimeReached = checkCompletion(allTimeStats);
    const isCompleted = isExplicitSeason
      ? (seasonStats.hasData && checkCompletion(seasonStats))
      : allTimeReached;

    let progressPct = 0;
    let remainingGapLabel = "";

    if (isExplicitSeason && !seasonStats.hasData) {
      progressPct = 0;
      remainingGapLabel = `Sin sesiones registradas en ${season?.name || "esta temporada"}`;
    } else if (!activeCurrent.hasData) {
      progressPct = 0;
      remainingGapLabel = "Pendiente de primer entrenamiento";
    } else if (isCompleted) {
      progressPct = 100;
      remainingGapLabel = "¡Objetivo ideal conseguido! ★";
    } else {
      if (metricType === "weight_reps") {
        const t1RM = target1RM ?? (targetWeight && targetReps ? calculate1RM(targetWeight, targetReps) : 0);
        const c1RM = activeCurrent.est1RM ?? (activeCurrent.weight > 0 && activeCurrent.reps > 0 ? calculate1RM(activeCurrent.weight, activeCurrent.reps) : 0);
        const b1RM = activeBaseline.est1RM ?? (activeBaseline.weight > 0 && activeBaseline.reps > 0 ? calculate1RM(activeBaseline.weight, activeBaseline.reps) : 0);

        if (t1RM > 0) {
          if (c1RM >= t1RM) {
            progressPct = 100;
          } else if (t1RM > b1RM && c1RM >= b1RM) {
            const pct = ((c1RM - b1RM) / (t1RM - b1RM)) * 100;
            progressPct = Math.min(99, Math.max(0, Math.round(pct)));
          } else if (c1RM > 0) {
            progressPct = Math.min(99, Math.max(0, Math.round((c1RM / t1RM) * 100)));
          } else {
            progressPct = 0;
          }

          const diff1RM = Number(Math.max(0, t1RM - c1RM).toFixed(1));
          const diffW = Math.max(0, (targetWeight ?? 0) - activeCurrent.weight);
          const diffR = Math.max(0, (targetReps ?? 0) - activeCurrent.reps);
          remainingGapLabel = `Faltan +${diff1RM} kg 1RM (${diffW > 0 ? `+${diffW} kg` : ""}${diffW > 0 && diffR > 0 ? " · " : ""}${diffR > 0 ? `+${diffR} reps` : ""})`;
        } else {
          progressPct = 0;
          remainingGapLabel = "Pendiente de objetivo";
        }
      } else if (metricType === "weighted_bodyweight") {
        const tW = targetWeight ?? 0;
        const cW = activeCurrent.weight;
        const bW = activeBaseline.weight;
        const t1RM = target1RM ?? (tW > 0 && targetReps ? calculate1RM(tW, targetReps) : 0);
        const c1RM = activeCurrent.est1RM ?? (cW > 0 && activeCurrent.reps > 0 ? calculate1RM(cW, activeCurrent.reps) : cW);
        const b1RM = activeBaseline.est1RM ?? (bW > 0 && activeBaseline.reps > 0 ? calculate1RM(bW, activeBaseline.reps) : bW);

        if (t1RM > b1RM && c1RM >= b1RM) {
          const pct = ((c1RM - b1RM) / (t1RM - b1RM)) * 100;
          progressPct = Math.min(99, Math.max(0, Math.round(pct)));
        } else if (tW > bW && cW >= bW) {
          const pct = ((cW - bW) / (tW - bW)) * 100;
          progressPct = Math.min(99, Math.max(0, Math.round(pct)));
        } else {
          progressPct = 0;
        }

        const diffW = Math.max(0, tW - cW);
        const diffR = Math.max(0, (targetReps ?? 0) - activeCurrent.reps);
        remainingGapLabel = `Faltan ${diffW > 0 ? `+${diffW} kg lastre` : ""}${diffW > 0 && diffR > 0 ? " · " : ""}${diffR > 0 ? `+${diffR} reps` : ""}`;
      } else if (metricType === "bodyweight_reps") {
        const tR = targetReps ?? 0;
        const cR = activeCurrent.reps;
        const bR = activeBaseline.reps;

        if (tR > bR && cR >= bR) {
          const pct = ((cR - bR) / (tR - bR)) * 100;
          progressPct = Math.min(99, Math.max(0, Math.round(pct)));
        } else if (tR > 0) {
          progressPct = Math.min(99, Math.max(0, Math.round((cR / tR) * 100)));
        } else {
          progressPct = 0;
        }
        remainingGapLabel = `+${Math.max(0, tR - cR)} reps para la meta`;
      } else if (metricType === "seconds") {
        const tS = targetSeconds ?? 0;
        const cS = activeCurrent.seconds;
        const bS = activeBaseline.seconds;

        if (tS > bS && cS >= bS) {
          const pct = ((cS - bS) / (tS - bS)) * 100;
          progressPct = Math.min(99, Math.max(0, Math.round(pct)));
        } else if (tS > 0) {
          progressPct = Math.min(99, Math.max(0, Math.round((cS / tS) * 100)));
        } else {
          progressPct = 0;
        }
        remainingGapLabel = `+${Math.max(0, tS - cS)}s para la meta`;
      } else if (metricType === "cardio") {
        const tD = targetDistanceKm ?? 0;
        const cD = activeCurrent.distanceKm;
        const bD = activeBaseline.distanceKm;

        if (tD > bD && cD >= bD) {
          const pct = ((cD - bD) / (tD - bD)) * 100;
          progressPct = Math.min(99, Math.max(0, Math.round(pct)));
        } else if (tD > 0) {
          progressPct = Math.min(99, Math.max(0, Math.round((cD / tD) * 100)));
        } else {
          progressPct = 0;
        }
        remainingGapLabel = `+${(Math.max(0, tD - cD)).toFixed(1)} km para la meta`;
      }
    }

    results.push({
      id: String(g.id),
      exerciseId: exId,
      exerciseName: exName,
      metricType,

      // Season Record
      seasonLabel: seasonStats.label,
      season1RM: seasonStats.est1RM,
      seasonWeight: seasonStats.weight > 0 ? seasonStats.weight : undefined,
      seasonReps: seasonStats.reps > 0 ? seasonStats.reps : undefined,
      hasSeasonData: seasonStats.hasData,

      // All-Time Record
      allTimeLabel: allTimeStats.label,
      allTime1RM: allTimeStats.est1RM,
      allTimeWeight: allTimeStats.weight > 0 ? allTimeStats.weight : undefined,
      allTimeReps: allTimeStats.reps > 0 ? allTimeStats.reps : undefined,
      hasAllTimeData: allTimeStats.hasData,
      allTimeReached,

      // Target Goal
      targetLabel,
      target1RM,
      targetWeight,
      targetReps,
      targetSeconds,
      targetDistanceKm,

      // Baseline Reference (Mínimo de la season si hay season, o mínimo histórico)
      baselineLabel: activeBaseline.label,
      baseline1RM: activeBaseline.est1RM,
      baselineWeight: activeBaseline.weight > 0 ? activeBaseline.weight : undefined,
      baselineReps: activeBaseline.reps > 0 ? activeBaseline.reps : undefined,
      baselineType: activeBaseline.type,

      // Progress
      progressPct,
      isCompleted,
      remainingGapLabel,
      notes: g.notes ? String(g.notes) : undefined,
      createdAt: Number(g.created_at),
      updatedAt: Number(g.updated_at),
      activeSeasonName: season ? season.name : undefined,
      activeSeasonColor: season ? (season.color || undefined) : undefined,

      // Backwards compatibility
      currentLabel: activeCurrent.label,
      current1RM: activeCurrent.est1RM,
      currentWeight: activeCurrent.weight > 0 ? activeCurrent.weight : undefined,
      currentReps: activeCurrent.reps > 0 ? activeCurrent.reps : undefined,
      currentSeconds: activeCurrent.seconds > 0 ? activeCurrent.seconds : undefined,
      currentDistanceKm: activeCurrent.distanceKm > 0 ? activeCurrent.distanceKm : undefined,
      gifUrl: cacheMap.get(exName.toLowerCase().trim())?.gifUrl || getExerciseMedia(exName).gifUrl,
      primaryMuscle: cacheMap.get(exName.toLowerCase().trim())?.primaryMuscle || getExerciseMedia(exName).primaryMuscle,
    });
  }

  return results;
}

export async function saveGoal(data: {
  id?: string;
  exerciseId: string;
  metricType: string;
  targetWeight?: number;
  targetReps?: number;
  targetSeconds?: number;
  targetDistanceKm?: number;
  notes?: string;
}) {
  const db = getDb();
  await ensureSchema(db);

  const existing = await db.execute({
    sql: data.id
      ? "SELECT id FROM goals WHERE id = ?"
      : "SELECT id FROM goals WHERE exercise_id = ?",
    args: [data.id ? data.id : data.exerciseId],
  });

  const id = existing.rows.length > 0 ? String(existing.rows[0].id) : (data.id || crypto.randomUUID());

  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE goals 
            SET exercise_id = ?, metric_type = ?, target_weight = ?, target_reps = ?, 
                target_seconds = ?, target_distance_km = ?, notes = ?, updated_at = strftime('%s', 'now')
            WHERE id = ?`,
      args: [
        data.exerciseId,
        data.metricType,
        data.targetWeight ?? null,
        data.targetReps ?? null,
        data.targetSeconds ?? null,
        data.targetDistanceKm ?? null,
        data.notes ?? null,
        id,
      ],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO goals (id, exercise_id, metric_type, target_weight, target_reps, target_seconds, target_distance_km, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        data.exerciseId,
        data.metricType,
        data.targetWeight ?? null,
        data.targetReps ?? null,
        data.targetSeconds ?? null,
        data.targetDistanceKm ?? null,
        data.notes ?? null,
      ],
    });
  }
  return { success: true, id };
}

export async function deleteGoal(id: string) {
  const db = getDb();
  await ensureSchema(db);
  await db.execute({
    sql: "DELETE FROM goals WHERE id = ?",
    args: [id],
  });
  return { success: true };
}

export interface JournalExercise {
  id: string;
  name: string;
  metricType?: string;
  exerciseNotes: string;
  sets: SetDetail[];
  topSetLabel: string;
  gifUrl?: string;
  primaryMuscle?: MuscleGroup | string;
  volumeKg?: number;
  best1RM?: number;
}

export interface JournalWorkout {
  id: string;
  title: string;
  startTime: string;
  startTimestamp: number;
  endTime: string;
  durationSeconds: number;
  description: string;
  totalVolumeKg?: number;
  totalSets?: number;
  averageRestSeconds?: number;
  exercises: JournalExercise[];
}

export async function getJournalWorkouts(seasonId?: string | null): Promise<JournalWorkout[]> {
  const db = getDb();
  await ensureSchema(db);

  const cacheMap = await getCachedMediaMap(db);

  let season: Season | null = null;
  if (seasonId && seasonId !== "all") {
    season = await getSeasonById(seasonId);
  }

  const workoutsRes = season
    ? await db.execute({
        sql: `SELECT id, title, start_time, start_timestamp, end_time, duration_seconds, description 
              FROM workouts 
              WHERE start_timestamp >= ? AND (? IS NULL OR start_timestamp <= ?) 
              ORDER BY start_timestamp DESC`,
        args: [season.startTimestamp, season.endTimestamp, season.endTimestamp],
      })
    : await db.execute(
        "SELECT id, title, start_time, start_timestamp, end_time, duration_seconds, description FROM workouts ORDER BY start_timestamp DESC"
      );

  const results: JournalWorkout[] = [];

  for (const w of workoutsRes.rows) {
    const wId = String(w.id);
    const exercisesData = await db.execute({
      sql: `SELECT we.id as we_id, e.id as exercise_id, e.name as exercise_name, e.metric_type, we.exercise_notes,
                   s.id as set_id, s.set_index, s.set_type, s.weight_kg, s.reps, s.distance_km, s.duration_seconds, s.rpe
            FROM workout_exercises we
            JOIN exercises e ON e.id = we.exercise_id
            JOIN exercise_sets s ON s.workout_exercise_id = we.id
            WHERE we.workout_id = ?
            ORDER BY we.order_index ASC, s.set_index ASC`,
      args: [wId],
    });

    const exMap = new Map<string, {
      id: string;
      name: string;
      metricType: string;
      exerciseNotes: string;
      sets: SetDetail[];
    }>();

    for (const r of exercisesData.rows) {
      const weId = String(r.we_id);
      if (!exMap.has(weId)) {
        exMap.set(weId, {
          id: String(r.exercise_id),
          name: String(r.exercise_name),
          metricType: String(r.metric_type || "weight_reps"),
          exerciseNotes: r.exercise_notes ? String(r.exercise_notes) : "",
          sets: [],
        });
      }
      exMap.get(weId)!.sets.push({
        id: String(r.set_id),
        setIndex: Number(r.set_index),
        setType: String(r.set_type || "normal"),
        weightKg: r.weight_kg !== null && r.weight_kg !== undefined ? Number(r.weight_kg) : null,
        reps: r.reps !== null && r.reps !== undefined ? Number(r.reps) : null,
        distanceKm: r.distance_km !== null && r.distance_km !== undefined ? Number(r.distance_km) : null,
        durationSeconds: r.duration_seconds !== null && r.duration_seconds !== undefined ? Number(r.duration_seconds) : null,
        rpe: r.rpe !== null && r.rpe !== undefined ? Number(r.rpe) : null,
      });
    }

    let workoutTotalVolume = 0;
    let workoutTotalSets = 0;
    let workoutActiveTime = 0;

    const exList: JournalExercise[] = Array.from(exMap.values()).map((ex) => {
      let topLabel = "-";
      let exVol = 0;
      let exBest1RM = 0;

      for (const s of ex.sets) {
        workoutTotalSets++;
        if (s.durationSeconds) {
          workoutActiveTime += s.durationSeconds;
        } else {
          workoutActiveTime += Math.min(60, Math.max(20, (s.reps || 8) * 3.5));
        }

        if (s.weightKg !== null && s.reps !== null && s.weightKg > 0 && s.reps > 0) {
          exVol += s.weightKg * s.reps;
          const s1rm = calculate1RM(s.weightKg, s.reps);
          if (s1rm > exBest1RM) exBest1RM = s1rm;
        }
      }
      workoutTotalVolume += exVol;

      if (ex.sets.length > 0) {
        const first = ex.sets[0];
        if (first.durationSeconds) {
          const maxSec = Math.max(...ex.sets.map((s) => s.durationSeconds || 0));
          topLabel = `${maxSec}s`;
        } else if (first.distanceKm) {
          const maxDist = Math.max(...ex.sets.map((s) => s.distanceKm || 0));
          topLabel = `${maxDist} km`;
        } else {
          let best = ex.sets[0];
          let maxSc = -999999;
          for (const s of ex.sets) {
            const wt = s.weightKg ?? 0;
            const rp = s.reps ?? 0;
            const sc = wt !== 0 ? wt * 1000 + rp : rp;
            if (sc > maxSc) {
              maxSc = sc;
              best = s;
            }
          }
          if (ex.metricType === "weighted_bodyweight") {
            if ((best.weightKg ?? 0) > 0) {
              topLabel = `+${best.weightKg} kg × ${best.reps}`;
            } else if (best.reps) {
              topLabel = `0kg + BW × ${best.reps}`;
            }
          } else {
            if ((best.weightKg ?? 0) > 0) {
              topLabel = `${best.weightKg} kg × ${best.reps}`;
            } else if (best.reps) {
              topLabel = `${best.reps} reps`;
            }
          }
        }
      }

      const media = cacheMap.get(ex.name.toLowerCase().trim()) || getExerciseMedia(ex.name);

      return {
        ...ex,
        topSetLabel: topLabel,
        gifUrl: media.gifUrl,
        primaryMuscle: media.primaryMuscle,
        volumeKg: Math.round(exVol),
        best1RM: exBest1RM > 0 ? exBest1RM : undefined,
      };
    });

    const durationSec = Number(w.duration_seconds) || 0;
    const intervals = Math.max(1, workoutTotalSets - 1);
    const restTotalSec = Math.max(0, durationSec - workoutActiveTime);
    const avgRestSec = durationSec > 0 && workoutTotalSets > 1 ? Math.round(restTotalSec / intervals) : 0;

    results.push({
      id: wId,
      title: String(w.title),
      startTime: String(w.start_time),
      startTimestamp: Number(w.start_timestamp),
      endTime: w.end_time ? String(w.end_time) : "",
      durationSeconds: durationSec,
      description: w.description ? String(w.description) : "",
      totalVolumeKg: Math.round(workoutTotalVolume),
      totalSets: workoutTotalSets,
      averageRestSeconds: avgRestSec,
      exercises: exList,
    });
  }

  return results;
}

export async function getWorkoutDetail(workoutId: string): Promise<JournalWorkout | null> {
  const db = getDb();
  await ensureSchema(db);

  const cacheMap = await getCachedMediaMap(db);

  const wRes = await db.execute({
    sql: "SELECT id, title, start_time, start_timestamp, end_time, duration_seconds, description FROM workouts WHERE id = ?",
    args: [workoutId],
  });

  if (wRes.rows.length === 0) return null;
  const w = wRes.rows[0];
  const wId = String(w.id);

  const exercisesData = await db.execute({
    sql: `SELECT we.id as we_id, e.id as exercise_id, e.name as exercise_name, e.metric_type, we.exercise_notes,
                 s.id as set_id, s.set_index, s.set_type, s.weight_kg, s.reps, s.distance_km, s.duration_seconds, s.rpe
          FROM workout_exercises we
          JOIN exercises e ON e.id = we.exercise_id
          JOIN exercise_sets s ON s.workout_exercise_id = we.id
          WHERE we.workout_id = ?
          ORDER BY we.order_index ASC, s.set_index ASC`,
    args: [wId],
  });

  const exMap = new Map<string, {
    id: string;
    name: string;
    metricType: string;
    exerciseNotes: string;
    sets: SetDetail[];
  }>();

  for (const r of exercisesData.rows) {
    const weId = String(r.we_id);
    if (!exMap.has(weId)) {
      exMap.set(weId, {
        id: String(r.exercise_id),
        name: String(r.exercise_name),
        metricType: String(r.metric_type || "weight_reps"),
        exerciseNotes: r.exercise_notes ? String(r.exercise_notes) : "",
        sets: [],
      });
    }
    exMap.get(weId)!.sets.push({
      id: String(r.set_id),
      setIndex: Number(r.set_index) + 1,
      setType: String(r.set_type || "normal"),
      weightKg: r.weight_kg !== null ? Number(r.weight_kg) : null,
      reps: r.reps !== null ? Number(r.reps) : null,
      distanceKm: r.distance_km !== null ? Number(r.distance_km) : null,
      durationSeconds: r.duration_seconds !== null ? Number(r.duration_seconds) : null,
      rpe: r.rpe !== null ? Number(r.rpe) : null,
    });
  }

  let workoutTotalVolume = 0;
  let workoutTotalSets = 0;
  let workoutActiveTime = 0;

  const exList: JournalExercise[] = Array.from(exMap.values()).map((ex) => {
    let topLabel = "-";
    let exVol = 0;
    let exBest1RM = 0;

    for (const s of ex.sets) {
      workoutTotalSets++;
      if (s.durationSeconds) {
        workoutActiveTime += s.durationSeconds;
      } else {
        workoutActiveTime += Math.min(60, Math.max(20, (s.reps || 8) * 3.5));
      }

      if (s.weightKg !== null && s.reps !== null && s.weightKg > 0 && s.reps > 0) {
        exVol += s.weightKg * s.reps;
        const s1rm = calculate1RM(s.weightKg, s.reps);
        if (s1rm > exBest1RM) exBest1RM = s1rm;
      }
    }
    workoutTotalVolume += exVol;

    if (ex.sets.length > 0) {
      const first = ex.sets[0];
      if (first.durationSeconds) {
        const maxSec = Math.max(...ex.sets.map((s) => s.durationSeconds || 0));
        topLabel = `${maxSec}s`;
      } else if (first.distanceKm) {
        const maxDist = Math.max(...ex.sets.map((s) => s.distanceKm || 0));
        topLabel = `${maxDist} km`;
      } else {
        let best = ex.sets[0];
        let maxSc = -999999;
        for (const s of ex.sets) {
          const wt = s.weightKg ?? 0;
          const rp = s.reps ?? 0;
          const sc = wt !== 0 ? wt * 1000 + rp : rp;
          if (sc > maxSc) {
            maxSc = sc;
            best = s;
          }
        }
        if (ex.metricType === "weighted_bodyweight") {
          if ((best.weightKg ?? 0) > 0) {
            topLabel = `+${best.weightKg} kg × ${best.reps}`;
          } else if (best.reps) {
            topLabel = `0kg + BW × ${best.reps}`;
          }
        } else {
          if ((best.weightKg ?? 0) > 0) {
            topLabel = `${best.weightKg} kg × ${best.reps}`;
          } else if (best.reps) {
            topLabel = `${best.reps} reps`;
          }
        }
      }
    }

    const media = cacheMap.get(ex.name.toLowerCase().trim()) || getExerciseMedia(ex.name);

    return {
      ...ex,
      topSetLabel: topLabel,
      gifUrl: media.gifUrl,
      primaryMuscle: media.primaryMuscle,
      volumeKg: Math.round(exVol),
      best1RM: exBest1RM > 0 ? exBest1RM : undefined,
    };
  });

  const durationSec = Number(w.duration_seconds) || 0;
  const intervals = Math.max(1, workoutTotalSets - 1);
  const restTotalSec = Math.max(0, durationSec - workoutActiveTime);
  const avgRestSec = durationSec > 0 && workoutTotalSets > 1 ? Math.round(restTotalSec / intervals) : 0;

  return {
    id: wId,
    title: String(w.title),
    startTime: String(w.start_time),
    startTimestamp: Number(w.start_timestamp),
    endTime: w.end_time ? String(w.end_time) : "",
    durationSeconds: durationSec,
    description: w.description ? String(w.description) : "",
    totalVolumeKg: Math.round(workoutTotalVolume),
    totalSets: workoutTotalSets,
    averageRestSeconds: avgRestSec,
    exercises: exList,
  };
}

export async function clearDatabase() {
  const db = getDb();
  await ensureSchema(db);
  await db.batch([
    "DELETE FROM exercise_sets;",
    "DELETE FROM workout_exercises;",
    "DELETE FROM workouts;",
    "DELETE FROM exercises;",
    "DELETE FROM weight_records;",
  ], "write");
  return { success: true };
}

export async function getWeightRecords(): Promise<WeightRecord[]> {
  const db = getDb();
  await ensureSchema(db);

  const res = await db.execute(`
    SELECT * FROM weight_records
    ORDER BY timestamp ASC
  `);

  if (res.rows.length === 0) {
    try {
      const allRecords: WeightRecord[] = [];
      const zeppPath = path.join(process.cwd(), "data", "zepp_life_weight.csv");
      if (fs.existsSync(zeppPath)) {
        const content = fs.readFileSync(zeppPath, "utf-8");
        const parsed = parseWeightCsv(content);
        if (parsed.success && parsed.records.length > 0) {
          allRecords.push(...parsed.records);
        }
      }

      const xiaomiPath = path.join(process.cwd(), "data", "xiaomi_mi_home_raw.csv");
      if (fs.existsSync(xiaomiPath)) {
        const content = fs.readFileSync(xiaomiPath, "utf-8");
        const parsed = parseWeightCsv(content);
        if (parsed.success && parsed.records.length > 0) {
          allRecords.push(...parsed.records);
        }
      }

      if (allRecords.length > 0) {
        allRecords.sort((a, b) => a.timestamp - b.timestamp);
        await bulkInsertWeightRecords(allRecords);
        return enrichWithMovingAverages(allRecords);
      }
    } catch (e) {
      console.warn("Could not auto-seed weight records from csv:", e);
    }
  }

  const records: WeightRecord[] = res.rows.map((r) => ({
    id: String(r.id),
    fecha: String(r.date),
    hora: String(r.time),
    timestamp: Number(r.timestamp),
    peso: Number(r.weight),
    impedancia: r.impedance !== null && r.impedance !== undefined ? Number(r.impedance) : null,
    impedanciaLow: r.impedance_low !== null && r.impedance_low !== undefined ? Number(r.impedance_low) : null,
    grasaPct: r.fat_rate !== null && r.fat_rate !== undefined ? Number(r.fat_rate) : null,
    masaMagraKg: r.lean_mass_kg !== null && r.lean_mass_kg !== undefined ? Number(r.lean_mass_kg) : null,
    masaGrasaKg: r.fat_mass_kg !== null && r.fat_mass_kg !== undefined ? Number(r.fat_mass_kg) : null,
    aguaPct: r.body_water_rate !== null && r.body_water_rate !== undefined ? Number(r.body_water_rate) : null,
    bmi: r.bmi !== null && r.bmi !== undefined ? Number(r.bmi) : null,
    ffmi: r.ffmi !== null && r.ffmi !== undefined ? Number(r.ffmi) : null,
    altura: r.height !== null && r.height !== undefined ? Number(r.height) : null,
    boneMass: r.bone_mass !== null && r.bone_mass !== undefined ? Number(r.bone_mass) : null,
    metabolism: r.metabolism !== null && r.metabolism !== undefined ? Number(r.metabolism) : null,
    muscleRate: r.muscle_rate !== null && r.muscle_rate !== undefined ? Number(r.muscle_rate) : null,
    visceralFat: r.visceral_fat !== null && r.visceral_fat !== undefined ? Number(r.visceral_fat) : null,
    source: r.source ? String(r.source) : "zepp_life",
    notes: r.notes ? String(r.notes) : null,
    esValido: true,
  }));

  return enrichWithMovingAverages(records);
}

export async function createWeightRecord(record: Partial<WeightRecord>): Promise<WeightRecord> {
  const db = getDb();
  await ensureSchema(db);

  const id = record.id || `w-${crypto.randomUUID()}`;
  const now = Date.now();
  const timestamp = record.timestamp || now;
  const date = record.fecha || new Date(timestamp).toISOString().split("T")[0];
  const time = record.hora || new Date(timestamp).toTimeString().substring(0, 5);

  await db.execute({
    sql: `INSERT INTO weight_records (
      id, date, time, timestamp, weight, impedance, impedance_low, height, bmi,
      fat_rate, body_water_rate, bone_mass, metabolism, muscle_rate, visceral_fat,
      lean_mass_kg, fat_mass_kg, ffmi, source, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      date,
      time,
      timestamp,
      record.peso ?? 0,
      record.impedancia ?? null,
      record.impedanciaLow ?? null,
      record.altura ?? null,
      record.bmi ?? null,
      record.grasaPct ?? null,
      record.aguaPct ?? null,
      record.boneMass ?? null,
      record.metabolism ?? null,
      record.muscleRate ?? null,
      record.visceralFat ?? null,
      record.masaMagraKg ?? null,
      record.masaGrasaKg ?? null,
      record.ffmi ?? null,
      record.source || "manual",
      record.notes || null,
    ],
  });

  return {
    id,
    fecha: date,
    hora: time,
    timestamp,
    peso: record.peso ?? 0,
    impedancia: record.impedancia ?? null,
    impedanciaLow: record.impedanciaLow ?? null,
    grasaPct: record.grasaPct ?? null,
    masaMagraKg: record.masaMagraKg ?? null,
    masaGrasaKg: record.masaGrasaKg ?? null,
    aguaPct: record.aguaPct ?? null,
    bmi: record.bmi ?? null,
    ffmi: record.ffmi ?? null,
    altura: record.altura ?? null,
    boneMass: record.boneMass ?? null,
    metabolism: record.metabolism ?? null,
    muscleRate: record.muscleRate ?? null,
    visceralFat: record.visceralFat ?? null,
    source: record.source || "manual",
    notes: record.notes || null,
    esValido: true,
  };
}

export async function updateWeightRecord(id: string, record: Partial<WeightRecord>): Promise<boolean> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: `UPDATE weight_records SET
      date = COALESCE(?, date),
      time = COALESCE(?, time),
      timestamp = COALESCE(?, timestamp),
      weight = COALESCE(?, weight),
      impedance = ?,
      impedance_low = ?,
      height = COALESCE(?, height),
      bmi = ?,
      fat_rate = ?,
      body_water_rate = ?,
      bone_mass = ?,
      metabolism = ?,
      muscle_rate = ?,
      visceral_fat = ?,
      lean_mass_kg = ?,
      fat_mass_kg = ?,
      ffmi = ?,
      notes = ?
    WHERE id = ?`,
    args: [
      record.fecha ?? null,
      record.hora ?? null,
      record.timestamp ?? null,
      record.peso ?? null,
      record.impedancia ?? null,
      record.impedanciaLow ?? null,
      record.altura ?? null,
      record.bmi ?? null,
      record.grasaPct ?? null,
      record.aguaPct ?? null,
      record.boneMass ?? null,
      record.metabolism ?? null,
      record.muscleRate ?? null,
      record.visceralFat ?? null,
      record.masaMagraKg ?? null,
      record.masaGrasaKg ?? null,
      record.ffmi ?? null,
      record.notes ?? null,
      id,
    ],
  });

  return true;
}

export async function deleteWeightRecord(id: string): Promise<boolean> {
  const db = getDb();
  await ensureSchema(db);
  await db.execute({
    sql: "DELETE FROM weight_records WHERE id = ?",
    args: [id],
  });
  return true;
}

export async function clearWeightRecords(): Promise<boolean> {
  const db = getDb();
  await ensureSchema(db);
  await db.execute("DELETE FROM weight_records;");
  return true;
}

export async function bulkInsertWeightRecords(records: WeightRecord[]): Promise<number> {
  const db = getDb();
  await ensureSchema(db);

  if (records.length === 0) return 0;

  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    const statements = chunk.map((r) => ({
      sql: `INSERT OR REPLACE INTO weight_records (
        id, date, time, timestamp, weight, impedance, impedance_low, height, bmi,
        fat_rate, body_water_rate, bone_mass, metabolism, muscle_rate, visceral_fat,
        lean_mass_kg, fat_mass_kg, ffmi, source, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        r.fecha,
        r.hora,
        r.timestamp,
        r.peso,
        r.impedancia ?? null,
        r.impedanciaLow ?? null,
        r.altura ?? null,
        r.bmi ?? null,
        r.grasaPct ?? null,
        r.aguaPct ?? null,
        r.boneMass ?? null,
        r.metabolism ?? null,
        r.muscleRate ?? null,
        r.visceralFat ?? null,
        r.masaMagraKg ?? null,
        r.masaGrasaKg ?? null,
        r.ffmi ?? null,
        r.source || "zepp_life",
        r.notes ?? null,
      ],
    }));

    await db.batch(statements, "write");
  }

  return records.length;
}
