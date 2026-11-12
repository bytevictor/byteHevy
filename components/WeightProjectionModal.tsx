"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  XIcon,
  SparklesIcon,
  ScaleIcon,
  FlameIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  TargetIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ZapIcon,
  ActivityIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
  RefreshCwIcon,
  ChevronRightIcon,
} from "./Icons";
import { useUserProfile } from "@/lib/user-profile-context";

interface WeightProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawRecords: {
    timestamp: number;
    fecha?: string;
    date?: string;
    peso: number;
  }[];
  activeSeasonName?: string;
  defaultTargetWeight?: number;
}

export type TrajectoryKey = "current" | "1m" | "2m" | "3m" | "def500" | "def1000" | "adf";

export function WeightProjectionModal({
  isOpen,
  onClose,
  rawRecords,
  activeSeasonName,
  defaultTargetWeight,
}: WeightProjectionModalProps) {
  const { profile } = useUserProfile();
  const [mounted, setMounted] = useState(false);
  const [calibrationDays, setCalibrationDays] = useState<number>(30);
  const [userTargetWeight, setUserTargetWeight] = useState<string>(() =>
    defaultTargetWeight ? String(defaultTargetWeight) : ""
  );
  const [selectedTrajectory, setSelectedTrajectory] = useState<TrajectoryKey>("current");
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetSavedSuccess, setTargetSavedSuccess] = useState(false);

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    weight: number;
    isProjected: boolean;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar meta desde la base de datos si no vino fijada por prop
  useEffect(() => {
    if (!defaultTargetWeight) {
      fetch("/api/weight/goal")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.targetWeight) {
            setUserTargetWeight(String(res.data.targetWeight));
          }
        })
        .catch(() => {});
    }
  }, [defaultTargetWeight]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Filtrar y ordenar los pesajes reales válidos
  const points = useMemo(() => {
    return rawRecords
      .filter((r) => typeof r.peso === "number" && r.peso > 0 && r.timestamp > 0)
      .map((r) => ({
        timestamp: r.timestamp,
        dateKey: r.fecha || r.date || new Date(r.timestamp).toISOString().split("T")[0],
        weight: r.peso,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [rawRecords]);

  // 2. Peso actual y fecha más reciente
  const latestPoint = points[points.length - 1];
  const currentWeight = latestPoint ? latestPoint.weight : 75;
  const latestTimestamp = latestPoint ? latestPoint.timestamp : Date.now();

  const targetWeightNum = useMemo(() => {
    const val = parseFloat(userTargetWeight);
    return !isNaN(val) && val > 0 ? val : currentWeight - 4;
  }, [userTargetWeight, currentWeight]);

  // Diferencia de kilos a la meta (positivo = subir, negativo = bajar)
  const deltaKg = Math.round((targetWeightNum - currentWeight) * 10) / 10;
  const isLoss = deltaKg < -0.05;
  const isGain = deltaKg > 0.05;
  const isMaint = !isLoss && !isGain;
  const kgToGoal = Math.abs(deltaKg);

  // Guardar meta directamente a la base de datos
  const handleSaveTargetGoal = async () => {
    if (!targetWeightNum || targetWeightNum <= 0) return;
    setSavingTarget(true);
    try {
      const res = await fetch("/api/weight/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWeight: targetWeightNum,
          startWeight: currentWeight,
          startDate: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTargetSavedSuccess(true);
        setTimeout(() => setTargetSavedSuccess(false), 2500);
      }
    } catch (e) {
      console.error("Error guardando meta:", e);
    } finally {
      setSavingTarget(false);
    }
  };

  // 3. Regresión lineal en la ventana de calibración para obtener el ritmo actual
  const calibrationMetrics = useMemo(() => {
    if (points.length < 2) {
      return {
        slopeDaily: 0,
        slopeWeekly: 0,
        currentDailyKcal: 0,
        sampleCount: points.length,
        calibrationPoints: points,
      };
    }

    const cutoff = latestTimestamp - calibrationDays * 86400000;
    const windowPoints = points.filter((p) => p.timestamp >= cutoff);
    const validPoints = windowPoints.length >= 2 ? windowPoints : points.slice(-Math.min(6, points.length));

    const n = validPoints.length;
    const t0 = validPoints[0].timestamp;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = (validPoints[i].timestamp - t0) / 86400000;
      const y = validPoints[i].weight;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denom = n * sumXX - sumX * sumX;
    const slopeDaily = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const slopeWeekly = Math.round(slopeDaily * 7 * 100) / 100;
    const currentDailyKcal = Math.round((slopeWeekly * 7700) / 7);

    return {
      slopeDaily,
      slopeWeekly,
      currentDailyKcal,
      sampleCount: n,
      calibrationPoints: validPoints,
    };
  }, [points, latestTimestamp, calibrationDays]);

  const { slopeWeekly, currentDailyKcal, calibrationPoints } = calibrationMetrics;

  // 4. Diagnóstico Claro: ¿Voy bien o voy mal? (Semáforo)
  const trafficLight = useMemo(() => {
    if (isMaint) {
      const isSteady = Math.abs(slopeWeekly) <= 0.15;
      return {
        status: isSteady ? "optimal" : "plateau",
        title: isSteady ? "En Mantenimiento Perfecto" : "Variación en Mantenimiento",
        badgeText: isSteady ? "Ritmo Estable" : "Ajustar Balance",
        badgeClass: isSteady
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : "bg-blue-500/10 text-blue-400 border-blue-500/30",
        message: isSteady
          ? `Tu peso está perfectamente estabilizado (${slopeWeekly > 0 ? "+" : ""}${slopeWeekly} kg/sem). Balance calórico neutro.`
          : `Tu peso oscila (${slopeWeekly > 0 ? "+" : ""}${slopeWeekly} kg/sem, ~${currentDailyKcal > 0 ? "+" : ""}${currentDailyKcal} kcal/d).`,
        color: isSteady ? "emerald" : "blue",
        isOptimal: isSteady,
        daysToTarget: 0,
        arrivalDate: "En la meta",
      };
    }

    if (isLoss) {
      // Objetivo: Pérdida de peso
      if (slopeWeekly <= -0.3 && slopeWeekly >= -0.9) {
        // Óptimo (-0.3 a -0.9 kg/sem)
        const days = Math.round((kgToGoal * 7700) / Math.abs(currentDailyKcal || 400));
        const arrivalDate = new Date(Date.now() + days * 86400000).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const weeks = Math.round((days / 7) * 10) / 10;
        return {
          status: "optimal",
          title: "Vas Muy Bien (Ritmo Óptimo)",
          badgeText: "Ritmo Saludable",
          badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          message: `Estás perdiendo peso a un ritmo excelente de ${Math.abs(slopeWeekly)} kg/sem (déficit real de ~${Math.abs(currentDailyKcal)} kcal/día). A este paso alcanzarás los ${targetWeightNum} kg en ~${weeks} semanas (${arrivalDate}) preservando tu masa muscular.`,
          color: "emerald",
          isOptimal: true,
          daysToTarget: days,
          arrivalDate,
        };
      }

      if (slopeWeekly < -0.9) {
        // Agresivo (> 0.9 kg/sem)
        const days = Math.round((kgToGoal * 7700) / Math.abs(currentDailyKcal || 1000));
        const arrivalDate = new Date(Date.now() + days * 86400000).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const weeks = Math.round((days / 7) * 10) / 10;
        return {
          status: "aggressive",
          title: "Vas Demasiado Rápido (>0.9 kg/sem)",
          badgeText: "Ritmo Muy Agresivo",
          badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          message: `Estás bajando a ${Math.abs(slopeWeekly)} kg/sem (déficit de ~${Math.abs(currentDailyKcal)} kcal/día). Llegarías a la meta en ~${weeks} semanas (${arrivalDate}), pero a este ritmo corres riesgo alto de perder masa muscular y pasar hambre extrema.`,
          color: "amber",
          isOptimal: false,
          daysToTarget: days,
          arrivalDate,
        };
      }

      if (slopeWeekly > -0.3 && slopeWeekly <= 0.05) {
        // Meseta / Estancado
        return {
          status: "plateau",
          title: "Estancado / Pérdida Muy Lenta",
          badgeText: "En Meseta",
          badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          message: `Tu peso apenas se mueve (${Math.abs(slopeWeekly)} kg/sem). Tu ingesta actual está prácticamente en mantenimiento. Para volver a bajar hacia los ${targetWeightNum} kg necesitas recortar unas 300-500 kcal en la dieta o aumentar tu actividad diaria.`,
          color: "amber",
          isOptimal: false,
          daysToTarget: null,
          arrivalDate: "Sin avance detectable",
        };
      }

      // Divergiendo (subiendo peso)
      return {
        status: "diverging",
        title: "Vas al Revés (Divergiendo)",
        badgeText: "Peso Subiendo",
        badgeClass: "bg-red-500/10 text-red-400 border-red-500/30",
        message: `¡Atención! Tu peso está subiendo (+${slopeWeekly} kg/sem) en vez de bajar. Estás comiendo en superávit de ~+${currentDailyKcal} kcal/día. Para alcanzar tu meta de ${targetWeightNum} kg es imprescindible entrar en déficit calórico.`,
        color: "red",
        isOptimal: false,
        daysToTarget: null,
        arrivalDate: "No se alcanzará sin déficit",
      };
    }

    // Objetivo: Ganancia de peso (Volumen)
    if (slopeWeekly >= 0.15 && slopeWeekly <= 0.45) {
      const days = Math.round((kgToGoal * 7700) / Math.abs(currentDailyKcal || 300));
      const arrivalDate = new Date(Date.now() + days * 86400000).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return {
        status: "optimal",
        title: "Volumen Óptimo y Limpio",
        badgeText: "Ritmo Saludable",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        message: `Ganando +${slopeWeekly} kg/sem (superávit de ~+${currentDailyKcal} kcal/día). Maximiza la ganancia muscular minimizando la grasa. Llegada estimada: ${arrivalDate}.`,
        color: "emerald",
        isOptimal: true,
        daysToTarget: days,
        arrivalDate,
      };
    }

    if (slopeWeekly > 0.45) {
      return {
        status: "aggressive",
        title: "Volumen Demasiado Rápido",
        badgeText: "Ganando Grasa Excesiva",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        message: `Subiendo a +${slopeWeekly} kg/sem. Gran parte del peso ganado será grasa corporal. Reduce ligeramente las calorías.`,
        color: "amber",
        isOptimal: false,
        daysToTarget: null,
        arrivalDate: "Revisar superávit",
      };
    }

    return {
      status: "diverging",
      title: "Peso Bajando en Volumen",
      badgeText: "Divergente",
      badgeClass: "bg-red-500/10 text-red-400 border-red-500/30",
      message: `Tu peso está bajando (${slopeWeekly} kg/sem) cuando tu meta es subir a ${targetWeightNum} kg. Necesitas aumentar tu ingesta calórica.`,
      color: "red",
      isOptimal: false,
      daysToTarget: null,
      arrivalDate: "Sin superávit",
    };
  }, [isLoss, isMaint, slopeWeekly, currentDailyKcal, kgToGoal, targetWeightNum]);

  // 5. APARTADO 1: ¿Cuántas kcal diarias y semanales de déficit necesito para llegar en 1, 2 y 3 meses?
  const totalKcalDeficitNeeded = kgToGoal * 7700;

  const timeTargets = useMemo(() => {
    // 1 Mes = 30 días (~4.29 semanas)
    const d1mDaily = Math.round(totalKcalDeficitNeeded / 30);
    const d1mWeekly = Math.round(d1mDaily * 7);
    const d1mRateWeekly = Math.round((kgToGoal / (30 / 7)) * 100) / 100;

    // 2 Meses = 60 días (~8.57 semanas)
    const d2mDaily = Math.round(totalKcalDeficitNeeded / 60);
    const d2mWeekly = Math.round(d2mDaily * 7);
    const d2mRateWeekly = Math.round((kgToGoal / (60 / 7)) * 100) / 100;

    // 3 Meses = 90 días (~12.86 semanas)
    const d3mDaily = Math.round(totalKcalDeficitNeeded / 90);
    const d3mWeekly = Math.round(d3mDaily * 7);
    const d3mRateWeekly = Math.round((kgToGoal / (90 / 7)) * 100) / 100;

    // Evaluación dinámica para identificar cuál de los 3 plazos es el más equilibrado
    // Sweet spot para corte estándar en fitness: ~550 kcal/d (~0.5 kg/sem)
    // Para volumen limpio: ~350 kcal/d (~0.3 kg/sem)
    const optionsDaily = [d1mDaily, d2mDaily, d3mDaily];
    const idealKcal = isGain ? 350 : 550;

    // Si todas las opciones son excesivas (> 1250 kcal/d), la menos inviable es la más larga (3 meses)
    const allExtreme = isLoss && optionsDaily.every((k) => k > 1250);

    const scores = optionsDaily.map((kcal, idx) => {
      if (allExtreme) return -idx;
      if (isLoss && kcal > 1250) return 99999;
      if (isLoss && kcal < 200) return 88888;
      if (isGain && kcal > 550) return 99999;
      if (isGain && kcal < 120) return 88888;
      return Math.abs(kcal - idealKcal);
    });
    const bestIndex = allExtreme ? 2 : scores.indexOf(Math.min(...scores));

    // Función que juzga cada intervalo de forma 100% dinámica según la meta y calorías
    const evaluateOption = (dailyKcal: number, rateWeekly: number, days: number, isBest: boolean) => {
      if (isMaint || kgToGoal <= 0.2) {
        return {
          label: "En Meta",
          badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
          textClass: "text-emerald-400",
          description: "Ya estás en tu meta objetivo. Mantén tu balance neutro.",
        };
      }

      if (isGain) {
        if (rateWeekly > 0.50 || dailyKcal > 550) {
          return {
            label: "⚠️ Grasa Excesiva",
            badgeClass: "bg-red-500/15 text-red-400 border border-red-500/30",
            textClass: "text-red-400",
            description: `Superávit excesivo (+${dailyKcal} kcal/d). Gran parte del peso ganado será grasa.`,
          };
        }
        if (rateWeekly >= 0.20 && rateWeekly <= 0.45) {
          return {
            label: isBest ? "⭐ Recomendado" : "⚖️ Ritmo Óptimo",
            badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
            textClass: "text-emerald-400",
            description: `Ritmo limpio y óptimo (+${rateWeekly} kg/sem). Máxima masa muscular con mínima grasa.`,
          };
        }
        if (rateWeekly < 0.15) {
          return {
            label: "🐢 Demasiado Lento",
            badgeClass: "bg-zinc-800 text-zinc-400 border border-zinc-700",
            textClass: "text-zinc-400",
            description: `Ritmo muy bajo (+${rateWeekly} kg/sem). Plazo excesivamente largo para solo ${kgToGoal} kg.`,
          };
        }
        return {
          label: isBest ? "⭐ Recomendado" : "🌱 Cómodo",
          badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
          textClass: "text-blue-400",
          description: `Superávit moderado (+${dailyKcal} kcal/d). Ganancia progresiva y controlada.`,
        };
      }

      // Pérdida de peso (Déficit)
      // 1. Inviable: déficit diario > 1250 kcal/d o ritmo > 1.25 kg/sem
      if (dailyKcal > 1250 || rateWeekly > 1.25) {
        return {
          label: "⛔ Inviable",
          badgeClass: "bg-red-500/20 text-red-400 border border-red-500/40",
          textClass: "text-red-400",
          description: `Déficit brutal de -${dailyKcal.toLocaleString("es-ES")} kcal/d (-${rateWeekly} kg/sem). Incompatible con retener músculo o mantener la salud.`,
        };
      }

      // 2. Muy Extremo: déficit entre 950 y 1250 kcal/d o ritmo entre 0.90 y 1.25 kg/sem
      if (dailyKcal > 950 || rateWeekly > 0.90) {
        return {
          label: isBest ? "⚡ Mejor Opción (Muy Exigente)" : "⚠️ Muy Extremo",
          badgeClass: isBest
            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
            : "bg-red-500/15 text-red-400 border border-red-500/30",
          textClass: "text-amber-400",
          description: `Déficit agresivo (-${dailyKcal} kcal/d, -${rateWeekly} kg/sem). Alto riesgo de catabolismo muscular, fatiga y rebote.`,
        };
      }

      // 3. Exigente: déficit entre 700 y 950 kcal/d o ritmo entre 0.65 y 0.90 kg/sem
      if (dailyKcal > 700 || rateWeekly > 0.65) {
        return {
          label: isBest ? "⭐ Mejor Opción (Exigente)" : "⚡ Exigente",
          badgeClass: isBest
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-amber-500/15 text-amber-400 border border-amber-500/30",
          textClass: isBest ? "text-emerald-400" : "text-amber-400",
          description: `Pérdida rápida (-${dailyKcal} kcal/d, -${rateWeekly} kg/sem). Requiere disciplina, proteína alta (≥2g/kg) y descanso estricto.`,
        };
      }

      // 4. Recomendado estándar: déficit entre 480 y 700 kcal/d (ritmo entre 0.45 y 0.65 kg/sem)
      if (dailyKcal >= 480 && dailyKcal <= 700) {
        return {
          label: isBest ? "⭐ Recomendado" : "⚖️ Sostenible",
          badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
          textClass: "text-emerald-400",
          description: `Equilibrio óptimo (-${dailyKcal} kcal/d, -${rateWeekly} kg/sem). Quema grasa a buen ritmo protegiendo 100% de fuerza y músculo.`,
        };
      }

      // 5. Cómodo y Sostenible: déficit entre 200 y 480 kcal/d (ritmo entre 0.20 y 0.45 kg/sem)
      if (dailyKcal >= 200 && dailyKcal < 480) {
        return {
          label: isBest ? "⭐ Recomendado" : "🌱 Cómodo y Fácil",
          badgeClass: isBest
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-blue-500/15 text-blue-400 border border-blue-500/30",
          textClass: isBest ? "text-emerald-400" : "text-blue-400",
          description: `Déficit suave (-${dailyKcal} kcal/d, -${rateWeekly} kg/sem). Cero ansiedad, gran energía diaria y máxima adherencia.`,
        };
      }

      // 6. Demasiado Lento: déficit < 200 kcal/d (ritmo < 0.20 kg/sem)
      return {
        label: "🐢 Demasiado Lento",
        badgeClass: "bg-zinc-800 text-zinc-400 border border-zinc-700",
        textClass: "text-zinc-400",
        description: `Déficit casi nulo de apenas -${dailyKcal} kcal/d (-${rateWeekly} kg/sem). ${days} días es excesivo para solo ${kgToGoal} kg; se diluye fácilmente con cualquier comida libre.`,
      };
    };

    return {
      bestIndex,
      oneMonth: {
        days: 30,
        weeksText: "~4 semanas (1 mes)",
        dailyKcal: d1mDaily,
        weeklyKcal: d1mWeekly,
        rateWeekly: d1mRateWeekly,
        arrivalDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        }),
        verdict: evaluateOption(d1mDaily, d1mRateWeekly, 30, bestIndex === 0),
      },
      twoMonths: {
        days: 60,
        weeksText: "~8 semanas (2 meses)",
        dailyKcal: d2mDaily,
        weeklyKcal: d2mWeekly,
        rateWeekly: d2mRateWeekly,
        arrivalDate: new Date(Date.now() + 60 * 86400000).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        }),
        verdict: evaluateOption(d2mDaily, d2mRateWeekly, 60, bestIndex === 1),
      },
      threeMonths: {
        days: 90,
        weeksText: "~13 semanas (3 meses)",
        dailyKcal: d3mDaily,
        weeklyKcal: d3mWeekly,
        rateWeekly: d3mRateWeekly,
        arrivalDate: new Date(Date.now() + 90 * 86400000).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        }),
        verdict: evaluateOption(d3mDaily, d3mRateWeekly, 90, bestIndex === 2),
      },
    };
  }, [totalKcalDeficitNeeded, kgToGoal, isLoss, isGain, isMaint]);

  // 6. APARTADO 2: Estrategias fijas (Déficit 500 kcal, Déficit 1000 kcal y Ayuno alterno 24h)
  // Estimación del TDEE personalizado para el ayuno alterno (ADF)
  const estimatedTdee = useMemo(() => {
    const w = currentWeight || 75;
    const h = profile?.alturaCm || 180;
    const a = profile?.edad || 27;
    const s = profile?.sexo || "male";

    // Fórmula de Mifflin-St Jeor con factor moderado de entrenamiento (1.45)
    let bmr = 10 * w + 6.25 * h - 5 * a + (s === "female" ? -161 : 5);
    if (!bmr || bmr < 1200) bmr = w * 22;
    return Math.round(bmr * 1.45);
  }, [currentWeight, profile]);

  const strategies = useMemo(() => {
    // 1. Déficit Estándar 500 kcal/día
    const def500Days = Math.max(1, Math.round(totalKcalDeficitNeeded / 500));
    const def500Weeks = Math.round((def500Days / 7) * 10) / 10;
    const def500Arrival = new Date(Date.now() + def500Days * 86400000).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // 2. Déficit Agresivo 1000 kcal/día
    const def1000Days = Math.max(1, Math.round(totalKcalDeficitNeeded / 1000));
    const def1000Weeks = Math.round((def1000Days / 7) * 10) / 10;
    const def1000Arrival = new Date(Date.now() + def1000Days * 86400000).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // 3. Ayuno Alterno cada 24h (Alternate-Day Fasting / ADF)
    // Se ayuna en días alternos: 3.5 días de ayuno a la semana.
    // Días de comida = mantenimiento (TDEE). Días de ayuno = 0 kcal.
    // Ahorro semanal = 3.5 * TDEE. Déficit diario promedio = (3.5 * TDEE) / 7 = TDEE / 2.
    const adfDailyDeficit = Math.round(estimatedTdee / 2);
    const adfWeeklyDeficit = Math.round(3.5 * estimatedTdee);
    const adfDays = Math.max(1, Math.round(totalKcalDeficitNeeded / adfDailyDeficit));
    const adfWeeks = Math.round((adfDays / 7) * 10) / 10;
    const adfRateWeekly = Math.round(((3.5 * estimatedTdee) / 7700) * 100) / 100;
    const adfArrival = new Date(Date.now() + adfDays * 86400000).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return {
      def500: {
        dailyKcal: 500,
        weeklyKcal: 3500,
        rateWeekly: 0.45,
        days: def500Days,
        weeks: def500Weeks,
        arrivalDate: def500Arrival,
      },
      def1000: {
        dailyKcal: 1000,
        weeklyKcal: 7000,
        rateWeekly: 0.91,
        days: def1000Days,
        weeks: def1000Weeks,
        arrivalDate: def1000Arrival,
      },
      adf: {
        dailyDeficitAverage: adfDailyDeficit,
        weeklyDeficit: adfWeeklyDeficit,
        rateWeekly: adfRateWeekly,
        days: adfDays,
        weeks: adfWeeks,
        arrivalDate: adfArrival,
        tdee: estimatedTdee,
      },
    };
  }, [totalKcalDeficitNeeded, estimatedTdee]);

  // 7. Preparación de la trayectoria a mostrar en el gráfico interactivo
  const trajectoryData = useMemo(() => {
    let daysToTarget = 60;
    let dailyRateKg = -0.05;

    if (selectedTrajectory === "current") {
      dailyRateKg = calibrationMetrics.slopeDaily || -0.05;
      if (Math.abs(dailyRateKg) > 0.005) {
        daysToTarget = Math.max(14, Math.min(365, Math.round(deltaKg / dailyRateKg)));
      } else {
        daysToTarget = 60;
      }
    } else if (selectedTrajectory === "1m") {
      daysToTarget = 30;
      dailyRateKg = deltaKg / 30;
    } else if (selectedTrajectory === "2m") {
      daysToTarget = 60;
      dailyRateKg = deltaKg / 60;
    } else if (selectedTrajectory === "3m") {
      daysToTarget = 90;
      dailyRateKg = deltaKg / 90;
    } else if (selectedTrajectory === "def500") {
      daysToTarget = strategies.def500.days;
      dailyRateKg = isLoss ? -500 / 7700 : 500 / 7700;
    } else if (selectedTrajectory === "def1000") {
      daysToTarget = strategies.def1000.days;
      dailyRateKg = isLoss ? -1000 / 7700 : 1000 / 7700;
    } else if (selectedTrajectory === "adf") {
      daysToTarget = strategies.adf.days;
      dailyRateKg = isLoss ? -strategies.adf.dailyDeficitAverage / 7700 : strategies.adf.dailyDeficitAverage / 7700;
    }

    daysToTarget = Math.max(7, Math.min(365, daysToTarget));
    const targetTs = latestTimestamp + daysToTarget * 86400000;
    const finalWeight = currentWeight + dailyRateKg * daysToTarget;

    // Generar 10 puntos intermedios en la proyección
    const projectedPoints: { timestamp: number; weight: number; dateLabel: string }[] = [];
    const steps = 10;
    for (let s = 1; s <= steps; s++) {
      const frac = s / steps;
      const ts = latestTimestamp + frac * daysToTarget * 86400000;
      const w = Math.round((currentWeight + dailyRateKg * daysToTarget * frac) * 10) / 10;
      const dLabel = new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      projectedPoints.push({ timestamp: ts, weight: w, dateLabel: dLabel });
    }

    return {
      daysToTarget,
      targetTs,
      finalWeight: Math.round(finalWeight * 10) / 10,
      projectedPoints,
    };
  }, [selectedTrajectory, calibrationMetrics.slopeDaily, deltaKg, isLoss, latestTimestamp, currentWeight, strategies]);

  // 8. Escalas del gráfico SVG simplificado
  const chartScales = useMemo(() => {
    const historical = calibrationPoints;
    const projected = trajectoryData.projectedPoints;

    const allTs = [
      ...historical.map((p) => p.timestamp),
      latestTimestamp,
      ...projected.map((p) => p.timestamp),
    ];
    const allWeights = [
      ...historical.map((p) => p.weight),
      currentWeight,
      targetWeightNum,
      ...projected.map((p) => p.weight),
    ];

    const minTs = Math.min(...allTs);
    const maxTs = Math.max(...allTs);
    const minW = Math.floor(Math.min(...allWeights) - 1);
    const maxW = Math.ceil(Math.max(...allWeights) + 1);

    const width = 800;
    const height = 260;
    const padding = { top: 25, right: 35, bottom: 35, left: 50 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const getX = (ts: number) => {
      if (maxTs === minTs) return padding.left + innerW / 2;
      return padding.left + ((ts - minTs) / (maxTs - minTs)) * innerW;
    };

    const getY = (w: number) => {
      if (maxW === minW) return padding.top + innerH / 2;
      return padding.top + ((maxW - w) / (maxW - minW)) * innerH;
    };

    // Ticks de Y (3 o 4 líneas de peso)
    const yTicks: number[] = [];
    const step = (maxW - minW) > 8 ? 2 : 1;
    for (let w = minW; w <= maxW; w += step) {
      yTicks.push(w);
    }

    // Ticks de X (fechas)
    const xTicks = [
      { ts: minTs, label: new Date(minTs).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) },
      { ts: latestTimestamp, label: "Hoy" },
      { ts: maxTs, label: new Date(maxTs).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) },
    ];

    return {
      width,
      height,
      padding,
      getX,
      getY,
      yTicks,
      xTicks,
      minTs,
      maxTs,
      minW,
      maxW,
    };
  }, [calibrationPoints, trajectoryData.projectedPoints, latestTimestamp, currentWeight, targetWeightNum]);

  // Manejo de movimiento del ratón en SVG para Tooltip
  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || !chartScales) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * chartScales.width;

      // Buscar el punto más cercano entre histórico y proyectado
      const allPoints = [
        ...calibrationPoints.map((p) => ({
          x: chartScales.getX(p.timestamp),
          y: chartScales.getY(p.weight),
          weight: p.weight,
          dateLabel: p.dateKey,
          isProjected: false,
        })),
        {
          x: chartScales.getX(latestTimestamp),
          y: chartScales.getY(currentWeight),
          weight: currentWeight,
          dateLabel: "Hoy",
          isProjected: false,
        },
        ...trajectoryData.projectedPoints.map((p) => ({
          x: chartScales.getX(p.timestamp),
          y: chartScales.getY(p.weight),
          weight: p.weight,
          dateLabel: p.dateLabel,
          isProjected: true,
        })),
      ];

      let closest = allPoints[0];
      let minDist = Infinity;
      for (const pt of allPoints) {
        const dist = Math.abs(pt.x - mouseX);
        if (dist < minDist) {
          minDist = dist;
          closest = pt;
        }
      }

      if (minDist < 45) {
        setHoveredPoint(closest);
      } else {
        setHoveredPoint(null);
      }
    },
    [chartScales, calibrationPoints, latestTimestamp, currentWeight, trajectoryData.projectedPoints]
  );

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* =========================================================================
            1. HEADER LIMPIO & CONCRETO
           ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shrink-0">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  Calculadora y Proyección de Déficit
                </h2>
                {activeSeasonName && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {activeSeasonName}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Planifica tu objetivo sin rodeos: ritmo actual, plazos y calorías
              </p>
            </div>
          </div>

          {/* Ajuste de Meta Objetivo & Cerrar */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Meta rápida editable */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-accent/40 rounded-xl px-2.5 py-1 text-xs">
              <TargetIcon className="w-3.5 h-3.5 text-accent-light" />
              <span className="text-zinc-400 font-medium">Meta:</span>
              <input
                type="number"
                step="0.1"
                min="35"
                max="250"
                value={userTargetWeight}
                onChange={(e) => setUserTargetWeight(e.target.value)}
                className="w-13 bg-transparent text-right font-mono font-bold text-accent-light focus:outline-none"
              />
              <span className="text-zinc-400 font-mono text-xs">kg</span>

              <button
                type="button"
                onClick={handleSaveTargetGoal}
                disabled={savingTarget}
                className="ml-1 p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Fijar como meta principal"
              >
                {targetSavedSuccess ? (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="text-[10px] font-bold text-accent-light">Fijar</span>
                )}
              </button>
            </div>

            {/* Selector de calibración temporal */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300">
              <ClockIcon className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={calibrationDays}
                onChange={(e) => setCalibrationDays(Number(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value={14} className="bg-zinc-900">Últimos 14 días</option>
                <option value={30} className="bg-zinc-900">Últimos 30 días</option>
                <option value={60} className="bg-zinc-900">Últimos 60 días</option>
                <option value={90} className="bg-zinc-900">Últimos 90 días</option>
                <option value={9999} className="bg-zinc-900">Todo el historial</option>
              </select>
            </div>

            {/* Botón cerrar */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer shrink-0"
              title="Cerrar ventana"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            CUERPO DEL PANEL
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* 1. SEMÁFORO DE DIAGNÓSTICO: ¿VOY BIEN O VOY MAL? */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              trafficLight.color === "emerald"
                ? "bg-emerald-950/20 border-emerald-500/30"
                : trafficLight.color === "amber"
                ? "bg-amber-950/20 border-amber-500/30"
                : trafficLight.color === "red"
                ? "bg-red-950/20 border-red-500/30"
                : "bg-blue-950/20 border-blue-500/30"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2.5">
                {trafficLight.color === "emerald" ? (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : trafficLight.color === "amber" ? (
                  <AlertTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />
                ) : trafficLight.color === "red" ? (
                  <AlertTriangleIcon className="w-5 h-5 text-red-400 shrink-0" />
                ) : (
                  <ActivityIcon className="w-5 h-5 text-blue-400 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">{trafficLight.title}</h3>
                  <span className="text-[11px] text-zinc-400">
                    Evaluación según tus últimos {calibrationMetrics.sampleCount} pesajes (últimos {calibrationDays} días)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${trafficLight.badgeClass}`}>
                  {trafficLight.badgeText}
                </span>
                {trafficLight.daysToTarget !== null && trafficLight.daysToTarget > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block font-medium">Llegada a este ritmo:</span>
                    <strong className="text-xs text-accent-light font-mono font-bold">
                      {trafficLight.arrivalDate}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-3">
              {trafficLight.message}
            </p>

            {/* Fila de 4 KPIs claros */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Peso Actual</span>
                <div className="text-base font-bold font-mono text-zinc-100 mt-0.5">
                  {currentWeight.toFixed(1)} <span className="text-xs text-zinc-400">kg</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Meta Objetivo</span>
                <div className="text-base font-bold font-mono text-accent-light mt-0.5">
                  {targetWeightNum.toFixed(1)} <span className="text-xs text-zinc-400">kg</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Distancia Restante</span>
                <div className={`text-base font-bold font-mono mt-0.5 ${isLoss ? "text-amber-400" : isGain ? "text-sky-400" : "text-emerald-400"}`}>
                  {deltaKg > 0 ? `+${deltaKg}` : deltaKg} <span className="text-xs text-zinc-400">kg</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Velocidad Actual</span>
                <div className="text-base font-bold font-mono text-zinc-200 mt-0.5">
                  {slopeWeekly > 0 ? `+${slopeWeekly}` : slopeWeekly} <span className="text-xs text-zinc-400">kg/sem</span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              2. APARTADO: DÉFICIT NECESARIO SEGÚN PLAZO (1 MES, 2 MESES, 3 MESES)
             ========================================================================= */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-200 flex items-center gap-2">
                <FlameIcon className="w-4 h-4 text-accent-light" />
                <span>¿Cuánto déficit necesitas para llegar a la meta?</span>
              </h3>
              <span className="text-[11px] text-zinc-400 font-mono">
                Total a quemar: {Math.round(totalKcalDeficitNeeded).toLocaleString("es-ES")} kcal ({kgToGoal} kg de grasa)
              </span>
            </div>

            {/* Banner Dinámico con Veredicto Global según los kg restantes */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
              <SparklesIcon className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                {isMaint || kgToGoal <= 0.2 ? (
                  "¡Ya estás en tu meta de peso! Tu objetivo actual es mantenerte."
                ) : timeTargets.bestIndex === 0 ? (
                  <>
                    Para tus <strong>{kgToGoal} kg</strong> restantes, el plazo más lógico y equilibrado es <strong>En 1 Mes</strong> ({isGain ? "superávit" : "déficit"} de <strong>{isGain ? "+" : "-"}{timeTargets.oneMonth.dailyKcal} kcal/día</strong>). Ampliarlo a 2 o 3 meses sería innecesariamente lento.
                  </>
                ) : timeTargets.bestIndex === 1 ? (
                  <>
                    Para tus <strong>{kgToGoal} kg</strong> restantes, el plazo más equilibrado es <strong>En 2 Meses</strong> ({isGain ? "superávit" : "déficit"} de <strong>{isGain ? "+" : "-"}{timeTargets.twoMonths.dailyKcal} kcal/día</strong>, ~{timeTargets.twoMonths.rateWeekly} kg/sem).
                  </>
                ) : timeTargets.threeMonths.dailyKcal > 1000 ? (
                  <>
                    Para una meta de <strong>{kgToGoal} kg</strong>, incluso 3 meses exige un ritmo muy agresivo ({isGain ? "+" : "-"}{timeTargets.threeMonths.dailyKcal} kcal/d). Se aconseja un horizonte de <strong>4 a 6 meses</strong> para no perder masa muscular.
                  </>
                ) : (
                  <>
                    Para tus <strong>{kgToGoal} kg</strong> restantes, el plazo más sostenible es <strong>En 3 Meses</strong> ({isGain ? "superávit" : "déficit"} de <strong>{isGain ? "+" : "-"}{timeTargets.threeMonths.dailyKcal} kcal/día</strong>, ~{timeTargets.threeMonths.rateWeekly} kg/sem).
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Opción 1: En 1 Mes */}
              <div
                onClick={() => setSelectedTrajectory("1m")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedTrajectory === "1m"
                    ? "bg-accent/10 border-accent shadow-md shadow-accent/5 ring-1 ring-accent/30"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">En 1 Mes</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${timeTargets.oneMonth.verdict.badgeClass}`}
                    >
                      {timeTargets.oneMonth.verdict.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Llegada para el <strong>{timeTargets.oneMonth.arrivalDate}</strong>
                  </span>
                </div>

                <div className="space-y-1.5 py-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">{isGain ? "Superávit diario:" : "Déficit diario:"}</span>
                    <strong className={`text-lg font-mono font-bold ${timeTargets.oneMonth.verdict.textClass}`}>
                      {isGain ? "+" : "-"}{timeTargets.oneMonth.dailyKcal}{" "}
                      <span className="text-xs font-normal text-zinc-400">kcal/d</span>
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>{isGain ? "Superávit semanal:" : "Déficit semanal:"}</span>
                    <strong className="font-mono text-zinc-200">
                      {isGain ? "+" : "-"}{timeTargets.oneMonth.weeklyKcal.toLocaleString("es-ES")} kcal/sem
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>{isGain ? "Ritmo de subida:" : "Ritmo de pérdida:"}</span>
                    <strong className="font-mono text-zinc-200">
                      {isGain ? "+" : "-"}{timeTargets.oneMonth.rateWeekly} kg/sem
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-400 border-t border-zinc-800/80 pt-2 leading-relaxed">
                  {timeTargets.oneMonth.verdict.description}
                </div>
              </div>

              {/* Opción 2: En 2 Meses */}
              <div
                onClick={() => setSelectedTrajectory("2m")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                  selectedTrajectory === "2m"
                    ? "bg-accent/10 border-accent shadow-md shadow-accent/5 ring-1 ring-accent/30"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">En 2 Meses</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${timeTargets.twoMonths.verdict.badgeClass}`}>
                      {timeTargets.twoMonths.verdict.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Llegada para el <strong>{timeTargets.twoMonths.arrivalDate}</strong>
                  </span>
                </div>

                <div className="space-y-1.5 py-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">{isGain ? "Superávit diario:" : "Déficit diario:"}</span>
                    <strong className={`text-lg font-mono font-bold ${timeTargets.twoMonths.verdict.textClass}`}>
                      {isGain ? "+" : "-"}{timeTargets.twoMonths.dailyKcal}{" "}
                      <span className="text-xs font-normal text-zinc-400">kcal/d</span>
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>{isGain ? "Superávit semanal:" : "Déficit semanal:"}</span>
                    <strong className="font-mono text-zinc-200">
                      {isGain ? "+" : "-"}{timeTargets.twoMonths.weeklyKcal.toLocaleString("es-ES")} kcal/sem
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>{isGain ? "Ritmo de subida:" : "Ritmo de pérdida:"}</span>
                    <strong className="font-mono text-zinc-200">
                      {isGain ? "+" : "-"}{timeTargets.twoMonths.rateWeekly} kg/sem
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-400 border-t border-zinc-800/80 pt-2 leading-relaxed">
                  {timeTargets.twoMonths.verdict.description}
                </div>
              </div>

              {/* Opción 3: En 3 Meses */}
              <div
                onClick={() => setSelectedTrajectory("3m")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedTrajectory === "3m"
                    ? "bg-accent/10 border-accent shadow-md shadow-accent/5 ring-1 ring-accent/30"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">En 3 Meses</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${timeTargets.threeMonths.verdict.badgeClass}`}>
                      {timeTargets.threeMonths.verdict.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Llegada para el <strong>{timeTargets.threeMonths.arrivalDate}</strong>
                  </span>
                </div>

                <div className="space-y-1.5 py-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">{isGain ? "Superávit diario:" : "Déficit diario:"}</span>
                    <strong className={`text-lg font-mono font-bold ${timeTargets.threeMonths.verdict.textClass}`}>
                      {isGain ? "+" : "-"}{timeTargets.threeMonths.dailyKcal}{" "}
                      <span className="text-xs font-normal text-zinc-400">kcal/d</span>
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>{isGain ? "Superávit semanal:" : "Déficit semanal:"}</span>
                    <strong className="font-mono text-zinc-200">
                      {isGain ? "+" : "-"}{timeTargets.threeMonths.weeklyKcal.toLocaleString("es-ES")} kcal/sem
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>{isGain ? "Ritmo de subida:" : "Ritmo de pérdida:"}</span>
                    <strong className="font-mono text-zinc-200">
                      {isGain ? "+" : "-"}{timeTargets.threeMonths.rateWeekly} kg/sem
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-400 border-t border-zinc-800/80 pt-2 leading-relaxed">
                  {timeTargets.threeMonths.verdict.description}
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              3. APARTADO: ESTRATEGIAS NUTRICIONALES ESTÁNDAR
             ========================================================================= */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-200 flex items-center gap-2">
              <ZapIcon className="w-4 h-4 text-emerald-400" />
              <span>Planes según tu estrategia nutricional</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Estrategia A: Déficit Estándar 500 kcal */}
              <div
                onClick={() => setSelectedTrajectory("def500")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedTrajectory === "def500"
                    ? "bg-emerald-500/10 border-emerald-500 shadow-md ring-1 ring-emerald-500/30"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">Déficit Estándar</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      -500 kcal/d
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    -3.500 kcal/sem (~0.45 kg/sem)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">Tiempo necesario:</span>
                    <strong className="text-sm font-mono text-zinc-100">
                      ~{strategies.def500.weeks} semanas
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>Fecha de llegada:</span>
                    <strong className="font-mono text-emerald-400">
                      {strategies.def500.arrivalDate}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  El protocolo clásico de recomposición: preservación total de masa muscular sin fatiga.
                </p>
              </div>

              {/* Estrategia B: Déficit Agresivo 1000 kcal */}
              <div
                onClick={() => setSelectedTrajectory("def1000")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedTrajectory === "def1000"
                    ? "bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/30"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">Déficit Agresivo</span>
                    <span className="text-[10px] font-mono font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                      -1.000 kcal/d
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    -7.000 kcal/sem (~0.91 kg/sem)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">Tiempo necesario:</span>
                    <strong className="text-sm font-mono text-zinc-100">
                      ~{strategies.def1000.weeks} semanas
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>Fecha de llegada:</span>
                    <strong className="font-mono text-amber-400">
                      {strategies.def1000.arrivalDate}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Pérdida rápida. Requiere asegurar al menos 2.0g de proteína por kg y no exceder 4-6 semanas seguidas.
                </p>
              </div>

              {/* Estrategia C: Ayuno Alterno 24h (ADF) */}
              <div
                onClick={() => setSelectedTrajectory("adf")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedTrajectory === "adf"
                    ? "bg-purple-500/10 border-purple-500 shadow-md ring-1 ring-purple-500/30"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">Ayuno Alterno (24h)</span>
                    <span className="text-[10px] font-mono font-bold text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30">
                      ADF (~3.5d/sem)
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5 font-mono">
                    ~-{strategies.adf.dailyDeficitAverage} kcal/d promedio (-{strategies.adf.rateWeekly} kg/sem)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">Tiempo necesario:</span>
                    <strong className="text-sm font-mono text-zinc-100">
                      ~{strategies.adf.weeks} semanas
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-zinc-400">
                    <span>Fecha de llegada:</span>
                    <strong className="font-mono text-purple-300">
                      {strategies.adf.arrivalDate}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Ayunar 24h en días alternos y comer a mantenimiento ({strategies.adf.tdee} kcal) los días normales. Sin necesidad de pesar comida a diario.
                </p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              4. GRÁFICO LIMPIO & INTERACTIVO DE TRAYECTORIA A LA META
             ========================================================================= */}
          <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <ActivityIcon className="w-4 h-4 text-accent-light" />
                  <span>Trayectoria de Peso hacia los {targetWeightNum} kg</span>
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Mostrando proyección según:{" "}
                  <strong className="text-accent-light font-medium">
                    {selectedTrajectory === "current"
                      ? "Tu ritmo actual registrado"
                      : selectedTrajectory === "1m"
                      ? "Plan Meta en 1 Mes"
                      : selectedTrajectory === "2m"
                      ? "Plan Meta en 2 Meses"
                      : selectedTrajectory === "3m"
                      ? "Plan Meta en 3 Meses"
                      : selectedTrajectory === "def500"
                      ? "Déficit estándar (-500 kcal/d)"
                      : selectedTrajectory === "def1000"
                      ? "Déficit agresivo (-1.000 kcal/d)"
                      : "Ayuno alterno (ADF cada 24h)"}
                  </strong>
                </p>
              </div>

              {/* Botón rápido para volver a 'Mi ritmo actual' */}
              {selectedTrajectory !== "current" && (
                <button
                  type="button"
                  onClick={() => setSelectedTrajectory("current")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-accent-light bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-all cursor-pointer self-start sm:self-center"
                >
                  <RefreshCwIcon className="w-3 h-3" />
                  <span>Ver con mi ritmo actual</span>
                </button>
              )}
            </div>

            {/* Canvas SVG */}
            <div className="relative w-full overflow-hidden">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${chartScales.width} ${chartScales.height}`}
                className="w-full h-auto max-h-[280px] overflow-visible select-none"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Líneas de rejilla horizontal (peso) */}
                {chartScales.yTicks.map((wVal) => {
                  const y = chartScales.getY(wVal);
                  return (
                    <g key={wVal}>
                      <line
                        x1={chartScales.padding.left}
                        y1={y}
                        x2={chartScales.width - chartScales.padding.right}
                        y2={y}
                        stroke="#27272a"
                        strokeWidth={1}
                        strokeDasharray="2 3"
                      />
                      <text
                        x={chartScales.padding.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] fill-zinc-500 font-mono"
                      >
                        {wVal} kg
                      </text>
                    </g>
                  );
                })}

                {/* Línea horizontal destacada de la META OBJETIVO */}
                <line
                  x1={chartScales.padding.left}
                  y1={chartScales.getY(targetWeightNum)}
                  x2={chartScales.width - chartScales.padding.right}
                  y2={chartScales.getY(targetWeightNum)}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.8}
                />
                <text
                  x={chartScales.width - chartScales.padding.right}
                  y={chartScales.getY(targetWeightNum) - 6}
                  textAnchor="end"
                  className="text-[10px] font-mono font-bold fill-emerald-400"
                >
                  Meta {targetWeightNum} kg
                </text>

                {/* Eje X (fechas) */}
                {chartScales.xTicks.map((xt, i) => {
                  const x = chartScales.getX(xt.ts);
                  return (
                    <text
                      key={i}
                      x={x}
                      y={chartScales.height - 10}
                      textAnchor={i === 0 ? "start" : i === chartScales.xTicks.length - 1 ? "end" : "middle"}
                      className="text-[10px] fill-zinc-500 font-mono"
                    >
                      {xt.label}
                    </text>
                  );
                })}

                {/* Línea histórica sólida de pesajes reales */}
                {calibrationPoints.length >= 2 && (
                  <path
                    d={calibrationPoints
                      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${chartScales.getX(p.timestamp).toFixed(1)} ${chartScales.getY(p.weight).toFixed(1)}`)
                      .join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                  />
                )}

                {/* Puntos individuales históricos */}
                {calibrationPoints.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={chartScales.getX(p.timestamp)}
                    cy={chartScales.getY(p.weight)}
                    r={3}
                    fill="#3b82f6"
                    stroke="#18181b"
                    strokeWidth={1}
                  />
                ))}

                {/* Punto T0 (HOY) */}
                <circle
                  cx={chartScales.getX(latestTimestamp)}
                  cy={chartScales.getY(currentWeight)}
                  r={5}
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                />

                {/* Línea Proyectada discontinua hacia la meta */}
                <path
                  d={`M ${chartScales.getX(latestTimestamp).toFixed(1)} ${chartScales.getY(currentWeight).toFixed(1)} ${trajectoryData.projectedPoints
                    .map((p) => `L ${chartScales.getX(p.timestamp).toFixed(1)} ${chartScales.getY(p.weight).toFixed(1)}`)
                    .join(" ")}`}
                  fill="none"
                  stroke="var(--accent-light, #fbbf24)"
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                />

                {/* Punto Final Meta */}
                <circle
                  cx={chartScales.getX(trajectoryData.targetTs)}
                  cy={chartScales.getY(trajectoryData.finalWeight)}
                  r={5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />

                {/* Tooltip crosshair */}
                {hoveredPoint && (
                  <g pointerEvents="none">
                    <line
                      x1={hoveredPoint.x}
                      y1={chartScales.padding.top}
                      x2={hoveredPoint.x}
                      y2={chartScales.height - chartScales.padding.bottom}
                      stroke="#fbbf24"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={hoveredPoint.x}
                      cy={hoveredPoint.y}
                      r={6}
                      fill="#ffffff"
                      stroke="#fbbf24"
                      strokeWidth={2}
                    />
                  </g>
                )}
              </svg>

              {/* Tooltip flotante */}
              {hoveredPoint && (
                <div
                  className="absolute top-2 z-10 pointer-events-none px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-zinc-700 shadow-xl text-xs font-mono backdrop-blur-sm"
                  style={{ left: `${Math.max(10, Math.min(600, hoveredPoint.x - 40))}px` }}
                >
                  <span className="text-zinc-400 block text-[10px]">
                    {hoveredPoint.isProjected ? "Proyección" : "Medición"}: {hoveredPoint.dateLabel}
                  </span>
                  <strong className="text-accent-light font-bold text-sm">
                    {hoveredPoint.weight.toFixed(1)} kg
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
