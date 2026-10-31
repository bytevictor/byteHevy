"use client";

import React, { useState, useId } from "react";

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  primaryValue: number;     // Top set (kg, reps o segundos)
  secondaryValue?: number;   // 1RM estimado (opcional)
  label?: string;            // ej: "70 kg × 8"
  isPR?: boolean;            // Insignia de récord
  workoutTitle?: string;
}

export interface ProgressionChartProps {
  data: ChartDataPoint[];
  unit: string;
  metricName?: string;
  secondaryMetricName?: string;
  height?: number;
}

export function ProgressionChart({
  data,
  unit,
  metricName = "Top Set",
  secondaryMetricName = "1RM Est.",
  height = 220,
}: ProgressionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (!data || data.length === 0) {
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

  // Calculate min & max values
  const allValues: number[] = [];
  data.forEach((d) => {
    if (typeof d.primaryValue === "number" && !isNaN(d.primaryValue)) {
      allValues.push(d.primaryValue);
    }
    if (typeof d.secondaryValue === "number" && !isNaN(d.secondaryValue)) {
      allValues.push(d.secondaryValue);
    }
  });

  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 10;
  const minValue = Math.max(0, Math.floor(rawMin * 0.9));
  const maxValue = Math.ceil(rawMax * 1.1) || 10;
  const valueRange = maxValue - minValue || 1;

  // Coordinates calculation
  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minValue, Math.min(maxValue, val));
    const normalized = (clamped - minValue) / valueRange;
    return paddingTop + chartHeight - normalized * chartHeight;
  };

  // Build SVG path for primary value
  const primaryPoints = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.primaryValue),
    d,
    index: i,
  }));

  const primaryPathD = primaryPoints.reduce((acc, curr, i) => {
    return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, "");

  // Area path for subtle gradient fill under primary line
  const areaPathD = primaryPoints.length > 0
    ? `${primaryPathD} L ${primaryPoints[primaryPoints.length - 1].x} ${paddingTop + chartHeight} L ${primaryPoints[0].x} ${paddingTop + chartHeight} Z`
    : "";

  // Secondary path (1RM) if present
  const hasSecondary = data.some((d) => typeof d.secondaryValue === "number" && d.secondaryValue > 0);
  const secondaryPoints = hasSecondary
    ? data.map((d, i) => ({
        x: getX(i),
        y: d.secondaryValue ? getY(d.secondaryValue) : getY(d.primaryValue),
      }))
    : [];

  const secondaryPathD = secondaryPoints.reduce((acc, curr, i) => {
    return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, "");

  // Grid steps (4 horizontal lines)
  const gridSteps = [0, 0.33, 0.66, 1];

  const activePoint = hoverIndex !== null ? primaryPoints[hoverIndex] : null;

  return (
    <div className="relative w-full select-none">
      {/* Legend & Summary Bar */}
      <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-500 rounded-full" />
            <span className="text-zinc-200">{metricName}</span>
          </div>
          {hasSecondary && (
            <div className="flex items-center gap-1.5 text-zinc-500">
              <span className="w-2.5 h-0.5 border-b border-dashed border-zinc-400" />
              <span>{secondaryMetricName}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-zinc-500">
            <span className="w-2 h-2 rounded-full border border-amber-400 bg-amber-400/20" />
            <span>PR</span>
          </div>
        </div>

        <div className="text-zinc-500 text-[10px]">
          {data.length} {data.length === 1 ? "sesión" : "sesiones"} registradas
        </div>
      </div>

      {/* Main SVG Container */}
      <div className="relative w-full rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2 backdrop-blur-sm">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full overflow-visible"
          style={{ height }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
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

          {/* Area fill under primary curve */}
          {areaPathD && (
            <path d={areaPathD} fill={`url(#${gradientId})`} />
          )}

          {/* Secondary dashed curve (1RM) */}
          {hasSecondary && secondaryPathD && (
            <path
              d={secondaryPathD}
              fill="none"
              stroke="#71717a"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              strokeLinecap="round"
            />
          )}

          {/* Primary solid curve (Top Set) */}
          {primaryPathD && (
            <path
              d={primaryPathD}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points on curve */}
          {primaryPoints.map((pt) => {
            const isHovered = hoverIndex === pt.index;
            return (
              <g key={pt.index}>
                {pt.d.isPR && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 5}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    className="transition-all duration-150 animate-pulse"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5 : pt.d.isPR ? 3.5 : 2.5}
                  fill={pt.d.isPR ? "#f59e0b" : "#18181b"}
                  stroke={pt.d.isPR ? "#fef3c7" : "#f59e0b"}
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoverIndex(pt.index)}
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

          {/* Invisible interactive vertical columns for smooth hovering */}
          {data.map((_, i) => {
            const x = getX(i);
            const colWidth = chartWidth / Math.max(1, data.length - 1);
            return (
              <rect
                key={i}
                x={x - colWidth / 2}
                y={paddingTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}

          {/* X Axis First & Last Dates */}
          {data.length > 0 && (
            <>
              <text
                x={paddingLeft}
                y={svgHeight - 8}
                textAnchor="start"
                className="text-[9px] fill-zinc-500 font-mono"
              >
                {data[0].date.split(",")[0]}
              </text>
              {data.length > 1 && (
                <text
                  x={svgWidth - paddingRight}
                  y={svgHeight - 8}
                  textAnchor="end"
                  className="text-[9px] fill-zinc-500 font-mono"
                >
                  {data[data.length - 1].date.split(",")[0]}
                </text>
              )}
            </>
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md transition-all duration-75 text-left"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${Math.max(10, (activePoint.y / svgHeight) * 100 - 35)}%`,
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-1 mb-1">
              <span className="text-[10px] text-zinc-400 font-mono">
                {activePoint.d.date}
              </span>
              {activePoint.d.isPR && (
                <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-mono font-semibold text-amber-300">
                  ★ PR
                </span>
              )}
            </div>

            <div className="text-xs font-mono font-medium text-zinc-100 flex items-center justify-between gap-3">
              <span className="text-zinc-400 text-[10px]">Top Set:</span>
              <span className="text-amber-400 font-semibold">
                {activePoint.d.label || `${activePoint.d.primaryValue} ${unit}`}
              </span>
            </div>

            {typeof activePoint.d.secondaryValue === "number" && activePoint.d.secondaryValue > 0 && (
              <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between gap-3 pt-0.5">
                <span className="text-[10px] text-zinc-500">1RM est:</span>
                <span>{activePoint.d.secondaryValue} {unit}</span>
              </div>
            )}

            {activePoint.d.workoutTitle && (
              <div className="mt-1 pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-500 truncate max-w-[170px]">
                {activePoint.d.workoutTitle}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

