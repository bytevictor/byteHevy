/**
 * Fórmulas clínicas y biométricas puras (BMI, FFMI, Rangos saludables)
 * Módulo isomórfico (compatible con Server Components, Route Handlers y Client Components)
 */

export interface UserBiometricProfile {
  alturaCm: number;              // Altura en centímetros (ej: 180)
  fechaNacimiento?: string;      // Formato YYYY-MM-DD (ej: "1999-01-20")
  edad: number;                  // Edad en años calculada al vuelo
  sexo: "male" | "female";       // Sexo biológico para fórmulas BIA / FFMI
}

export const DEFAULT_BIRTH_DATE = "1999-01-20";

/**
 * Calcula con precisión la edad a partir de la fecha de nacimiento
 * respecto a una fecha de referencia (por defecto, la fecha actual).
 */
export function calculateAge(fechaNacimiento?: string | null, referenceDate: Date = new Date()): number {
  if (!fechaNacimiento || typeof fechaNacimiento !== "string") return 27;
  const parts = fechaNacimiento.split("-");
  if (parts.length !== 3) return 27;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const birthDay = parseInt(parts[2], 10);

  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return 27;

  let age = referenceDate.getFullYear() - birthYear;
  const monthDiff = referenceDate.getMonth() - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDay)) {
    age--;
  }
  return Math.max(0, age);
}

export const DEFAULT_USER_PROFILE: UserBiometricProfile = {
  alturaCm: 180,
  fechaNacimiento: DEFAULT_BIRTH_DATE,
  edad: calculateAge(DEFAULT_BIRTH_DATE),
  sexo: "male",
};

export interface BmiCategoryInfo {
  label: string;
  rangeText: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  isHealthy: boolean;
}

/**
 * Calcula el Índice de Masa Corporal (BMI / IMC):
 * BMI = peso (kg) / (altura (m))^2
 */
export function calculateBmi(pesoKg: number, alturaCm: number): number {
  if (!alturaCm || alturaCm <= 0 || !pesoKg || pesoKg <= 0) return 0;
  const alturaM = alturaCm / 100;
  return Math.round((pesoKg / (alturaM * alturaM)) * 10) / 10;
}

/**
 * Clasificación clínica estándar del BMI / IMC
 */
export function getBmiCategory(bmi: number): BmiCategoryInfo {
  if (bmi <= 0) {
    return {
      label: "Sin datos",
      rangeText: "-",
      description: "Sin datos biométricos suficientes",
      color: "text-zinc-400",
      bgColor: "bg-zinc-800/60",
      borderColor: "border-zinc-700/60",
      isHealthy: false,
    };
  }
  if (bmi < 18.5) {
    return {
      label: "Bajo Peso",
      rangeText: "< 18.5 kg/m²",
      description: "Peso por debajo del rango estándar recomendado",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      isHealthy: false,
    };
  }
  if (bmi < 25.0) {
    return {
      label: "Normopeso",
      rangeText: "18.5 - 24.9 kg/m²",
      description: "Peso en rango óptimo y saludable",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      isHealthy: true,
    };
  }
  if (bmi < 30.0) {
    return {
      label: "Sobrepeso (Físico / Muscular)",
      rangeText: "25.0 - 29.9 kg/m²",
      description: "En atletas o usuarios de fuerza suele deberse a masa muscular alta (evaluar con % graso)",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      isHealthy: false,
    };
  }
  return {
    label: "Obesidad",
    rangeText: "≥ 30.0 kg/m²",
    description: "IMC elevado (≥30 kg/m²)",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    isHealthy: false,
  };
}

/**
 * Rango de peso saludable (normopeso BMI 18.5 - 24.9) para una altura dada
 */
export function getIdealWeightRange(alturaCm: number): { min: number; max: number } {
  if (!alturaCm || alturaCm <= 0) return { min: 0, max: 0 };
  const hM = alturaCm / 100;
  const h2 = hM * hM;
  return {
    min: Math.round(18.5 * h2 * 10) / 10,
    max: Math.round(24.9 * h2 * 10) / 10,
  };
}

/**
 * Fat-Free Mass Index (FFMI / Índice de Masa Libre de Grasa)
 * Esencial en entrenamiento con cargas para evaluar desarrollo muscular real independiente de la grasa
 */
export function calculateFfmi(
  masaMagraKg: number,
  alturaCm: number
): { ffmi: number; ffmiNormalized: number; category: string } {
  if (!alturaCm || alturaCm <= 0 || !masaMagraKg || masaMagraKg <= 0) {
    return { ffmi: 0, ffmiNormalized: 0, category: "-" };
  }
  const hM = alturaCm / 100;
  const ffmi = masaMagraKg / (hM * hM);
  // FFMI normalizado a 1.80m de altura
  const ffmiNormalized = ffmi + 6.1 * (1.8 - hM);

  let category = "Promedio";
  if (ffmiNormalized >= 25.0) category = "Límite Genético / Élite";
  else if (ffmiNormalized >= 22.0) category = "Excelente / Muy Avanzado";
  else if (ffmiNormalized >= 20.0) category = "Atleta / Desarrollado";
  else if (ffmiNormalized >= 18.0) category = "Nivel Intermedio";
  else category = "Principiante / Bajo";

  return {
    ffmi: Math.round(ffmi * 10) / 10,
    ffmiNormalized: Math.round(ffmiNormalized * 10) / 10,
    category,
  };
}
