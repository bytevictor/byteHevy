import { createClient, Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

let dbInstance: Client | null = null;
let initialized = false;

export function getDb(): Client {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "bytehevy.db");
  dbInstance = createClient({
    url: `file:${dbPath}`,
  });

  return dbInstance;
}

export async function ensureSchema(db: Client) {
  if (initialized) return;

  // Check if goals table needs migration (e.g., old milestone schema)
  try {
    const tableInfo = await db.execute("PRAGMA table_info(goals)");
    const colNames = tableInfo.rows.map((r) => String(r.name));
    if (colNames.includes("target_milestone")) {
      await db.execute("DROP TABLE goals");
    }
  } catch (e) {
    // ignore
  }

  await db.batch([
    `CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      start_timestamp INTEGER NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER,
      description TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_unique 
      ON workouts(start_time, title);`,
    `CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      metric_type TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );`,
    `CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      exercise_notes TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);`,
    `CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);`,
    `CREATE TABLE IF NOT EXISTS exercise_sets (
      id TEXT PRIMARY KEY,
      workout_exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      set_type TEXT DEFAULT 'normal',
      weight_kg REAL,
      reps INTEGER,
      distance_km REAL,
      duration_seconds INTEGER,
      rpe REAL,
      FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_set_we ON exercise_sets(workout_exercise_id);`,
    `CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      exercise_id TEXT NOT NULL UNIQUE,
      metric_type TEXT NOT NULL,
      target_weight REAL,
      target_reps INTEGER,
      target_seconds INTEGER,
      target_distance_km REAL,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_goals_exercise ON goals(exercise_id);`,
    `CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      start_timestamp INTEGER NOT NULL,
      end_date TEXT,
      end_timestamp INTEGER,
      description TEXT,
      color TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );`,
    `CREATE INDEX IF NOT EXISTS idx_seasons_start ON seasons(start_timestamp);`,
  ]);

  // Migration for seasons: ensure color column exists
  try {
    const seasonInfo = await db.execute("PRAGMA table_info(seasons)");
    const seasonCols = seasonInfo.rows.map((r) => String(r.name));
    if (!seasonCols.includes("color")) {
      await db.execute("ALTER TABLE seasons ADD COLUMN color TEXT;");
    }
  } catch (e) {
    // ignore
  }

  initialized = true;
}
