import { getDb, ensureSchema } from "./db";
import crypto from "node:crypto";

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
  };
}

export interface ChartPoint {
  date: string;
  timestamp: number;
  primaryValue: number;
  secondaryValue?: number;
  label: string;
  isPR: boolean;
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
    estimated1RM: number | null;
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

export async function getExercisesList(): Promise<ExerciseSummary[]> {
  const db = getDb();
  await ensureSchema(db);

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
          const score = wt > 0 ? wt * 100 + rp : rp;
          if (score > allTimeBestVal) {
            allTimeBestVal = score;
            allTimeBestLabel = wt > 0 ? `+${wt} kg × ${rp}` : `BW × ${rp}`;
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

    const latest = uniqueWorkouts[uniqueWorkouts.length - 1];
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
        let maxScore = -1;
        for (const s of latest.sets) {
          const w = s.weight_kg !== null && s.weight_kg !== undefined ? Number(s.weight_kg) : 0;
          const r = Number(s.reps) || 0;
          const sc = w > 0 ? w * 100 + r : r;
          if (sc > maxScore) {
            maxScore = sc;
            top = s;
          }
        }
        const tw = top.weight_kg !== null && top.weight_kg !== undefined ? Number(top.weight_kg) : 0;
        latestTopLabel = tw > 0 ? `+${tw} kg × ${top.reps}` : `BW × ${top.reps}`;
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
      sessionCount: uniqueWorkouts.length,
      latestTimestamp: latest.startTimestamp,
      latestDate: latest.startTime,
      bestValue: allTimeBestVal,
      bestLabel: allTimeBestLabel,
      latestTopSetLabel: latestTopLabel,
    });
  }

  return results.sort((a, b) => b.sessionCount - a.sessionCount || b.latestTimestamp - a.latestTimestamp);
}

export async function getExerciseDetail(exerciseId: string): Promise<ExerciseDetailData | null> {
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

  const chartPoints: ChartPoint[] = [];
  const sessions: ExerciseSessionHistory[] = [];

  let runningBestValue = -1;
  let allTimeBestRecord: { value: number; label: string; date: string } | null = null;
  let maxEst1RM = 0;

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
      let bestScore = -1;
      for (const s of w.sets) {
        const wt = s.weightKg ?? 0;
        const rp = s.reps ?? 0;
        const sc = wt > 0 ? wt * 100 + rp : rp;
        if (sc > bestScore) {
          bestScore = sc;
          top = s;
        }
      }
      topVal = top.weightKg ?? 0;
      label = topVal > 0 ? `+${topVal} kg × ${top.reps}` : `BW × ${top.reps}`;
      if (topVal > 0 && top.reps) {
        est1RM = calculate1RM(topVal, top.reps);
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

    if (est1RM && est1RM > maxEst1RM) {
      maxEst1RM = est1RM;
    }

    const isPR = topVal > runningBestValue && topVal > 0;
    if (isPR) {
      runningBestValue = topVal;
      allTimeBestRecord = {
        value: topVal,
        label,
        date: w.startTime,
      };
    }

    const point: ChartPoint = {
      date: w.startTime,
      timestamp: w.startTimestamp,
      primaryValue: topVal,
      secondaryValue: est1RM,
      label,
      isPR,
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
      estimated1RM: maxEst1RM > 0 ? maxEst1RM : null,
    },
    chartPoints,
    sessions,
  };
}

export interface GoalItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  metricType: string;
  currentValue: number;
  currentLabel: string;
  targetMilestone: number;
  targetFinal: number;
  targetReps?: number;
  notes?: string;
  progressMilestonePct: number;
  progressFinalPct: number;
}

export async function getGoals(): Promise<GoalItem[]> {
  const db = getDb();
  await ensureSchema(db);

  const goalsRes = await db.execute(
    `SELECT g.id, g.exercise_id, e.name as exercise_name, g.metric_type,
            g.target_milestone, g.target_final, g.target_reps, g.notes
     FROM goals g
     JOIN exercises e ON e.id = g.exercise_id
     ORDER BY g.created_at DESC`
  );

  const results: GoalItem[] = [];

  for (const g of goalsRes.rows) {
    const exId = String(g.exercise_id);
    const detail = await getExerciseDetail(exId);
    const best = detail?.exercise.allTimeBest?.value ?? 0;
    const currentLabel = detail?.exercise.allTimeBest?.label ?? "Sin datos aún";

    const milestoneTarget = Number(g.target_milestone) || 0;
    const finalTarget = Number(g.target_final) || 0;

    const milestonePct = milestoneTarget > 0 ? Math.min(100, Math.round((best / milestoneTarget) * 100)) : 0;
    const finalPct = finalTarget > 0 ? Math.min(100, Math.round((best / finalTarget) * 100)) : 0;

    results.push({
      id: String(g.id),
      exerciseId: exId,
      exerciseName: String(g.exercise_name),
      metricType: String(g.metric_type),
      currentValue: best,
      currentLabel,
      targetMilestone: milestoneTarget,
      targetFinal: finalTarget,
      targetReps: g.target_reps !== null && g.target_reps !== undefined ? Number(g.target_reps) : undefined,
      notes: g.notes ? String(g.notes) : undefined,
      progressMilestonePct: milestonePct,
      progressFinalPct: finalPct,
    });
  }

  return results;
}

export async function saveGoal(data: {
  id?: string;
  exerciseId: string;
  metricType: string;
  targetMilestone: number;
  targetFinal: number;
  targetReps?: number;
  notes?: string;
}) {
  const db = getDb();
  await ensureSchema(db);
  const id = data.id || crypto.randomUUID();

  const existing = await db.execute({
    sql: "SELECT id FROM goals WHERE id = ?",
    args: [id],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE goals 
            SET exercise_id = ?, metric_type = ?, target_milestone = ?, target_final = ?, target_reps = ?, notes = ?, updated_at = strftime('%s', 'now')
            WHERE id = ?`,
      args: [data.exerciseId, data.metricType, data.targetMilestone, data.targetFinal, data.targetReps ?? null, data.notes ?? null, id],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO goals (id, exercise_id, metric_type, target_milestone, target_final, target_reps, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, data.exerciseId, data.metricType, data.targetMilestone, data.targetFinal, data.targetReps ?? null, data.notes ?? null],
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
    exerciseNotes: string;
    sets: SetDetail[];
    topSetLabel: string;
  }[];
}

export async function getJournalWorkouts(): Promise<JournalWorkout[]> {
  const db = getDb();
  await ensureSchema(db);

  const workoutsRes = await db.execute(
    "SELECT id, title, start_time, start_timestamp, end_time, duration_seconds, description FROM workouts ORDER BY start_timestamp DESC"
  );

  const results: JournalWorkout[] = [];

  for (const w of workoutsRes.rows) {
    const wId = String(w.id);
    const exercisesData = await db.execute({
      sql: `SELECT we.id as we_id, e.id as exercise_id, e.name as exercise_name, we.exercise_notes,
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
      exerciseNotes: string;
      sets: SetDetail[];
    }>();

    for (const r of exercisesData.rows) {
      const weId = String(r.we_id);
      if (!exMap.has(weId)) {
        exMap.set(weId, {
          id: String(r.exercise_id),
          name: String(r.exercise_name),
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
          let maxSc = -1;
          for (const s of ex.sets) {
            const wt = s.weightKg ?? 0;
            const rp = s.reps ?? 0;
            const sc = wt > 0 ? wt * 100 + rp : rp;
            if (sc > maxSc) {
              maxSc = sc;
              best = s;
            }
          }
          if ((best.weightKg ?? 0) > 0) {
            topLabel = `${best.weightKg} kg × ${best.reps}`;
          } else if (best.reps) {
            topLabel = `${best.reps} reps`;
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
    sql: `SELECT we.id as we_id, e.id as exercise_id, e.name as exercise_name, we.exercise_notes,
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
    exerciseNotes: string;
    sets: SetDetail[];
  }>();

  for (const r of exercisesData.rows) {
    const weId = String(r.we_id);
    if (!exMap.has(weId)) {
      exMap.set(weId, {
        id: String(r.exercise_id),
        name: String(r.exercise_name),
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
        let maxSc = -1;
        for (const s of ex.sets) {
          const wt = s.weightKg ?? 0;
          const rp = s.reps ?? 0;
          const sc = wt > 0 ? wt * 100 + rp : rp;
          if (sc > maxSc) {
            maxSc = sc;
            best = s;
          }
        }
        if ((best.weightKg ?? 0) > 0) {
          topLabel = `${best.weightKg} kg × ${best.reps}`;
        } else if (best.reps) {
          topLabel = `${best.reps} reps`;
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
