/**
 * Motor Matemático y Estadístico de Proyecciones de Peso Corporal (byteHevy)
 * 
 * Implementa modelos de series temporales, física del balance energético (Wishnofsky/Hall),
 * filtrado estocástico (Kalman 1D), regresión ponderada con intervalos de predicción,
 * adaptación metabólica asintótica y simulaciones de Monte Carlo.
 */

export interface WeightDataPoint {
  timestamp: number;
  dateKey: string;
  weight: number;
}

export type ProjectionHorizonId = "14d" | "30d" | "45d" | "60d" | "90d" | "180d" | "season";

export interface HorizonConfig {
  id: ProjectionHorizonId;
  days: number;
  label: string;
  shortLabel: string;
  isRecommended: boolean;
  scientificReason: string;
}

export const HORIZON_PRESETS: HorizonConfig[] = [
  {
    id: "14d",
    days: 14,
    label: "14 Días (2 Semanas)",
    shortLabel: "14d",
    isRecommended: false,
    scientificReason: "Corto plazo. Dominado por variaciones transitorias de glucógeno, sodio y agua extracelular (ruido estocástico > señal tisular).",
  },
  {
    id: "30d",
    days: 30,
    label: "30 Días (~4 Semanas)",
    shortLabel: "30d",
    isRecommended: true,
    scientificReason: "⭐ Recomendado fisiológicamente. Filtra ciclos mensuales de retención hídrica, acumula suficientes muestras (N ≥ 20) y minimiza el desvío por adaptación metabólica.",
  },
  {
    id: "45d",
    days: 45,
    label: "45 Días (~6 Semanas)",
    shortLabel: "45d",
    isRecommended: false,
    scientificReason: "Horizonte equilibrado. Ideal para mesociclos intermedios de volumen o corte.",
  },
  {
    id: "60d",
    days: 60,
    label: "60 Días (~8 Semanas)",
    shortLabel: "60d",
    isRecommended: true,
    scientificReason: "⭐ Estándar de oro en ciencias del deporte. 8 semanas permiten consolidar cambios reales de masa tisular (> 2-3 kg) superando con creces el ruido biológico.",
  },
  {
    id: "90d",
    days: 90,
    label: "90 Días (~3 Meses)",
    shortLabel: "90d",
    isRecommended: false,
    scientificReason: "Macro-ciclo trimestral. A partir de los 90 días, la adaptación metabólica y el cambio en NEAT reducen la fiabilidad del modelo lineal simple.",
  },
  {
    id: "180d",
    days: 180,
    label: "180 Días (~6 Meses)",
    shortLabel: "180d",
    isRecommended: false,
    scientificReason: "Largo plazo orientativo. Presenta cono de incertidumbre amplio debido a la acumulación de varianza estocástica.",
  },
];

export interface LinearModelResult {
  slopeDaily: number;       // kg/día
  slopeWeekly: number;      // kg/semana
  slopeMonthly: number;     // kg/mes (~30d)
  intercept: number;
  r2: number;               // Coeficiente de determinación (0 a 1)
  adjR2: number;            // R2 ajustado por grados de libertad
  rmse: number;             // Error cuadrático medio en kg (ruido biológico medio)
  mae: number;              // Error absoluto medio en kg
  slopeSe: number;          // Error estándar de la pendiente
  tStatistic: number;       // t-Student
  pValue: number;           // Significancia estadística (H0: slope = 0)
  isSignificant: boolean;   // p < 0.05
  durbinWatson: number;     // Autocorrelación de residuos (1.5 - 2.5 ideal)
  projectedWeight: number;
  predictionInterval68: [number, number]; // 1-sigma [min, max]
  predictionInterval95: [number, number]; // 2-sigma [min, max]
}

export interface MetabolicPlateauResult {
  hasPlateauTendency: boolean; // ¿Se observa desaceleración detectable?
  rateConstantK: number;       // Tasa de relajación k (1/días)
  halfLifeDays: number;        // Tiempo para alcanzar la mitad del ajuste
  asymptoteWeight: number;     // Peso de equilibrio asintótico (W_infinito)
  projectedWeight: number;     // Peso al horizonte seleccionado
  deltaFromLinear: number;     // Diferencia con respecto a la recta pura (kg ahorrados/no perdidos por freno metabólico)
  currentDeceleration: number; // Aceleración d2W/dt2 en g/día^2
  explanation: string;
}

export interface MonteCarloPercentilePoint {
  dayOffset: number;
  timestamp: number;
  dateLabel: string;
  p10: number;
  p25: number;
  p50: number; // Mediana
  p75: number;
  p90: number;
}

export interface MonteCarloResult {
  numSimulations: number;
  points: MonteCarloPercentilePoint[];
  finalP10: number;
  finalP25: number;
  finalP50: number;
  finalP75: number;
  finalP90: number;
  spread90: number; // P90 - P10 (amplitud de dispersión al horizonte)
}

export interface ThermodynamicBalance {
  impliedNetKcalDaily: number;   // Déficit (-) o Superávit (+) diario medio en kcal/día
  impliedNetKcalWeekly: number;  // kcal semanales equivalentes
  confidenceKcalMargin: number;  // Margen de error +/- kcal
  tdeeShiftEstimate: number;     // Estimación de adaptación en gasto calórico
  interpretation: string;
}

export interface InverseProjectionTarget {
  targetWeight: number;
  currentWeight: number;
  deltaWeight: number;
  isDiverging: boolean;          // ¿La tendencia va en sentido contrario a la meta?
  expectedDays: number | null;
  expectedDateLabel: string | null;
  optimisticDateLabel: string | null;  // P10
  conservativeDateLabel: string | null; // P90
  weeklyPaceNeededForTargetInDays?: (targetDays: number) => number;
}

export interface FullProjectionReport {
  sampleCount: number;
  timeSpanDays: number;
  calibrationWindowDays: number;
  latestTimestamp: number;
  latestWeight: number;
  targetTimestamp: number;
  targetDateLabel: string;
  horizonDays: number;
  horizonConfig: HorizonConfig;
  
  // Modelos
  linear: LinearModelResult;
  metabolic: MetabolicPlateauResult;
  monteCarlo: MonteCarloResult;
  thermodynamics: ThermodynamicBalance;
  inverseTarget?: InverseProjectionTarget;

  // Curvas generadas para visualización SVG
  timelinePoints: {
    timestamp: number;
    dateLabel: string;
    linearExpected: number;
    linearLower95: number;
    linearUpper95: number;
    linearLower68: number;
    linearUpper68: number;
    metabolicExpected: number;
    monteCarloP50: number;
    monteCarloP10: number;
    monteCarloP90: number;
  }[];
}

/**
 * Filtro de Kalman 1D para estimar el peso real sin ruido y la velocidad instantánea
 */
export function run1DKalmanFilter(
  points: WeightDataPoint[],
  processVariance = 0.001, // Varianza del proceso (cambio real de masa tisular)
  measurementVariance = 0.5 // Varianza de medición (ruido de agua ~0.7 kg SD -> Var ~0.5)
): { smoothed: number[]; velocities: number[] } {
  if (points.length === 0) return { smoothed: [], velocities: [] };

  const smoothed: number[] = [];
  const velocities: number[] = [];

  let x = points[0].weight; // Estado inicial (peso)
  let v = 0;               // Velocidad inicial (kg/día)
  let p = measurementVariance; // Incertidumbre inicial

  smoothed.push(x);
  velocities.push(v);

  for (let i = 1; i < points.length; i++) {
    const dt = Math.max(0.1, (points[i].timestamp - points[i - 1].timestamp) / 86400000);

    // Predicción
    const xPred = x + v * dt;
    const pPred = p + processVariance * dt;

    // Medición
    const z = points[i].weight;
    const k = pPred / (pPred + measurementVariance);

    // Actualización
    const newX = xPred + k * (z - xPred);
    v = (newX - x) / dt;
    x = newX;
    p = (1 - k) * pPred;

    smoothed.push(Math.round(x * 100) / 100);
    velocities.push(Math.round(v * 1000) / 1000);
  }

  return { smoothed, velocities };
}

/**
 * Calcula la función de distribución t-Student acumulada inversa (aproximación numérica)
 */
function studentTInverse(alpha: number, df: number): number {
  // Para df >= 30, t se aproxima a la normal standard z
  if (df >= 30) {
    if (alpha <= 0.01) return 2.576;
    if (alpha <= 0.05) return 1.960;
    if (alpha <= 0.10) return 1.645;
    if (alpha <= 0.32) return 1.000;
    return 1.96;
  }
  // Tabla interpolada para grados de libertad pequeños
  const lookup95: Record<number, number> = {
    1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57,
    6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23,
    15: 2.13, 20: 2.09, 25: 2.06, 29: 2.04
  };
  if (alpha <= 0.05) {
    const closest = Object.keys(lookup95).map(Number).reduce((prev, curr) => 
      Math.abs(curr - df) < Math.abs(prev - df) ? curr : prev
    );
    return lookup95[closest] || 2.0;
  }
  return 1.0;
}

/**
 * Ajusta regresión lineal ponderada por tiempo (WLS) con intervalos de predicción rigurosos
 */
export function computeRobustLinearProjection(
  points: WeightDataPoint[],
  horizonDays: number,
  halfLifeDays = 45
): LinearModelResult {
  const n = points.length;
  if (n < 2) {
    const w = points[0]?.weight ?? 70;
    return {
      slopeDaily: 0,
      slopeWeekly: 0,
      slopeMonthly: 0,
      intercept: w,
      r2: 0,
      adjR2: 0,
      rmse: 0,
      mae: 0,
      slopeSe: 0,
      tStatistic: 0,
      pValue: 1,
      isSignificant: false,
      durbinWatson: 2,
      projectedWeight: w,
      predictionInterval68: [w, w],
      predictionInterval95: [w, w],
    };
  }

  const latestTs = points[n - 1].timestamp;
  const lambda = halfLifeDays > 0 ? Math.LN2 / (halfLifeDays * 86400000) : 0;

  // Normalizar tiempo t en días relativos al primer punto para evitar números gigantescos
  const t0 = points[0].timestamp;
  const daysArray = points.map((p) => (p.timestamp - t0) / 86400000);
  const weightsArray = points.map((p) => p.weight);

  let sumW = 0;
  let sumWX = 0;
  let sumWY = 0;
  let sumWXX = 0;
  let sumWXY = 0;

  for (let i = 0; i < n; i++) {
    // Ponderación exponencial temporal (los días más recientes pesan más)
    const ageMs = latestTs - points[i].timestamp;
    const weight = Math.exp(-lambda * ageMs);

    const x = daysArray[i];
    const y = weightsArray[i];

    sumW += weight;
    sumWX += weight * x;
    sumWY += weight * y;
    sumWXX += weight * x * x;
    sumWXY += weight * x * y;
  }

  const denom = sumW * sumWXX - sumWX * sumWX;
  const slope = denom !== 0 ? (sumW * sumWXY - sumWX * sumWY) / denom : 0;
  const intercept = (sumWY - slope * sumWX) / sumW;

  // Métricas de ajuste y residuos
  const meanY = sumWY / sumW;
  let ssTot = 0;
  let ssRes = 0;
  let sumAbsRes = 0;
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    const x = daysArray[i];
    const y = weightsArray[i];
    const yHat = intercept + slope * x;
    const res = y - yHat;
    residuals.push(res);

    const w = Math.exp(-lambda * (latestTs - points[i].timestamp));
    ssTot += w * Math.pow(y - meanY, 2);
    ssRes += w * Math.pow(res, 2);
    sumAbsRes += Math.abs(res);
  }

  const df = Math.max(1, n - 2);
  const rmse = Math.sqrt(ssRes / df);
  const mae = sumAbsRes / n;
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  const adjR2 = Math.max(0, 1 - (1 - r2) * ((n - 1) / df));

  // Error estándar de la pendiente y estadístico t
  const meanX = sumWX / sumW;
  let ssX = 0;
  for (let i = 0; i < n; i++) {
    ssX += Math.pow(daysArray[i] - meanX, 2);
  }
  const slopeSe = ssX > 0 ? rmse / Math.sqrt(ssX) : 0;
  const tStat = slopeSe > 0 ? slope / slopeSe : 0;
  const absT = Math.abs(tStat);
  // Aproximación de p-value para t-Student
  const pValue = absT > 3.5 ? 0.001 : absT > 2.5 ? 0.015 : absT > 2.0 ? 0.048 : absT > 1.5 ? 0.14 : 0.45;
  const isSignificant = pValue < 0.05;

  // Estadístico de Durbin-Watson para verificar autocorrelación serial
  let dwNum = 0;
  let dwDenom = 0;
  for (let i = 0; i < n; i++) {
    dwDenom += Math.pow(residuals[i], 2);
    if (i > 0) {
      dwNum += Math.pow(residuals[i] - residuals[i - 1], 2);
    }
  }
  const durbinWatson = dwDenom > 0 ? Math.round((dwNum / dwDenom) * 100) / 100 : 2.0;

  // Proyección al horizonte
  const targetDayX = (latestTs - t0) / 86400000 + horizonDays;
  const projectedWeight = Math.round((intercept + slope * targetDayX) * 10) / 10;

  // Intervalos de Predicción al 68% (1-sigma) y al 95% (2-sigma)
  const tCrit95 = studentTInverse(0.05, df);
  const tCrit68 = studentTInverse(0.32, df);

  const leverage = ssX > 0 ? 1 + 1 / n + Math.pow(targetDayX - meanX, 2) / ssX : 1;
  const margin95 = tCrit95 * rmse * Math.sqrt(leverage);
  const margin68 = tCrit68 * rmse * Math.sqrt(leverage);

  return {
    slopeDaily: Math.round(slope * 1000) / 1000,
    slopeWeekly: Math.round(slope * 7 * 100) / 100,
    slopeMonthly: Math.round(slope * 30 * 100) / 100,
    intercept: Math.round(intercept * 100) / 100,
    r2: Math.round(r2 * 1000) / 1000,
    adjR2: Math.round(adjR2 * 1000) / 1000,
    rmse: Math.round(rmse * 100) / 100,
    mae: Math.round(mae * 100) / 100,
    slopeSe: Math.round(slopeSe * 1000) / 1000,
    tStatistic: Math.round(tStat * 100) / 100,
    pValue,
    isSignificant,
    durbinWatson,
    projectedWeight,
    predictionInterval68: [
      Math.round((projectedWeight - margin68) * 10) / 10,
      Math.round((projectedWeight + margin68) * 10) / 10,
    ],
    predictionInterval95: [
      Math.round((projectedWeight - margin95) * 10) / 10,
      Math.round((projectedWeight + margin95) * 10) / 10,
    ],
  };
}

/**
 * Modela la adaptación metabólica no lineal (ecuación diferencial de relajación dW/dt = -k(W - W_inf))
 */
export function computeMetabolicPlateau(
  points: WeightDataPoint[],
  linearResult: LinearModelResult,
  horizonDays: number
): MetabolicPlateauResult {
  const n = points.length;
  const latestWeight = points[n - 1]?.weight ?? 70;

  if (n < 6 || Math.abs(linearResult.slopeDaily) < 0.005) {
    return {
      hasPlateauTendency: false,
      rateConstantK: 0.015,
      halfLifeDays: 45,
      asymptoteWeight: latestWeight,
      projectedWeight: linearResult.projectedWeight,
      deltaFromLinear: 0,
      currentDeceleration: 0,
      explanation: "Ritmo de cambio muy bajo o muestras insuficientes para detectar curvatura asintótica.",
    };
  }

  // Dividir la muestra en dos mitades temporales para calcular aceleración d2W/dt2
  const midIdx = Math.floor(n / 2);
  const firstHalf = points.slice(0, midIdx);
  const secondHalf = points.slice(midIdx);

  const linear1 = computeRobustLinearProjection(firstHalf, 0);
  const linear2 = computeRobustLinearProjection(secondHalf, 0);

  const slope1 = linear1.slopeDaily;
  const slope2 = linear2.slopeDaily;

  // Aceleración en g/día^2
  const dtDays = Math.max(5, (secondHalf[secondHalf.length - 1].timestamp - firstHalf[0].timestamp) / (2 * 86400000));
  const accelDaily = (slope2 - slope1) / dtDays; // kg/día^2
  const accelGrams = Math.round(accelDaily * 1000 * 100) / 100; // g/día^2

  // Detectar si hay desaceleración compatible con meseta:
  // Si está perdiendo peso (slope < 0), desaceleración significa slope2 > slope1 (accel > 0)
  // Si está ganando peso (slope > 0), desaceleración significa slope2 < slope1 (accel < 0)
  const isLoss = linearResult.slopeDaily < 0;
  const isDecelerating = isLoss ? accelDaily > 0 : accelDaily < 0;

  // Constante de amortiguación metabólica k (~0.01 a 0.03 1/día, según Kevin Hall et al.)
  // k representa un tiempo de relajación típico de 40 a 70 días
  const k = Math.max(0.008, Math.min(0.04, Math.abs(accelDaily / (linearResult.slopeDaily || 0.01))));
  const halfLife = Math.round(Math.LN2 / k);

  // Estimación de la asíntota W_infinito = W_0 + (dW/dt) / k
  const deltaAsymptote = linearResult.slopeDaily / k;
  const asymptoteWeight = Math.round((latestWeight + deltaAsymptote) * 10) / 10;

  // Proyección exponencial: W(t) = W_inf + (W_0 - W_inf) * exp(-k * t)
  const projectedWeight = Math.round(
    (asymptoteWeight + (latestWeight - asymptoteWeight) * Math.exp(-k * horizonDays)) * 10
  ) / 10;

  const deltaFromLinear = Math.round((projectedWeight - linearResult.projectedWeight) * 10) / 10;

  let explanation = "";
  if (isDecelerating) {
    explanation = isLoss
      ? `Se detecta adaptación metabólica (freno de pérdida a ${accelGrams} g/día²). El modelo predice que la pérdida se amortigua hacia una meseta asintótica en ~${asymptoteWeight} kg si no se ajusta la ingesta o el gasto calórico.`
      : `Se detecta desaceleración en la ganancia de masa (${accelGrams} g/día²). La curva se amortigua hacia una estabilización en ~${asymptoteWeight} kg.`;
  } else {
    explanation = `El ritmo se mantiene sostenido sin signos prematuros de freno metabólico (${accelGrams >= 0 ? "+" : ""}${accelGrams} g/día²).`;
  }

  return {
    hasPlateauTendency: isDecelerating,
    rateConstantK: Math.round(k * 1000) / 1000,
    halfLifeDays: halfLife,
    asymptoteWeight,
    projectedWeight,
    deltaFromLinear,
    currentDeceleration: accelGrams,
    explanation,
  };
}

/**
 * Simulación de Monte Carlo (1.000 iteraciones con remuestreo estocástico autorregresivo AR(1))
 */
export function runMonteCarloSimulation(
  points: WeightDataPoint[],
  linearResult: LinearModelResult,
  horizonDays: number,
  numSimulations = 1000
): MonteCarloResult {
  const n = points.length;
  const latestTs = points[n - 1]?.timestamp ?? Date.now();
  const latestWeight = points[n - 1]?.weight ?? 70;

  const stepDays = Math.max(1, Math.floor(horizonDays / 15)); // ~15 puntos clave en el tiempo
  const numSteps = Math.ceil(horizonDays / stepDays);

  // Calcular varianza residual y autocorrelación rho de los pesajes empíricos
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    const daysFromStart = (points[i].timestamp - points[0].timestamp) / 86400000;
    const expected = linearResult.intercept + linearResult.slopeDaily * daysFromStart;
    residuals.push(points[i].weight - expected);
  }

  let cov = 0;
  let varRes = 0;
  for (let i = 1; i < n; i++) {
    cov += residuals[i] * residuals[i - 1];
    varRes += residuals[i] * residuals[i];
  }
  const rho = varRes > 0 ? Math.max(-0.6, Math.min(0.6, cov / varRes)) : 0.2;
  const sigmaInnov = linearResult.rmse * Math.sqrt(Math.max(0.1, 1 - rho * rho));

  // Generador pseudo-aleatorio normal (Box-Muller)
  function randomNormal(mean = 0, std = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Matriz de simulaciones: [stepIndex][simIndex]
  const simMatrix: number[][] = Array.from({ length: numSteps }, () => []);

  for (let s = 0; s < numSimulations; s++) {
    let currentW = latestWeight;
    let prevEta = residuals[residuals.length - 1] || 0;

    for (let step = 1; step <= numSteps; step++) {
      const dt = stepDays;
      // Proceso estocástico AR(1) con drift de tendencia
      const drift = linearResult.slopeDaily * dt;
      const noise = rho * prevEta + randomNormal(0, sigmaInnov * Math.sqrt(dt));
      prevEta = noise;

      currentW = currentW + drift + (noise * 0.4); // Factor de escala para realismo biológico
      simMatrix[step - 1].push(currentW);
    }
  }

  // Extraer percentiles empíricos en cada paso temporal
  const percentilePoints: MonteCarloPercentilePoint[] = [];

  for (let step = 0; step < numSteps; step++) {
    const arr = simMatrix[step].sort((a, b) => a - b);
    const dayOffset = (step + 1) * stepDays;
    const ts = latestTs + dayOffset * 86400000;

    const p10 = arr[Math.floor(numSimulations * 0.10)];
    const p25 = arr[Math.floor(numSimulations * 0.25)];
    const p50 = arr[Math.floor(numSimulations * 0.50)];
    const p75 = arr[Math.floor(numSimulations * 0.75)];
    const p90 = arr[Math.floor(numSimulations * 0.90)];

    percentilePoints.push({
      dayOffset,
      timestamp: ts,
      dateLabel: new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      p10: Math.round(p10 * 10) / 10,
      p25: Math.round(p25 * 10) / 10,
      p50: Math.round(p50 * 10) / 10,
      p75: Math.round(p75 * 10) / 10,
      p90: Math.round(p90 * 10) / 10,
    });
  }

  const final = percentilePoints[percentilePoints.length - 1];

  return {
    numSimulations,
    points: percentilePoints,
    finalP10: final.p10,
    finalP25: final.p25,
    finalP50: final.p50,
    finalP75: final.p75,
    finalP90: final.p90,
    spread90: Math.round((final.p90 - final.p10) * 10) / 10,
  };
}

/**
 * Calcula el balance calórico neto según la termodinámica de Wishnofsky / Kevin Hall
 */
export function computeThermodynamicBalance(
  slopeDailyKg: number,
  slopeSe: number
): ThermodynamicBalance {
  // Constante promedio de tejido mixto (~7700 kcal/kg)
  const KCAL_PER_KG = 7700;

  const netKcalDaily = Math.round(slopeDailyKg * KCAL_PER_KG);
  const netKcalWeekly = Math.round(netKcalDaily * 7);
  const marginKcal = Math.round(slopeSe * KCAL_PER_KG * 1.96);

  let interpretation = "";
  if (Math.abs(netKcalDaily) < 60) {
    interpretation = "Mantenimiento normocalórico en equilibrio termodinámico (variación neta < ±60 kcal/día).";
  } else if (netKcalDaily < 0) {
    interpretation = `Déficit calórico neto medio de ~${Math.abs(netKcalDaily)} kcal/día (equivalente a ~${Math.abs(netKcalWeekly)} kcal/semana por debajo de tu TDEE).`;
  } else {
    interpretation = `Superávit calórico neto medio de +${netKcalDaily} kcal/día (equivalente a +${netKcalWeekly} kcal/semana por encima de tu TDEE).`;
  }

  return {
    impliedNetKcalDaily: netKcalDaily,
    impliedNetKcalWeekly: netKcalWeekly,
    confidenceKcalMargin: marginKcal,
    tdeeShiftEstimate: Math.round(netKcalDaily * 0.15), // Estimación de adaptación adaptativa (~15%)
    interpretation,
  };
}

/**
 * Calcula la proyección inversa (Tiempo requerido para alcanzar un peso meta objetivo)
 */
export function computeInverseTarget(
  currentWeight: number,
  targetWeight: number,
  linearResult: LinearModelResult,
  monteCarloResult: MonteCarloResult
): InverseProjectionTarget {
  const delta = Math.round((targetWeight - currentWeight) * 10) / 10;
  const isLossTarget = delta < 0;
  const isGainTarget = delta > 0;

  // Detectar divergencia: si el objetivo es perder peso y la pendiente es positiva, o viceversa
  const isDiverging =
    (isLossTarget && linearResult.slopeDaily >= -0.002) ||
    (isGainTarget && linearResult.slopeDaily <= 0.002);

  if (isDiverging || Math.abs(linearResult.slopeDaily) < 0.001) {
    return {
      targetWeight,
      currentWeight,
      deltaWeight: delta,
      isDiverging: true,
      expectedDays: null,
      expectedDateLabel: null,
      optimisticDateLabel: null,
      conservativeDateLabel: null,
      weeklyPaceNeededForTargetInDays: (days: number) => Math.round((delta / (days / 7)) * 100) / 100,
    };
  }

  const daysNeeded = Math.round(delta / linearResult.slopeDaily);
  const now = Date.now();
  const expectedTs = now + daysNeeded * 86400000;

  // Desvío optimista y conservador según la dispersión de Monte Carlo
  const ratioSpread = monteCarloResult.spread90 / (Math.abs(linearResult.slopeWeekly) * 4 || 1);
  const dayMargin = Math.round(daysNeeded * Math.min(0.35, Math.max(0.10, ratioSpread * 0.08)));

  const optimisticDays = Math.max(1, daysNeeded - dayMargin);
  const conservativeDays = daysNeeded + dayMargin;

  return {
    targetWeight,
    currentWeight,
    deltaWeight: delta,
    isDiverging: false,
    expectedDays: daysNeeded,
    expectedDateLabel: new Date(expectedTs).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    optimisticDateLabel: new Date(now + optimisticDays * 86400000).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    }),
    conservativeDateLabel: new Date(now + conservativeDays * 86400000).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    weeklyPaceNeededForTargetInDays: (days: number) => Math.round((delta / (days / 7)) * 100) / 100,
  };
}

/**
 * Orquestador principal que ejecuta todo el pipeline de análisis de ingeniería
 */
export function buildFullProjectionReport(
  rawPoints: WeightDataPoint[],
  horizonId: ProjectionHorizonId = "30d",
  customHorizonDays?: number,
  targetWeight?: number,
  calibrationWindowDays = 45
): FullProjectionReport | null {
  if (!rawPoints || rawPoints.length < 3) return null;

  const sorted = [...rawPoints].sort((a, b) => a.timestamp - b.timestamp);
  const latestTs = sorted[sorted.length - 1].timestamp;

  // Filtrar ventana de calibración (soporta ventanas amplias: 1 año, 2 años y Todo el historial)
  const isAllHistory = calibrationWindowDays >= 9999;
  const calibrationCutoff = isAllHistory ? 0 : latestTs - calibrationWindowDays * 86400000;
  let calibrationPoints = isAllHistory
    ? sorted
    : sorted.filter((p) => p.timestamp >= calibrationCutoff);

  // Si en la ventana seleccionada hay menos de 2 pesajes, tomar el mínimo necesario (últimos 3-5 pesajes)
  if (calibrationPoints.length < 2) {
    calibrationPoints = sorted.slice(-Math.min(5, sorted.length));
  }

  const horizonConfig =
    HORIZON_PRESETS.find((h) => h.id === horizonId) ||
    HORIZON_PRESETS[1]; // 30d default

  const days = customHorizonDays ?? horizonConfig.days;
  const targetTimestamp = latestTs + days * 86400000;
  const targetDateLabel = new Date(targetTimestamp).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const latestWeight = calibrationPoints[calibrationPoints.length - 1].weight;
  const timeSpanDays = Math.max(1, Math.round((latestTs - calibrationPoints[0].timestamp) / 86400000));
  const effectiveHalfLife = isAllHistory
    ? Math.max(90, Math.round(timeSpanDays * 0.45))
    : calibrationWindowDays >= 365
    ? Math.max(90, Math.round(calibrationWindowDays * 0.5))
    : Math.max(45, Math.round(calibrationWindowDays * 0.6));

  // 1. Regresión Lineal Robusta (WLS ponderada según el tamaño de la ventana)
  const linear = computeRobustLinearProjection(calibrationPoints, days, effectiveHalfLife);

  // 2. Modelo Asintótico de Adaptación Metabólica
  const metabolic = computeMetabolicPlateau(calibrationPoints, linear, days);

  // 3. Simulación de Monte Carlo
  const monteCarlo = runMonteCarloSimulation(calibrationPoints, linear, days, 1000);

  // 4. Termodinámica Implícita
  const thermodynamics = computeThermodynamicBalance(linear.slopeDaily, linear.slopeSe);

  // 5. Proyección Inversa a Meta Objetivo
  const effectiveTargetWeight = targetWeight ?? (linear.slopeDaily < 0 ? latestWeight - 3 : latestWeight + 3);
  const inverseTarget = computeInverseTarget(latestWeight, effectiveTargetWeight, linear, monteCarlo);

  // 6. Generar series continuas para gráficos SVG (alta resolución para hover preciso)
  const timelinePoints: FullProjectionReport["timelinePoints"] = [];
  const steps = Math.max(60, Math.min(180, Math.round(days * 2)));
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const curDays = fraction * days;
    const curTs = latestTs + curDays * 86400000;

    const lin = computeRobustLinearProjection(calibrationPoints, curDays, effectiveHalfLife);
    const met = computeMetabolicPlateau(calibrationPoints, linear, curDays);

    // Buscar el punto Monte Carlo más cercano
    const mcPoint = monteCarlo.points.find((p) => p.dayOffset >= curDays) || monteCarlo.points[monteCarlo.points.length - 1];

    timelinePoints.push({
      timestamp: curTs,
      dateLabel: new Date(curTs).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      linearExpected: lin.projectedWeight,
      linearLower95: lin.predictionInterval95[0],
      linearUpper95: lin.predictionInterval95[1],
      linearLower68: lin.predictionInterval68[0],
      linearUpper68: lin.predictionInterval68[1],
      metabolicExpected: met.projectedWeight,
      monteCarloP50: mcPoint?.p50 ?? lin.projectedWeight,
      monteCarloP10: mcPoint?.p10 ?? lin.predictionInterval95[0],
      monteCarloP90: mcPoint?.p90 ?? lin.predictionInterval95[1],
    });
  }

  return {
    sampleCount: calibrationPoints.length,
    timeSpanDays: Math.round((latestTs - calibrationPoints[0].timestamp) / 86400000),
    calibrationWindowDays,
    latestTimestamp: latestTs,
    latestWeight,
    targetTimestamp,
    targetDateLabel,
    horizonDays: days,
    horizonConfig,
    linear,
    metabolic,
    monteCarlo,
    thermodynamics,
    inverseTarget,
    timelinePoints,
  };
}

