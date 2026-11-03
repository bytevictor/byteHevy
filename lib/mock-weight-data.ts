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
} from "./biometrics";

export type { UserBiometricProfile };
export { DEFAULT_USER_PROFILE };

export interface WeightRecord {
  id: string;
  fecha: string;         // YYYY-MM-DD (ej: "2026-10-31")
  hora: string;          // HH:mm (ej: "07:45")
  timestamp: number;     // Epoch ms
  peso: number;          // kg (ej: 77.4)
  impedancia?: number | null;    // Ohmios Ω (alta frecuencia / 50kHz)
  impedanciaLow?: number | null; // Ohmios Ω (baja frecuencia / 5kHz)
  grasaPct: number | null;       // % grasa corporal estimado
  masaMagraKg: number | null;    // kg masa libre de grasa (FFM)
  masaGrasaKg: number | null;    // kg masa grasa
  aguaPct: number | null;        // % agua corporal total estimada
  bmi?: number | null;           // Índice de masa corporal (kg/m²)
  ffmi?: number | null;          // Fat-Free Mass Index
  altura?: number | null;        // Altura en cm
  boneMass?: number | null;      // Masa ósea en kg (Zepp Life)
  metabolism?: number | null;    // Tasa metabólica basal en kcal (Zepp Life)
  muscleRate?: number | null;    // Masa muscular en kg o % (Zepp Life)
  visceralFat?: number | null;   // Nivel de grasa visceral 1-30 (Zepp Life)
  source?: string;               // 'zepp_life' | 'scale_bia' | 'manual'
  notes?: string | null;
  deltaPeso?: number;    // Diferencia con respecto al registro anterior
  deltaGrasa?: number;   // Diferencia de % graso con el registro anterior
  ma7Peso?: number;      // Media móvil de 7 días de peso
  ma7Grasa?: number;     // Media móvil de 7 días de % graso
  esValido?: boolean;
  measurementsCount?: number;   // Cantidad de medidas realizadas ese día
  measurements?: WeightRecord[]; // Lista de pesajes individuales de ese día
  isDailyAverage?: boolean;     // True si el punto representa la media diaria
  isPeriodAverage?: boolean;    // True si el punto representa una media agrupada (semanal / mensual)
  periodType?: "daily" | "weekly" | "monthly"; // Escala temporal de agrupación
  periodLabel?: string;         // Etiqueta legible (ej: "12 - 18 oct 2026" o "Octubre 2026")
  minPeso?: number;             // Peso mínimo de ese día o período
  maxPeso?: number;             // Peso máximo de ese día o período
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
      if (typeof cur.grasaPct === "number" && typeof prev.grasaPct === "number") {
        cur.deltaGrasa = Math.round((cur.grasaPct - prev.grasaPct) * 10) / 10;
      } else {
        cur.deltaGrasa = undefined;
      }
    } else {
      cur.deltaPeso = 0;
      cur.deltaGrasa = undefined;
    }

    // Ventana de los últimos N días
    const windowStart = cur.timestamp - windowDays * 24 * 60 * 60 * 1000;
    const windowPoints = sorted.slice(0, i + 1).filter((p) => p.timestamp >= windowStart);

    if (windowPoints.length > 0) {
      const avgPeso = windowPoints.reduce((sum, p) => sum + p.peso, 0) / windowPoints.length;
      cur.ma7Peso = Math.round(avgPeso * 100) / 100;

      const fatPoints = windowPoints.filter(
        (p) => typeof p.grasaPct === "number" && !isNaN(p.grasaPct)
      );
      if (fatPoints.length > 0) {
        const avgGrasa = fatPoints.reduce((sum, p) => sum + (p.grasaPct || 0), 0) / fatPoints.length;
        cur.ma7Grasa = Math.round(avgGrasa * 10) / 10;
      } else {
        cur.ma7Grasa = cur.grasaPct !== null ? cur.grasaPct : undefined;
      }
    } else {
      cur.ma7Peso = cur.peso;
      cur.ma7Grasa = cur.grasaPct !== null ? cur.grasaPct : undefined;
    }
  }

  return sorted;
}

/**
 * Agrupa pesajes por día (fecha YYYY-MM-DD).
 * Si un día tiene múltiples pesajes:
 * - Calcula la media aritmética de peso, grasa, masa magra, agua, impedancia, etc.
 * - Guarda la lista completa de medidas de ese día en `measurements`.
 * - Marca `isDailyAverage: true` y `measurementsCount: records.length`.
 * Si el día tiene 1 sola toma:
 * - Se mantiene la toma intacta con `measurementsCount: 1` y `measurements: [record]`.
 */
export function aggregateRecordsByDay(
  records: WeightRecord[],
  profile: UserBiometricProfile = DEFAULT_USER_PROFILE
): WeightRecord[] {
  if (records.length === 0) return [];

  // Agrupar por fecha preservando orden cronológico
  const groupsByDate = new Map<string, WeightRecord[]>();
  for (const r of records) {
    const list = groupsByDate.get(r.fecha) || [];
    list.push(r);
    groupsByDate.set(r.fecha, list);
  }

  const result: WeightRecord[] = [];

  for (const [fecha, dayRecords] of groupsByDate.entries()) {
    // Ordenar las tomas del día por timestamp/hora
    dayRecords.sort((a, b) => a.timestamp - b.timestamp);

    if (dayRecords.length === 1) {
      const single = dayRecords[0];
      result.push({
        ...single,
        measurementsCount: 1,
        measurements: [single],
        isDailyAverage: false,
        minPeso: single.peso,
        maxPeso: single.peso,
      });
      continue;
    }

    // Múltiples tomas en el mismo día: calcular la media aritmética
    const count = dayRecords.length;
    const avgPeso = Math.round((dayRecords.reduce((sum, r) => sum + r.peso, 0) / count) * 10) / 10;
    const weights = dayRecords.map((r) => r.peso);
    const minPeso = Math.min(...weights);
    const maxPeso = Math.max(...weights);

    const validFats = dayRecords.filter(
      (r) => typeof r.grasaPct === "number" && !isNaN(r.grasaPct)
    );
    const avgFat =
      validFats.length > 0
        ? Math.round(
            (validFats.reduce((sum, r) => sum + (r.grasaPct || 0), 0) / validFats.length) * 10
          ) / 10
        : null;

    const validLeans = dayRecords.filter(
      (r) => typeof r.masaMagraKg === "number" && !isNaN(r.masaMagraKg)
    );
    const avgLean =
      validLeans.length > 0
        ? Math.round(
            (validLeans.reduce((sum, r) => sum + (r.masaMagraKg || 0), 0) / validLeans.length) * 10
          ) / 10
        : null;

    const validFatKgs = dayRecords.filter(
      (r) => typeof r.masaGrasaKg === "number" && !isNaN(r.masaGrasaKg)
    );
    const avgFatKg =
      validFatKgs.length > 0
        ? Math.round(
            (validFatKgs.reduce((sum, r) => sum + (r.masaGrasaKg || 0), 0) / validFatKgs.length) * 10
          ) / 10
        : null;

    const validWaters = dayRecords.filter(
      (r) => typeof r.aguaPct === "number" && !isNaN(r.aguaPct)
    );
    const avgWater =
      validWaters.length > 0
        ? Math.round(
            (validWaters.reduce((sum, r) => sum + (r.aguaPct || 0), 0) / validWaters.length) * 10
          ) / 10
        : null;

    const validImps = dayRecords.filter(
      (r) => typeof r.impedancia === "number" && !isNaN(r.impedancia)
    );
    const avgImp =
      validImps.length > 0
        ? Math.round(validImps.reduce((sum, r) => sum + (r.impedancia || 0), 0) / validImps.length)
        : null;

    const validImpLows = dayRecords.filter(
      (r) => typeof r.impedanciaLow === "number" && !isNaN(r.impedanciaLow)
    );
    const avgImpLow =
      validImpLows.length > 0
        ? Math.round(
            validImpLows.reduce((sum, r) => sum + (r.impedanciaLow || 0), 0) / validImpLows.length
          )
        : null;

    const validBone = dayRecords.filter(
      (r) => typeof r.boneMass === "number" && !isNaN(r.boneMass)
    );
    const avgBone =
      validBone.length > 0
        ? Math.round(
            (validBone.reduce((sum, r) => sum + (r.boneMass || 0), 0) / validBone.length) * 100
          ) / 100
        : null;

    const validMetab = dayRecords.filter(
      (r) => typeof r.metabolism === "number" && !isNaN(r.metabolism)
    );
    const avgMetab =
      validMetab.length > 0
        ? Math.round(validMetab.reduce((sum, r) => sum + (r.metabolism || 0), 0) / validMetab.length)
        : null;

    const validMuscle = dayRecords.filter(
      (r) => typeof r.muscleRate === "number" && !isNaN(r.muscleRate)
    );
    const avgMuscle =
      validMuscle.length > 0
        ? Math.round(
            (validMuscle.reduce((sum, r) => sum + (r.muscleRate || 0), 0) / validMuscle.length) * 100
          ) / 100
        : null;

    const validVisc = dayRecords.filter(
      (r) => typeof r.visceralFat === "number" && !isNaN(r.visceralFat)
    );
    const avgVisc =
      validVisc.length > 0
        ? Math.round(
            (validVisc.reduce((sum, r) => sum + (r.visceralFat || 0), 0) / validVisc.length) * 10
          ) / 10
        : null;

    const h = profile.alturaCm > 0 ? profile.alturaCm : 178;
    const bmi = calculateBmi(avgPeso, h);
    const ffmiData = avgLean && h > 0 ? calculateFfmi(avgLean, h) : null;

    // Timestamp central para la gráfica: tomamos el promedio
    const avgTimestamp = Math.round(
      dayRecords.reduce((sum, r) => sum + r.timestamp, 0) / count
    );

    result.push({
      id: `day-${fecha}`,
      fecha,
      hora: `Media (${count})`,
      timestamp: avgTimestamp,
      peso: avgPeso,
      impedancia: avgImp,
      impedanciaLow: avgImpLow,
      grasaPct: avgFat,
      masaMagraKg: avgLean,
      masaGrasaKg: avgFatKg,
      aguaPct: avgWater,
      bmi,
      ffmi: ffmiData ? ffmiData.ffmi : null,
      boneMass: avgBone,
      metabolism: avgMetab,
      muscleRate: avgMuscle,
      visceralFat: avgVisc,
      altura: h,
      source: "media_diaria",
      measurementsCount: count,
      measurements: dayRecords,
      isDailyAverage: true,
      minPeso,
      maxPeso,
      esValido: true,
    });
  }

  // Ordenar cronológicamente
  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

export type WeightGroupingMode = "auto" | "daily" | "weekly" | "monthly";

/**
 * Devuelve el lunes (YYYY-MM-DD) de la semana correspondiente a una fecha
 */
export function getMondayOfWeek(fechaStr: string): string {
  const date = new Date(fechaStr + "T12:00:00");
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().split("T")[0];
}

/**
 * Etiqueta legible para una semana a partir de la fecha de su lunes: ej. "12 - 18 oct 2026"
 */
export function getWeekRangeLabel(mondayStr: string): string {
  const monday = new Date(mondayStr + "T12:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mD = monday.getDate();
  const sD = sunday.getDate();
  const mMonth = monday.toLocaleDateString("es-ES", { month: "short" });
  const sMonth = sunday.toLocaleDateString("es-ES", { month: "short" });
  const year = monday.getFullYear();
  return mMonth === sMonth
    ? `${mD} - ${sD} ${mMonth} ${year}`
    : `${mD} ${mMonth} - ${sD} ${sMonth} ${year}`;
}

/**
 * Etiqueta legible para un mes a partir de YYYY-MM: ej. "Octubre 2026"
 */
export function getMonthLabel(monthKey: string): string {
  const d = new Date(monthKey + "-15T12:00:00");
  const monthName = d.toLocaleDateString("es-ES", { month: "long" });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} ${d.getFullYear()}`;
}

export interface AdaptiveAggregationResult {
  records: WeightRecord[];
  effectiveInterval: "daily" | "weekly" | "monthly";
  isCrowded: boolean;
  reason: string;
  totalMeasurements: number;
  displayedPoints: number;
}

/**
 * Agrupación adaptativa inteligente para evitar que las medidas se amontonen
 * en rangos amplios como "1A" (anual) o "Todo".
 * 
 * Fórmula de densidad:
 * - Si la cantidad de días > 45 o el intervalo abarca más de 120 días con muchas tomas:
 *   se agrupa por semanas (media semanal) o meses (media mensual).
 * - Calcula la media aritmética exacta de peso, grasa %, masa magra, agua, etc.
 * - Mantiene el desglose de todas las tomas individuales del período en `measurements`.
 */
export function aggregateRecordsAdaptive(
  rawRecords: WeightRecord[],
  profile: UserBiometricProfile = DEFAULT_USER_PROFILE,
  mode: WeightGroupingMode = "auto"
): AdaptiveAggregationResult {
  if (rawRecords.length === 0) {
    return {
      records: [],
      effectiveInterval: "daily",
      isCrowded: false,
      reason: "Sin datos",
      totalMeasurements: 0,
      displayedPoints: 0,
    };
  }

  // 1. Agrupar primero por día para resolver múltiples tomas en un mismo día
  const dailyRecords = aggregateRecordsByDay(rawRecords, profile);
  const count = dailyRecords.length;

  if (count <= 1) {
    return {
      records: enrichWithMovingAverages(dailyRecords, 7),
      effectiveInterval: "daily",
      isCrowded: false,
      reason: "Pocos registros",
      totalMeasurements: rawRecords.length,
      displayedPoints: count,
    };
  }

  // Ordenar cronológicamente
  dailyRecords.sort((a, b) => a.timestamp - b.timestamp);
  const minTime = dailyRecords[0].timestamp;
  const maxTime = dailyRecords[dailyRecords.length - 1].timestamp;
  const spanDays = Math.max(1, Math.round((maxTime - minTime) / (24 * 3600 * 1000)));

  // Detección de amontonamiento:
  // En el canvas de 880px, más de 45 puntos o abarcar más de 120 días con > 35 puntos
  // provoca que los círculos de 6-12px se toquen o superpongan.
  const isCrowded = count > 45 || (spanDays > 120 && count > 35);

  let effectiveInterval: "daily" | "weekly" | "monthly" = "daily";
  let reason = "Registros con espaciado óptimo diario";

  if (mode === "daily") {
    effectiveInterval = "daily";
    reason = "Forzado en modo diario";
  } else if (mode === "weekly") {
    effectiveInterval = "weekly";
    reason = "Forzado en modo semanal (media 7d)";
  } else if (mode === "monthly") {
    effectiveInterval = "monthly";
    reason = "Forzado en modo mensual";
  } else {
    // Modo AUTO: aplicar fórmula de descongestión
    if (!isCrowded) {
      effectiveInterval = "daily";
      reason = "Densidad óptima para vista diaria";
    } else {
      // Amontonado: si abarca más de 450 días y hay más de 70 puntos, agrupamos por mes;
      // en caso de 1 año (~365 días) o hasta 450 días, agrupamos por semana (52 puntos en 1 año)
      if (spanDays > 450 && count > 70) {
        effectiveInterval = "monthly";
        reason = `Medidas amontonadas (${count} días en ${spanDays}d): agrupado en media mensual`;
      } else {
        effectiveInterval = "weekly";
        reason = `Medidas amontonadas (${count} días en ${spanDays}d): agrupado en media semanal (7 días)`;
      }
    }
  }

  if (effectiveInterval === "daily") {
    const enriched = enrichWithMovingAverages(dailyRecords, 7);
    return {
      records: enriched,
      effectiveInterval: "daily",
      isCrowded,
      reason,
      totalMeasurements: rawRecords.length,
      displayedPoints: enriched.length,
    };
  }

  // Agrupación Semanal o Mensual
  const groups = new Map<string, WeightRecord[]>();
  const isWeekly = effectiveInterval === "weekly";

  for (const day of dailyRecords) {
    const key = isWeekly ? getMondayOfWeek(day.fecha) : day.fecha.slice(0, 7);
    const list = groups.get(key) || [];
    list.push(day);
    groups.set(key, list);
  }

  const aggregatedResult: WeightRecord[] = [];
  const h = profile.alturaCm > 0 ? profile.alturaCm : 178;

  for (const [key, daysInPeriod] of groups.entries()) {
    // Recopilar todas las tomas individuales subyacentes
    const allMeasurements: WeightRecord[] = [];
    for (const d of daysInPeriod) {
      if (d.measurements && d.measurements.length > 0) {
        allMeasurements.push(...d.measurements);
      } else {
        allMeasurements.push(d);
      }
    }
    allMeasurements.sort((a, b) => a.timestamp - b.timestamp);

    const mCount = allMeasurements.length;
    const avgPeso =
      Math.round((allMeasurements.reduce((sum, r) => sum + r.peso, 0) / mCount) * 10) / 10;
    const weights = allMeasurements.map((r) => r.peso);
    const minPeso = Math.min(...weights);
    const maxPeso = Math.max(...weights);

    // Medias de grasa, masa magra, masa grasa, agua
    const validFats = allMeasurements.filter(
      (r) => typeof r.grasaPct === "number" && !isNaN(r.grasaPct)
    );
    const avgFat =
      validFats.length > 0
        ? Math.round(
            (validFats.reduce((sum, r) => sum + (r.grasaPct || 0), 0) / validFats.length) * 10
          ) / 10
        : null;

    const validLeans = allMeasurements.filter(
      (r) => typeof r.masaMagraKg === "number" && !isNaN(r.masaMagraKg)
    );
    const avgLean =
      validLeans.length > 0
        ? Math.round(
            (validLeans.reduce((sum, r) => sum + (r.masaMagraKg || 0), 0) / validLeans.length) * 10
          ) / 10
        : null;

    const validFatKgs = allMeasurements.filter(
      (r) => typeof r.masaGrasaKg === "number" && !isNaN(r.masaGrasaKg)
    );
    const avgFatKg =
      validFatKgs.length > 0
        ? Math.round(
            (validFatKgs.reduce((sum, r) => sum + (r.masaGrasaKg || 0), 0) / validFatKgs.length) * 10
          ) / 10
        : null;

    const validWaters = allMeasurements.filter(
      (r) => typeof r.aguaPct === "number" && !isNaN(r.aguaPct)
    );
    const avgWater =
      validWaters.length > 0
        ? Math.round(
            (validWaters.reduce((sum, r) => sum + (r.aguaPct || 0), 0) / validWaters.length) * 10
          ) / 10
        : null;

    const validImps = allMeasurements.filter(
      (r) => typeof r.impedancia === "number" && !isNaN(r.impedancia)
    );
    const avgImp =
      validImps.length > 0
        ? Math.round(validImps.reduce((sum, r) => sum + (r.impedancia || 0), 0) / validImps.length)
        : null;

    const validImpLows = allMeasurements.filter(
      (r) => typeof r.impedanciaLow === "number" && !isNaN(r.impedanciaLow)
    );
    const avgImpLow =
      validImpLows.length > 0
        ? Math.round(
            validImpLows.reduce((sum, r) => sum + (r.impedanciaLow || 0), 0) / validImpLows.length
          )
        : null;

    const validBone = allMeasurements.filter(
      (r) => typeof r.boneMass === "number" && !isNaN(r.boneMass)
    );
    const avgBone =
      validBone.length > 0
        ? Math.round(
            (validBone.reduce((sum, r) => sum + (r.boneMass || 0), 0) / validBone.length) * 100
          ) / 100
        : null;

    const validMetab = allMeasurements.filter(
      (r) => typeof r.metabolism === "number" && !isNaN(r.metabolism)
    );
    const avgMetab =
      validMetab.length > 0
        ? Math.round(validMetab.reduce((sum, r) => sum + (r.metabolism || 0), 0) / validMetab.length)
        : null;

    const validMuscle = allMeasurements.filter(
      (r) => typeof r.muscleRate === "number" && !isNaN(r.muscleRate)
    );
    const avgMuscle =
      validMuscle.length > 0
        ? Math.round(
            (validMuscle.reduce((sum, r) => sum + (r.muscleRate || 0), 0) / validMuscle.length) * 100
          ) / 100
        : null;

    const bmi = calculateBmi(avgPeso, h);
    const ffmiData = avgLean && h > 0 ? calculateFfmi(avgLean, h) : null;

    // Timestamp medio de las tomas del período
    const avgTimestamp = Math.round(
      allMeasurements.reduce((sum, r) => sum + r.timestamp, 0) / mCount
    );

    const periodLabel = isWeekly ? getWeekRangeLabel(key) : getMonthLabel(key);

    aggregatedResult.push({
      id: isWeekly ? `week-${key}` : `month-${key}`,
      fecha: isWeekly ? key : `${key}-01`,
      hora: isWeekly ? `Semanal (${mCount} tomas)` : `Mensual (${mCount} tomas)`,
      timestamp: avgTimestamp,
      peso: avgPeso,
      impedancia: avgImp,
      impedanciaLow: avgImpLow,
      grasaPct: avgFat,
      masaMagraKg: avgLean,
      masaGrasaKg: avgFatKg,
      aguaPct: avgWater,
      bmi,
      ffmi: ffmiData ? ffmiData.ffmi : null,
      boneMass: avgBone,
      metabolism: avgMetab,
      muscleRate: avgMuscle,
      altura: h,
      source: isWeekly ? "media_semanal" : "media_mensual",
      measurementsCount: mCount,
      measurements: allMeasurements,
      isDailyAverage: true, // Para mantener compatibilidad con clics y tooltips
      isPeriodAverage: true,
      periodType: effectiveInterval,
      periodLabel,
      minPeso,
      maxPeso,
      esValido: true,
    });
  }

  // Ordenar cronológicamente
  aggregatedResult.sort((a, b) => a.timestamp - b.timestamp);

  // Enriquecer con medias móviles proporcionales a la escala de agrupación
  // Para semanal: ventana de 28 días (4 semanas). Para mensual: ventana de 90 días (3 meses).
  const windowDays = isWeekly ? 28 : 90;
  const finalRecords = enrichWithMovingAverages(aggregatedResult, windowDays);

  return {
    records: finalRecords,
    effectiveInterval,
    isCrowded,
    reason,
    totalMeasurements: rawRecords.length,
    displayedPoints: finalRecords.length,
  };
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
 * Parser universal para CSV de peso:
 * Soporta formato Zepp Life / Mi Fit (time, weight, height, bmi, fatRate, bodyWaterRate, boneMass, metabolism, muscleRate, visceralFat)
 * y formato nativo de báscula BIA (Fecha, Hora, Impedancia, Impedancia Low, Peso).
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

  // Detectar separador (, o ;) y limpiar BOM UTF-8
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const separator = headerLine.includes(";") ? ";" : ",";
  const rawHeaders = headerLine
    .split(separator)
    .map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""));

  const isZeppLife =
    rawHeaders.includes("fatrate") ||
    rawHeaders.includes("bodywaterrate") ||
    rawHeaders.includes("musclerate") ||
    (rawHeaders.includes("time") && rawHeaders.includes("weight") && rawHeaders.includes("height"));

  const isXiaomiMiHome =
    rawHeaders.includes("timestamp_ms") ||
    rawHeaders.includes("timestampms") ||
    rawHeaders.includes("bodyfat_pct") ||
    rawHeaders.includes("bodyfatpct") ||
    rawHeaders.includes("skeletalmusclemass_kg") ||
    rawHeaders.includes("skeletalmusclemasskg") ||
    rawHeaders.includes("basalmetabolism_kcal");

  const parsedRecords: WeightRecord[] = [];
  const errors: string[] = [];

  if (isZeppLife) {
    const timeIdx = rawHeaders.findIndex((h) => h === "time" || h.includes("time"));
    const weightIdx = rawHeaders.findIndex((h) => h === "weight" || h.includes("peso"));
    const heightIdx = rawHeaders.findIndex((h) => h === "height" || h.includes("altura"));
    const bmiIdx = rawHeaders.findIndex((h) => h === "bmi" || h.includes("imc"));
    const fatIdx = rawHeaders.findIndex((h) => h.includes("fatrate") || h.includes("fat"));
    const waterIdx = rawHeaders.findIndex((h) => h.includes("bodywater") || h.includes("water"));
    const boneIdx = rawHeaders.findIndex((h) => h.includes("bone"));
    const metIdx = rawHeaders.findIndex((h) => h.includes("metabolism") || h.includes("bmr"));
    const muscleIdx = rawHeaders.findIndex((h) => h.includes("muscle"));
    const viscIdx = rawHeaders.findIndex((h) => h.includes("visceral"));

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(separator).map((c) => c.trim());
      if (row.length < 2) continue;

      try {
        const timeRaw = row[timeIdx] || "";
        const wRaw = row[weightIdx] ? parseFloat(row[weightIdx].replace(",", ".")) : NaN;
        const hRaw = row[heightIdx] ? parseFloat(row[heightIdx].replace(",", ".")) : (profile.alturaCm || 181);
        const bmiRaw = row[bmiIdx] && row[bmiIdx] !== "null" ? parseFloat(row[bmiIdx].replace(",", ".")) : null;

        if (!timeRaw || isNaN(wRaw) || wRaw <= 0) {
          errors.push(`Fila ${i + 1}: Fecha/Hora o Peso inválidos.`);
          continue;
        }

        // Extracción de fecha y hora del formato ISO "YYYY-MM-DD HH:mm:ss+0000"
        let fechaStr = "";
        let horaStr = "08:00";
        let ts = 0;

        if (timeRaw.includes(" ") || timeRaw.includes("T")) {
          const delim = timeRaw.includes("T") ? "T" : " ";
          const parts = timeRaw.split(delim);
          fechaStr = parts[0];
          const timePart = parts[1] || "";
          horaStr = timePart.split("+")[0].split("-")[0].substring(0, 5) || "08:00";
          ts = new Date(timeRaw.replace(" ", "T")).getTime();
        } else {
          fechaStr = timeRaw;
          ts = new Date(timeRaw).getTime();
        }

        if (isNaN(ts) || ts <= 0) {
          const [y, m, d] = fechaStr.split("-").map(Number);
          ts = new Date(y, (m || 1) - 1, d || 1).getTime();
        }

        const parseOptional = (idx: number) => {
          if (idx === -1 || !row[idx] || row[idx].toLowerCase() === "null") return null;
          const val = parseFloat(row[idx].replace(",", "."));
          return isNaN(val) ? null : val;
        };

        const fatRate = parseOptional(fatIdx);
        const waterRate = parseOptional(waterIdx);
        const boneMass = parseOptional(boneIdx);
        const metabolism = parseOptional(metIdx);
        const muscleRate = parseOptional(muscleIdx);
        const visceralFat = parseOptional(viscIdx);

        const h = hRaw > 0 ? hRaw : (profile.alturaCm || 181);
        const bmi = bmiRaw !== null ? Math.round(bmiRaw * 10) / 10 : calculateBmi(wRaw, h);

        let leanMassKg: number | null = null;
        let fatMassKg: number | null = null;
        let ffmi: number | null = null;
        let estImpedance: number | null = null;
        let estImpedanceLow: number | null = null;

        if (fatRate !== null) {
          fatMassKg = Math.round((wRaw * (fatRate / 100)) * 100) / 100;
          leanMassKg = Math.round((wRaw - fatMassKg) * 100) / 100;
          const ffmiData = calculateFfmi(leanMassKg, h);
          ffmi = ffmiData.ffmi;

          // Estimación inversa de impedancia a partir del agua corporal
          if (waterRate !== null) {
            const tbwL = wRaw * (waterRate / 100);
            const denom = tbwL - (0.12 * wRaw) - 4.5;
            if (denom > 0) {
              estImpedance = Math.round(((0.386 * (h * h)) / denom) * 10) / 10;
              estImpedanceLow = Math.round(estImpedance * 1.085);
            }
          }
        }

        parsedRecords.push({
          id: `csv-zepp-${i}`,
          fecha: fechaStr,
          hora: horaStr,
          timestamp: ts,
          peso: Math.round(wRaw * 10) / 10,
          impedancia: estImpedance,
          impedanciaLow: estImpedanceLow,
          grasaPct: fatRate !== null ? Math.round(fatRate * 10) / 10 : null,
          masaMagraKg: leanMassKg,
          masaGrasaKg: fatMassKg,
          aguaPct: waterRate !== null ? Math.round(waterRate * 10) / 10 : null,
          bmi,
          ffmi,
          altura: h,
          boneMass,
          metabolism,
          muscleRate,
          visceralFat,
          source: "zepp_life",
          esValido: true,
        });
      } catch (err: any) {
        errors.push(`Fila ${i + 1}: ${err?.message || "Error al procesar fila"}`);
      }
    }
  } else if (isXiaomiMiHome) {
    const dateIdx = rawHeaders.findIndex((h) => h === "date" || h === "fecha");
    const tsIdx = rawHeaders.findIndex((h) => h.includes("timestamp"));
    const weightIdx = rawHeaders.findIndex((h) => h.includes("weight") || h.includes("peso"));
    const bmiIdx = rawHeaders.findIndex((h) => h === "bmi" || h.includes("imc"));
    const fatIdx = rawHeaders.findIndex((h) => h.includes("bodyfat") || h.includes("fat"));
    const waterIdx = rawHeaders.findIndex((h) => h.includes("bodywater") || h.includes("water"));
    const boneIdx = rawHeaders.findIndex((h) => h.includes("bonemass") || h.includes("bone"));
    const muscleIdx = rawHeaders.findIndex((h) => h.includes("musclemass") || h.includes("muscle"));
    const proteinIdx = rawHeaders.findIndex((h) => h.includes("protein"));
    const skeletalIdx = rawHeaders.findIndex((h) => h.includes("skeletal"));
    const viscIdx = rawHeaders.findIndex((h) => h.includes("visceral"));
    const metAgeIdx = rawHeaders.findIndex((h) => h.includes("metabolicage"));
    const bmrIdx = rawHeaders.findIndex((h) => h.includes("basal") || h.includes("metabolism") || h.includes("bmr"));
    const scoreIdx = rawHeaders.findIndex((h) => h.includes("bodyscore") || h.includes("score"));
    const hrIdx = rawHeaders.findIndex((h) => h.includes("heartrate") || h.includes("bpm"));
    const heightIdx = rawHeaders.findIndex((h) => h.includes("height") || h.includes("altura"));

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(separator).map((c) => c.trim());
      if (row.length < 2) continue;

      try {
        const dateRaw = row[dateIdx] || "";
        const wRaw = row[weightIdx] ? parseFloat(row[weightIdx].replace(",", ".")) : NaN;
        const hRaw = row[heightIdx] ? parseFloat(row[heightIdx].replace(",", ".")) : (profile.alturaCm || 180);
        const bmiRaw = row[bmiIdx] && row[bmiIdx] !== "null" ? parseFloat(row[bmiIdx].replace(",", ".")) : null;

        if (!dateRaw || isNaN(wRaw) || wRaw <= 0) {
          errors.push(`Fila ${i + 1}: Fecha/Hora o Peso inválidos.`);
          continue;
        }

        let fechaStr = "";
        let horaStr = "08:00";
        if (dateRaw.includes(" ") || dateRaw.includes("T")) {
          const delim = dateRaw.includes("T") ? "T" : " ";
          const parts = dateRaw.split(delim);
          fechaStr = parts[0];
          const timePart = parts[1] || "";
          horaStr = timePart.substring(0, 5) || "08:00";
        } else {
          fechaStr = dateRaw;
        }

        let ts = tsIdx !== -1 && row[tsIdx] ? parseInt(row[tsIdx], 10) : NaN;
        if (isNaN(ts) || ts <= 0) {
          ts = new Date(dateRaw.replace(" ", "T")).getTime();
        }
        if (isNaN(ts) || ts <= 0) {
          const [y, m, d] = fechaStr.split("-").map(Number);
          ts = new Date(y, (m || 1) - 1, d || 1).getTime();
        }

        const parseOptional = (idx: number) => {
          if (idx === -1 || !row[idx] || row[idx].toLowerCase() === "null") return null;
          const val = parseFloat(row[idx].replace(",", "."));
          return isNaN(val) ? null : val;
        };

        const fatVal = parseOptional(fatIdx);
        // En Xiaomi Mi Home / Yunmai, 0.0 indica pesaje simple sin medición de impedancia
        const fatRate = fatVal !== null && fatVal > 0 ? fatVal : null;

        const waterVal = parseOptional(waterIdx);
        const waterRate = waterVal !== null && waterVal > 0 ? waterVal : null;

        const boneVal = parseOptional(boneIdx);
        const boneMass = boneVal !== null && boneVal > 0 ? boneVal : null;

        const muscleVal = parseOptional(muscleIdx);
        const muscleRate = muscleVal !== null && muscleVal > 0 ? muscleVal : null;

        const viscVal = parseOptional(viscIdx);
        const visceralFat = viscVal !== null && viscVal > 0 ? viscVal : null;

        const bmrVal = parseOptional(bmrIdx);
        const metabolism = bmrVal !== null && bmrVal > 0 ? bmrVal : null;

        const proteinVal = parseOptional(proteinIdx);
        const proteinMass = proteinVal !== null && proteinVal > 0 ? proteinVal : null;

        const skeletalVal = parseOptional(skeletalIdx);
        const skeletalMass = skeletalVal !== null && skeletalVal > 0 ? skeletalVal : null;

        const metAgeVal = parseOptional(metAgeIdx);
        const metabolicAge = metAgeVal !== null && metAgeVal > 0 ? metAgeVal : null;

        const scoreVal = parseOptional(scoreIdx);
        const bodyScore = scoreVal !== null && scoreVal > 0 ? scoreVal : null;

        const hrVal = parseOptional(hrIdx);
        const heartRate = hrVal !== null && hrVal > 0 ? hrVal : null;

        const h = hRaw > 0 ? hRaw : (profile.alturaCm || 180);
        const bmi = bmiRaw !== null && bmiRaw > 0 ? Math.round(bmiRaw * 10) / 10 : calculateBmi(wRaw, h);

        let leanMassKg: number | null = null;
        let fatMassKg: number | null = null;
        let ffmi: number | null = null;
        let estImpedance: number | null = null;
        let estImpedanceLow: number | null = null;

        if (fatRate !== null) {
          fatMassKg = Math.round((wRaw * (fatRate / 100)) * 100) / 100;
          leanMassKg = Math.round((wRaw - fatMassKg) * 100) / 100;
          const ffmiData = calculateFfmi(leanMassKg, h);
          ffmi = ffmiData.ffmi;

          if (waterRate !== null) {
            const tbwL = wRaw * (waterRate / 100);
            const denom = tbwL - (0.12 * wRaw) - 4.5;
            if (denom > 0) {
              estImpedance = Math.round(((0.386 * (h * h)) / denom) * 10) / 10;
              estImpedanceLow = Math.round(estImpedance * 1.085);
            }
          }
        }

        const notesParts: string[] = [];
        if (heartRate) notesParts.push(`FC: ${heartRate} bpm`);
        if (proteinMass) notesParts.push(`Proteína: ${proteinMass} kg`);
        if (skeletalMass) notesParts.push(`M. esquelético: ${skeletalMass} kg`);
        if (metabolicAge) notesParts.push(`Edad metabólica: ${metabolicAge} a`);
        if (bodyScore) notesParts.push(`Puntuación: ${bodyScore}/100`);
        const notes = notesParts.length > 0 ? notesParts.join(" | ") : null;

        parsedRecords.push({
          id: `mihome-${ts}`,
          fecha: fechaStr,
          hora: horaStr,
          timestamp: ts,
          peso: Math.round(wRaw * 10) / 10,
          impedancia: estImpedance,
          impedanciaLow: estImpedanceLow,
          grasaPct: fatRate !== null ? Math.round(fatRate * 10) / 10 : null,
          masaMagraKg: leanMassKg,
          masaGrasaKg: fatMassKg,
          aguaPct: waterRate !== null ? Math.round(waterRate * 10) / 10 : null,
          bmi,
          ffmi,
          altura: h,
          boneMass,
          metabolism,
          muscleRate,
          visceralFat,
          source: "xiaomi_mi_home",
          notes,
          esValido: true,
        });
      } catch (err: any) {
        errors.push(`Fila ${i + 1}: ${err?.message || "Error al procesar fila"}`);
      }
    }
  } else {
    // Formato estándar de Báscula BIA (Fecha, Hora, Impedancia, Impedancia Low, Peso)
    let fechaIdx = rawHeaders.findIndex((h) => h.includes("fecha") || h.includes("date"));
    let horaIdx = rawHeaders.findIndex((h) => h.includes("hora") || h.includes("time"));
    let impLowIdx = rawHeaders.findIndex((h) => h.includes("low") || h.includes("baja"));
    let impIdx = rawHeaders.findIndex(
      (h, idx) => idx !== impLowIdx && (h.includes("impedancia") || h.includes("impedance") || h.includes("resistencia"))
    );
    let pesoIdx = rawHeaders.findIndex((h) => h.includes("peso") || h.includes("weight") || h.includes("kg"));

    if (fechaIdx === -1 && lines.length > 1) fechaIdx = 0;
    if (horaIdx === -1) horaIdx = 1;
    if (impIdx === -1) impIdx = 2;
    if (impLowIdx === -1) impLowIdx = 3;
    if (pesoIdx === -1) pesoIdx = 4;

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
          id: `csv-bia-${i}`,
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
          altura: profile.alturaCm,
          source: "scale_bia",
          esValido: true,
        });
      } catch (e: any) {
        errors.push(`Fila ${i + 1}: ${e?.message || "Error de formato"}`);
      }
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
