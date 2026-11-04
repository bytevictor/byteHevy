import { getDb, ensureSchema } from "./db";

export interface HevyAuthRecord {
  id: string;
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  username: string | null;
  email: string | null;
  isAuthenticated: boolean;
  lastSyncTimestamp: number;
  lastSyncWorkoutsCount: number;
  updatedAt: number;
}

export async function getHevyAuthRecord(): Promise<HevyAuthRecord> {
  const db = getDb();
  await ensureSchema(db);

  let res = await db.execute("SELECT * FROM hevy_auth WHERE id = 'primary' LIMIT 1");

  if (res.rows.length === 0) {
    await db.execute(`
      INSERT OR IGNORE INTO hevy_auth (id, is_authenticated, last_sync_timestamp, last_sync_workouts_count)
      VALUES ('primary', 0, 0, 0)
    `);
    res = await db.execute("SELECT * FROM hevy_auth WHERE id = 'primary' LIMIT 1");
  }

  const r = res.rows[0];
  return {
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    accessToken: r.access_token ? String(r.access_token) : null,
    refreshToken: r.refresh_token ? String(r.refresh_token) : null,
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    username: r.username ? String(r.username) : null,
    email: r.email ? String(r.email) : null,
    isAuthenticated: Boolean(r.is_authenticated),
    lastSyncTimestamp: Number(r.last_sync_timestamp || 0),
    lastSyncWorkoutsCount: Number(r.last_sync_workouts_count || 0),
    updatedAt: Number(r.updated_at || 0),
  };
}

export async function saveHevyAuthTokens(tokens: {
  userId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  username?: string | null;
  email?: string | null;
}): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: `INSERT INTO hevy_auth (id, user_id, access_token, refresh_token, expires_at, username, email, is_authenticated, updated_at)
          VALUES ('primary', ?, ?, ?, ?, ?, ?, 1, strftime('%s', 'now'))
          ON CONFLICT(id) DO UPDATE SET
            user_id = COALESCE(excluded.user_id, hevy_auth.user_id),
            access_token = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, hevy_auth.refresh_token),
            expires_at = COALESCE(excluded.expires_at, hevy_auth.expires_at),
            username = COALESCE(excluded.username, hevy_auth.username),
            email = COALESCE(excluded.email, hevy_auth.email),
            is_authenticated = 1,
            updated_at = strftime('%s', 'now')`,
    args: [
      tokens.userId || null,
      tokens.accessToken,
      tokens.refreshToken || null,
      tokens.expiresAt || null,
      tokens.username || null,
      tokens.email || null,
    ],
  });
}

export async function updateHevyLastSync(
  timestamp: number,
  workoutsCount = 0
): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: `UPDATE hevy_auth
          SET last_sync_timestamp = ?,
              last_sync_workouts_count = ?,
              updated_at = strftime('%s', 'now')
          WHERE id = 'primary'`,
    args: [timestamp, workoutsCount],
  });
}

export async function disconnectHevyAuth(): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute(`
    UPDATE hevy_auth
    SET access_token = NULL,
        refresh_token = NULL,
        is_authenticated = 0,
        updated_at = strftime('%s', 'now')
    WHERE id = 'primary'
  `);
}

