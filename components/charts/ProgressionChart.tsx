"use client";

import React, { useState, useEffect, useMemo, useId } from "react";

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  primaryValue: number;     // Top set (kg, reps o segundos)
  secondaryValue?: number;   // 1RM estimado (opcional)
  label?: string;            // ej: "70 kg × 8"
  isPR?: boolean;            // Insignia de récord
  isAllTimePR?: boolean;     // Insignia de récord histórico absoluto
  workoutTitle?: string;
  workoutId?: string;
}

export type ChartMode = "session" | "date";
export type CurveType = "linear" | "smooth" | "flow";

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
    // Ultra-smooth Catmull-Rom flow with rounded sweeps
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

      const dx1 = p2.x - p0.x;
      const dy1 = p2.y - p0.y;
      const dx2 = p3.x - p1.x;
      const dy2 = p3.y - p1.y;

      let cp1x = p1.x + (dx1 * tension) / 3;
      let cp1y = p1.y + (dy1 * tension) / 3;
      let cp2x = p2.x - (dx2 * tension) / 3;
      let cp2y = p2.y - (dy2 * tension) / 3;

      // Ensure horizontal monotonicity
      cp1x = Math.max(p1.x, Math.min(p2.x, cp1x));
      cp2x = Math.max(p1.x, Math.min(p2.x, cp2x));

      // Stay within chart Y boundaries
      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  // Smooth mode: Monotone Cubic Spline (Fritsch-Carlson)
  const n = points.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].x - points[i].x;
    const deltaY = points[i + 1].y - points[i].y;
    dx.push(deltaX);
    dy.push(deltaY);
    slopes.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const m = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1];
    const s1 = slopes[i];
    if (s0 * s1 <= 0) {
      m[i] = 0;
    } else {
      m[i] = (2 * s0 * s1) / (s0 + s1);
    }
  }

  // Fritsch-Carlson limiter to guarantee monotonicity and zero overshoot
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i];
    if (Math.abs(s) < 1e-7) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / s;
      const b = m[i + 1] / s;
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        m[i] = t * a * s;
        m[i + 1] = t * b * s;
      }
    }
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const deltaX = dx[i];

    if (deltaX <= 0) {
      d += ` L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      continue;
    }

    const cp1x = p0.x + deltaX / 3;
    const cp1y = p0.y + (m[i] * deltaX) / 3;
    const cp2x = p1.x - deltaX / 3;
    const cp2y = p1.y - (m[i + 1] * deltaX) / 3;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return d;
}

function SessionModeIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12h2.5M6.75 8h2.5M11 4h2.5" />
      <circle cx="3.75" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12.25" cy="4" r="1.25" fill="currentColor" stroke="none" />
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
  metricName = "Top Set",
  secondaryMetricName = "1RM Est.",
  showSecondaryLine = false,
  height = 220,
  mode: controlledMode,
  defaultMode = "session",
  onModeChange,
  curveType: controlledCurve,
  defaultCurveType = "smooth",
  onCurveTypeChange,
  onPointClick,
}: ProgressionChartProps) {
  const [internalMode, setInternalMode] = useState<ChartMode>(defaultMode);
  const [internalCurve, setInternalCurve] = useState<CurveType>(defaultCurveType);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  // Load saved preferences safely on client
  useEffect(() => {
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
  }, [controlledMode, controlledCurve]);

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

  // Width and padding constants for SVG viewBox
  const svgWidth = 800;
  const svgHeight = height;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

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
  parsedData.forEach((d) => {
    if (typeof d.primaryValue === "number" && !isNaN(d.primaryValue)) {
      allValues.push(d.primaryValue);
    }
    if (showSecondaryLine && typeof d.secondaryValue === "number" && !isNaN(d.secondaryValue)) {
      allValues.push(d.secondaryValue);
    }
  });

  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 10;
  const minValue = rawMin < 0 ? Math.floor(rawMin * 1.1) : Math.max(0, Math.floor(rawMin * 0.9));
  const maxValue = Math.ceil(rawMax * 1.1) || 10;
  const valueRange = maxValue - minValue || 1;

  // Coordinates calculation
  const getX = (index: number) => {
    if (parsedData.length <= 1) return paddingLeft + chartWidth / 2;

    if (activeMode === "date" && timeSpan > 0) {
      const t = parsedData[index]._timestampMs;
      if (t > 0) {
        const normalized = (t - minTime) / timeSpan;
        return paddingLeft + normalized * chartWidth;
      }
    }

    // Default: Session mode (equidistant spacing)
    return paddingLeft + (index / (parsedData.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minValue, Math.min(maxValue, val));
    const normalized = (clamped - minValue) / valueRange;
    return paddingTop + chartHeight - normalized * chartHeight;
  };

  // Build points for primary value
  const primaryPoints = parsedData.map((d, i) => ({
    x: getX(i),
    y: getY(d.primaryValue),
    d,
    index: i,
  }));

  const primaryPathD = buildPath(primaryPoints, activeCurve, paddingTop, paddingTop + chartHeight);

  // Area path for subtle gradient fill under primary line
  const areaPathD = primaryPoints.length > 0
    ? `${primaryPathD} L ${primaryPoints[primaryPoints.length - 1].x} ${paddingTop + chartHeight} L ${primaryPoints[0].x} ${paddingTop + chartHeight} Z`
    : "";

  // Secondary path (1RM) if present
  const hasSecondary = parsedData.some((d) => typeof d.secondaryValue === "number" && d.secondaryValue > 0);
  const secondaryPoints = hasSecondary
    ? parsedData.map((d, i) => ({
        x: getX(i),
        y: d.secondaryValue ? getY(d.secondaryValue) : getY(d.primaryValue),
      }))
    : [];

  const secondaryPathD = hasSecondary
    ? buildPath(secondaryPoints, activeCurve, paddingTop, paddingTop + chartHeight)
    : "";

  // Grid steps (4 horizontal lines)
  const gridSteps = [0, 0.33, 0.66, 1];

  // Intermediate date ticks for date mode
  const dateTicks = useMemo(() => {
    if (activeMode !== "date" || timeSpan <= 0) return [];
    return [0.25, 0.5, 0.75].map((fraction) => {
      const tickTime = minTime + fraction * timeSpan;
      const x = paddingLeft + fraction * chartWidth;
      const label = formatAxisDate(tickTime, spanDays);
      return { x, label, fraction };
    });
  }, [activeMode, timeSpan, minTime, chartWidth, spanDays]);

  const activePoint = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < primaryPoints.length
    ? primaryPoints[hoverIndex]
    : null;

  // Fluid hover interaction across entire chart
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || primaryPoints.length === 0) return;

    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * svgHeight;

    if (mouseX < paddingLeft - 20 || mouseX > svgWidth - paddingRight + 20) {
      setHoverIndex(null);
      return;
    }

    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < primaryPoints.length; i++) {
      const pt = primaryPoints[i];
      const dx = pt.x - mouseX;
      const dy = (pt.y - mouseY) * 0.35;
      const dist = dx * dx + dy * dy;
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    setHoverIndex(closestIdx);
  };

  return (
    <div className="relative w-full select-none">
      {/* Top Controls Bar: Legend & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 text-[11px] font-mono">
        {/* Left: Legend */}
        <div className="flex items-center gap-3.5 text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-accent rounded-full" />
            <span className="text-zinc-200">{metricName}</span>
          </div>
          {showSecondaryLine && hasSecondary && (
            <div className="flex items-center gap-1.5 text-zinc-500">
              <span className="w-2.5 h-0.5 border-b border-dashed border-zinc-400" />
              <span>{secondaryMetricName}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-zinc-500">
            <span className="w-2 h-2 rounded-full border border-accent-light bg-accent/20" />
            <span>PR</span>
          </div>
        </div>

        {/* Right: Mode Switchers & Session Summary */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Segmented Mode Control (Por sesión vs Por fecha) */}
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

          {/* Segmented Curve Control (Puntos vs Curvas vs Fluida) */}
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

          <div className="hidden lg:flex items-center text-zinc-500 text-[10px] pl-0.5">
            {parsedData.length} {parsedData.length === 1 ? "sesión" : "sesiones"}
            {activeMode === "date" && timeSpan > 0 && (
              <span className="ml-1 text-zinc-600">({formatDurationSpan(timeSpan)})</span>
            )}
          </div>
        </div>
      </div>

      {/* Main SVG Container */}
      <div className="relative w-full rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2 backdrop-blur-sm">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full overflow-visible"
          style={{ height }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          onClick={() => {
            if (activePoint) {
              onPointClick?.(activePoint.d);
            }
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity={activeCurve === "flow" ? "0.22" : "0.18"} />
              <stop offset="100%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis labels */}
          {gridSteps.map((step, idx) => {
            const val = Math.round(minValue + step * valueRange);
            const yPos = paddingTop + chartHeight - step * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={svgWidth - paddingRight}
                  y2={yPos}
                  stroke="#27272a"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 3}
                  textAnchor="end"
                  className="text-[9px] fill-zinc-500 font-mono font-medium"
                >
                  {val}
                  {idx === gridSteps.length - 1 ? ` ${unit}` : ""}
                </text>
              </g>
            );
          })}

          {/* Zero reference line for bodyweight baseline (0 kg) when spanning negative and positive */}
          {minValue < 0 && maxValue > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={getY(0)}
                x2={svgWidth - paddingRight}
                y2={getY(0)}
                stroke="#52525b"
                strokeWidth="1.25"
                strokeDasharray="4,4"
              />
              <text
                x={paddingLeft + 6}
                y={getY(0) - 4}
                textAnchor="start"
                className="text-[9px] fill-zinc-400 font-mono font-medium"
              >
                BW (0 kg)
              </text>
            </g>
          )}

          {/* Date mode vertical timeline guide lines */}
          {activeMode === "date" && dateTicks.map((tick) => (
            <line
              key={`grid-line-${tick.fraction}`}
              x1={tick.x}
              y1={paddingTop}
              x2={tick.x}
              y2={paddingTop + chartHeight}
              stroke="#27272a"
              strokeWidth="1"
              strokeDasharray="2,3"
              opacity="0.8"
            />
          ))}

          {/* Area fill under primary curve */}
          {areaPathD && (
            <path d={areaPathD} fill={`url(#${gradientId})`} />
          )}

          {/* Secondary dashed curve (1RM) */}
          {showSecondaryLine && hasSecondary && secondaryPathD && (
            <path
              d={secondaryPathD}
              fill="none"
              stroke="#71717a"
              strokeWidth={activeCurve === "flow" ? "1.75" : "1.5"}
              strokeDasharray="3,3"
              strokeLinecap="round"
            />
          )}

          {/* Primary curve (Top Set) */}
          {primaryPathD && (
            <path
              d={primaryPathD}
              fill="none"
              stroke="var(--accent, #f59e0b)"
              strokeWidth={activeCurve === "flow" ? "2.5" : "2"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points on curve: in "flow" mode, hidden unless hovered */}
          {primaryPoints.map((pt) => {
            const isHovered = hoverIndex === pt.index;
            const showPoint = activeCurve !== "flow" || isHovered;

            if (!showPoint) return null;

            return (
              <g key={pt.index}>
                {pt.d.isAllTimePR ? (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 8 : 6}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    className="transition-all duration-200 animate-pulse"
                  />
                ) : pt.d.isPR ? (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 5}
                    fill="none"
                    stroke="var(--accent, #f59e0b)"
                    strokeWidth="1.5"
                    className="transition-all duration-200 animate-pulse"
                  />
                ) : null}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : pt.d.isAllTimePR ? 4.5 : pt.d.isPR ? 3.5 : 2.5}
                  fill={pt.d.isAllTimePR ? "#fbbf24" : pt.d.isPR ? "var(--accent, #f59e0b)" : "#18181b"}
                  stroke={pt.d.isAllTimePR ? "#fef08a" : pt.d.isPR ? "var(--accent-lighter, #fef3c7)" : "var(--accent, #f59e0b)"}
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoverIndex(pt.index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoverIndex(pt.index);
                    onPointClick?.(pt.d);
                  }}
                />
              </g>
            );
          })}

          {/* Hover Crosshair Vertical Line */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={paddingTop}
              x2={activePoint.x}
              y2={paddingTop + chartHeight}
              stroke="#52525b"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          )}

          {/* X Axis First & Last Dates */}
          {parsedData.length > 0 && (
            <>
              <text
                x={paddingLeft}
                y={svgHeight - 8}
                textAnchor="start"
                className="text-[9px] fill-zinc-500 font-mono"
              >
                {parsedData[0].date.split(",")[0]}
              </text>

              {/* Intermediate Date Ticks in Date Mode */}
              {activeMode === "date" && dateTicks.map((tick) => (
                <text
                  key={`lbl-${tick.fraction}`}
                  x={tick.x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-500 font-mono"
                >
                  {tick.label}
                </text>
              ))}

              {/* Intermediate Session Tick in Session Mode if many sessions */}
              {activeMode === "session" && parsedData.length >= 6 && (
                <text
                  x={paddingLeft + chartWidth / 2}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-600 font-mono"
                >
                  {parsedData[Math.floor((parsedData.length - 1) / 2)].date.split(",")[0]}
                </text>
              )}

              {parsedData.length > 1 && (
                <text
                  x={svgWidth - paddingRight}
                  y={svgHeight - 8}
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
        {activePoint && (() => {
          let daysSincePrev: number | null = null;
          if (activePoint.index > 0) {
            const prevT = parsedData[activePoint.index - 1]._timestampMs;
            const currT = parsedData[activePoint.index]._timestampMs;
            if (prevT > 0 && currT > 0) {
              daysSincePrev = Math.round((currT - prevT) / (1000 * 60 * 60 * 24));
            }
          }

          const pctX = (activePoint.x / svgWidth) * 100;
          let alignmentClass = "-translate-x-1/2";
          if (activePoint.x < 110) {
            alignmentClass = "-translate-x-2";
          } else if (activePoint.x > svgWidth - 110) {
            alignmentClass = "-translate-x-[96%]";
          }

          return (
            <div
              className={`pointer-events-none absolute z-20 ${alignmentClass} rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur-md transition-all duration-75 text-left min-w-[160px]`}
              style={{
                left: `${pctX}%`,
                top: `${Math.max(8, (activePoint.y / svgHeight) * 100 - 32)}%`,
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {activePoint.d.date}
                  </span>
                  {activePoint.d.isAllTimePR ? (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-400/40">
                      👑 ALL-TIME PR
                    </span>
                  ) : activePoint.d.isPR ? (
                    <span className="rounded bg-accent/20 px-1 py-0.2 text-[9px] font-mono font-semibold text-accent-lighter border border-accent/30">
                      ★ PR
                    </span>
                  ) : null}
                </div>
                <span className="text-[9px] font-mono text-zinc-500">
                  #{activePoint.index + 1}
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

              <div className="text-xs font-mono font-medium text-zinc-100 flex items-center justify-between gap-3">
                <span className="text-zinc-400 text-[10px]">{metricName}:</span>
                <span className="text-accent-light font-semibold">
                  {activePoint.d.label || `${activePoint.d.primaryValue} ${unit}`}
                </span>
              </div>

              {typeof activePoint.d.secondaryValue === "number" && activePoint.d.secondaryValue > 0 && (
                <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between gap-3 pt-0.5">
                  <span className="text-[10px] text-zinc-500">{secondaryMetricName}:</span>
                  <span>{activePoint.d.secondaryValue} {unit}</span>
                </div>
              )}

              {activePoint.d.workoutTitle && (
                <div className="mt-1 pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-500 truncate max-w-[200px]">
                  {activePoint.d.workoutTitle}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
