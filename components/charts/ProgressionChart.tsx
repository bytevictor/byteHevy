"use client";

import React, { useState, useEffect, useMemo, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MaximizeIcon,
  XIcon,
  CalendarIcon,
  TrophyIcon,
  CrownIcon,
} from "../Icons";
import { hexToRgba } from "@/lib/season-colors";

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  primaryValue: number;      // Top set (kg, reps o segundos)
  secondaryValue?: number;    // 1RM estimado (opcional)
  label?: string;             // ej: "70 kg × 8"
  isPR?: boolean;             // Insignia de récord
  isAllTimePR?: boolean;      // Insignia de récord histórico absoluto
  workoutTitle?: string;
  workoutId?: string;
  avgReps?: number;           // Media de repeticiones de la sesión
  totalVolume?: number;       // Volumen total (tonelaje o reps acumuladas)
  topWeight?: number;         // Peso de la serie máxima
  topReps?: number;           // Reps de la serie máxima
  setsCount?: number;         // Número de series
  est1RM?: number;            // 1RM estimado (top set)
  avg1RM?: number;            // 1RM estimado medio de las series
}

export type ChartMode = "session" | "date";
export type CurveType = "linear" | "smooth" | "flow";
export type ChartMetricView = "top_set" | "avg_1rm";

export interface ProgressionChartProps {
  data: ChartDataPoint[];
  unit: string;
  metricName?: string;
  secondaryMetricName?: string;
  showSecondaryLine?: boolean;
  height?: number;
  mode?: ChartMode;
  defaultMode?: ChartMode;
  onModeChange?: (mode: ChartMode) => void;
  curveType?: CurveType;
  defaultCurveType?: CurveType;
  onCurveTypeChange?: (curveType: CurveType) => void;
  onPointClick?: (point: ChartDataPoint) => void;
  exerciseName?: string;
  metricType?: string;
  seasonName?: string;
  seasonColor?: string;
  allTimeBestLabel?: string;
  seasonBestLabel?: string;
}

const SPANISH_MONTHS: Record<string, number> = {
  ene: 0, enero: 0,
  feb: 1, febrero: 1,
  mar: 2, marzo: 2,
  abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5,
  jul: 6, julio: 6,
  ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8,
  oct: 9, octubre: 9,
  nov: 10, noviembre: 10,
  dic: 11, diciembre: 11,
};

function parseSpanishDateString(str: string): number {
  if (!str) return 0;
  const match = str.trim().match(/^(\d{1,2})\s+([a-zA-Záéíóú]+)\.?\s+(\d{4})(?:,\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return 0;
  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  const year = parseInt(match[3], 10);
  const hour = match[4] ? parseInt(match[4], 10) : 12;
  const minute = match[5] ? parseInt(match[5], 10) : 0;
  const month = SPANISH_MONTHS[monthStr] ?? 0;
  return new Date(year, month, day, hour, minute).getTime();
}

function getTimestampMs(d: ChartDataPoint): number {
  if (typeof d.timestamp === "number" && !isNaN(d.timestamp) && d.timestamp > 0) {
    return d.timestamp < 1e11 ? d.timestamp * 1000 : d.timestamp;
  }
  if (d.date) {
    const parsed = parseSpanishDateString(d.date);
    if (parsed > 0) return parsed;
    const native = Date.parse(d.date);
    if (!isNaN(native) && native > 0) return native;
  }
  return 0;
}

function formatAxisDate(ts: number, spanDays: number): string {
  const d = new Date(ts);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  if (spanDays > 450) {
    return `${month} ${year}`;
  }
  return `${day} ${month}`;
}

function formatDurationSpan(ms: number): string {
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days} d`;
  const months = Math.floor(days / 30.4375);
  const remainingDays = Math.round(days - months * 30.4375);
  if (months < 12) {
    return remainingDays > 3 ? `${months}m ${remainingDays}d` : `${months} meses`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}a ${remMonths}m` : `${years} ${years === 1 ? "año" : "años"}`;
}

/**
 * Builds an SVG path string:
 * - "linear": Straight segments with sharp peaks between points.
 * - "smooth": Monotone Cubic Spline (Fritsch-Carlson) without overshoot.
 * - "flow": Ultra-smooth Catmull-Rom spline with rounded continuous sweeps.
 */
function buildPath(
  points: { x: number; y: number }[],
  curveType: CurveType,
  minY = 20,
  maxY = 300
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2 || curveType === "linear") {
    return points.reduce((acc, curr, i) => {
      return i === 0
        ? `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
        : `${acc} L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }, "");
  }

  if (curveType === "flow") {
    const n = points.length;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    const tension = 0.4;

    for (let i = 0; i < n - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < n - 2 ? points[i + 2] : p2;

      const spanX = p2.x - p1.x;
      if (spanX <= 0) {
        d += ` L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        continue;
      }

      const cp1x = p1.x + spanX * tension;
      const cp1y = Math.max(minY, Math.min(maxY, p1.y + (p2.y - p0.y) * tension * 0.5));

      const cp2x = p2.x - spanX * tension;
      const cp2y = Math.max(minY, Math.min(maxY, p2.y - (p3.y - p1.y) * tension * 0.5));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  // "smooth" - Monotone cubic spline (Fritsch-Carlson)
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
      tangents.push((3 * common) / ((common + dx1) / m0 + (common + dx0) / m1));
    }
  }
  tangents.push(ms[ms.length - 1]);

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p0.x + dx / 3;
    const cp1y = Math.max(minY, Math.min(maxY, p0.y + (tangents[i] * dx) / 3));
    const cp2x = p1.x - dx / 3;
    const cp2y = Math.max(minY, Math.min(maxY, p1.y - (tangents[i + 1] * dx) / 3));
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return d;
}

function SessionModeIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2.5" y1="4" x2="2.5" y2="12" />
      <line x1="7.5" y1="4" x2="7.5" y2="12" />
      <line x1="12.5" y1="4" x2="12.5" y2="12" />
      <circle cx="2.5" cy="4" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="4" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="4" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DateModeIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10.5" rx="2" />
      <path d="M2 6.5h12M5 1.5v2.5M11 1.5v2.5" />
    </svg>
  );
}

function LinearLineIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13L6 5L10 10L14 3" />
      <circle cx="6" cy="5" r="1.1" fill="currentColor" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" />
    </svg>
  );
}

function SmoothLineIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C4.5 12 5.5 4 8 4C10.5 4 11.5 12 14 12" />
      <circle cx="8" cy="4" r="1.2" fill="currentColor" />
    </svg>
  );
}

function FlowLineIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12C3.5 12 4.5 4 8 4C11.5 4 12.5 12 14.5 12" />
    </svg>
  );
}

export function ProgressionChart({
  data,
  unit,
  metricName = "Carga Top",
  secondaryMetricName = "1RM Est.",
  showSecondaryLine = false,
  height = 240,
  mode: controlledMode,
  defaultMode = "session",
  onModeChange,
  curveType: controlledCurve,
  defaultCurveType = "smooth",
  onCurveTypeChange,
  onPointClick,
  exerciseName,
  metricType,
  seasonName,
  seasonColor,
  allTimeBestLabel,
  seasonBestLabel,
}: ProgressionChartProps) {
  const [internalMode, setInternalMode] = useState<ChartMode>(defaultMode);
  const [internalCurve, setInternalCurve] = useState<CurveType>(defaultCurveType);
  const [internalMetric, setInternalMetric] = useState<ChartMetricView>("top_set");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [modalHoverIndex, setModalHoverIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowHeight, setWindowHeight] = useState(700);
  const [mounted, setMounted] = useState(false);

  const inlineGradientId = useId();
  const modalGradientId = useId();

  // Load preferences safely on client
  useEffect(() => {
    setMounted(true);
    if (controlledMode === undefined) {
      try {
        const savedMode = localStorage.getItem("bytehevy_progression_mode");
        if (savedMode === "session" || savedMode === "date") {
          setInternalMode(savedMode);
        }
      } catch {}
    }

    if (controlledCurve === undefined) {
      try {
        const savedCurve = localStorage.getItem("bytehevy_progression_curve");
        if (savedCurve === "linear" || savedCurve === "smooth" || savedCurve === "flow") {
          setInternalCurve(savedCurve);
        }
      } catch {}
    }

    try {
      const savedMetric = localStorage.getItem("bytehevy_chart_metric") as ChartMetricView;
      if (savedMetric && (savedMetric === "top_set" || savedMetric === "avg_1rm")) {
        setInternalMetric(savedMetric);
      }
    } catch {}

    if (typeof window !== "undefined") {
      setWindowHeight(window.innerHeight);
      const handleResize = () => setWindowHeight(window.innerHeight);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [controlledMode, controlledCurve]);

  // Lock body scroll and handle Escape key to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const activeMode = controlledMode ?? internalMode;
  const activeCurve = controlledCurve ?? internalCurve;

  const handleModeChange = (newMode: ChartMode) => {
    if (controlledMode === undefined) {
      setInternalMode(newMode);
    }
    try {
      localStorage.setItem("bytehevy_progression_mode", newMode);
    } catch {}
    onModeChange?.(newMode);
  };

  const handleCurveChange = (newCurve: CurveType) => {
    if (controlledCurve === undefined) {
      setInternalCurve(newCurve);
    }
    try {
      localStorage.setItem("bytehevy_progression_curve", newCurve);
    } catch {}
    onCurveTypeChange?.(newCurve);
  };

  const handleMetricChange = (newMetric: ChartMetricView) => {
    setInternalMetric(newMetric);
    try {
      localStorage.setItem("bytehevy_chart_metric", newMetric);
    } catch {}
  };

  // Ensure items are ordered by chronological timestamp
  const parsedData = useMemo(() => {
    if (!data) return [];
    return [...data]
      .map((d) => ({
        ...d,
        _timestampMs: getTimestampMs(d),
      }))
      .sort((a, b) => a._timestampMs - b._timestampMs);
  }, [data]);

  const isWeightMetric = useMemo(() => {
    return (
      unit === "kg" ||
      unit.includes("kg") ||
      metricType === "weight_reps" ||
      metricType === "weighted_bodyweight"
    );
  }, [unit, metricType]);

  const isRepsMetric = useMemo(() => {
    return unit === "reps" || metricType === "bodyweight_reps";
  }, [unit, metricType]);

  // Metric selector options tailored to exercise unit (Peso Máximo vs 1RM Medio)
  const availableMetrics = useMemo(() => {
    if (isWeightMetric) {
      return [
        {
          id: "top_set" as const,
          label: "Peso Máximo",
          title: "Peso máximo levantado en la sesión (Top Set en kg)",
        },
        {
          id: "avg_1rm" as const,
          label: "1RM Medio",
          title: "Estimación media de 1RM a lo largo de las series de la sesión (Epley)",
        },
      ];
    }
    if (isRepsMetric) {
      return [
        {
          id: "top_set" as const,
          label: "Reps Máx",
          title: "Repeticiones de la mejor serie",
        },
        {
          id: "avg_1rm" as const,
          label: "Reps Medias",
          title: "Media de repeticiones por serie realizada",
        },
      ];
    }
    return [
      { id: "top_set" as const, label: "Máximo", title: "Valor máximo alcanzado en la sesión" },
    ];
  }, [isWeightMetric, isRepsMetric]);

  const activeMetric: ChartMetricView = useMemo(() => {
    if (internalMetric === "avg_1rm" && !isWeightMetric && !isRepsMetric) return "top_set";
    return internalMetric;
  }, [internalMetric, isWeightMetric, isRepsMetric]);

  const currentUnit = useMemo(() => {
    if (activeMetric === "avg_1rm") {
      return isRepsMetric ? "reps" : (unit.includes("kg") ? unit : "kg");
    }
    return unit;
  }, [activeMetric, isRepsMetric, unit]);

  const currentMetricName = useMemo(() => {
    if (activeMetric === "avg_1rm") {
      return isRepsMetric ? "Media de Reps / Serie" : "1RM Medio Estimado";
    }
    return isWeightMetric ? "Peso Máximo" : metricName;
  }, [activeMetric, isWeightMetric, isRepsMetric, metricName]);

  const getPointValue = useCallback((d: ChartDataPoint): number => {
    if (activeMetric === "avg_1rm") {
      if (isRepsMetric) {
        if (typeof d.avgReps === "number" && !isNaN(d.avgReps)) return d.avgReps;
        return d.primaryValue;
      }
      if (typeof d.avg1RM === "number" && !isNaN(d.avg1RM) && d.avg1RM > 0) return d.avg1RM;
      if (typeof d.est1RM === "number" && !isNaN(d.est1RM) && d.est1RM > 0) return d.est1RM;
      return d.primaryValue;
    }
    return d.primaryValue;
  }, [activeMetric, isRepsMetric]);

  // Pre-calculate progressive PRs and all-time records for the active metric
  const pointMetricsMeta = useMemo(() => {
    let runningBest = -Infinity;
    const allTimeBestVal = parsedData.length > 0 ? Math.max(...parsedData.map((d) => getPointValue(d))) : 0;

    return parsedData.map((d) => {
      const val = getPointValue(d);
      if (activeMetric === "top_set") {
        return {
          val,
          isPR: !!d.isPR,
          isAllTimePR: !!d.isAllTimePR,
        };
      }
      const isPR = val > runningBest && val > 0;
      if (isPR) {
        runningBest = val;
      }
      const isAllTimePR = val >= allTimeBestVal && val > 0 && allTimeBestVal > 0;
      return {
        val,
        isPR,
        isAllTimePR,
      };
    });
  }, [parsedData, activeMetric, getPointValue]);

  // Global KPIs across period
  const kpis = useMemo(() => {
    if (parsedData.length === 0) return null;
    const firstPt = parsedData[0];
    const lastPt = parsedData[parsedData.length - 1];
    let peakIdx = 0;
    let maxVal = -Infinity;

    pointMetricsMeta.forEach((m, idx) => {
      if (m.val > maxVal) {
        maxVal = m.val;
        peakIdx = idx;
      }
    });

    const peakPt = parsedData[peakIdx];
    const firstVal = pointMetricsMeta[0]?.val ?? 0;
    const lastVal = pointMetricsMeta[pointMetricsMeta.length - 1]?.val ?? 0;
    const diff = Number((lastVal - firstVal).toFixed(1));
    const diffPct = firstVal !== 0 ? Math.round((diff / Math.abs(firstVal)) * 100) : 0;

    const repsList = parsedData.map((d) => d.avgReps).filter((r): r is number => typeof r === "number" && r > 0);
    const globalAvgReps = repsList.length > 0 ? (repsList.reduce((a, b) => a + b, 0) / repsList.length).toFixed(1) : null;

    const totalVolumeSum = parsedData.reduce((acc, d) => acc + (d.totalVolume || 0), 0);

    return {
      firstPt,
      lastPt,
      peakPt,
      firstVal,
      lastVal,
      peakVal: maxVal,
      diff,
      diffPct,
      globalAvgReps,
      totalVolumeSum,
    };
  }, [parsedData, pointMetricsMeta]);

  if (!parsedData || parsedData.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center border border-zinc-900 bg-zinc-950/40 rounded-lg text-zinc-500 font-mono text-xs"
        style={{ height }}
      >
        No hay suficientes datos de progresión
      </div>
    );
  }

  // Time range calculation for date mode
  const validTimestamps = parsedData
    .map((d) => d._timestampMs)
    .filter((t) => t > 0);

  const minTime = validTimestamps.length > 0 ? Math.min(...validTimestamps) : 0;
  const maxTime = validTimestamps.length > 0 ? Math.max(...validTimestamps) : 0;
  const timeSpan = maxTime - minTime;
  const spanDays = Math.max(1, Math.round(timeSpan / (1000 * 60 * 60 * 24)));

  // Calculate min & max values for Y Axis
  const allValues: number[] = [];
  parsedData.forEach((d, idx) => {
    const val = pointMetricsMeta[idx]?.val ?? getPointValue(d);
    if (typeof val === "number" && !isNaN(val)) {
      allValues.push(val);
    }
    if (activeMetric === "top_set" && showSecondaryLine && typeof d.secondaryValue === "number" && !isNaN(d.secondaryValue)) {
      allValues.push(d.secondaryValue);
    }
  });

  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 10;
  const minValue = rawMin < 0 ? Math.floor(rawMin * 1.1) : Math.max(0, Math.floor(rawMin * 0.9));
  const maxValue = Math.ceil(rawMax * 1.1) || 10;
  const valueRange = maxValue - minValue || 1;

  // Grid steps (4 horizontal lines)
  const gridSteps = [0, 0.33, 0.66, 1];

  // Helper to build and render SVG chart with dynamic dimensions
  const renderChartSvg = (
    svgW: number,
    svgH: number,
    activeHoverIdx: number | null,
    onHoverChange: (idx: number | null) => void,
    gradId: string,
    isModalView = false
  ) => {
    const padL = isModalView ? 55 : 45;
    const padR = isModalView ? 35 : 25;
    const padT = isModalView ? 30 : 25;
    const padB = isModalView ? 40 : 35;
    const cW = svgW - padL - padR;
    const cH = svgH - padT - padB;

    const getXCoord = (index: number) => {
      if (parsedData.length <= 1) return padL + cW / 2;
      if (activeMode === "date" && timeSpan > 0) {
        const t = parsedData[index]._timestampMs;
        if (t > 0) {
          const normalized = (t - minTime) / timeSpan;
          return padL + normalized * cW;
        }
      }
      return padL + (index / (parsedData.length - 1)) * cW;
    };

    const getYCoord = (val: number) => {
      const clamped = Math.max(minValue, Math.min(maxValue, val));
      const normalized = (clamped - minValue) / valueRange;
      return padT + cH - normalized * cH;
    };

    const primaryPts = parsedData.map((d, i) => {
      const meta = pointMetricsMeta[i];
      return {
        x: getXCoord(i),
        y: getYCoord(meta?.val ?? getPointValue(d)),
        d,
        index: i,
        val: meta?.val ?? getPointValue(d),
        isPR: meta?.isPR ?? false,
        isAllTimePR: meta?.isAllTimePR ?? false,
      };
    });

    const primaryD = buildPath(primaryPts, activeCurve, padT, padT + cH);
    const areaD = primaryPts.length > 0
      ? `${primaryD} L ${primaryPts[primaryPts.length - 1].x} ${padT + cH} L ${primaryPts[0].x} ${padT + cH} Z`
      : "";

    // Secondary line (1RM) in top_set mode
    const hasSec = activeMetric === "top_set" && parsedData.some((d) => typeof d.secondaryValue === "number" && d.secondaryValue > 0);
    const secondaryPts = hasSec
      ? parsedData.map((d, i) => ({
          x: getXCoord(i),
          y: d.secondaryValue ? getYCoord(d.secondaryValue) : getYCoord(d.primaryValue),
        }))
      : [];
    const secD = hasSec ? buildPath(secondaryPts, activeCurve, padT, padT + cH) : "";

    // Intermediate date ticks for date mode
    const dTicks = activeMode === "date" && timeSpan > 0
      ? [0.25, 0.5, 0.75].map((fraction) => {
          const tickTime = minTime + fraction * timeSpan;
          const x = padL + fraction * cW;
          const label = formatAxisDate(tickTime, spanDays);
          return { x, label, fraction };
        })
      : [];

    const activePt = activeHoverIdx !== null && activeHoverIdx >= 0 && activeHoverIdx < primaryPts.length
      ? primaryPts[activeHoverIdx]
      : null;

    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || primaryPts.length === 0) return;

      const mouseX = ((e.clientX - rect.left) / rect.width) * svgW;
      const mouseY = ((e.clientY - rect.top) / rect.height) * svgH;

      if (mouseX < padL - 25 || mouseX > svgW - padR + 25) {
        onHoverChange(null);
        return;
      }

      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < primaryPts.length; i++) {
        const pt = primaryPts[i];
        const dx = pt.x - mouseX;
        const dy = (pt.y - mouseY) * 0.35;
        const dist = dx * dx + dy * dy;
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      onHoverChange(closestIdx);
    };

    return (
      <div className="relative w-full rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-1.5 sm:p-2 backdrop-blur-sm">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full overflow-visible"
          style={{ height: svgH }}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => onHoverChange(null)}
          onClick={() => {
            if (activePt) {
              onPointClick?.(activePt.d);
            }
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity={activeCurve === "flow" ? "0.22" : "0.18"} />
              <stop offset="100%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis labels */}
          {gridSteps.map((step, idx) => {
            const val = Math.round(minValue + step * valueRange);
            const yPos = padT + cH - step * cH;
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={yPos}
                  x2={svgW - padR}
                  y2={yPos}
                  stroke="#27272a"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                <text
                  x={padL - 8}
                  y={yPos + 3}
                  textAnchor="end"
                  className="text-[9px] fill-zinc-500 font-mono font-medium"
                >
                  {val.toLocaleString()}
                  {idx === gridSteps.length - 1 ? ` ${currentUnit}` : ""}
                </text>
              </g>
            );
          })}

          {/* Zero reference line for bodyweight baseline (0 kg) when spanning negative and positive */}
          {activeMetric === "top_set" && minValue < 0 && maxValue > 0 && (
            <g>
              <line
                x1={padL}
                y1={getYCoord(0)}
                x2={svgW - padR}
                y2={getYCoord(0)}
                stroke="#52525b"
                strokeWidth="1.25"
                strokeDasharray="4,4"
              />
              <text
                x={padL + 6}
                y={getYCoord(0) - 4}
                textAnchor="start"
                className="text-[9px] fill-zinc-400 font-mono font-medium"
              >
                BW (0 kg)
              </text>
            </g>
          )}

          {/* Date mode vertical timeline guide lines */}
          {activeMode === "date" && dTicks.map((tick) => (
            <line
              key={`grid-line-${tick.fraction}`}
              x1={tick.x}
              y1={padT}
              x2={tick.x}
              y2={padT + cH}
              stroke="#27272a"
              strokeWidth="1"
              strokeDasharray="2,3"
              opacity="0.8"
            />
          ))}

          {/* Area fill under primary curve */}
          {areaD && (
            <path d={areaD} fill={`url(#${gradId})`} />
          )}

          {/* Secondary dashed curve (1RM) in top_set mode */}
          {showSecondaryLine && hasSec && secD && (
            <path
              d={secD}
              fill="none"
              stroke="#71717a"
              strokeWidth={activeCurve === "flow" ? "1.75" : "1.5"}
              strokeDasharray="3,3"
              strokeLinecap="round"
            />
          )}

          {/* Primary curve */}
          {primaryD && (
            <path
              d={primaryD}
              fill="none"
              stroke="var(--accent, #f59e0b)"
              strokeWidth={activeCurve === "flow" ? "2.5" : "2"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points on curve */}
          {primaryPts.map((pt) => {
            const isHovered = activeHoverIdx === pt.index;
            const showPoint = activeCurve !== "flow" || isHovered;
            if (!showPoint) return null;

            return (
              <g key={pt.index}>
                {pt.isAllTimePR ? (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 8.5 : 6.5}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    className="transition-all duration-200 animate-pulse"
                  />
                ) : pt.isPR ? (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7.5 : 5.5}
                    fill="none"
                    stroke="var(--accent, #f59e0b)"
                    strokeWidth="1.5"
                    className="transition-all duration-200 animate-pulse"
                  />
                ) : null}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : pt.isAllTimePR ? 4.5 : pt.isPR ? 3.5 : 2.5}
                  fill={pt.isAllTimePR ? "#fbbf24" : pt.isPR ? "var(--accent, #f59e0b)" : "#18181b"}
                  stroke={pt.isAllTimePR ? "#fef08a" : pt.isPR ? "var(--accent-lighter, #fef3c7)" : "var(--accent, #f59e0b)"}
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => onHoverChange(pt.index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHoverChange(pt.index);
                    onPointClick?.(pt.d);
                  }}
                />
              </g>
            );
          })}

          {/* Hover Crosshair Vertical Line */}
          {activePt && (
            <line
              x1={activePt.x}
              y1={padT}
              x2={activePt.x}
              y2={padT + cH}
              stroke="#52525b"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          )}

          {/* X Axis First & Last Dates */}
          {parsedData.length > 0 && (
            <>
              <text
                x={padL}
                y={svgH - 8}
                textAnchor="start"
                className="text-[9px] fill-zinc-500 font-mono"
              >
                {parsedData[0].date.split(",")[0]}
              </text>

              {/* Intermediate Date Ticks in Date Mode */}
              {activeMode === "date" && dTicks.map((tick) => (
                <text
                  key={`lbl-${tick.fraction}`}
                  x={tick.x}
                  y={svgH - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-500 font-mono"
                >
                  {tick.label}
                </text>
              ))}

              {/* Intermediate Session Tick in Session Mode */}
              {activeMode === "session" && parsedData.length >= 6 && (
                <text
                  x={padL + cW / 2}
                  y={svgH - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-600 font-mono"
                >
                  {parsedData[Math.floor((parsedData.length - 1) / 2)].date.split(",")[0]}
                </text>
              )}

              {parsedData.length > 1 && (
                <text
                  x={svgW - padR}
                  y={svgH - 8}
                  textAnchor="end"
                  className="text-[9px] fill-zinc-500 font-mono"
                >
                  {parsedData[parsedData.length - 1].date.split(",")[0]}
                </text>
              )}
            </>
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activePt && (() => {
          let daysSincePrev: number | null = null;
          if (activePt.index > 0) {
            const prevT = parsedData[activePt.index - 1]._timestampMs;
            const currT = parsedData[activePt.index]._timestampMs;
            if (prevT > 0 && currT > 0) {
              daysSincePrev = Math.round((currT - prevT) / (1000 * 60 * 60 * 24));
            }
          }

          const pctX = (activePt.x / svgW) * 100;
          let alignmentClass = "-translate-x-1/2";
          if (activePt.x < 120) {
            alignmentClass = "-translate-x-2";
          } else if (activePt.x > svgW - 120) {
            alignmentClass = "-translate-x-[96%]";
          }

          return (
            <div
              className={`pointer-events-none absolute z-30 ${alignmentClass} rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-75 text-left min-w-[170px] max-w-[240px]`}
              style={{
                left: `${pctX}%`,
                top: `${Math.max(6, (activePt.y / svgH) * 100 - 35)}%`,
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {activePt.d.date}
                  </span>
                  {activePt.isAllTimePR ? (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-amber-300 border border-amber-400/40">
                      👑 ALL-TIME
                    </span>
                  ) : activePt.isPR ? (
                    <span className="rounded bg-accent/20 px-1 py-0.2 text-[9px] font-mono font-semibold text-accent-lighter border border-accent/30">
                      ★ PR
                    </span>
                  ) : null}
                </div>
                <span className="text-[9px] font-mono text-zinc-500">
                  #{activePt.index + 1}
                </span>
              </div>

              {daysSincePrev !== null && (
                <div className="text-[10px] font-mono text-zinc-400 pb-1 mb-1 border-b border-zinc-900 flex items-center justify-between">
                  <span className="text-zinc-500">Separación:</span>
                  <span className={daysSincePrev > 14 ? "text-amber-400 font-medium" : "text-zinc-300"}>
                    {daysSincePrev === 0
                      ? "Mismo día"
                      : daysSincePrev === 1
                      ? "+1 día"
                      : `+${daysSincePrev} días`}
                  </span>
                </div>
              )}

              {/* Main Metric Focus Value */}
              <div className="text-xs font-mono font-medium text-zinc-100 flex items-center justify-between gap-3">
                <span className="text-zinc-400 text-[10px]">{currentMetricName}:</span>
                <span className="text-accent-light font-bold">
                  {activeMetric === "avg_1rm"
                    ? `${activePt.val} ${currentUnit}`
                    : activePt.d.label || `${activePt.val} ${currentUnit}`}
                </span>
              </div>

              {/* Context metrics in tooltip */}
              <div className="mt-1.5 pt-1.5 border-t border-zinc-800/80 flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
                {activeMetric !== "top_set" && activePt.d.label && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Top Set:</span>
                    <span className="text-zinc-200 font-medium">{activePt.d.label}</span>
                  </div>
                )}
                {activeMetric === "top_set" && activePt.d.avg1RM !== undefined && activePt.d.avg1RM > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">1RM Medio:</span>
                    <span className="text-accent-light font-medium">{activePt.d.avg1RM} kg</span>
                  </div>
                )}
                {activeMetric === "top_set" && isRepsMetric && activePt.d.avgReps !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Media reps:</span>
                    <span className="text-zinc-300">{activePt.d.avgReps} reps/serie</span>
                  </div>
                )}
                {activePt.d.setsCount !== undefined && (
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Series:</span>
                    <span>{activePt.d.setsCount} series</span>
                  </div>
                )}
                {onPointClick && (
                  <div className="pt-1 text-[9px] text-accent-light/80 italic text-right border-t border-zinc-900 mt-0.5">
                    Clic para ver sesión completa ↗
                  </div>
                )}
              </div>

              {activePt.d.workoutTitle && (
                <div className="mt-1 pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-500 truncate max-w-[200px]">
                  {activePt.d.workoutTitle}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const fullscreenSvgHeight = Math.max(380, Math.min(640, windowHeight - 320));

  return (
    <div className="relative w-full select-none">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-2.5 pb-3 text-[11px] font-mono">
        {/* Row 1: Selectors & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Metric View Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800">
            {availableMetrics.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleMetricChange(m.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMetric === m.id
                    ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs text-accent-light"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title={m.title}
              >
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Right: Mode & Curve Switchers + Fullscreen Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Mode Control */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800">
              <button
                type="button"
                onClick={() => handleModeChange("session")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === "session"
                    ? "bg-zinc-800 text-zinc-100 font-medium shadow-xs"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Separación uniforme entre sesiones consecutivas (modo sesión)"
              >
                <SessionModeIcon className="w-3 h-3" />
                <span>Por sesión</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("date")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === "date"
                    ? "bg-zinc-800 text-zinc-100 font-medium shadow-xs"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Separación proporcional a la fecha y tiempo transcurrido (modo temporal)"
              >
                <DateModeIcon className="w-3 h-3" />
                <span>Por fecha</span>
              </button>
            </div>

            {/* Segmented Curve Control */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800">
              <button
                type="button"
                onClick={() => handleCurveChange("linear")}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeCurve === "linear"
                    ? "bg-zinc-800 text-zinc-100 font-medium shadow-xs"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Trazado lineal con picos entre puntos concretos"
              >
                <LinearLineIcon className="w-3 h-3" />
                <span>Puntos</span>
              </button>

              <button
                type="button"
                onClick={() => handleCurveChange("smooth")}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeCurve === "smooth"
                    ? "bg-zinc-800 text-zinc-100 font-medium shadow-xs"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Vista suavizada con curvas y puntos visibles"
              >
                <SmoothLineIcon className="w-3 h-3" />
                <span>Curvas</span>
              </button>

              <button
                type="button"
                onClick={() => handleCurveChange("flow")}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeCurve === "flow"
                    ? "bg-zinc-800 text-zinc-100 font-medium shadow-xs"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Línea continua ultra suave sin puntos"
              >
                <FlowLineIcon className="w-3 h-3" />
                <span>Fluida</span>
              </button>
            </div>

            {/* Fullscreen Expand Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/90 text-zinc-400 hover:text-accent-light hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Pantalla completa"
              aria-label="Pantalla completa"
            >
              <MaximizeIcon className="w-3.5 h-3.5 text-accent-light" />
            </button>
          </div>
        </div>

        {/* Row 2: Legend & Details */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-t border-zinc-900 text-zinc-400 text-[10px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-accent rounded-full" />
              <span className="text-zinc-200 font-semibold">{currentMetricName}</span>
            </div>
            {activeMetric === "top_set" && showSecondaryLine && parsedData.some((d) => typeof d.secondaryValue === "number" && d.secondaryValue > 0) && (
              <div className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2.5 h-0.5 border-b border-dashed border-zinc-400" />
                <span>{secondaryMetricName}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-zinc-500">
              <span className="w-2 h-2 rounded-full border border-accent-light bg-accent/20" />
              <span>PR</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-500">
              <span className="w-2 h-2 rounded-full border border-amber-400 bg-amber-400/30" />
              <span>All-Time</span>
            </div>
          </div>

          <div className="flex items-center text-zinc-500 text-[10px]">
            {parsedData.length} {parsedData.length === 1 ? "sesión" : "sesiones"}
            {activeMode === "date" && timeSpan > 0 && (
              <span className="ml-1 text-zinc-600">({formatDurationSpan(timeSpan)})</span>
            )}
          </div>
        </div>
      </div>

      {/* Inline Chart SVG */}
      {renderChartSvg(800, height, hoverIndex, setHoverIndex, inlineGradientId, false)}

      {/* Fullscreen Modal Dialog (Portaled to document.body to break free of any ancestor transforms or backdrop filters) */}
      {mounted && isFullscreen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-zinc-100 select-none">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setIsFullscreen(false)} />

          {/* Modal Container */}
          <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden z-10">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800/90 bg-zinc-900/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                      <TrophyIcon className="w-4 h-4 text-accent-light" />
                      <span>{exerciseName || metricName}</span>
                    </h3>
                    {seasonName && (
                      <span
                        className="px-2 py-0.2 rounded-full text-[10px] font-mono border"
                        style={
                          seasonColor
                            ? {
                                backgroundColor: hexToRgba(seasonColor, 0.18),
                                color: seasonColor,
                                borderColor: hexToRgba(seasonColor, 0.4),
                              }
                            : {
                                backgroundColor: "rgba(251, 191, 36, 0.2)",
                                color: "#fcd34d",
                                borderColor: "rgba(251, 191, 36, 0.3)",
                              }
                        }
                      >
                        {seasonName}
                      </span>
                    )}
                    {allTimeBestLabel && (
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                        <CrownIcon className="w-3 h-3 text-amber-400" />
                        <span>Récord: {allTimeBestLabel}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    {parsedData.length} sesiones en total
                    {timeSpan > 0 && ` (${formatDurationSpan(timeSpan)})`}
                    {" · "}Vista detallada de progresión
                  </p>
                </div>
              </div>

              {/* Controls inside Fullscreen Header */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                {/* Metric Switcher */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  {availableMetrics.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleMetricChange(m.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                        activeMetric === m.id
                          ? "bg-zinc-800 text-accent-light font-semibold shadow-xs"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      title={m.title}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Mode Switcher */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => handleModeChange("session")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer ${
                      activeMode === "session"
                        ? "bg-zinc-800 text-zinc-100 font-medium"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <SessionModeIcon className="w-3 h-3" />
                    <span>Sesión</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("date")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer ${
                      activeMode === "date"
                        ? "bg-zinc-800 text-zinc-100 font-medium"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <DateModeIcon className="w-3 h-3" />
                    <span>Fecha</span>
                  </button>
                </div>

                {/* Curve Switcher */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => handleCurveChange("linear")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                      activeCurve === "linear" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Puntos lineales"
                  >
                    <LinearLineIcon className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurveChange("smooth")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                      activeCurve === "smooth" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Curvas suavizadas"
                  >
                    <SmoothLineIcon className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurveChange("flow")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                      activeCurve === "flow" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Línea fluida continua"
                  >
                    <FlowLineIcon className="w-3 h-3" />
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
                  title="Cerrar pantalla completa (Esc)"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Modal Chart Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-5">
              {renderChartSvg(1100, fullscreenSvgHeight, modalHoverIndex, setModalHoverIndex, modalGradientId, true)}

              {/* KPI Timeline Highlights Footer */}
              {kpis && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Primer registro */}
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Primer registro
                      </span>
                      <div className="mt-1">
                        <span className="text-base font-bold font-mono text-zinc-100">
                          {kpis.firstVal} {currentUnit}
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-500 mt-0.5">
                          {kpis.firstPt.date.split(",")[0]}
                        </span>
                      </div>
                    </div>

                    {/* Pico máximo */}
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-amber-400/90 uppercase tracking-wider flex items-center gap-1">
                        <CrownIcon className="w-3 h-3 text-amber-400" />
                        <span>Récord periodo</span>
                      </span>
                      <div className="mt-1">
                        <span className="text-base font-bold font-mono text-amber-300">
                          {kpis.peakVal} {currentUnit}
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-500 mt-0.5">
                          {kpis.peakPt.date.split(",")[0]}
                        </span>
                      </div>
                    </div>

                    {/* Último registro */}
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Última sesión
                      </span>
                      <div className="mt-1">
                        <span className="text-base font-bold font-mono text-zinc-100">
                          {kpis.lastVal} {currentUnit}
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-500 mt-0.5">
                          {kpis.lastPt.date.split(",")[0]}
                        </span>
                      </div>
                    </div>

                    {/* Progreso neto */}
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Progreso neto
                      </span>
                      <div className="mt-1">
                        <span className={`text-base font-bold font-mono ${kpis.diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {kpis.diff >= 0 ? `+${kpis.diff}` : `${kpis.diff}`} {currentUnit}
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-500 mt-0.5">
                          {kpis.diffPct >= 0 ? `+${kpis.diffPct}%` : `${kpis.diffPct}%`} vs inicio
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-[11px] font-mono text-zinc-500 flex items-center justify-center gap-1.5 pt-1">
                    <span>💡</span>
                    <span>Haz clic sobre cualquier punto de la curva para ver el entrenamiento completo realizado en ese día.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
