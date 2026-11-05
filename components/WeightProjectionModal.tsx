"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  XIcon,
  SparklesIcon,
  ScaleIcon,
  ActivityIcon,
  FlameIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  TargetIcon,
  InfoIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ZapIcon,
  RefreshCwIcon,
  ChevronDownIcon,
} from "./Icons";
import {
  buildFullProjectionReport,
  HORIZON_PRESETS,
  ProjectionHorizonId,
  FullProjectionReport,
  WeightDataPoint,
} from "@/lib/weight-projection-engine";

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

/**
 * Genera un trazado cúbico monótono (Fritsch-Carlson) para unir los puntos
 * de forma ultra-suave y continua, idéntico al modo de tendencia.
 */
function buildSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  const n = points.length;
  const dxs: number[] = [];
  const dys: number[] = [];
  const ms: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    ms.push(dx === 0 ? 0 : dy / dx);
  }

  const tangents: number[] = [ms[0]];
  for (let i = 1; i < n - 1; i++) {
    const m0 = ms[i - 1];
    const m1 = ms[i];
    if (m0 * m1 <= 0) {
      tangents.push(0);
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      const common = dx0 + dx1;
      tangents.push(common === 0 ? 0 : (3 * common) / ((common + dx1) / m0 + (common + dx0) / m1));
    }
  }
  tangents.push(ms[n - 2]);

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;
    const cp1x = p0.x + dx;
    const cp1y = p0.y + tangents[i] * dx;
    const cp2x = p1.x - dx;
    const cp2y = p1.y - tangents[i + 1] * dx;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return path;
}

export function WeightProjectionModal({
  isOpen,
  onClose,
  rawRecords,
  activeSeasonName,
  defaultTargetWeight,
}: WeightProjectionModalProps) {
  // Estado de interactividad
  const [selectedHorizonId, setSelectedHorizonId] = useState<ProjectionHorizonId>("30d");
  const [calibrationWindowDays, setCalibrationWindowDays] = useState<number>(30);
  const [userTargetWeight, setUserTargetWeight] = useState<string>(() =>
    defaultTargetWeight ? String(defaultTargetWeight) : ""
  );

  // Simulador What-If (ajuste calórico dinámico de -600 a +600 kcal/día)
  const [whatIfKcal, setWhatIfKcal] = useState<number>(0);

  // Complejidad de las explicaciones (simple vs técnica)
  const [explanationMode, setExplanationMode] = useState<"simple" | "technical">("simple");
  // Toggle para expandir detalles matemáticos profundos
  const [showMathDetails, setShowMathDetails] = useState<boolean>(false);

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    screenX: number;
    isHistorical: boolean;
    dateLabel: string;
    weight: number;
    diffFromLatest: number;
    daysAgoOrAhead: number;
    lower95?: number;
    upper95?: number;
    lower68?: number;
    upper68?: number;
    isSimulation?: boolean;
  } | null>(null);

  const [mounted, setMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar meta fijada globalmente desde la base de datos si no vino por props
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

  // Escuchar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Transformar registros a puntos válidos
  const points: WeightDataPoint[] = useMemo(() => {
    return rawRecords
      .filter((r) => typeof r.peso === "number" && r.peso > 0 && !isNaN(r.peso))
      .map((r) => ({
        timestamp: r.timestamp,
        dateKey: r.fecha || r.date || new Date(r.timestamp).toISOString().slice(0, 10),
        weight: r.peso,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [rawRecords]);

  // Meta numérica coherente
  const targetWeightNum = useMemo(() => {
    const parsed = parseFloat(userTargetWeight);
    if (!isNaN(parsed) && parsed > 20 && parsed < 300) return parsed;
    if (points.length === 0) return 70;
    const latest = points[points.length - 1].weight;
    return Math.round((latest - 3) * 10) / 10;
  }, [userTargetWeight, points]);

  // Ejecutar motor estadístico base
  const report: FullProjectionReport | null = useMemo(() => {
    if (points.length < 2) return null;
    return buildFullProjectionReport(
      points,
      selectedHorizonId,
      undefined,
      targetWeightNum,
      calibrationWindowDays
    );
  }, [points, selectedHorizonId, targetWeightNum, calibrationWindowDays]);

  // Histórico de calibración reciente para el gráfico
  const calibrationPoints = useMemo(() => {
    if (!report || points.length === 0) return [];
    if (calibrationWindowDays >= 9999) {
      return points;
    }
    const cutoff = report.latestTimestamp - calibrationWindowDays * 86400000;
    const filtered = points.filter((p) => p.timestamp >= cutoff);
    return filtered.length >= 2 ? filtered : points.slice(-Math.min(5, points.length));
  }, [report, points, calibrationWindowDays]);

  // Puntos proyectados con simulación What-If aplicada en vivo
  const simulationData = useMemo(() => {
    if (!report) return null;

    const baseSlopeDaily = report.linear.slopeDaily;
    const baseSlopeWeekly = report.linear.slopeWeekly;
    // Wishnofsky: 7700 kcal / kg => deltaRate diario = whatIfKcal / 7700
    const deltaDaily = whatIfKcal / 7700;
    const simulatedSlopeDaily = baseSlopeDaily + deltaDaily;
    const simulatedSlopeWeekly = Math.round((baseSlopeWeekly + (whatIfKcal * 7) / 7700) * 100) / 100;
    const simulatedNetKcalDaily = report.thermodynamics.impliedNetKcalDaily + whatIfKcal;

    // Recalcular puntos proyectados de la línea de tiempo
    const simulatedTimeline = report.timelinePoints.map((tp) => {
      const daysAhead = (tp.timestamp - report.latestTimestamp) / 86400000;
      const simulatedWeight = Math.round((tp.linearExpected + daysAhead * deltaDaily) * 10) / 10;
      const lower95 = Math.round((tp.linearLower95 + daysAhead * deltaDaily) * 10) / 10;
      const upper95 = Math.round((tp.linearUpper95 + daysAhead * deltaDaily) * 10) / 10;

      return {
        ...tp,
        simulatedWeight,
        simulatedLower95: lower95,
        simulatedUpper95: upper95,
      };
    });

    // Recalcular llegada a la meta objetivo (proyección inversa simulada)
    const deltaToTarget = targetWeightNum - report.latestWeight;
    const isLossTarget = deltaToTarget < -0.1;
    const isGainTarget = deltaToTarget > 0.1;

    let simulatedDaysToTarget: number | null = null;
    let simulatedArrivalDate: string | null = null;
    let isSimulatedDiverging = false;

    if (isLossTarget && simulatedSlopeDaily >= -0.003) {
      isSimulatedDiverging = true;
    } else if (isGainTarget && simulatedSlopeDaily <= 0.003) {
      isSimulatedDiverging = true;
    } else if (Math.abs(simulatedSlopeDaily) > 0.003) {
      simulatedDaysToTarget = Math.round(deltaToTarget / simulatedSlopeDaily);
      if (simulatedDaysToTarget > 0 && simulatedDaysToTarget < 3650) {
        const targetTs = Date.now() + simulatedDaysToTarget * 86400000;
        simulatedArrivalDate = new Date(targetTs).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }

    // Comparación con la fecha base pura
    let timeDeltaWeeks = 0;
    if (report.inverseTarget?.expectedDays && simulatedDaysToTarget) {
      const diffDays = report.inverseTarget.expectedDays - simulatedDaysToTarget;
      timeDeltaWeeks = Math.round((diffDays / 7) * 10) / 10;
    }

    return {
      simulatedSlopeDaily,
      simulatedSlopeWeekly,
      simulatedNetKcalDaily,
      simulatedTimeline,
      simulatedDaysToTarget,
      simulatedArrivalDate,
      isSimulatedDiverging,
      timeDeltaWeeks,
    };
  }, [report, whatIfKcal, targetWeightNum]);

  // SEMÁFORO DEPORTIVO & CLÍNICO UNIFICADO
  const trafficLight = useMemo(() => {
    if (!report || !simulationData) return null;

    const currentWeight = report.latestWeight;
    const target = targetWeightNum;
    const delta = target - currentWeight;
    const slopeWeekly = simulationData.simulatedSlopeWeekly;

    // Fase corporal
    const phase: "deficit" | "surplus" | "maintenance" =
      delta < -0.2 ? "deficit" : delta > 0.2 ? "surplus" : "maintenance";

    let status: "optimal" | "aggressive" | "plateau" | "diverging" = "optimal";
    let statusLabel = "";
    let badgeClass = "";
    let simpleExplanation = "";
    let technicalExplanation = "";

    if (phase === "deficit") {
      if (slopeWeekly <= -1.0) {
        status = "aggressive";
        statusLabel = "Ritmo Agresivo (>1.0 kg/sem)";
        badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/30";
        simpleExplanation = `Vas demasiado rápido (${Math.abs(slopeWeekly)} kg/sem). Si pierdes más de 1 kg por semana, tu cuerpo empezará a quemar músculo y notarás fatiga y debilidad.`;
        technicalExplanation = `Tasa de pérdida elevada (|dW/dt| > 1.2% MC/sem). Supera la tasa lipolítica máxima de Klein & Wolfe (0.007 kg/kg grasa/día). Alto riesgo de catabolismo de masa magra contráctil y caída del gasto metabólico basal.`;
      } else if (slopeWeekly <= -0.3 && slopeWeekly > -1.0) {
        status = "optimal";
        statusLabel = "Ritmo Óptimo (Estándar de Oro)";
        badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
        simpleExplanation = `Vas a un ritmo perfecto (${Math.abs(slopeWeekly)} kg/sem). Estás quemando grasa corporal mientras proteges tu músculo y mantienes tu fuerza intacta.`;
        technicalExplanation = `Cinemática en zona de máxima conservación de masa libre de grasa (0.5% a 1.0% de peso corporal/semana). Balance termodinámico negativo controlado sin desencadenar respuesta neuroendocrina de leptina ni aumento masivo de grelina.`;
      } else if (slopeWeekly > -0.3 && slopeWeekly <= 0.05) {
        status = "plateau";
        statusLabel = "Meseta / Pérdida Lenta";
        badgeClass = "text-amber-300 bg-amber-500/10 border-amber-500/30";
        simpleExplanation = `Tu peso apenas se mueve (${Math.abs(slopeWeekly)} kg/sem). Para continuar perdiendo hacia los ${target} kg necesitas ajustar tu comida o aumentar tus pasos.`;
        technicalExplanation = `Deceleración asintótica (d²W/dt² ≈ 0, dW/dt → 0). Adaptación homeostática del modelo de Hall donde la caída de masa corporal activa y la termogénesis no adaptativa (NEAT) igualaron el gasto total a la ingesta.`;
      } else {
        status = "diverging";
        statusLabel = "Divergencia con la Meta";
        badgeClass = "text-red-400 bg-red-500/10 border-red-500/30";
        simpleExplanation = `Tu peso está subiendo (+${slopeWeekly} kg/sem) en vez de bajar. Para alcanzar tu objetivo de ${target} kg necesitas entrar en déficit calórico.`;
        technicalExplanation = `Vector de velocidad divergente: dW/dt > 0 con objetivo ΔW < 0. Balance de energía neto positivo (+${simulationData.simulatedNetKcalDaily} kcal/día) opuesto a la dirección cinemática hacia el objetivo.`;
      }
    } else if (phase === "surplus") {
      if (slopeWeekly >= 0.4) {
        status = "aggressive";
        statusLabel = "Volumen Rápido (>0.4 kg/sem)";
        badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/30";
        simpleExplanation = `Estás ganando peso muy rápido (+${slopeWeekly} kg/sem). El cuerpo no puede crear músculo tan deprisa, por lo que gran parte del peso extra será grasa.`;
        technicalExplanation = `Superávit excesivo que sobrepasa la tasa fisiológica máxima de síntesis proteica muscular miofibrilar natural (~100-200 g/semana de tejido contráctil). Partición de nutrientes desfavorable (acumulación adiposa predominante).`;
      } else if (slopeWeekly >= 0.1 && slopeWeekly < 0.4) {
        status = "optimal";
        statusLabel = "Volumen Limpio Óptimo";
        badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
        simpleExplanation = `Ritmo excelente de volumen (+${slopeWeekly} kg/sem). Ganancia muscular limpia minimizando la acumulación de grasa.`;
        technicalExplanation = `Tasa de ganancia de masa magra óptima (+0.25% a +0.50% de peso corporal/mes). Disponibilidad energética anabólica sin saturación de vías lipogénicas.`;
      } else if (slopeWeekly < -0.05) {
        status = "diverging";
        statusLabel = "Divergencia (Peso en Caída)";
        badgeClass = "text-red-400 bg-red-500/10 border-red-500/30";
        simpleExplanation = `Tu peso está bajando (${slopeWeekly} kg/sem) en vez de subir. Para ganar músculo necesitas comer más calorías.`;
        technicalExplanation = `Déficit involuntario: dW/dt < 0 en fase de hipertrofia. Balance calórico negativo incompatible con la tasa metabólica de adición tisular de Forbes.`;
      } else {
        status = "plateau";
        statusLabel = "Mantenimiento / Sin Ganancia";
        badgeClass = "text-zinc-300 bg-zinc-800 border-zinc-700";
        simpleExplanation = `Tu peso está estancado (~0.0 kg/sem). Necesitas un ligero superávit de unas 200-300 kcal/día para empezar a ganar volumen.`;
        technicalExplanation = `Equilibrio isoenergético en régimen normocalórico (dW/dt ≈ 0). Se requiere un incremento de ~200-350 kcal/día para reiniciar la trayectoria positiva hacia la meta.`;
      }
    } else {
      // Mantenimiento
      if (Math.abs(slopeWeekly) <= 0.15) {
        status = "optimal";
        statusLabel = "Mantenimiento Perfecto";
        badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
        simpleExplanation = `Tu peso está totalmente estabilizado (fluctuaciones mínimas de ±${Math.abs(slopeWeekly)} kg/sem). Buen control calórico.`;
        technicalExplanation = `Estabilidad ergogénica óptima (|dW/dt| < 0.15 kg/sem). Homeostasis energética en perfecto balance de ingesta vs gasto total.`;
      } else {
        status = "plateau";
        statusLabel = "Fluctuación Fuera de Margen";
        badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/30";
        simpleExplanation = `Tu peso está oscilando (${slopeWeekly > 0 ? "+" : ""}${slopeWeekly} kg/sem). Ajusta ligeramente tu comida para mantenerte en ${target} kg.`;
        technicalExplanation = `Deriva energética leve (|dW/dt| > 0.15 kg/sem) fuera del rango de recomposición / estabilidad isoenergética.`;
      }
    }

    // Prescripción de Wishnofsky exacta para la meta
    // Ritmo óptimo recomendado: -0.5 kg/sem para déficit, +0.25 kg/sem para volumen
    const targetWeeklyRate = phase === "deficit" ? -0.5 : phase === "surplus" ? 0.25 : 0;
    const requiredKcalAdjustment = Math.round((targetWeeklyRate - slopeWeekly) * 1100);

    return {
      phase,
      status,
      statusLabel,
      badgeClass,
      simpleExplanation,
      technicalExplanation,
      requiredKcalAdjustment,
      currentPace: slopeWeekly,
    };
  }, [report, simulationData, targetWeightNum]);

  // Dimensiones y escalas del SVG Maestro
  const svgDimensions = { width: 960, height: 420, padding: { top: 35, right: 80, bottom: 45, left: 65 } };
  const innerWidth = svgDimensions.width - svgDimensions.padding.left - svgDimensions.padding.right;
  const innerHeight = svgDimensions.height - svgDimensions.padding.top - svgDimensions.padding.bottom;

  const scales = useMemo(() => {
    if (!report || calibrationPoints.length === 0 || !simulationData) return null;

    const minTs = calibrationPoints[0].timestamp;
    const maxTs = report.targetTimestamp;
    const timeSpan = maxTs - minTs || 1;

    // Recolectar valores Y
    const histWeights = calibrationPoints.map((p) => p.weight);
    const simWeights = simulationData.simulatedTimeline.map((p) => p.simulatedWeight);
    const lower95s = simulationData.simulatedTimeline.map((p) => p.simulatedLower95);
    const upper95s = simulationData.simulatedTimeline.map((p) => p.simulatedUpper95);

    const allY = [
      ...histWeights,
      ...simWeights,
      ...lower95s,
      ...upper95s,
      report.latestWeight,
      targetWeightNum,
    ].filter((v) => !isNaN(v) && isFinite(v));

    const rawMinY = Math.min(...allY);
    const rawMaxY = Math.max(...allY);

    const paddingY = Math.max(0.6, (rawMaxY - rawMinY) * 0.12);
    const minY = Math.floor((rawMinY - paddingY) * 2) / 2;
    const maxY = Math.ceil((rawMaxY + paddingY) * 2) / 2;
    const ySpan = maxY - minY || 1;

    const getX = (ts: number) => {
      const frac = (ts - minTs) / timeSpan;
      return svgDimensions.padding.left + Math.max(0, Math.min(innerWidth, frac * innerWidth));
    };

    const getY = (val: number) => {
      const frac = (val - minY) / ySpan;
      return svgDimensions.padding.top + innerHeight - Math.max(0, Math.min(innerHeight, frac * innerHeight));
    };

    // Ticks para eje Y
    const yStep = ySpan > 12 ? 2 : ySpan > 6 ? 1 : 0.5;
    const yTicks: number[] = [];
    for (let w = minY; w <= maxY + 0.001; w += yStep) {
      yTicks.push(Math.round(w * 10) / 10);
    }

    // Ticks para eje X
    const xTicks: { ts: number; label: string }[] = [];
    const numXTicks = 6;
    for (let i = 0; i <= numXTicks; i++) {
      const ts = minTs + (timeSpan * i) / numXTicks;
      const d = new Date(ts);
      xTicks.push({
        ts,
        label: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
      });
    }

    return { getX, getY, minY, maxY, yTicks, xTicks, minTs, maxTs };
  }, [report, calibrationPoints, simulationData, targetWeightNum]);

  // Manejador del Hover en SVG con resolución geométrica exacta sin desfase
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !scales || !report || !simulationData) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const viewBoxWidth = svgDimensions.width;
    const viewBoxHeight = svgDimensions.height;
    const elemAspect = rect.width / rect.height;
    const viewBoxAspect = viewBoxWidth / viewBoxHeight;

    let scale: number;
    let offsetX = 0;
    let offsetY = 0;

    if (elemAspect > viewBoxAspect) {
      scale = rect.height / viewBoxHeight;
      offsetX = (rect.width - viewBoxWidth * scale) / 2;
    } else {
      scale = rect.width / viewBoxWidth;
      offsetY = (rect.height - viewBoxHeight * scale) / 2;
    }

    const svgX = (clientX - offsetX) / scale;
    const t0X = scales.getX(report.latestTimestamp);

    if (svgX <= t0X) {
      // Puntos previos a T0
      let closestPt = calibrationPoints[0];
      let minDiff = Math.abs(scales.getX(closestPt.timestamp) - svgX);
      for (let i = 1; i < calibrationPoints.length; i++) {
        const diff = Math.abs(scales.getX(calibrationPoints[i].timestamp) - svgX);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = calibrationPoints[i];
        }
      }

      const ptX = scales.getX(closestPt.timestamp);
      const ptY = scales.getY(closestPt.weight);
      const screenX = offsetX + ptX * scale;
      const diffFromLatest = Math.round((closestPt.weight - report.latestWeight) * 10) / 10;
      const daysAgo = Math.max(0, Math.round((report.latestTimestamp - closestPt.timestamp) / 86400000));

      setHoveredPoint({
        x: ptX,
        y: ptY,
        screenX,
        isHistorical: true,
        dateLabel: new Date(closestPt.timestamp).toLocaleDateString("es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        weight: closestPt.weight,
        diffFromLatest,
        daysAgoOrAhead: daysAgo,
      });
    } else {
      // Puntos proyectados (futuro)
      const timeline = simulationData.simulatedTimeline;
      if (timeline.length > 0) {
        let closestProj = timeline[0];
        let minDiff = Math.abs(scales.getX(closestProj.timestamp) - svgX);
        for (let i = 1; i < timeline.length; i++) {
          const diff = Math.abs(scales.getX(timeline[i].timestamp) - svgX);
          if (diff < minDiff) {
            minDiff = diff;
            closestProj = timeline[i];
          }
        }

        const projX = scales.getX(closestProj.timestamp);
        const activeVal = closestProj.simulatedWeight;
        const projY = scales.getY(activeVal);
        const screenX = offsetX + projX * scale;
        const diffFromLatest = Math.round((activeVal - report.latestWeight) * 10) / 10;
        const daysAhead = Math.max(0, Math.round((closestProj.timestamp - report.latestTimestamp) / 86400000));

        setHoveredPoint({
          x: projX,
          y: projY,
          screenX,
          isHistorical: false,
          dateLabel: closestProj.dateLabel,
          weight: activeVal,
          diffFromLatest,
          daysAgoOrAhead: daysAhead,
          lower95: closestProj.simulatedLower95,
          upper95: closestProj.simulatedUpper95,
          isSimulation: whatIfKcal !== 0,
        });
      }
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-[1440px] max-h-[95vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden z-10 text-zinc-100">
        
        {/* =========================================================================
            HEADER LIMPIO: CONTROLES HORIZONTALES SIN SOLAPAMIENTO
           ========================================================================= */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-800/90 bg-zinc-900/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent-light shrink-0">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                  Panel Unificado de Proyección & Decisión
                </h2>
                {activeSeasonName && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-accent/15 border border-accent/40 text-accent-light font-bold">
                    {activeSeasonName}
                  </span>
                )}
                {report && (
                  <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                    N={report.sampleCount} pesajes ({report.timeSpanDays}d)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Diagnóstico fisiológico, semáforo clínico, prescripción en kcal/día y simulación interactiva.
              </p>
            </div>
          </div>

          {/* Selectores de Ventana y Horizonte en fila horizontal estricta */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Ventana de calibración previa */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs shrink-0">
              <span className="text-zinc-400 font-mono text-[11px] uppercase font-semibold">Pesajes previos:</span>
              <select
                value={calibrationWindowDays}
                onChange={(e) => setCalibrationWindowDays(Number(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value={7} className="bg-zinc-900">Últimos 7 días</option>
                <option value={14} className="bg-zinc-900">Últimos 14 días</option>
                <option value={30} className="bg-zinc-900">Últimos 30 días</option>
                <option value={60} className="bg-zinc-900">Últimos 60 días</option>
                <option value={90} className="bg-zinc-900">Últimos 90 días</option>
                <option value={180} className="bg-zinc-900">Últimos 6 meses</option>
                <option value={365} className="bg-zinc-900">1 año completo</option>
                <option value={730} className="bg-zinc-900">2 años</option>
                <option value={99999} className="bg-zinc-900">Todo el historial</option>
              </select>
            </div>

            {/* Horizonte de proyección */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-accent/40 rounded-xl px-2.5 py-1.5 text-xs shrink-0">
              <CalendarIcon className="w-3.5 h-3.5 text-accent-light shrink-0" />
              <span className="text-accent-light font-mono text-[11px] uppercase font-semibold">Horizonte:</span>
              <select
                value={selectedHorizonId}
                onChange={(e) => setSelectedHorizonId(e.target.value as ProjectionHorizonId)}
                className="bg-transparent text-accent-light font-bold text-xs focus:outline-none cursor-pointer"
              >
                {HORIZON_PRESETS.map((h) => (
                  <option key={h.id} value={h.id} className="bg-zinc-900 text-zinc-200">
                    {h.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Cerrar */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
              title="Cerrar modal"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            CUERPO PRINCIPAL DEL MODAL
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {!report || !simulationData || !trafficLight ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <AlertTriangleIcon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-zinc-200">Datos Insuficientes para Proyección</h3>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                Se requieren al menos 2 pesajes registrados dentro de la ventana de calibración seleccionada.
              </p>
            </div>
          ) : (
            <>
              {/* 1. SEMÁFORO DEPORTIVO Y CLÍNICO & PRESCRIPCIÓN ACCIONABLE */}
              <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${trafficLight.badgeClass}`}
                    >
                      {trafficLight.status === "optimal" ? (
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                      ) : trafficLight.status === "aggressive" ? (
                        <AlertTriangleIcon className="w-3.5 h-3.5" />
                      ) : trafficLight.status === "diverging" ? (
                        <AlertTriangleIcon className="w-3.5 h-3.5" />
                      ) : (
                        <ActivityIcon className="w-3.5 h-3.5" />
                      )}
                      <span>{trafficLight.statusLabel}</span>
                    </span>

                    {/* Toggle Explicación Simple vs Compleja */}
                    <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px] font-medium">
                      <button
                        type="button"
                        onClick={() => setExplanationMode("simple")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          explanationMode === "simple"
                            ? "bg-zinc-800 text-zinc-100 font-bold"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Explicación Directa
                      </button>
                      <button
                        type="button"
                        onClick={() => setExplanationMode("technical")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          explanationMode === "technical"
                            ? "bg-zinc-800 text-zinc-100 font-bold"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Científica (NIH/Hall)
                      </button>
                    </div>
                  </div>

                  {/* Meta numérica con opción de ajuste rápido en el modal */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <TargetIcon className="w-3.5 h-3.5 text-accent-light" />
                      <span>Meta:</span>
                    </span>
                    <div className="flex items-center gap-1 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                      <input
                        type="number"
                        step="0.1"
                        value={userTargetWeight}
                        onChange={(e) => setUserTargetWeight(e.target.value)}
                        className="w-14 bg-transparent text-right font-mono font-bold text-zinc-100 focus:outline-none"
                      />
                      <span className="text-zinc-400 font-mono">kg</span>
                    </div>
                  </div>
                </div>

                {/* Texto del semáforo (Directo o Técnico) */}
                <div className="text-sm text-zinc-300 leading-relaxed p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  {explanationMode === "simple" ? (
                    <p>{trafficLight.simpleExplanation}</p>
                  ) : (
                    <p className="font-mono text-xs text-zinc-300">{trafficLight.technicalExplanation}</p>
                  )}
                </div>

                {/* Prescripción de Wishnofsky Accionable */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    <FlameIcon className="w-4 h-4 text-accent-light shrink-0" />
                    <span className="text-zinc-300">
                      Balance real implícito actual:{" "}
                      <strong className="text-zinc-100 font-mono">
                        {simulationData.simulatedNetKcalDaily > 0 ? "+" : ""}
                        {simulationData.simulatedNetKcalDaily} kcal/día
                      </strong>
                      {" · "}
                      {trafficLight.requiredKcalAdjustment !== 0 ? (
                        <>
                          Para ritmo recomendado hacia {targetWeightNum} kg ajusta:{" "}
                          <strong className="text-accent-light font-mono">
                            {trafficLight.requiredKcalAdjustment > 0 ? "+" : ""}
                            {trafficLight.requiredKcalAdjustment} kcal/día
                          </strong>
                          {" "}
                          (equivale a ~{Math.round(Math.abs(trafficLight.requiredKcalAdjustment) / 0.04)} pasos diarios).
                        </>
                      ) : (
                        "Ritmo calórico actualmente alineado con tu meta."
                      )}
                    </span>
                  </div>

                  {simulationData.simulatedArrivalDate && (
                    <div className="flex items-center gap-1.5 font-mono text-zinc-300 shrink-0">
                      <span className="text-zinc-500 font-sans">Llegada estimada:</span>
                      <strong className="text-accent-light font-bold">
                        {simulationData.simulatedArrivalDate}
                      </strong>
                      <span className="text-[11px] text-zinc-400">
                        (~{Math.round((simulationData.simulatedDaysToTarget || 0) / 7)} sem)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. SIMULADOR INTERACTIVO "WHAT-IF" */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ZapIcon className="w-4 h-4 text-accent-light" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      Simulador Interactivo "What-If" (¿Qué pasaría si...?)
                    </span>
                  </div>
                  {whatIfKcal !== 0 && (
                    <button
                      type="button"
                      onClick={() => setWhatIfKcal(0)}
                      className="flex items-center gap-1 text-[11px] text-accent-light hover:underline cursor-pointer"
                    >
                      <RefreshCwIcon className="w-3 h-3" />
                      <span>Restablecer a tendencia real (0 kcal)</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 w-16 text-right shrink-0">
                      -600 kcal
                    </span>
                    <input
                      type="range"
                      min={-600}
                      max={600}
                      step={25}
                      value={whatIfKcal}
                      onChange={(e) => setWhatIfKcal(Number(e.target.value))}
                      className="flex-1 accent-accent h-2 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-xs font-mono text-zinc-400 w-16 shrink-0">
                      +600 kcal
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0 font-mono text-xs">
                    <span className="text-zinc-400">Ajuste:</span>
                    <strong
                      className={
                        whatIfKcal < 0
                          ? "text-emerald-400 text-sm"
                          : whatIfKcal > 0
                          ? "text-sky-400 text-sm"
                          : "text-zinc-100 text-sm"
                      }
                    >
                      {whatIfKcal > 0 ? `+${whatIfKcal}` : whatIfKcal} kcal/día
                    </strong>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    {whatIfKcal === 0 ? (
                      "Mostrando proyección basada puramente en tu tendencia real."
                    ) : (
                      <>
                        Simulando un cambio de{" "}
                        <strong className="text-zinc-200 font-mono">
                          {whatIfKcal > 0 ? "+" : ""}{whatIfKcal} kcal/día
                        </strong>{" "}
                        ({whatIfKcal > 0 ? "+" : ""}{Math.round((whatIfKcal * 7 / 7700) * 100) / 100} kg/sem).
                        {simulationData.timeDeltaWeeks !== 0 && (
                          <strong className="text-accent-light ml-1 font-mono">
                            {simulationData.timeDeltaWeeks > 0
                              ? `¡Llegarías ~${simulationData.timeDeltaWeeks} semanas antes!`
                              : `Llegarías ~${Math.abs(simulationData.timeDeltaWeeks)} semanas después.`}
                          </strong>
                        )}
                      </>
                    )}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Nueva velocidad: {simulationData.simulatedSlopeWeekly > 0 ? "+" : ""}{simulationData.simulatedSlopeWeekly} kg/sem
                  </span>
                </div>
              </div>

              {/* 3. GRÁFICO MAESTRO UNIFICADO ("LÍNEA DE VIDA") */}
              <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800/90 bg-zinc-950 shadow-xl flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wide">
                      Gráfico Maestro Unificado: Pasado Real & Proyección
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 rounded-full bg-accent" />
                      <span>Pesajes reales</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 border-t-2 border-dashed border-accent-light" />
                      <span>Proyección {whatIfKcal !== 0 ? "(Simulada)" : ""}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-2.5 bg-accent/20 border border-accent/40 rounded-xs" />
                      <span>Incertidumbre (95%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 border-t border-dashed border-emerald-400" />
                      <span>Meta ({targetWeightNum} kg)</span>
                    </span>
                  </div>
                </div>

                {/* Contenedor SVG con crosshair */}
                <div ref={chartContainerRef} className="relative w-full overflow-hidden">
                  {scales && (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
                      className="w-full h-auto max-h-[440px] overflow-visible"
                      onMouseMove={handleSvgMouseMove}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="unifiedConeGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--accent-light, #fbbf24)" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>

                      {/* Eje Y Grids & Labels */}
                      {scales.yTicks.map((yVal) => {
                        const y = scales.getY(yVal);
                        return (
                          <g key={yVal}>
                            <line
                              x1={svgDimensions.padding.left}
                              y1={y}
                              x2={svgDimensions.width - svgDimensions.padding.right}
                              y2={y}
                              stroke="#27272a"
                              strokeWidth={1}
                              strokeDasharray="2 3"
                            />
                            <text
                              x={svgDimensions.padding.left - 10}
                              y={y + 4}
                              textAnchor="end"
                              className="text-xs fill-zinc-400 font-mono font-medium"
                            >
                              {yVal.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Eje X Grids & Labels */}
                      {scales.xTicks.map((xt, idx) => {
                        const x = scales.getX(xt.ts);
                        return (
                          <g key={idx}>
                            <line
                              x1={x}
                              y1={svgDimensions.padding.top}
                              x2={x}
                              y2={svgDimensions.height - svgDimensions.padding.bottom}
                              stroke="#27272a"
                              strokeWidth={1}
                              strokeDasharray="2 3"
                            />
                            <text
                              x={x}
                              y={svgDimensions.height - svgDimensions.padding.bottom + 18}
                              textAnchor="middle"
                              className="text-xs fill-zinc-400 font-mono"
                            >
                              {xt.label}
                            </text>
                          </g>
                        );
                      })}

                      {/* Línea horizontal de Peso Meta Objetivo */}
                      {(() => {
                        const targetY = scales.getY(targetWeightNum);
                        const isInside =
                          targetY >= svgDimensions.padding.top &&
                          targetY <= svgDimensions.height - svgDimensions.padding.bottom;
                        if (!isInside) return null;

                        return (
                          <g pointerEvents="none">
                            <line
                              x1={svgDimensions.padding.left}
                              y1={targetY}
                              x2={svgDimensions.width - svgDimensions.padding.right}
                              y2={targetY}
                              stroke="#10b981"
                              strokeWidth={1.75}
                              strokeDasharray="4 4"
                            />
                            <rect
                              x={svgDimensions.width - svgDimensions.padding.right + 4}
                              y={targetY - 10}
                              width={60}
                              height={18}
                              rx={4}
                              fill="#064e3b"
                              stroke="#059669"
                              strokeWidth={1}
                            />
                            <text
                              x={svgDimensions.width - svgDimensions.padding.right + 34}
                              y={targetY + 3}
                              textAnchor="middle"
                              className="text-[10px] font-mono font-bold fill-emerald-300"
                            >
                              {targetWeightNum.toFixed(1)} kg
                            </text>
                          </g>
                        );
                      })()}

                      {/* Área de Incertidumbre / Cono Estocástico al 95% */}
                      {(() => {
                        const timeline = simulationData.simulatedTimeline;
                        if (timeline.length < 2) return null;

                        const t0X = scales.getX(report.latestTimestamp);
                        const t0Y = scales.getY(report.latestWeight);

                        let upperPath = `M ${t0X.toFixed(1)} ${t0Y.toFixed(1)}`;
                        let lowerPath = "";

                        for (let i = 0; i < timeline.length; i++) {
                          const x = scales.getX(timeline[i].timestamp);
                          const yUp = scales.getY(timeline[i].simulatedUpper95);
                          const yLow = scales.getY(timeline[i].simulatedLower95);
                          upperPath += ` L ${x.toFixed(1)} ${yUp.toFixed(1)}`;
                          lowerPath = ` L ${x.toFixed(1)} ${yLow.toFixed(1)}` + lowerPath;
                        }

                        const coneSvgPath = upperPath + lowerPath + " Z";

                        return (
                          <path
                            d={coneSvgPath}
                            fill="url(#unifiedConeGradient)"
                            stroke="var(--accent, #f59e0b)"
                            strokeWidth={0.75}
                            strokeDasharray="2 2"
                            opacity={0.7}
                            pointerEvents="none"
                          />
                        );
                      })()}

                      {/* Curva Spline Cúbica Monótona Suave (Fritsch-Carlson) para Pesajes Previos */}
                      {(() => {
                        const histCurvePoints = calibrationPoints.map((p) => ({
                          x: scales.getX(p.timestamp),
                          y: scales.getY(p.weight),
                        }));
                        const splineD = buildSplinePath(histCurvePoints);

                        return (
                          <path
                            d={splineD}
                            fill="none"
                            stroke="var(--accent, #f59e0b)"
                            strokeWidth={2.75}
                            strokeLinecap="round"
                            pointerEvents="none"
                          />
                        );
                      })()}

                      {/* Curva Proyectada (con What-If integrado) */}
                      {(() => {
                        const projPoints = [
                          { x: scales.getX(report.latestTimestamp), y: scales.getY(report.latestWeight) },
                          ...simulationData.simulatedTimeline.map((p) => ({
                            x: scales.getX(p.timestamp),
                            y: scales.getY(p.simulatedWeight),
                          })),
                        ];
                        const projSplineD = buildSplinePath(projPoints);

                        return (
                          <path
                            d={projSplineD}
                            fill="none"
                            stroke="var(--accent-light, #fbbf24)"
                            strokeWidth={2.5}
                            strokeDasharray="5 4"
                            strokeLinecap="round"
                            pointerEvents="none"
                          />
                        );
                      })()}

                      {/* Puntos individuales de pesaje previo */}
                      {calibrationPoints.map((pt, idx) => {
                        const cx = scales.getX(pt.timestamp);
                        const cy = scales.getY(pt.weight);
                        const isHovered =
                          hoveredPoint?.isHistorical &&
                          Math.abs(hoveredPoint.x - cx) < 1;

                        return (
                          <g key={idx} pointerEvents="none">
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isHovered ? 5.5 : 3}
                              fill={isHovered ? "var(--accent-light, #fbbf24)" : "#ffffff"}
                              stroke="var(--accent, #f59e0b)"
                              strokeWidth={isHovered ? 2 : 1.5}
                              className="transition-all duration-150"
                            />
                          </g>
                        );
                      })}

                      {/* Baliza T0 (Momento Actual) */}
                      {(() => {
                        const t0X = scales.getX(report.latestTimestamp);
                        const t0Y = scales.getY(report.latestWeight);

                        return (
                          <g pointerEvents="none">
                            <line
                              x1={t0X}
                              y1={svgDimensions.padding.top}
                              x2={t0X}
                              y2={svgDimensions.height - svgDimensions.padding.bottom}
                              stroke="#52525b"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                            />
                            <circle cx={t0X} cy={t0Y} r={11} fill="var(--accent, #f59e0b)" opacity={0.25} />
                            <circle cx={t0X} cy={t0Y} r={5} fill="var(--accent-light, #fbbf24)" stroke="#ffffff" strokeWidth={2} />
                          </g>
                        );
                      })()}

                      {/* Crosshair en Hover */}
                      {hoveredPoint && (
                        <g pointerEvents="none">
                          <line
                            x1={hoveredPoint.x}
                            y1={svgDimensions.padding.top}
                            x2={hoveredPoint.x}
                            y2={svgDimensions.height - svgDimensions.padding.bottom}
                            stroke="var(--accent-light, #fbbf24)"
                            strokeWidth={1.25}
                            strokeDasharray="3 2"
                            opacity={0.8}
                          />
                          <line
                            x1={svgDimensions.padding.left}
                            y1={hoveredPoint.y}
                            x2={svgDimensions.width - svgDimensions.padding.right}
                            y2={hoveredPoint.y}
                            stroke="var(--accent-light, #fbbf24)"
                            strokeWidth={1.25}
                            strokeDasharray="3 2"
                            opacity={0.8}
                          />
                          <circle
                            cx={hoveredPoint.x}
                            cy={hoveredPoint.y}
                            r={6}
                            fill="#ffffff"
                            stroke="var(--accent, #f59e0b)"
                            strokeWidth={2.5}
                          />
                        </g>
                      )}
                    </svg>
                  )}

                  {/* Tooltip flotante */}
                  {hoveredPoint && (
                    <div
                      className="absolute top-2 z-20 pointer-events-none p-2.5 rounded-xl bg-zinc-950/95 border border-zinc-700 shadow-2xl text-xs font-mono space-y-1 backdrop-blur-md"
                      style={{
                        left: `${Math.max(10, Math.min(window.innerWidth - 240, hoveredPoint.screenX - 70))}px`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 text-zinc-400 border-b border-zinc-800 pb-1">
                        <span className="font-semibold text-zinc-200">{hoveredPoint.dateLabel}</span>
                        <span className="text-[10px]">
                          {hoveredPoint.isHistorical
                            ? hoveredPoint.daysAgoOrAhead === 0
                              ? "Hoy (T₀)"
                              : `hace ${hoveredPoint.daysAgoOrAhead}d`
                            : `en ${hoveredPoint.daysAgoOrAhead}d`}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-zinc-400 font-sans">
                          {hoveredPoint.isHistorical ? "Peso medido:" : "Proyección:"}
                        </span>
                        <strong className="text-sm text-accent-light font-bold">
                          {hoveredPoint.weight.toFixed(1)} kg
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-400">
                        <span>Dif. respecto a hoy:</span>
                        <span
                          className={
                            hoveredPoint.diffFromLatest > 0
                              ? "text-sky-400"
                              : hoveredPoint.diffFromLatest < 0
                              ? "text-emerald-400"
                              : "text-zinc-300"
                          }
                        >
                          {hoveredPoint.diffFromLatest > 0 ? `+${hoveredPoint.diffFromLatest}` : hoveredPoint.diffFromLatest} kg
                        </span>
                      </div>
                      {!hoveredPoint.isHistorical && hoveredPoint.lower95 !== undefined && (
                        <div className="text-[10px] text-zinc-500 pt-0.5 border-t border-zinc-850">
                          Rango (95%): {hoveredPoint.lower95.toFixed(1)} - {hoveredPoint.upper95?.toFixed(1)} kg
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. RIBBON DE TELEMETRÍA FISIOLÓGICA & MÉTRICAS CLAVE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* 1. Velocidad (dW/dt) */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
                    <ActivityIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Velocidad (dW/dt)</span>
                  </span>
                  <div className="mt-1.5">
                    <span
                      className={`text-xl font-bold font-mono ${
                        simulationData.simulatedSlopeWeekly < 0
                          ? "text-emerald-400"
                          : simulationData.simulatedSlopeWeekly > 0
                          ? "text-amber-400"
                          : "text-zinc-200"
                      }`}
                    >
                      {simulationData.simulatedSlopeWeekly > 0
                        ? `+${simulationData.simulatedSlopeWeekly}`
                        : simulationData.simulatedSlopeWeekly}{" "}
                      <span className="text-xs font-normal text-zinc-400">kg/sem</span>
                    </span>
                    <span className="block text-[11px] text-zinc-400 font-mono mt-0.5">
                      {Math.round(simulationData.simulatedSlopeDaily * 1000)} g/día
                    </span>
                  </div>
                </div>

                {/* 2. Balance Calórico Implícito */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
                    <FlameIcon className="w-3.5 h-3.5 text-accent-light" />
                    <span>Balance Termodinámico</span>
                  </span>
                  <div className="mt-1.5">
                    <span className="text-xl font-bold font-mono text-accent-light">
                      {simulationData.simulatedNetKcalDaily > 0 ? `+${simulationData.simulatedNetKcalDaily}` : simulationData.simulatedNetKcalDaily}{" "}
                      <span className="text-xs font-normal text-zinc-400">kcal/d</span>
                    </span>
                    <span className="block text-[11px] text-zinc-400 font-mono mt-0.5">
                      Wishnofsky (7.700 kcal/kg)
                    </span>
                  </div>
                </div>

                {/* 3. Aceleración (d2W/dt2) */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">
                    Aceleración (d²W/dt²)
                  </span>
                  <div className="mt-1.5">
                    <span className="text-xl font-bold font-mono text-zinc-100">
                      {report.metabolic.currentDeceleration > 0 ? `+${report.metabolic.currentDeceleration}` : report.metabolic.currentDeceleration}{" "}
                      <span className="text-xs font-normal text-zinc-400">g/d²</span>
                    </span>
                    <span className="block text-[11px] text-zinc-400 truncate mt-0.5">
                      {report.metabolic.hasPlateauTendency ? "Freno adaptativo detectado" : "Ritmo cinemático sostenido"}
                    </span>
                  </div>
                </div>

                {/* 4. Meta & Tiempo Estimado */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
                    <TargetIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Meta Objetivo</span>
                  </span>
                  <div className="mt-1.5">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {targetWeightNum.toFixed(1)}{" "}
                      <span className="text-xs font-normal text-zinc-400">kg</span>
                    </span>
                    <span className="block text-[11px] text-zinc-400 truncate mt-0.5">
                      {simulationData.simulatedArrivalDate
                        ? `Llegada: ${simulationData.simulatedArrivalDate}`
                        : simulationData.isSimulatedDiverging
                        ? "Divergente (ajustar)"
                        : "En equilibrio"}
                    </span>
                  </div>
                </div>

                {/* 5. Ruido Biológico (RMSE) */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between col-span-2 sm:col-span-1">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">
                    Ruido Biológico (RMSE)
                  </span>
                  <div className="mt-1.5">
                    <span className="text-xl font-bold font-mono text-zinc-100">
                      ±{report.linear.rmse.toFixed(2)}{" "}
                      <span className="text-xs font-normal text-zinc-400">kg</span>
                    </span>
                    <span className="block text-[11px] text-zinc-400 font-mono mt-0.5">
                      R²={report.linear.r2.toFixed(2)} (Filtro Kalman)
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. PANEL PLEGABLE: DETALLES DE MODELADO CIENTÍFICO PROFUNDO */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMathDetails(!showMathDetails)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-zinc-850/40 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <InfoIcon className="w-4 h-4 text-accent-light" />
                    <span>Ver Fundamentos Matemáticos y Parámetros del Motor (NIH / Hall / Wishnofsky)</span>
                  </span>
                  <ChevronDownIcon
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      showMathDetails ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showMathDetails && (
                  <div className="p-5 border-t border-zinc-800/80 space-y-4 text-xs text-zinc-400 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. Kevin Hall Dynamics */}
                      <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                        <strong className="text-zinc-200 block text-xs">1. Modelo Metabólico de Kevin Hall (NIH)</strong>
                        <p className="leading-relaxed">
                          Resuelve la ecuación diferencial de relajación de primer orden:{" "}
                          <span className="font-mono text-accent-light font-semibold">dW/dt = -k(W - W∞)</span>.
                        </p>
                        <p className="font-mono text-zinc-400 text-[11px]">
                          Constante k = {report.metabolic.rateConstantK} d⁻¹ (Vida media t½ = {report.metabolic.halfLifeDays} días).
                        </p>
                      </div>

                      {/* 2. Wishnofsky First Principles */}
                      <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                        <strong className="text-zinc-200 block text-xs">2. Termodinámica de Wishnofsky</strong>
                        <p className="leading-relaxed">
                          Aplica la densidad energética de tejido mixto humano (<span className="font-mono text-accent-light">κ ≈ 7.700 kcal/kg</span>) sobre la derivada temporal:{" "}
                          <span className="font-mono text-zinc-300">ΔE = κ · (dW/dt)</span>.
                        </p>
                        <p className="font-mono text-zinc-400 text-[11px]">
                          Margen de confianza al 95%: ±{report.thermodynamics.confidenceKcalMargin} kcal/día.
                        </p>
                      </div>

                      {/* 3. Monte Carlo Simulation */}
                      <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                        <strong className="text-zinc-200 block text-xs">3. Distribución Monte Carlo (1.000 iteraciones)</strong>
                        <p className="leading-relaxed">
                          Propaga la incertidumbre del ruido hídrico mediante remuestreo estocástico:
                        </p>
                        <p className="font-mono text-zinc-400 text-[11px]">
                          P10={report.monteCarlo.finalP10.toFixed(1)} kg · P50={report.monteCarlo.finalP50.toFixed(1)} kg · P90={report.monteCarlo.finalP90.toFixed(1)} kg.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
