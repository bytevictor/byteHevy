import { getDb, ensureSchema } from "./db";
import { WeightRecord } from "./mock-weight-data";
import { calculateFfmi, calculateBmi } from "./biometrics";
import { bulkInsertWeightRecords } from "./actions";

export interface XiaomiAuthRecord {
  id: string;
  userId: string | null;
  passToken: string | null;
  region: string;
  scaleModel: string;
  isAuthenticated: boolean;
  lastSyncTimestampMs: number;
  qrLpUrl: string | null;
  qrLoginUrl: string | null;
  qrImageUrl: string | null;
  qrCreatedAt: number | null;
  updatedAt: number;
}

export interface ScaleMeasurementRecord {
  timestamp_ms: number;
  measured_at: string | null;
  weight_kg: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  body_water_pct: number | null;
  bone_mass_kg: number | null;
  muscle_mass_kg: number | null;
  protein_mass_kg: number | null;
  skeletal_muscle_mass_kg: number | null;
  visceral_fat: number | null;
  metabolic_age: number | null;
  bmr_kcal: number | null;
  body_score: number | null;
  heart_rate_bpm: number | null;
  user_name: string;
  height_cm: number | null;
  scale_model?: string;
}

export async function getXiaomiAuthRecord(): Promise<XiaomiAuthRecord> {
  const db = getDb();
  await ensureSchema(db);

  let res = await db.execute("SELECT * FROM xiaomi_auth WHERE id = 'primary' LIMIT 1");

  if (res.rows.length === 0) {
    await db.execute(`
      INSERT OR IGNORE INTO xiaomi_auth (id, region, scale_model, is_authenticated, last_sync_timestamp_ms)
      VALUES ('primary', 'de', 'yunmai.scales.ms104', 0, 0)
    `);
    res = await db.execute("SELECT * FROM xiaomi_auth WHERE id = 'primary' LIMIT 1");
  }

  const r = res.rows[0];
  return {
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    passToken: r.pass_token ? String(r.pass_token) : null,
    region: String(r.region || "de"),
    scaleModel: String(r.scale_model || "yunmai.scales.ms104"),
    isAuthenticated: Boolean(r.is_authenticated),
    lastSyncTimestampMs: Number(r.last_sync_timestamp_ms || 0),
    qrLpUrl: r.qr_lp_url ? String(r.qr_lp_url) : null,
    qrLoginUrl: r.qr_login_url ? String(r.qr_login_url) : null,
    qrImageUrl: r.qr_image_url ? String(r.qr_image_url) : null,
    qrCreatedAt: r.qr_created_at ? Number(r.qr_created_at) : null,
    updatedAt: Number(r.updated_at || 0),
  };
}

export async function saveXiaomiQrSession(
  loginUrl: string,
  qrImageUrl: string,
  lpUrl: string
): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: `INSERT INTO xiaomi_auth (id, qr_login_url, qr_image_url, qr_lp_url, qr_created_at, updated_at)
          VALUES ('primary', ?, ?, ?, ?, strftime('%s', 'now'))
          ON CONFLICT(id) DO UPDATE SET
            qr_login_url = excluded.qr_login_url,
            qr_image_url = excluded.qr_image_url,
            qr_lp_url = excluded.qr_lp_url,
            qr_created_at = excluded.qr_created_at,
            updated_at = strftime('%s', 'now')`,
    args: [loginUrl, qrImageUrl, lpUrl, Date.now()],
  });
}

export async function saveXiaomiAuthTokens(
  userId: string,
  passToken: string,
  region = "de",
  scaleModel = "yunmai.scales.ms104"
): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: `INSERT INTO xiaomi_auth (id, user_id, pass_token, region, scale_model, is_authenticated, qr_lp_url, qr_login_url, qr_image_url, updated_at)
          VALUES ('primary', ?, ?, ?, ?, 1, NULL, NULL, NULL, strftime('%s', 'now'))
          ON CONFLICT(id) DO UPDATE SET
            user_id = excluded.user_id,
            pass_token = excluded.pass_token,
            region = excluded.region,
            scale_model = excluded.scale_model,
            is_authenticated = 1,
            qr_lp_url = NULL,
            qr_login_url = NULL,
            qr_image_url = NULL,
            updated_at = strftime('%s', 'now')`,
    args: [userId, passToken, region, scaleModel],
  });
}

export async function updateXiaomiSyncTimestamp(lastSyncTimestampMs: number): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute({
    sql: `UPDATE xiaomi_auth SET
            last_sync_timestamp_ms = ?,
            updated_at = strftime('%s', 'now')
          WHERE id = 'primary'`,
    args: [lastSyncTimestampMs],
  });
}

export async function setXiaomiAuthExpired(): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute(`
    UPDATE xiaomi_auth SET
      is_authenticated = 0,
      updated_at = strftime('%s', 'now')
    WHERE id = 'primary'
  `);
}

export async function disconnectXiaomiAuth(): Promise<void> {
  const db = getDb();
  await ensureSchema(db);

  await db.execute(`
    UPDATE xiaomi_auth SET
      user_id = NULL,
      pass_token = NULL,
      is_authenticated = 0,
      qr_lp_url = NULL,
      qr_login_url = NULL,
      qr_image_url = NULL,
      updated_at = strftime('%s', 'now')
    WHERE id = 'primary'
  `);
}

export async function getLatestScaleMeasurementTimestamp(): Promise<number> {
  const db = getDb();
  await ensureSchema(db);

  const res = await db.execute("SELECT MAX(timestamp_ms) as max_ts FROM scale_measurements");
  const maxTs = res.rows[0]?.max_ts;
  if (maxTs && Number(maxTs) > 0) {
    return Number(maxTs);
  }

  // Fallback a last_sync_timestamp_ms de auth
  const auth = await getXiaomiAuthRecord();
  return auth.lastSyncTimestampMs;
}

export async function saveScaleMeasurements(
  records: ScaleMeasurementRecord[]
): Promise<{ insertedCount: number; lastTimestampMs: number }> {
  if (records.length === 0) {
    return { insertedCount: 0, lastTimestampMs: 0 };
  }

  const db = getDb();
  await ensureSchema(db);

  // 1. Guardar en scale_measurements
  const batchStatements = records.map((r) => ({
    sql: `INSERT OR REPLACE INTO scale_measurements (
      timestamp_ms, measured_at, weight_kg, bmi, body_fat_pct, body_water_pct,
      bone_mass_kg, muscle_mass_kg, protein_mass_kg, skeletal_muscle_mass_kg,
      visceral_fat, metabolic_age, bmr_kcal, body_score, heart_rate_bpm,
      user_name, height_cm, scale_model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      r.timestamp_ms,
      r.measured_at ?? null,
      r.weight_kg ?? null,
      r.bmi ?? null,
      r.body_fat_pct ?? null,
      r.body_water_pct ?? null,
      r.bone_mass_kg ?? null,
      r.muscle_mass_kg ?? null,
      r.protein_mass_kg ?? null,
      r.skeletal_muscle_mass_kg ?? null,
      r.visceral_fat ?? null,
      r.metabolic_age ?? null,
      r.bmr_kcal ?? null,
      r.body_score ?? null,
      r.heart_rate_bpm ?? null,
      r.user_name || "Usuario",
      r.height_cm ?? 180,
      r.scale_model || "yunmai.scales.ms104",
    ],
  }));

  // Batch insert en trozos de 100
  for (let i = 0; i < batchStatements.length; i += 100) {
    await db.batch(batchStatements.slice(i, i + 100), "write");
  }

  // 2. Sincronizar simultáneamente con la tabla principal weight_records
  // para que las gráficas, medias móviles y tabla de pesajes se actualicen de inmediato
  const weightRecordsToSync: WeightRecord[] = records
    .filter((r) => r.weight_kg && r.weight_kg > 0)
    .map((r) => {
      const ts = r.timestamp_ms;
      const dt = r.measured_at ? new Date(r.measured_at) : new Date(ts);
      const fecha = dt.toISOString().split("T")[0];
      const hora = dt.toTimeString().substring(0, 5);

      const peso = r.weight_kg!;
      const altura = r.height_cm && r.height_cm > 0 ? r.height_cm : 180;
      const bmi = r.bmi && r.bmi > 0 ? r.bmi : calculateBmi(peso, altura);
      const fatRate = r.body_fat_pct && r.body_fat_pct > 0 ? r.body_fat_pct : null;
      const waterRate = r.body_water_pct && r.body_water_pct > 0 ? r.body_water_pct : null;

      let leanMassKg: number | null = null;
      let fatMassKg: number | null = null;
      let ffmi: number | null = null;
      let estImpedance: number | null = null;
      let estImpedanceLow: number | null = null;

      if (fatRate !== null) {
        fatMassKg = Math.round(peso * (fatRate / 100) * 100) / 100;
        leanMassKg = Math.round((peso - fatMassKg) * 100) / 100;
        const ffmiData = calculateFfmi(leanMassKg, altura);
        ffmi = ffmiData.ffmi;

        if (waterRate !== null) {
          const tbwL = peso * (waterRate / 100);
          const denom = tbwL - 0.12 * peso - 4.5;
          if (denom > 0) {
            estImpedance = Math.round(((0.386 * (altura * altura)) / denom) * 10) / 10;
            estImpedanceLow = Math.round(estImpedance * 1.085);
          }
        }
      }

      const notesParts: string[] = [];
      if (r.heart_rate_bpm && r.heart_rate_bpm > 0) notesParts.push(`FC: ${r.heart_rate_bpm} bpm`);
      if (r.protein_mass_kg && r.protein_mass_kg > 0) notesParts.push(`Proteína: ${r.protein_mass_kg} kg`);
      if (r.skeletal_muscle_mass_kg && r.skeletal_muscle_mass_kg > 0) {
        notesParts.push(`M. esquelético: ${r.skeletal_muscle_mass_kg} kg`);
      }
      if (r.metabolic_age && r.metabolic_age > 0) notesParts.push(`Edad metabólica: ${r.metabolic_age} a`);
      if (r.body_score && r.body_score > 0) notesParts.push(`Puntuación: ${r.body_score}/100`);
      const notes = notesParts.length > 0 ? notesParts.join(" | ") : null;

      return {
        id: `mihome-${ts}`,
        fecha,
        hora,
        timestamp: ts,
        peso,
        impedancia: estImpedance,
        impedanciaLow: estImpedanceLow,
        grasaPct: fatRate,
        masaMagraKg: leanMassKg,
        masaGrasaKg: fatMassKg,
        aguaPct: waterRate,
        bmi,
        ffmi,
        altura,
        boneMass: r.bone_mass_kg && r.bone_mass_kg > 0 ? r.bone_mass_kg : null,
        metabolism: r.bmr_kcal && r.bmr_kcal > 0 ? r.bmr_kcal : null,
        muscleRate: r.muscle_mass_kg && r.muscle_mass_kg > 0 ? r.muscle_mass_kg : null,
        visceralFat: r.visceral_fat && r.visceral_fat > 0 ? r.visceral_fat : null,
        source: "xiaomi_mi_home",
        notes,
        esValido: true,
      };
    });

  if (weightRecordsToSync.length > 0) {
    await bulkInsertWeightRecords(weightRecordsToSync);
  }

  const maxTs = Math.max(...records.map((r) => r.timestamp_ms));
  await updateXiaomiSyncTimestamp(maxTs);

  return { insertedCount: records.length, lastTimestampMs: maxTs };
}
