"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
} from "./Icons";
import {
  buildFullProjectionReport,
  HORIZON_PRESETS,
  ProjectionHorizonId,
  FullProjectionReport,
  WeightDataPoint,
} from "@/lib/weight-projection-engine";

export type ProjectionAnalysisMode = "cone" | "metabolic" | "montecarlo" | "thermo" | "inverse";

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
    const cp1y = p0.y + (tangents[i] * dx) / 3;
    const cp2x = p1.x - dx / 3;
    const cp2y = p1.y - (tangents[i + 1] * dx) / 3;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return d;
}

export function WeightProjectionModal({
  isOpen,
  onClose,
  rawRecords,
  activeSeasonName,
  defaultTargetWeight,
}: WeightProjectionModalProps) {
  // Estado de interactividad
  const [activeMode, setActiveMode] = useState<ProjectionAnalysisMode>("cone");
  const [selectedHorizonId, setSelectedHorizonId] = useState<ProjectionHorizonId>("30d");
  const [calibrationWindowDays, setCalibrationWindowDays] = useState<number>(30);
  const [userTargetWeight, setUserTargetWeight] = useState<string>(() =>
    defaultTargetWeight ? String(defaultTargetWeight) : ""
  );
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    linearVal: number;
    lower95: number;
    upper95: number;
    lower68: number;
    upper68: number;
    metabolicVal: number;
    monteCarloP50: number;
    monteCarloP10: number;
    monteCarloP90: number;
  } | null>(null);

  const [mounted, setMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Si no se proporcionó meta, sugerir una coherente
  const targetWeightNum = useMemo(() => {
    const parsed = parseFloat(userTargetWeight);
    if (!isNaN(parsed) && parsed > 20 && parsed < 300) return parsed;
    if (points.length === 0) return 70;
    const latest = points[points.length - 1].weight;
    return Math.round((latest - 3) * 10) / 10;
  }, [userTargetWeight, points]);

  // Ejecutar motor estadístico
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
    const cutoff = report.latestTimestamp - report.calibrationWindowDays * 86400000;
    const filtered = points.filter((p) => p.timestamp >= cutoff);
    return filtered.length >= 2 ? filtered : points.slice(-Math.min(5, points.length));
  }, [report, points]);

  // Escalas matemáticas para el SVG
  const svgDimensions = { width: 960, height: 400, padding: { top: 35, right: 75, bottom: 45, left: 65 } };
  const innerWidth = svgDimensions.width - svgDimensions.padding.left - svgDimensions.padding.right;
  const innerHeight = svgDimensions.height - svgDimensions.padding.top - svgDimensions.padding.bottom;

  const scales = useMemo(() => {
    if (!report || calibrationPoints.length === 0) return null;

    const minTs = calibrationPoints[0].timestamp;
    const maxTs = report.targetTimestamp;
    const timeSpan = maxTs - minTs || 1;

    // Recolectar todos los valores de peso posibles para el dominio Y
    const histWeights = calibrationPoints.map((p) => p.weight);
    const projMin = Math.min(
      report.linear.predictionInterval95[0],
      report.metabolic.projectedWeight,
      report.monteCarlo.finalP10,
      report.inverseTarget?.targetWeight ?? report.latestWeight
    );
    const projMax = Math.max(
      report.linear.predictionInterval95[1],
      report.metabolic.projectedWeight,
      report.monteCarlo.finalP90,
      report.inverseTarget?.targetWeight ?? report.latestWeight
    );

    const allY = [...histWeights, projMin, projMax, report.latestWeight];
    const rawMinY = Math.min(...allY);
    const rawMaxY = Math.max(...allY);

    const paddingY = Math.max(0.6, (rawMaxY - rawMinY) * 0.14);
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
    const yStep = ySpan > 10 ? 2 : ySpan > 5 ? 1 : 0.5;
    const yTicks: number[] = [];
    for (let w = minY; w <= maxY + 0.001; w += yStep) {
      yTicks.push(Math.round(w * 10) / 10);
    }

    // Ticks temporales para eje X
    const xTicks: { ts: number; label: string }[] = [];
    const numXTicks = 6;
    for (let i = 0; i <= numXTicks; i++) {
      const curTs = minTs + (i / numXTicks) * timeSpan;
      xTicks.push({
        ts: curTs,
        label: new Date(curTs).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
      });
    }

    return { minTs, maxTs, minY, maxY, getX, getY, yTicks, xTicks };
  }, [report, calibrationPoints, innerWidth, innerHeight]);

  // Curva continua de puntos históricos generada mediante Spline
  const calibrationCurvePath = useMemo(() => {
    if (!scales || calibrationPoints.length === 0) return "";
    const pts = calibrationPoints.map((p) => ({
      x: scales.getX(p.timestamp),
      y: scales.getY(p.weight),
    }));
    return buildSplinePath(pts);
  }, [scales, calibrationPoints]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-[1520px] max-h-[94vh] flex flex-col rounded-3xl bg-[var(--background,#09090b)] border border-zinc-800 shadow-2xl overflow-hidden z-10 text-[var(--foreground,#fafafa)]">
        
        {/* =========================================================================
            HEADER CON THEMING DINÁMICO & CONTROLES DE INGENIERÍA
           ========================================================================= */}
        <div className="px-6 py-4.5 border-b border-zinc-800/90 bg-zinc-900/80 backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent-light shadow-sm shadow-accent/10 shrink-0">
              <SparklesIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-zinc-100">
                  Módulo de Proyección & Cinemática de Peso
                </h2>
                {activeSeasonName && (
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/40 text-accent-light font-bold">
                    {activeSeasonName}
                  </span>
                )}
                {report && (
                  <span className="text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-750 px-2.5 py-0.5 rounded-lg">
                    N={report.sampleCount} pesajes ({report.timeSpanDays}d analizados)
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-0.5">
                Modelado estocástico sin impedancia, cinemática de derivadas (velocidad/aceleración) y balance termodinámico.
              </p>
            </div>
          </div>

          {/* Controles de Configuración de Ventana y Horizonte */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            {/* Ventana de Calibración (incluye opción desde los últimos 7 días) */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm">
              <span className="text-zinc-400 font-mono text-xs uppercase font-semibold">Calibración:</span>
              <select
                value={calibrationWindowDays}
                onChange={(e) => setCalibrationWindowDays(Number(e.target.value))}
                className="bg-transparent text-zinc-200 text-sm font-bold focus:outline-none cursor-pointer"
              >
                <option value={7} className="bg-zinc-900">Últimos 7 días (1 sem - Ultra reactivo)</option>
                <option value={14} className="bg-zinc-900">Últimos 14 días (2 semanas)</option>
                <option value={30} className="bg-zinc-900">Últimos 30 días (~1 mes)</option>
                <option value={45} className="bg-zinc-900">Últimos 45 días (Equilibrado)</option>
                <option value={60} className="bg-zinc-900">Últimos 60 días (Robusto)</option>
                <option value={90} className="bg-zinc-900">Últimos 90 días (Trimestral)</option>
              </select>
            </div>

            {/* Horizonte Temporal con Badge de Recomendación Científica */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-accent/40 rounded-xl px-3 py-1.5 text-sm shadow-xs shadow-accent/10">
              <CalendarIcon className="w-4 h-4 text-accent-light" />
              <select
                value={selectedHorizonId}
                onChange={(e) => setSelectedHorizonId(e.target.value as ProjectionHorizonId)}
                className="bg-transparent text-accent-light font-bold text-sm focus:outline-none cursor-pointer"
              >
                {HORIZON_PRESETS.map((h) => (
                  <option key={h.id} value={h.id} className="bg-zinc-900 text-zinc-200">
                    {h.label} {h.isRecommended ? "⭐ (Recomendado científicamente)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Cerrar */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Cerrar modal"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            CUERPO PRINCIPAL DEL MODAL (CON TIPOGRAFÍA GRANDE Y LEGIBLE)
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 custom-scrollbar">
          {!report ? (
            <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <AlertTriangleIcon className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-zinc-200">Datos Insuficientes para Proyección</h3>
              <p className="text-sm text-zinc-400 max-w-md leading-relaxed">
                Se requieren al menos 2 pesajes registrados dentro de la ventana de calibración seleccionada.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Selector de Modo / Perspectiva Analítica (Tipografía generosa) */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 overflow-x-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveMode("cone")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "cone"
                      ? "bg-accent/20 text-accent-light border border-accent/50 shadow-md shadow-accent/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <ActivityIcon className="w-4 h-4" />
                  <span>1. Cono de Incertidumbre (WLS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("metabolic")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "metabolic"
                      ? "bg-accent/20 text-accent-light border border-accent/50 shadow-md shadow-accent/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <TrendingDownIcon className="w-4 h-4" />
                  <span>2. Adaptación Metabólica (Plateau)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("montecarlo")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "montecarlo"
                      ? "bg-accent/20 text-accent-light border border-accent/50 shadow-md shadow-accent/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <ZapIcon className="w-4 h-4" />
                  <span>3. Simulación Monte Carlo (1.000 Trayectorias)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("thermo")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "thermo"
                      ? "bg-accent/20 text-accent-light border border-accent/50 shadow-md shadow-accent/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <FlameIcon className="w-4 h-4" />
                  <span>4. Balance Termodinámico (kcal/día)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("inverse")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "inverse"
                      ? "bg-accent/20 text-accent-light border border-accent/50 shadow-md shadow-accent/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <TargetIcon className="w-4 h-4" />
                  <span>5. Proyección Inversa (Meta)</span>
                </button>
              </div>

              {/* 2. Cartel Explicativo Riguroso del Modo Activo (Texto claro y legible) */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-900 border border-accent/30 shadow-md">
                {activeMode === "cone" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-accent-light font-bold text-sm uppercase tracking-wider">
                      <ActivityIcon className="w-4 h-4" />
                      <span>Modo 1: Regresión WLS con Cono de Predicción al 68% (1σ) y 95% (2σ)</span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed font-normal">
                      <strong>Fundamento Matemático:</strong> Ajusta una regresión lineal con ponderación exponencial decreciente en el tiempo (<span className="font-mono text-accent-light font-semibold">λ=t/45d</span>). Calcula el intervalo de predicción formal que contempla tanto la incertidumbre de los parámetros muestrales como la varianza aleatoria individual futura.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> En biología, una línea recta sola es una falacia. Este modelo te muestra el <em>rango de dispersión probabilístico real</em> donde aterrizará tu peso, ensanchándose proporcionalmente a <span className="font-mono text-zinc-300">√(1 + 1/N + Δt²)</span>.
                    </p>
                  </div>
                )}

                {activeMode === "metabolic" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-accent-light font-bold text-sm uppercase tracking-wider">
                      <TrendingDownIcon className="w-4 h-4" />
                      <span>Modo 2: Ecuación Diferencial Asintótica de Adaptación Metabólica (Plateau)</span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed font-normal">
                      <strong>Fundamento Físico:</strong> Basado en el modelo dinámico de Kevin Hall (NIH). Modela el freno metabólico (<span className="font-mono text-accent-light font-semibold">dW/dt = -k(W - W∞)</span>), donde el gasto energético en reposo decrece a medida que disminuye la masa celular activa.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> Permite saber si tu ritmo actual está entrando en una meseta fisiológica natural y predice el peso límite de equilibrio (<span className="font-mono font-bold text-accent-light">{report.metabolic.asymptoteWeight} kg</span>) si no modificas tus calorías o tu nivel de actividad física.
                    </p>
                  </div>
                )}

                {activeMode === "montecarlo" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-accent-light font-bold text-sm uppercase tracking-wider">
                      <ZapIcon className="w-4 h-4" />
                      <span>Modo 3: Simulación Estocástica de Monte Carlo (1.000 Iteraciones AR(1))</span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed font-normal">
                      <strong>Fundamento Estadístico:</strong> Corre 1.000 simulaciones numéricas del camino aleatorio del peso incorporando la autocorrelación serial empírica (<span className="font-mono text-accent-light font-semibold">AR(1), ρ={report.linear.durbinWatson ? ((2 - report.linear.durbinWatson) / 2).toFixed(2) : "0.20"}</span>) observada en tus fluctuaciones hídricas.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> Revela las densidades empíricas de los percentiles P10, P25, P50 (mediana), P75 y P90. Muestra escenarios optimistas vs conservadores respetando las leyes de correlación temporal del cuerpo humano.
                    </p>
                  </div>
                )}

                {activeMode === "thermo" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-accent-light font-bold text-sm uppercase tracking-wider">
                      <FlameIcon className="w-4 h-4" />
                      <span>Modo 4: Termodinámica & Balance Energético Neto Real Implícito</span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed font-normal">
                      <strong>Fundamento Termodinámico:</strong> Aplica la constante energética de tejido humano mixto (<span className="font-mono text-accent-light font-semibold">~7.700 kcal/kg</span> de Wishnofsky) sobre la primera derivada temporal de tu peso (<span className="font-mono text-zinc-300">Ẇ = dW/dt</span>).
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> No depende de si calculaste bien tus calorías en una app: te dice el <em>déficit o superávit neto real sostenido por tus mitocondrias</em> con su intervalo de confianza estadístico.
                    </p>
                  </div>
                )}

                {activeMode === "inverse" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-accent-light font-bold text-sm uppercase tracking-wider">
                      <TargetIcon className="w-4 h-4" />
                      <span>Modo 5: Proyección Inversa / Time-to-Target (Tiempo Estimado hacia Peso Objetivo)</span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed font-normal">
                      <strong>Fundamento Analítico:</strong> Resuelve el problema inverso en el espacio de estados: dado un peso objetivo meta <span className="font-mono text-accent-light font-semibold">W_meta</span>, calcula la fecha más probable de llegada (P50) junto con la ventana de dispersión P10-P90.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> Diagnostica si tu ritmo actual es físicamente viable para tu meta o si existe divergencia termodinámica (ritmo en sentido contrario al objetivo deseado).
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Panel Ribbon de Telemetría Numérica (Tipografía amplia) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* 1. Peso Inicial Calibrado */}
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Peso de Partida
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-2xl font-bold font-mono text-zinc-100">
                      {report.latestWeight.toFixed(1)}
                    </span>
                    <span className="text-sm text-zinc-500 font-medium">kg</span>
                  </div>
                  <span className="text-xs text-zinc-500 mt-1">Última medición</span>
                </div>

                {/* 2. Proyección Esperada */}
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-accent/40 flex flex-col justify-between shadow-xs shadow-accent/10">
                  <span className="text-xs font-mono uppercase tracking-wider text-accent-light font-semibold flex items-center justify-between">
                    <span>Estimado ({report.horizonDays}d)</span>
                    <span className="text-[10px] bg-accent/20 px-1.5 py-0.5 rounded text-accent-light font-bold">P50</span>
                  </span>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-mono text-accent-light">
                      {activeMode === "metabolic"
                        ? report.metabolic.projectedWeight.toFixed(1)
                        : report.linear.projectedWeight.toFixed(1)}
                    </span>
                    <span className="text-sm text-accent-light/80 font-medium">kg</span>
                    <span
                      className={`text-xs font-mono font-bold ml-1 ${
                        report.linear.slopeDaily < 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {report.linear.slopeDaily < 0 ? "" : "+"}
                      {(
                        (activeMode === "metabolic"
                          ? report.metabolic.projectedWeight
                          : report.linear.projectedWeight) - report.latestWeight
                      ).toFixed(1)}{" "}
                      kg
                    </span>
                  </div>
                  <span className="text-xs text-accent-light/90 font-mono font-medium">
                    🎯 {report.targetDateLabel}
                  </span>
                </div>

                {/* 3. Velocidad Semanal (dW/dt) */}
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Velocidad (dW/dt)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span
                      className={`text-2xl font-bold font-mono ${
                        report.linear.slopeWeekly < 0
                          ? "text-emerald-400"
                          : report.linear.slopeWeekly > 0
                          ? "text-amber-400"
                          : "text-zinc-200"
                      }`}
                    >
                      {report.linear.slopeWeekly > 0 ? `+${report.linear.slopeWeekly}` : report.linear.slopeWeekly}
                    </span>
                    <span className="text-sm text-zinc-400 font-medium">kg/sem</span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    {Math.round(report.linear.slopeDaily * 1000)} g/día
                  </span>
                </div>

                {/* 4. Aceleración / Curvatura (d2W/dt2) */}
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Aceleración (d²W/dt²)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-2xl font-bold font-mono text-zinc-100">
                      {report.metabolic.currentDeceleration > 0 ? `+${report.metabolic.currentDeceleration}` : report.metabolic.currentDeceleration}
                    </span>
                    <span className="text-xs text-zinc-500">g/día²</span>
                  </div>
                  <span className="text-xs text-zinc-400 truncate">
                    {report.metabolic.hasPlateauTendency ? "Freno metabólico detectado" : "Ritmo sostenido"}
                  </span>
                </div>

                {/* 5. Calidad Estadística (R2 / RMSE) */}
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Ruido Biológico (RMSE)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-2xl font-bold font-mono text-zinc-100">
                      ±{report.linear.rmse.toFixed(2)}
                    </span>
                    <span className="text-sm text-zinc-400">kg</span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    R²={report.linear.r2.toFixed(2)} {report.linear.isSignificant ? "(p<0.05)" : "(p≥0.05)"}
                  </span>
                </div>

                {/* 6. Déficit/Superávit Calórico Implícito */}
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Balance Neto Implícito
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span
                      className={`text-2xl font-bold font-mono ${
                        report.thermodynamics.impliedNetKcalDaily < 0
                          ? "text-emerald-400"
                          : report.thermodynamics.impliedNetKcalDaily > 0
                          ? "text-amber-400"
                          : "text-zinc-200"
                      }`}
                    >
                      {report.thermodynamics.impliedNetKcalDaily > 0 ? `+${report.thermodynamics.impliedNetKcalDaily}` : report.thermodynamics.impliedNetKcalDaily}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">kcal/d</span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    ~{Math.abs(report.thermodynamics.impliedNetKcalWeekly)} kcal/sem
                  </span>
                </div>
              </div>

              {/* 4. GRÁFICO INTERACTIVO SVG CON THEMING DINÁMICO Y CURVA CONTINUA */}
              <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 shadow-xl flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm font-bold text-zinc-200 uppercase tracking-wide">
                      Trayectoria Cinemática & Curva de Calibración
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-300 font-mono flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-1 rounded-full bg-accent" />
                      <span>Curva de pesajes previos</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-1 border-t-2 border-dashed border-accent-light" />
                      <span>Proyección esperada</span>
                    </span>
                    {(activeMode === "cone" || activeMode === "thermo" || activeMode === "inverse") && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-2.5 bg-accent/25 border border-accent/50 rounded-xs" />
                        <span>Cono de predicción (95%)</span>
                      </span>
                    )}
                    {activeMode === "metabolic" && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-1 border-t-2 border-dashed border-emerald-400" />
                        <span>Plateau asintótico</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Contenedor SVG con crosshair */}
                <div className="relative w-full overflow-hidden">
                  {scales && (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
                      className="w-full h-auto max-h-[480px] overflow-visible"
                      onMouseMove={(e) => {
                        if (!svgRef.current) return;
                        const rect = svgRef.current.getBoundingClientRect();
                        const clientX = e.clientX - rect.left;
                        const svgX = (clientX / rect.width) * svgDimensions.width;

                        // Buscar el punto de la línea temporal más próximo
                        const matchingPoint = report.timelinePoints.reduce((prev, curr) => {
                          const prevX = scales.getX(prev.timestamp);
                          const currX = scales.getX(curr.timestamp);
                          return Math.abs(currX - svgX) < Math.abs(prevX - svgX) ? curr : prev;
                        }, report.timelinePoints[0]);

                        if (matchingPoint) {
                          setHoveredPoint({
                            x: scales.getX(matchingPoint.timestamp),
                            y: scales.getY(matchingPoint.linearExpected),
                            dateLabel: matchingPoint.dateLabel,
                            linearVal: matchingPoint.linearExpected,
                            lower95: matchingPoint.linearLower95,
                            upper95: matchingPoint.linearUpper95,
                            lower68: matchingPoint.linearLower68,
                            upper68: matchingPoint.linearUpper68,
                            metabolicVal: matchingPoint.metabolicExpected,
                            monteCarloP50: matchingPoint.monteCarloP50,
                            monteCarloP10: matchingPoint.monteCarloP10,
                            monteCarloP90: matchingPoint.monteCarloP90,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        {/* Gradiente Cono de Incertidumbre al 95% adaptado al Theme activo */}
                        <linearGradient id="themeConeGradient95" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="var(--accent-light, #fbbf24)" stopOpacity="0.06" />
                        </linearGradient>

                        {/* Gradiente Cono al 68% */}
                        <linearGradient id="themeConeGradient68" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--accent-light, #fbbf24)" stopOpacity="0.40" />
                          <stop offset="100%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.12" />
                        </linearGradient>

                        {/* Gradiente Monte Carlo Fan */}
                        <linearGradient id="themeMcGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="var(--accent-light, #fbbf24)" stopOpacity="0.08" />
                        </linearGradient>
                      </defs>

                      {/* Líneas de cuadrícula horizontales (Eje Y) */}
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

                      {/* Líneas de cuadrícula verticales (Eje X) */}
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
                              className="text-xs fill-zinc-400 font-mono font-medium"
                            >
                              {xt.label}
                            </text>
                          </g>
                        );
                      })}

                      {/* Línea divisoria 'Hoy / Última Toma' */}
                      <line
                        x1={scales.getX(report.latestTimestamp)}
                        y1={svgDimensions.padding.top}
                        x2={scales.getX(report.latestTimestamp)}
                        y2={svgDimensions.height - svgDimensions.padding.bottom}
                        stroke="#a1a1aa"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                      />
                      <text
                        x={scales.getX(report.latestTimestamp) - 8}
                        y={svgDimensions.padding.top + 14}
                        textAnchor="end"
                        className="text-xs fill-zinc-300 font-mono font-bold"
                      >
                        Hoy (T0)
                      </text>

                      {/* =============================================================
                          POLÍGONOS DEL CONO DE INCERTIDUMBRE (MODO 1 y 3)
                         ============================================================= */}
                      {(activeMode === "cone" || activeMode === "thermo" || activeMode === "inverse") && (
                        <>
                          {/* Área 95% (2 sigma) */}
                          <polygon
                            points={
                              report.timelinePoints
                                .map((pt) => `${scales.getX(pt.timestamp)},${scales.getY(pt.linearUpper95)}`)
                                .join(" ") +
                              " " +
                              report.timelinePoints
                                .slice()
                                .reverse()
                                .map((pt) => `${scales.getX(pt.timestamp)},${scales.getY(pt.linearLower95)}`)
                                .join(" ")
                            }
                            fill="url(#themeConeGradient95)"
                          />

                          {/* Área 68% (1 sigma) */}
                          <polygon
                            points={
                              report.timelinePoints
                                .map((pt) => `${scales.getX(pt.timestamp)},${scales.getY(pt.linearUpper68)}`)
                                .join(" ") +
                              " " +
                              report.timelinePoints
                                .slice()
                                .reverse()
                                .map((pt) => `${scales.getX(pt.timestamp)},${scales.getY(pt.linearLower68)}`)
                                .join(" ")
                            }
                            fill="url(#themeConeGradient68)"
                          />
                        </>
                      )}

                      {/* Polígono Fan Chart de Monte Carlo (Modo 3) */}
                      {activeMode === "montecarlo" && (
                        <>
                          <polygon
                            points={
                              report.timelinePoints
                                .map((pt) => `${scales.getX(pt.timestamp)},${scales.getY(pt.monteCarloP90)}`)
                                .join(" ") +
                              " " +
                              report.timelinePoints
                                .slice()
                                .reverse()
                                .map((pt) => `${scales.getX(pt.timestamp)},${scales.getY(pt.monteCarloP10)}`)
                                .join(" ")
                            }
                            fill="url(#themeMcGradient)"
                          />
                        </>
                      )}

                      {/* =============================================================
                          CURVA SUAVE CONTINUA DE PUNTOS PREVIOS (MONOTONE SPLINE)
                         ============================================================= */}
                      {calibrationCurvePath && (
                        <path
                          d={calibrationCurvePath}
                          fill="none"
                          stroke="var(--accent, #f59e0b)"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-90 drop-shadow-sm"
                        />
                      )}

                      {/* =============================================================
                          CURVAS DE TRAYECTORIA FUTURA (THEME ACCENT)
                         ============================================================= */}
                      {/* Curva lineal esperada */}
                      <path
                        d={
                          "M " +
                          report.timelinePoints
                            .map((pt) => `${scales.getX(pt.timestamp)} ${scales.getY(pt.linearExpected)}`)
                            .join(" L ")
                        }
                        fill="none"
                        stroke="var(--accent-light, #fbbf24)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeDasharray={activeMode === "metabolic" ? "4 3" : undefined}
                      />

                      {/* Curva metabólica asintótica (Modo 2) */}
                      {activeMode === "metabolic" && (
                        <>
                          <path
                            d={
                              "M " +
                              report.timelinePoints
                                .map((pt) => `${scales.getX(pt.timestamp)} ${scales.getY(pt.metabolicExpected)}`)
                                .join(" L ")
                            }
                            fill="none"
                            stroke="#34d399"
                            strokeWidth={3}
                            strokeLinecap="round"
                          />
                          {/* Línea horizontal del plateau asintótico */}
                          <line
                            x1={scales.getX(report.latestTimestamp)}
                            y1={scales.getY(report.metabolic.asymptoteWeight)}
                            x2={svgDimensions.width - svgDimensions.padding.right}
                            y2={scales.getY(report.metabolic.asymptoteWeight)}
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="6 4"
                          />
                          <text
                            x={svgDimensions.width - svgDimensions.padding.right}
                            y={scales.getY(report.metabolic.asymptoteWeight) - 8}
                            textAnchor="end"
                            className="text-xs fill-emerald-400 font-mono font-bold"
                          >
                            Asíntota Plateau: {report.metabolic.asymptoteWeight} kg
                          </text>
                        </>
                      )}

                      {/* Línea objetivo meta para Proyección Inversa (Modo 5) */}
                      {activeMode === "inverse" && report.inverseTarget && (
                        <>
                          <line
                            x1={scales.getX(report.latestTimestamp)}
                            y1={scales.getY(report.inverseTarget.targetWeight)}
                            x2={svgDimensions.width - svgDimensions.padding.right}
                            y2={scales.getY(report.inverseTarget.targetWeight)}
                            stroke="#60a5fa"
                            strokeWidth={1.8}
                            strokeDasharray="5 3"
                          />
                          <text
                            x={svgDimensions.width - svgDimensions.padding.right}
                            y={scales.getY(report.inverseTarget.targetWeight) - 8}
                            textAnchor="end"
                            className="text-xs fill-blue-400 font-mono font-bold"
                          >
                            Meta Objetivo: {report.inverseTarget.targetWeight} kg
                          </text>
                        </>
                      )}

                      {/* =============================================================
                          PUNTOS HISTÓRICOS SOBRE LA CURVA
                         ============================================================= */}
                      {calibrationPoints.map((pt, idx) => {
                        const cx = scales.getX(pt.timestamp);
                        const cy = scales.getY(pt.weight);
                        const isLatest = idx === calibrationPoints.length - 1;
                        return (
                          <g key={idx}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isLatest ? 6 : 4}
                              fill={isLatest ? "var(--accent-light, #fbbf24)" : "var(--accent, #f59e0b)"}
                              stroke="#ffffff"
                              strokeWidth={isLatest ? 2 : 1.5}
                              className="transition-transform hover:scale-150 cursor-pointer drop-shadow-sm"
                            />
                          </g>
                        );
                      })}

                      {/* Baliza terminal en la fecha objetivo adaptada al Theme */}
                      <g
                        transform={`translate(${scales.getX(report.targetTimestamp)}, ${scales.getY(
                          activeMode === "metabolic"
                            ? report.metabolic.projectedWeight
                            : report.linear.projectedWeight
                        )})`}
                      >
                        <circle r={9} fill="var(--accent, #f59e0b)" opacity={0.35} className="animate-ping" />
                        <circle r={5.5} fill="var(--accent-light, #fbbf24)" stroke="#ffffff" strokeWidth={2} />
                      </g>

                      {/* =============================================================
                          CROSSHAIR INTERACTIVO EN HOVER
                         ============================================================= */}
                      {hoveredPoint && (
                        <g>
                          <line
                            x1={hoveredPoint.x}
                            y1={svgDimensions.padding.top}
                            x2={hoveredPoint.x}
                            y2={svgDimensions.height - svgDimensions.padding.bottom}
                            stroke="var(--accent-light, #fbbf24)"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={hoveredPoint.x}
                            cy={hoveredPoint.y}
                            r={5.5}
                            fill="var(--accent-light, #fbbf24)"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        </g>
                      )}
                    </svg>
                  )}

                  {/* Tooltip flotante con detalles estadísticos (Tipografía legible) */}
                  {hoveredPoint && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${(hoveredPoint.x / svgDimensions.width) * 100}%`,
                        top: "14px",
                        transform: "translateX(-50%)",
                      }}
                      className="pointer-events-none z-30 p-3 rounded-2xl bg-zinc-950/95 border border-accent/50 shadow-2xl text-xs sm:text-sm font-mono flex flex-col gap-1.5 min-w-[240px] backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-bold text-zinc-100">
                        <span>{hoveredPoint.dateLabel}</span>
                        <span className="text-accent-light text-sm font-extrabold">
                          {activeMode === "metabolic"
                            ? `${hoveredPoint.metabolicVal} kg`
                            : `${hoveredPoint.linearVal} kg`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-xs">
                        <span>Intervalo 95% (2σ):</span>
                        <span className="text-zinc-200 font-semibold">
                          [{hoveredPoint.lower95} — {hoveredPoint.upper95}] kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-xs">
                        <span>Intervalo 68% (1σ):</span>
                        <span className="text-zinc-200 font-semibold">
                          [{hoveredPoint.lower68} — {hoveredPoint.upper68}] kg
                        </span>
                      </div>
                      {activeMode === "montecarlo" && (
                        <div className="flex items-center justify-between text-accent-light text-xs pt-1 border-t border-zinc-900 font-bold">
                          <span>Monte Carlo P50:</span>
                          <span>{hoveredPoint.monteCarloP50} kg</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. VISTAS ESPECIALIZADAS POR MODO */}
              {activeMode === "inverse" && report.inverseTarget && (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-blue-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                        <TargetIcon className="w-4 h-4" />
                        <span>Configuración de Peso Meta Objetivo</span>
                      </h4>
                      <p className="text-sm text-zinc-400 mt-0.5">
                        Define el peso que deseas alcanzar para resolver el tiempo estocástico necesario.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-sm text-zinc-300 font-mono font-semibold">Peso Meta:</span>
                      <div className="relative w-32">
                        <input
                          type="number"
                          step="0.1"
                          value={userTargetWeight}
                          onChange={(e) => setUserTargetWeight(e.target.value)}
                          placeholder={report.inverseTarget.targetWeight.toString()}
                          className="w-full bg-zinc-950 border border-blue-500/40 rounded-xl px-3.5 py-2 text-sm text-blue-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {report.inverseTarget.isDiverging ? (
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-sm flex items-center gap-3.5">
                      <AlertTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <strong className="block font-bold">Divergencia de Trayectoria Detectada</strong>
                        <span className="text-xs text-amber-200/90 leading-relaxed">
                          Tu peso actual es de {report.latestWeight} kg y tu meta es {report.inverseTarget.targetWeight} kg,
                          pero tu velocidad actual es de {report.linear.slopeWeekly > 0 ? `+${report.linear.slopeWeekly}` : report.linear.slopeWeekly} kg/sem
                          (en dirección contraria a la meta). Necesitas un cambio calórico neto de signo contrario.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm font-mono">
                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-blue-500/20">
                        <span className="text-xs text-zinc-400 uppercase block font-semibold">Fecha Esperada (P50)</span>
                        <span className="text-lg font-bold text-blue-300 mt-1.5 block">
                          🎯 {report.inverseTarget.expectedDateLabel}
                        </span>
                        <span className="text-xs text-zinc-400 mt-0.5 block">
                          En aprox. {report.inverseTarget.expectedDays} días
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-500/20">
                        <span className="text-xs text-zinc-400 uppercase block font-semibold">Escenario Rápido (P10)</span>
                        <span className="text-lg font-bold text-emerald-400 mt-1.5 block">
                          ⚡ {report.inverseTarget.optimisticDateLabel}
                        </span>
                        <span className="text-xs text-zinc-400 mt-0.5 block">Si se mantiene el ritmo superior</span>
                      </div>

                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                        <span className="text-xs text-zinc-400 uppercase block font-semibold">Escenario Conservador (P90)</span>
                        <span className="text-lg font-bold text-zinc-200 mt-1.5 block">
                          🛡️ {report.inverseTarget.conservativeDateLabel}
                        </span>
                        <span className="text-xs text-zinc-400 mt-0.5 block">Contemplando mesetas menores</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeMode === "thermo" && (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-accent/30 space-y-3.5">
                  <h4 className="text-sm font-bold text-accent-light uppercase tracking-wider flex items-center gap-2">
                    <FlameIcon className="w-4 h-4" />
                    <span>Física del Balance Energético Sostenido</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm">
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase block font-semibold">Interpretación Fisiológica</span>
                      <p className="text-sm text-zinc-200 mt-1.5 leading-relaxed">
                        {report.thermodynamics.interpretation}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase block font-semibold">Incertidumbre Térmica (95%)</span>
                      <p className="text-base text-zinc-100 font-bold mt-1.5 font-mono">
                        ±{report.thermodynamics.confidenceKcalMargin} kcal/día
                      </p>
                      <span className="text-xs text-zinc-400 mt-0.5 block">Derivada del error estándar muestral</span>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase block font-semibold">Compensación Metabólica Estimada</span>
                      <p className="text-base text-zinc-100 font-bold mt-1.5 font-mono">
                        ~{report.thermodynamics.tdeeShiftEstimate > 0 ? `+${report.thermodynamics.tdeeShiftEstimate}` : report.thermodynamics.tdeeShiftEstimate} kcal/día
                      </p>
                      <span className="text-xs text-zinc-400 mt-0.5 block">Ajuste adaptativo en BMR/NEAT</span>
                    </div>
                  </div>
                </div>
              )}

              {activeMode === "montecarlo" && (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-accent/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-accent-light uppercase tracking-wider flex items-center gap-2">
                      <ZapIcon className="w-4 h-4" />
                      <span>Distribución Percentil de Monte Carlo al Horizonte ({report.horizonDays}d)</span>
                    </h4>
                    <span className="text-xs text-zinc-400 font-mono font-semibold">
                      1.000 trayectorias autorregresivas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm font-mono">
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-xs text-zinc-400 block font-semibold">P10 (Rápido)</span>
                      <span className="text-lg font-bold text-emerald-400 mt-1 block">{report.monteCarlo.finalP10} kg</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-xs text-zinc-400 block font-semibold">P25 (Favorable)</span>
                      <span className="text-lg font-bold text-emerald-300 mt-1 block">{report.monteCarlo.finalP25} kg</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-accent/50 text-center bg-accent/15">
                      <span className="text-xs text-accent-light block font-bold">P50 (Mediana)</span>
                      <span className="text-lg font-extrabold text-accent-light mt-1 block">{report.monteCarlo.finalP50} kg</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-xs text-zinc-400 block font-semibold">P75 (Moderado)</span>
                      <span className="text-lg font-bold text-zinc-200 mt-1 block">{report.monteCarlo.finalP75} kg</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-xs text-zinc-400 block font-semibold">P90 (Lento)</span>
                      <span className="text-lg font-bold text-zinc-300 mt-1 block">{report.monteCarlo.finalP90} kg</span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                    La dispersión total esperada al horizonte es de <strong>{report.monteCarlo.spread90} kg</strong> entre el percentil 10 y el 90, reflejando el ancho del cono de variabilidad biológica.
                  </p>
                </div>
              )}

              {activeMode === "metabolic" && (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-emerald-500/30 space-y-4">
                  <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                    <TrendingDownIcon className="w-4 h-4" />
                    <span>Diagnóstico de Freno y Adaptación Asintótica</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm">
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase block font-semibold">Diagnóstico de Meseta</span>
                      <p className="text-sm text-zinc-200 mt-1.5 leading-relaxed">
                        {report.metabolic.explanation}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase block font-semibold">Constante k & Vida Media</span>
                      <p className="text-sm text-zinc-200 mt-1.5 font-mono font-bold">
                        k = {report.metabolic.rateConstantK} d⁻¹ (t½ = {report.metabolic.halfLifeDays} días)
                      </p>
                      <span className="text-xs text-zinc-400 mt-0.5 block">Tiempo de relajación al 50% del equilibrio</span>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase block font-semibold">Impacto en el Horizonte</span>
                      <p className="text-sm text-zinc-200 mt-1.5 font-mono font-bold">
                        Δ = {report.metabolic.deltaFromLinear > 0 ? `+${report.metabolic.deltaFromLinear}` : report.metabolic.deltaFromLinear} kg vs lineal
                      </p>
                      <span className="text-xs text-zinc-400 mt-0.5 block">Diferencia proyectada por resistencia metabólica</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-sm text-zinc-400 font-mono">
          <span>byteHevy Scientific Engine · Cinemática pura libre de impedancia</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-bold transition-colors cursor-pointer"
          >
            Cerrar Módulo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
