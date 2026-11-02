/**
 * Estructuras de datos y mockups para el seguimiento de Peso y % Graso
 * Modelo basado en báscula de bioimpedancia dual:
 * Schema esperado: Fecha, hora, Impedancia, Impedancia Low, Peso
 */

import {
  UserBiometricProfile,
  DEFAULT_USER_PROFILE,
  calculateBmi,
  calculateFfmi,
} from "./user-profile-context";

export type { UserBiometricProfile };
export { DEFAULT_USER_PROFILE };

export interface WeightRecord {
  id: string;
  fecha: string;         // YYYY-MM-DD (ej: "2026-10-31")
  hora: string;          // HH:mm (ej: "07:45")
  timestamp: number;     // Epoch ms
  peso: number;          // kg (ej: 77.4)
  impedancia: number;    // Ohmios Ω (alta frecuencia / 50kHz)
  impedanciaLow: number; // Ohmios Ω (baja frecuencia / 5kHz)
  grasaPct: number;      // % grasa corporal estimado
  masaMagraKg: number;   // kg masa libre de grasa (FFM)
  masaGrasaKg: number;   // kg masa grasa
  aguaPct: number;       // % agua corporal total estimada
  bmi?: number;          // Índice de masa corporal (kg/m²)
  ffmi?: number;         // Fat-Free Mass Index
  deltaPeso?: number;    // Diferencia con respecto al registro anterior
  deltaGrasa?: number;   // Diferencia de % graso con el registro anterior
  ma7Peso?: number;      // Media móvil de 7 días de peso
  ma7Grasa?: number;     // Media móvil de 7 días de % graso
  esValido?: boolean;
}

/**
 * Estima los parámetros de composición corporal basados en Peso y Bioimpedancia (BIA)
 * Ecuación clínica basada en el índice de impedancia (H²/R) y peso corporal.
 */
export function estimateBodyComposition(
  peso: number,
  impedancia: number,
  impedanciaLow: number,
  profile: UserBiometricProfile = DEFAULT_USER_PROFILE
): {
  grasaPct: number;
  masaMagraKg: number;
  masaGrasaKg: number;
  aguaPct: number;
  bmi: number;
  ffmi: number;
} {
  const h = profile.alturaCm > 0 ? profile.alturaCm : 178;
  const isMale = profile.sexo === "male";

  // Índice de impedancia: H² / R (cm² / Ω)
  const impedanceIndex = (h * h) / (impedancia > 0 ? impedancia : 500);

  // Estimación de Agua Corporal Total (TBW en Litros) con factor de edad
  const ageFactor = ((profile.edad || 26) - 25) * 0.035;
  let tbwLitres: number;
  if (isMale) {
    tbwLitres = 0.386 * impedanceIndex + 0.12 * peso + 4.5 - ageFactor;
  } else {
    tbwLitres = 0.345 * impedanceIndex + 0.13 * peso + 3.2 - ageFactor;
  }

  // Factor de hidratación según ratio de impedancia (ImpedanciaLow / Impedancia)
  const ratio = impedanciaLow > 0 && impedancia > 0 ? impedanciaLow / impedancia : 1.08;
  const hydrationModifier = 1.08 / Math.max(1.0, ratio);
  tbwLitres *= hydrationModifier;

  // Masa libre de grasa (FFM / Masa Magra en kg): el tejido magro es aproximadamente 73.2% agua
  let masaMagraKg = tbwLitres / 0.732;
  // Límites biológicos
  if (masaMagraKg > peso * 0.94) masaMagraKg = peso * 0.94;
  if (masaMagraKg < peso * 0.60) masaMagraKg = peso * 0.60;

  const masaGrasaKg = Math.max(2, peso - masaMagraKg);
  const grasaPct = (masaGrasaKg / peso) * 100;
  const aguaPct = (tbwLitres / peso) * 100;

  const bmi = calculateBmi(peso, h);
  const ffmiData = calculateFfmi(masaMagraKg, h);

  return {
    grasaPct: Math.round(grasaPct * 10) / 10,
    masaMagraKg: Math.round(masaMagraKg * 10) / 10,
    masaGrasaKg: Math.round(masaGrasaKg * 10) / 10,
    aguaPct: Math.round(aguaPct * 10) / 10,
    bmi,
    ffmi: ffmiData.ffmi,
  };
}

/**
 * Calcula las medias móviles (7 días) para suavizar fluctuaciones de agua
 */
export function enrichWithMovingAverages(records: WeightRecord[], windowDays = 7): WeightRecord[] {
  // Ordenar cronológicamente
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];

    // Diferencia con respecto al registro previo
    if (i > 0) {
      const prev = sorted[i - 1];
      cur.deltaPeso = Math.round((cur.peso - prev.peso) * 100) / 100;
      cur.deltaGrasa = Math.round((cur.grasaPct - prev.grasaPct) * 10) / 10;
    } else {
      cur.deltaPeso = 0;
      cur.deltaGrasa = 0;
    }

    // Ventana de los últimos N días
    const windowStart = cur.timestamp - windowDays * 24 * 60 * 60 * 1000;
    const windowPoints = sorted.slice(0, i + 1).filter((p) => p.timestamp >= windowStart);

    if (windowPoints.length > 0) {
      const avgPeso = windowPoints.reduce((sum, p) => sum + p.peso, 0) / windowPoints.length;
      const avgGrasa = windowPoints.reduce((sum, p) => sum + p.grasaPct, 0) / windowPoints.length;
      cur.ma7Peso = Math.round(avgPeso * 100) / 100;
      cur.ma7Grasa = Math.round(avgGrasa * 10) / 10;
    } else {
      cur.ma7Peso = cur.peso;
      cur.ma7Grasa = cur.grasaPct;
    }
  }

  return sorted;
}

/**
 * Generador de datos mockup realistas de peso e impedancia
 * Simula una fase de definición / recomposición corporal de ~5 meses (Junio a Noviembre 2026)
 * con fluctuaciones naturales de retención de agua, fines de semana y preservación muscular.
 */
export function generateMockWeightRecords(
  profile: UserBiometricProfile = DEFAULT_USER_PROFILE
): WeightRecord[] {
  const records: WeightRecord[] = [];
  const startDate = new Date(2026, 4, 15); // 15 de Mayo 2026
  const endDate = new Date(2026, 10, 2);   // 2 de Noviembre 2026

  let currentWeight = 81.8;
  const targetWeight = 77.1;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000));
  const ratePerDay = (81.8 - targetWeight) / totalDays; // ~0.027 kg / día (~190g por semana)

  let currentDate = new Date(startDate);
  let idCounter = 1;

  while (currentDate <= endDate) {
    // Saltarse algunos días aleatorios (como pesarse 5-6 días por semana)
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const skipChance = isWeekend ? 0.25 : 0.08;

    if (Math.random() > skipChance) {
      const dayIndex = Math.round((currentDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000));
      const progressFraction = dayIndex / totalDays;

      // Tendencia base de pérdida de peso
      const baseWeight = 81.8 - (progressFraction * (81.8 - targetWeight));

      // Ruido biológico realista (carbohidratos, hidratación, inflamación de entreno)
      // Ciclo semanal: lunes ligeramente más alto tras el fin de semana (+0.3kg)
      const weekendBump = dayOfWeek === 1 ? 0.35 : dayOfWeek === 2 ? 0.15 : 0;
      const noise = (Math.sin(dayIndex * 0.45) * 0.3) + ((Math.random() - 0.5) * 0.35) + weekendBump;

      const dailyWeight = Math.round((baseWeight + noise) * 10) / 10;

      // Impedancia correlacionada: al bajar la grasa y el agua, la impedancia en ohmios suele subir ligeramente
      // 505 Ω a 81.8kg -> 535 Ω a 77.1kg
      const baseImpedance = 505 + (progressFraction * 32);
      const impNoise = (Math.random() - 0.5) * 8 - (noise * 6); // Más agua retenida = menor impedancia
      const impedancia = Math.round(baseImpedance + impNoise);

      // Impedancia Low (baja frecuencia, ej. 5kHz): típicamente un ~8% - 10% mayor
      const impedanciaLow = Math.round(impedancia * (1.085 + (Math.random() - 0.5) * 0.015));

      // Hora típica de pesaje matutino (07:15 - 08:30)
      const hours = Math.floor(7 + Math.random() * 1.5);
      const minutes = Math.floor(Math.random() * 59);
      const horaStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const fechaStr = `${year}-${month}-${day}`;

      const ts = new Date(year, currentDate.getMonth(), currentDate.getDate(), hours, minutes).getTime();

      const comp = estimateBodyComposition(dailyWeight, impedancia, impedanciaLow, profile);

      records.push({
        id: `w-${idCounter++}`,
        fecha: fechaStr,
        hora: horaStr,
        timestamp: ts,
        peso: dailyWeight,
        impedancia,
        impedanciaLow,
        grasaPct: comp.grasaPct,
        masaMagraKg: comp.masaMagraKg,
        masaGrasaKg: comp.masaGrasaKg,
        aguaPct: comp.aguaPct,
        bmi: comp.bmi,
        ffmi: comp.ffmi,
        esValido: true,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return enrichWithMovingAverages(records);
}

/**
 * Parser para el CSV del usuario según el esquema:
 * Fecha, hora, Impedancia, Impedancia Low, Peso
 */
export function parseWeightCsv(
  csvText: string,
  profile: UserBiometricProfile = DEFAULT_USER_PROFILE
): { success: boolean; records: WeightRecord[]; errors: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      success: false,
      records: [],
      errors: ["El archivo CSV debe tener al menos una cabecera y una fila de datos."],
    };
  }

  // Detectar separador (, o ;)
  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const rawHeaders = headerLine.split(separator).map((h) => h.trim().toLowerCase());

  // Encontrar índices de columnas
  let fechaIdx = rawHeaders.findIndex((h) => h.includes("fecha") || h.includes("date"));
  let horaIdx = rawHeaders.findIndex((h) => h.includes("hora") || h.includes("time"));
  let impLowIdx = rawHeaders.findIndex((h) => h.includes("low") || h.includes("baja"));
  let impIdx = rawHeaders.findIndex(
    (h, idx) => idx !== impLowIdx && (h.includes("impedancia") || h.includes("impedance") || h.includes("resistencia"))
  );
  let pesoIdx = rawHeaders.findIndex((h) => h.includes("peso") || h.includes("weight") || h.includes("kg"));

  // Si no se detectaron por nombre, asignar por posición por defecto:
  // Fecha (0), hora (1), Impedancia (2), Impedancia Low (3), Peso (4)
  if (fechaIdx === -1 && lines.length > 1) fechaIdx = 0;
  if (horaIdx === -1) horaIdx = 1;
  if (impIdx === -1) impIdx = 2;
  if (impLowIdx === -1) impLowIdx = 3;
  if (pesoIdx === -1) pesoIdx = 4;

  const parsedRecords: WeightRecord[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(separator).map((cell) => cell.trim());
    if (row.length < 3) continue;

    try {
      const fechaStr = row[fechaIdx] || "";
      const horaStr = row[horaIdx] || "08:00";
      const impRaw = row[impIdx] ? parseFloat(row[impIdx].replace(",", ".")) : 0;
      const impLowRaw = row[impLowIdx] ? parseFloat(row[impLowIdx].replace(",", ".")) : 0;
      const pesoRaw = row[pesoIdx] ? parseFloat(row[pesoIdx].replace(",", ".")) : 0;

      if (!fechaStr || isNaN(pesoRaw) || pesoRaw <= 0) {
        errors.push(`Fila ${i + 1}: Fecha o Peso inválidos.`);
        continue;
      }

      // Normalizar fecha (soporta YYYY-MM-DD o DD/MM/YYYY)
      let normalizedDate = fechaStr;
      if (fechaStr.includes("/")) {
        const parts = fechaStr.split("/");
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            normalizedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          } else if (parts[0].length === 4) {
            normalizedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          }
        }
      }

      const [y, m, d] = normalizedDate.split("-").map(Number);
      const [hh, mm] = horaStr.split(":").map(Number);
      const ts = new Date(y, (m || 1) - 1, d || 1, hh || 8, mm || 0).getTime();

      const impedancia = isNaN(impRaw) || impRaw <= 0 ? 520 : impRaw;
      const impedanciaLow = isNaN(impLowRaw) || impLowRaw <= 0 ? Math.round(impedancia * 1.08) : impLowRaw;

      const comp = estimateBodyComposition(pesoRaw, impedancia, impedanciaLow, profile);

      parsedRecords.push({
        id: `csv-${i}`,
        fecha: normalizedDate,
        hora: horaStr,
        timestamp: ts,
        peso: Math.round(pesoRaw * 10) / 10,
        impedancia,
        impedanciaLow,
        grasaPct: comp.grasaPct,
        masaMagraKg: comp.masaMagraKg,
        masaGrasaKg: comp.masaGrasaKg,
        aguaPct: comp.aguaPct,
        bmi: comp.bmi,
        ffmi: comp.ffmi,
        esValido: true,
      });
    } catch (e: any) {
      errors.push(`Fila ${i + 1}: ${e?.message || "Error de formato"}`);
    }
  }

  if (parsedRecords.length === 0) {
    return {
      success: false,
      records: [],
      errors: errors.length > 0 ? errors : ["No se encontraron registros válidos."],
    };
  }

  const enriched = enrichWithMovingAverages(parsedRecords);

  return {
    success: true,
    records: enriched,
    errors,
  };
}

/**
 * Ejemplo representativo de CSV para descargar o previsualizar
 */
export function getSampleCsvContent(): string {
  return `Fecha, hora, Impedancia, Impedancia Low, Peso
2026-10-25, 07:35, 524, 570, 77.8
2026-10-26, 07:42, 522, 568, 77.7
2026-10-27, 07:30, 520, 565, 77.5
2026-10-28, 08:05, 526, 572, 77.6
2026-10-29, 07:40, 521, 566, 77.3
2026-10-30, 07:38, 523, 569, 77.4
2026-10-31, 08:15, 525, 571, 77.2
2026-11-01, 08:20, 527, 574, 77.4
2026-11-02, 07:45, 524, 570, 77.1`;
}
