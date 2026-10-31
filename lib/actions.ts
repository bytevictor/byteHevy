import { getDb, ensureSchema } from "./db";
import crypto from "node:crypto";

export interface Season {
  id: string;
  name: string;
  startDate: string;
  startTimestamp: number;
  endDate: string | null;
  endTimestamp: number | null;
  description?: string;
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
    isAllTimePR?: boolean;
  };
}

export interface ChartPoint {
  date: string;
  timestamp: number;
  primaryValue: number;
  secondaryValue?: number;
  label: string;
  isPR: boolean;
  isAllTimePR?: boolean;
  workoutTitle: string;
  workoutId: string;
}

export interface ExerciseDetailData {
  exercise: {
    id: string;
    name: string;
    metricType: "weight_reps" | "weighted_bodyweight" | "bodyweight_reps" | "seconds" | "cardio";
    allTimeBest: {
      value: number;
      label: string;
      date: string;
    } | null;
    seasonBest?: {
      value: number;
      label: string;
      date: string;
    } | null;
    estimated1RM: number | null;
    allTimeEstimated1RM?: number | null;
    activeSeason?: {
      id: string;
      name: string;
      startDate: string;
      endDate: string | null;
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
    SELECT s.id, s.name, s.start_date, s.start_timestamp, s.end_date, s.end_timestamp, s.description, s.created_at,
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
    workoutCount: Number(r.workout_count) || 0,
    createdAt: Number(r.created_at) || 0,
  }));
}

export async function getSeasonById(id: string): Promise<Season | null> {
  const db = getDb();
  await ensureSchema(db);

  const res = await db.execute({
    sql: `SELECT s.id, s.name, s.start_date, s.start_timestamp, s.end_date, s.end_timestamp, s.description, s.created_at,
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
    workoutCount: Number(r.workout_count) || 0,
    createdAt: Number(r.created_at) || 0,
  };
}

export async function createSeason(data: {
  name: string;
  startDate: string;
  endDate?: string | null;
  description?: string;
}): Promise<Season> {
  const db = getDb();
  await ensureSchema(db);

  const id = crypto.randomUUID();
  const startTimestamp = parseDateInputToTimestamp(data.startDate, false);
  const endTimestamp = data.endDate && data.endDate.trim() !== "" ? parseDateInputToTimestamp(data.endDate, true) : null;

  await db.execute({
    sql: `INSERT INTO seasons (id, name, start_date, start_timestamp, end_date, end_timestamp, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.name.trim(),
      data.startDate.trim(),
      startTimestamp,
      data.endDate && data.endDate.trim() !== "" ? data.endDate.trim() : null,
      endTimestamp,
      data.description ? data.description.trim() : "",
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
  }
): Promise<Season | null> {
  const db = getDb();
  await ensureSchema(db);

  const startTimestamp = parseDateInputToTimestamp(data.startDate, false);
  const endTimestamp = data.endDate && data.endDate.trim() !== "" ? parseDateInputToTimestamp(data.endDate, true) : null;

  await db.execute({
    sql: `UPDATE seasons 
          SET name = ?, start_date = ?, start_timestamp = ?, end_date = ?, end_timestamp = ?, description = ?
          WHERE id = ?`,
    args: [
      data.name.trim(),
      data.startDate.trim(),
      startTimestamp,
      data.endDate && data.endDate.trim() !== "" ? data.endDate.trim() : null,
      endTimestamp,
      data.description ? data.description.trim() : "",
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

export async function getExercisesList(seasonId?: string | null): Promise<ExerciseSummary[]> {
  const db = getDb();
  await ensureSchema(db);

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
          const score = wt !== 0 ? wt * 1000 + rp : rp;
          if (score > allTimeBestVal && wt > 0) {
            allTimeBestVal = score;
            allTimeBestLabel = `+${wt} kg × ${rp}`;
          } else if (allTimeBestVal === 0 && score > allTimeBestVal) {
            allTimeBestVal = score;
            allTimeBestLabel = wt < 0 ? `${wt} kg × ${rp}` : `BW × ${rp}`;
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
          const score = wt !== 0 ? wt * 1000 + rp : rp;
          if (score > seasonBestVal && wt > 0) {
            seasonBestVal = score;
            seasonBestLabel = `+${wt} kg × ${rp}`;
          } else if (seasonBestVal === 0 && score > seasonBestVal) {
            seasonBestVal = score;
            seasonBestLabel = wt < 0 ? `${wt} kg × ${rp}` : `BW × ${rp}`;
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
          const sc = w !== 0 ? w * 1000 + r : r;
          if (sc > maxScore) {
            maxScore = sc;
            top = s;
          }
        }
        const tw = top.weight_kg !== null && top.weight_kg !== undefined ? Number(top.weight_kg) : 0;
        if (tw > 0) {
          latestTopLabel = `+${tw} kg × ${top.reps}`;
        } else if (tw < 0) {
          latestTopLabel = `${tw} kg × ${top.reps}`;
        } else {
          latestTopLabel = `BW × ${top.reps}`;
        }
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
  let allTimeBestRecord: { value: number; label: string; date: string } | null = null;
  let allTimeMaxEst1RM = 0;
  let allTimeRunningBest = -1;

  for (const w of chronologicalWorkouts) {
    let topVal = 0;
    let est1RM: number | undefined = undefined;
    let label = "";

    if (metricType === "seconds") {
      topVal = Math.max(...w.sets.map((s) => s.durationSeconds || 0));
      label = `${topVal}s`;
    } else if (metricType === "cardio") {
      topVal = Math.max(...w.sets.map((s) => s.distanceKm || 0));
      label = `${topVal} km`;
    } else if (metricType === "weighted_bodyweight") {
      let top = w.sets[0];
      let bestScore = -999999;
      for (const s of w.sets) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sc = wt !== 0 ? wt * 1000 + rp : rp;
        if (sc > bestScore) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top.weightKg ?? 0;
      if (topVal > 0) {
        label = `+${topVal} kg × ${top.reps}`;
        if (top.reps) est1RM = calculate1RM(topVal, top.reps);
      } else if (topVal < 0) {
        label = `${topVal} kg × ${top.reps}`;
      } else {
        label = `BW × ${top.reps}`;
      }
    } else if (metricType === "bodyweight_reps") {
      topVal = Math.max(...w.sets.map((s) => s.reps || 0));
      label = `${topVal} reps`;
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
      topVal = top.weightKg || 0;
      label = `${topVal} kg × ${top.reps}`;
      if (topVal > 0 && top.reps) {
        est1RM = calculate1RM(topVal, top.reps);
      }
    }

    if (est1RM && est1RM > allTimeMaxEst1RM) {
      allTimeMaxEst1RM = est1RM;
    }

    if (topVal > allTimeRunningBest && topVal > 0) {
      allTimeRunningBest = topVal;
      allTimeBestRecord = {
        value: topVal,
        label,
        date: w.startTime,
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

  let seasonRunningBestValue = -1;
  let seasonBestRecord: { value: number; label: string; date: string } | null = null;
  let seasonMaxEst1RM = 0;

  for (const w of activeWorkouts) {
    let topVal = 0;
    let est1RM: number | undefined = undefined;
    let label = "";

    if (metricType === "seconds") {
      topVal = Math.max(...w.sets.map((s) => s.durationSeconds || 0));
      label = `${topVal}s`;
    } else if (metricType === "cardio") {
      topVal = Math.max(...w.sets.map((s) => s.distanceKm || 0));
      label = `${topVal} km`;
    } else if (metricType === "weighted_bodyweight") {
      let top = w.sets[0];
      let bestScore = -999999;
      for (const s of w.sets) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sc = wt !== 0 ? wt * 1000 + rp : rp;
        if (sc > bestScore) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top.weightKg ?? 0;
      if (topVal > 0) {
        label = `+${topVal} kg × ${top.reps}`;
        if (top.reps) est1RM = calculate1RM(topVal, top.reps);
      } else if (topVal < 0) {
        label = `${topVal} kg × ${top.reps}`;
      } else {
        label = `BW × ${top.reps}`;
      }
    } else if (metricType === "bodyweight_reps") {
      topVal = Math.max(...w.sets.map((s) => s.reps || 0));
      label = `${topVal} reps`;
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
      topVal = top.weightKg || 0;
      label = `${topVal} kg × ${top.reps}`;
      if (topVal > 0 && top.reps) {
        est1RM = calculate1RM(topVal, top.reps);
      }
    }

    if (est1RM && est1RM > seasonMaxEst1RM) {
      seasonMaxEst1RM = est1RM;
    }

    const isPR = topVal > seasonRunningBestValue && topVal > 0;
    if (isPR) {
      seasonRunningBestValue = topVal;
      seasonBestRecord = {
        value: topVal,
        label,
        date: w.startTime,
      };
    }

    const isAllTimePR = allTimeBestRecord ? (topVal >= allTimeBestRecord.value && topVal > 0) : false;

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
    });
  }

  sessions.reverse();

  return {
    exercise: {
      id: String(ex.id),
      name: String(ex.name),
      metricType,
      allTimeBest: allTimeBestRecord,
      seasonBest: season ? seasonBestRecord : allTimeBestRecord,
      estimated1RM: season ? (seasonMaxEst1RM > 0 ? seasonMaxEst1RM : null) : (allTimeMaxEst1RM > 0 ? allTimeMaxEst1RM : null),
      allTimeEstimated1RM: allTimeMaxEst1RM > 0 ? allTimeMaxEst1RM : null,
      activeSeason: season ? {
        id: season.id,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
      } : null,
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
  currentWeight?: number;
  currentReps?: number;
  currentSeconds?: number;
  currentDistanceKm?: number;
  current1RM?: number;
  currentLabel: string;
  targetWeight?: number;
  targetReps?: number;
  targetSeconds?: number;
  targetDistanceKm?: number;
  target1RM?: number;
  targetLabel: string;
  progressPct: number;
  isCompleted: boolean;
  remainingGapLabel?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  allTimeReached?: boolean;
  allTimeLabel?: string;
  activeSeasonName?: string;
}

export async function getGoals(seasonId?: string | null): Promise<GoalItem[]> {
  const db = getDb();
  await ensureSchema(db);

  let season: Season | null = null;
  if (seasonId && seasonId !== "all") {
    season = await getSeasonById(seasonId);
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
      targetLabel = targetWeight && targetWeight > 0 ? `+${targetWeight} kg × ${targetReps ?? 0} reps` : `BW × ${targetReps ?? 0} reps`;
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
      sql: `SELECT s.weight_kg, s.reps, s.duration_seconds, s.distance_km, w.start_time, w.start_timestamp
            FROM exercise_sets s
            JOIN workout_exercises we ON we.id = s.workout_exercise_id
            JOIN workouts w ON w.id = we.workout_id
            WHERE we.exercise_id = ?
            ORDER BY w.start_timestamp ASC`,
      args: [exId],
    });

    // Separate all-time sets from active season sets
    const allSets = setsRes.rows;
    const activeSets = season
      ? allSets.filter((row) => {
          const ts = Number(row.start_timestamp);
          return ts >= season!.startTimestamp && (!season!.endTimestamp || ts <= season!.endTimestamp);
        })
      : allSets;

    // Helper to evaluate max stats from a set of rows
    const evaluateSets = (rows: typeof allSets) => {
      let bestW = 0;
      let bestR = 0;
      let bestSec = 0;
      let bestDist = 0;
      let max1RM = 0;
      let bestScore = -1;
      let label = "Sin registros";

      if (rows.length === 0) {
        return { bestW, bestR, bestSec, bestDist, max1RM, label, hasData: false };
      }

      if (metricType === "seconds") {
        for (const row of rows) {
          const s = Number(row.duration_seconds) || 0;
          if (s > bestSec) bestSec = s;
        }
        label = `${bestSec}s`;
      } else if (metricType === "cardio") {
        for (const row of rows) {
          const d = Number(row.distance_km) || 0;
          if (d > bestDist) bestDist = d;
        }
        label = `${bestDist} km`;
      } else if (metricType === "bodyweight_reps") {
        for (const row of rows) {
          const r = Number(row.reps) || 0;
          if (r > bestR) bestR = r;
        }
        label = `${bestR} reps`;
      } else if (metricType === "weighted_bodyweight") {
        for (const row of rows) {
          const wt = Number(row.weight_kg) || 0;
          const rp = Number(row.reps) || 0;
          const score = wt !== 0 ? wt * 1000 + rp : rp;
          if (score > bestScore) {
            bestScore = score;
            bestW = wt;
            bestR = rp;
          }
          if (wt > 0 && rp > 0) {
            const e1 = calculate1RM(wt, rp);
            if (e1 > max1RM) max1RM = e1;
          }
        }
        if (bestW > 0) {
          label = `+${bestW} kg × ${bestR}`;
        } else if (bestW < 0) {
          label = `${bestW} kg × ${bestR}`;
        } else {
          label = `BW × ${bestR}`;
        }
      } else {
        // weight_reps
        for (const row of rows) {
          const wt = Number(row.weight_kg) || 0;
          const rp = Number(row.reps) || 0;
          const score = wt * 1000 + rp;
          if (score > bestScore) {
            bestScore = score;
            bestW = wt;
            bestR = rp;
          }
          if (wt > 0 && rp > 0) {
            const e1 = calculate1RM(wt, rp);
            if (e1 > max1RM) max1RM = e1;
          }
        }
        label = `${bestW} kg × ${bestR}`;
      }

      return { bestW, bestR, bestSec, bestDist, max1RM, label, hasData: true };
    };

    const allTimeStats = evaluateSets(allSets);
    const activeStats = evaluateSets(activeSets);

    // Calculate completion for all-time
    const checkCompletion = (stats: ReturnType<typeof evaluateSets>) => {
      if (!stats.hasData) return false;
      if (metricType === "weight_reps" || metricType === "weighted_bodyweight") {
        const tWeight = targetWeight ?? 0;
        const tReps = targetReps ?? 0;
        const t1RM = target1RM ?? 0;
        const c1RM = stats.max1RM || (stats.bestW > 0 && stats.bestR > 0 ? calculate1RM(stats.bestW, stats.bestR) : 0);
        return (stats.bestW >= tWeight && stats.bestR >= tReps) || (t1RM > 0 && c1RM >= t1RM);
      } else if (metricType === "bodyweight_reps") {
        return stats.bestR >= (targetReps ?? 0) && (targetReps ?? 0) > 0;
      } else if (metricType === "seconds") {
        return stats.bestSec >= (targetSeconds ?? 0) && (targetSeconds ?? 0) > 0;
      } else if (metricType === "cardio") {
        return stats.bestDist >= (targetDistanceKm ?? 0) && (targetDistanceKm ?? 0) > 0;
      }
      return false;
    };

    const allTimeReached = checkCompletion(allTimeStats);
    const isCompleted = checkCompletion(activeStats);

    let progressPct = 0;
    let remainingGapLabel = "";

    if (!activeStats.hasData) {
      progressPct = 0;
      remainingGapLabel = season ? `Sin registros en temporada ${season.name}` : "Pendiente de primer registro";
    } else if (isCompleted) {
      progressPct = 100;
      remainingGapLabel = "¡Objetivo Conseguido! ★";
    } else {
      if (metricType === "weight_reps" || metricType === "weighted_bodyweight") {
        const tWeight = targetWeight ?? 0;
        const tReps = targetReps ?? 0;
        const t1RM = target1RM ?? 0;
        const c1RM = activeStats.max1RM || (activeStats.bestW > 0 && activeStats.bestR > 0 ? calculate1RM(activeStats.bestW, activeStats.bestR) : 0);

        if (t1RM > 0 && c1RM > 0) {
          progressPct = Math.min(99, Math.max(1, Math.round((c1RM / t1RM) * 100)));
        } else if (tWeight > 0 && activeStats.bestW > 0) {
          progressPct = Math.min(99, Math.max(1, Math.round((activeStats.bestW / tWeight) * 100)));
        } else {
          progressPct = 0;
        }

        const diffWeight = Math.max(0, tWeight - activeStats.bestW);
        const diffReps = Math.max(0, tReps - activeStats.bestR);
        if (diffWeight > 0 && diffReps > 0) {
          remainingGapLabel = `+${diffWeight.toFixed(diffWeight % 1 === 0 ? 0 : 1)} kg · +${diffReps} reps`;
        } else if (diffWeight > 0) {
          remainingGapLabel = `+${diffWeight.toFixed(diffWeight % 1 === 0 ? 0 : 1)} kg`;
        } else if (diffReps > 0) {
          remainingGapLabel = `+${diffReps} reps`;
        } else {
          remainingGapLabel = "Casi completado";
        }
      } else if (metricType === "bodyweight_reps") {
        const tReps = targetReps ?? 0;
        progressPct = tReps > 0 ? Math.min(99, Math.max(0, Math.round((activeStats.bestR / tReps) * 100))) : 0;
        remainingGapLabel = `+${Math.max(0, tReps - activeStats.bestR)} reps`;
      } else if (metricType === "seconds") {
        const tSec = targetSeconds ?? 0;
        progressPct = tSec > 0 ? Math.min(99, Math.max(0, Math.round((activeStats.bestSec / tSec) * 100))) : 0;
        remainingGapLabel = `+${Math.max(0, tSec - activeStats.bestSec)}s`;
      } else if (metricType === "cardio") {
        const tDist = targetDistanceKm ?? 0;
        progressPct = tDist > 0 ? Math.min(99, Math.max(0, Math.round((activeStats.bestDist / tDist) * 100))) : 0;
        remainingGapLabel = `+${Math.max(0, tDist - activeStats.bestDist).toFixed(1)} km`;
      }
    }

    results.push({
      id: String(g.id),
      exerciseId: exId,
      exerciseName: exName,
      metricType,
      currentWeight: activeStats.bestW > 0 ? activeStats.bestW : undefined,
      currentReps: activeStats.bestR > 0 ? activeStats.bestR : undefined,
      currentSeconds: activeStats.bestSec > 0 ? activeStats.bestSec : undefined,
      currentDistanceKm: activeStats.bestDist > 0 ? activeStats.bestDist : undefined,
      current1RM: activeStats.max1RM > 0 ? activeStats.max1RM : undefined,
      currentLabel: activeStats.label,
      targetWeight,
      targetReps,
      targetSeconds,
      targetDistanceKm,
      target1RM,
      targetLabel,
      progressPct,
      isCompleted,
      remainingGapLabel,
      notes: g.notes ? String(g.notes) : undefined,
      createdAt: Number(g.created_at),
      updatedAt: Number(g.updated_at),
      allTimeReached,
      allTimeLabel: allTimeStats.label,
      activeSeasonName: season ? season.name : undefined,
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

export interface JournalWorkout {
  id: string;
  title: string;
  startTime: string;
  startTimestamp: number;
  endTime: string;
  durationSeconds: number;
  description: string;
  exercises: {
    id: string;
    name: string;
    metricType?: string;
    exerciseNotes: string;
    sets: SetDetail[];
    topSetLabel: string;
  }[];
}

export async function getJournalWorkouts(seasonId?: string | null): Promise<JournalWorkout[]> {
  const db = getDb();
  await ensureSchema(db);

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

    const exList = Array.from(exMap.values()).map((ex) => {
      let topLabel = "-";
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
            } else if ((best.weightKg ?? 0) < 0) {
              topLabel = `${best.weightKg} kg × ${best.reps}`;
            } else if (best.reps) {
              topLabel = `BW × ${best.reps}`;
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

      return {
        ...ex,
        topSetLabel: topLabel,
      };
    });

    results.push({
      id: wId,
      title: String(w.title),
      startTime: String(w.start_time),
      startTimestamp: Number(w.start_timestamp),
      endTime: w.end_time ? String(w.end_time) : "",
      durationSeconds: Number(w.duration_seconds) || 0,
      description: w.description ? String(w.description) : "",
      exercises: exList,
    });
  }

  return results;
}

export async function getWorkoutDetail(workoutId: string): Promise<JournalWorkout | null> {
  const db = getDb();
  await ensureSchema(db);

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

  const exList = Array.from(exMap.values()).map((ex) => {
    let topLabel = "-";
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
          } else if ((best.weightKg ?? 0) < 0) {
            topLabel = `${best.weightKg} kg × ${best.reps}`;
          } else if (best.reps) {
            topLabel = `BW × ${best.reps}`;
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

    return {
      ...ex,
      topSetLabel: topLabel,
    };
  });

  return {
    id: wId,
    title: String(w.title),
    startTime: String(w.start_time),
    startTimestamp: Number(w.start_timestamp),
    endTime: w.end_time ? String(w.end_time) : "",
    durationSeconds: Number(w.duration_seconds) || 0,
    description: w.description ? String(w.description) : "",
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
  ], "write");
  return { success: true };
}
