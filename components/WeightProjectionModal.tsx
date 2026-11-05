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
  const [calibrationWindowDays, setCalibrationWindowDays] = useState<number>(45);
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
    if (points.length < 3) return null;
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
    return filtered.length >= 4 ? filtered : points.slice(-15);
  }, [report, points]);

  // Escalas matemáticas para el SVG
  const svgDimensions = { width: 900, height: 380, padding: { top: 30, right: 65, bottom: 40, left: 55 } };
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
    const yStep = ySpan > 10 ? 2 : ySpan > 5 ? 1 : 0.5;
    const yTicks: number[] = [];
    for (let w = minY; w <= maxY + 0.001; w += yStep) {
      yTicks.push(Math.round(w * 10) / 10);
    }

    // Ticks temporales para eje X
    const xTicks: { ts: number; label: string }[] = [];
    const totalDays = Math.round(timeSpan / 86400000);
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

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-[1500px] max-h-[94vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden z-10 text-zinc-100">
        
        {/* =========================================================================
            HEADER DE TELEMETRÍA Y CONTROLES DE INGENIERÍA
           ========================================================================= */}
        <div className="px-5 py-4 border-b border-zinc-800/90 bg-zinc-900/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm shrink-0">
              <SparklesIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                  Módulo de Proyección & Cinemática de Peso
                </h2>
                {activeSeasonName && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent-light font-semibold">
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
                Modelado estocástico, cinemática de derivadas (velocidad/aceleración) y balance termodinámico riguroso.
              </p>
            </div>
          </div>

          {/* Controles: Selector de Ventana de Calibración & Horizonte Científico */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
            {/* Ventana de Calibración */}
            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-zinc-500 font-mono text-[10px] uppercase">Calibración:</span>
              <select
                value={calibrationWindowDays}
                onChange={(e) => setCalibrationWindowDays(Number(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value={14} className="bg-zinc-900">Últimos 14 días (Reactivo)</option>
                <option value={30} className="bg-zinc-900">Últimos 30 días</option>
                <option value={45} className="bg-zinc-900">Últimos 45 días (Equilibrado)</option>
                <option value={60} className="bg-zinc-900">Últimos 60 días (Robusto)</option>
                <option value={90} className="bg-zinc-900">Últimos 90 días (Largo Plazo)</option>
              </select>
            </div>

            {/* Horizonte Temporal con Badge de Recomendación Científica */}
            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-purple-500/30 rounded-xl px-2.5 py-1 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 text-purple-400" />
              <select
                value={selectedHorizonId}
                onChange={(e) => setSelectedHorizonId(e.target.value as ProjectionHorizonId)}
                className="bg-transparent text-purple-200 font-bold text-xs focus:outline-none cursor-pointer"
              >
                {HORIZON_PRESETS.map((h) => (
                  <option key={h.id} value={h.id} className="bg-zinc-900 text-zinc-200">
                    {h.label} {h.isRecommended ? "⭐ (Recomendado)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Cerrar */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Cerrar modal"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            CUERPO PRINCIPAL DEL MODAL (CON SCROLL INTERNO SUAVE)
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {!report ? (
            <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <AlertTriangleIcon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-zinc-200">Datos Insuficientes para Proyección</h3>
              <p className="text-xs text-zinc-500 max-w-md">
                Se requieren al menos 3 pesajes válidos dentro de la ventana de calibración para ajustar los modelos estadísticos.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Selector de Modo / Perspectiva Analítica */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 overflow-x-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveMode("cone")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "cone"
                      ? "bg-purple-900/50 text-purple-200 border border-purple-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  <ActivityIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>1. Cono de Incertidumbre (WLS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("metabolic")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "metabolic"
                      ? "bg-purple-900/50 text-purple-200 border border-purple-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  <TrendingDownIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Adaptación Metabólica (Plateau)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("montecarlo")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "montecarlo"
                      ? "bg-purple-900/50 text-purple-200 border border-purple-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  <ZapIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>3. Simulación Monte Carlo (1.000 Trayectorias)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("thermo")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "thermo"
                      ? "bg-purple-900/50 text-purple-200 border border-purple-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  <FlameIcon className="w-3.5 h-3.5 text-rose-400" />
                  <span>4. Balance Termodinámico (kcal/día)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode("inverse")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeMode === "inverse"
                      ? "bg-purple-900/50 text-purple-200 border border-purple-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  <TargetIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>5. Proyección Inversa (Meta)</span>
                </button>
              </div>

              {/* 2. Cartel Explicativo Riguroso del Modo Activo */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-purple-950/20 border border-zinc-800 shadow-sm">
                {activeMode === "cone" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                      <ActivityIcon className="w-4 h-4" />
                      <span>Modo 1: Regresión WLS con Cono de Predicción al 68% (1σ) y 95% (2σ)</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      <strong>Fundamento Matemático:</strong> Ajusta una regresión lineal con ponderación exponencial decreciente en el tiempo (<span className="font-mono text-purple-300">λ=t/45d</span>). Calcula el intervalo de predicción formal que contempla tanto la incertidumbre de los parámetros muestrales como la varianza aleatoria individual futura.
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> En biología, una línea recta sola es una falacia. Este modelo te muestra el <em>rango de dispersión probabilístico real</em> donde aterrizará tu peso, ensanchándose proporcionalmente a <span className="font-mono">√(1 + 1/N + Δt²)</span>.
                    </p>
                  </div>
                )}

                {activeMode === "metabolic" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      <TrendingDownIcon className="w-4 h-4" />
                      <span>Modo 2: Ecuación Diferencial Asintótica de Adaptación Metabólica (Plateau)</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      <strong>Fundamento Físico:</strong> Basado en el modelo dinámico de Kevin Hall (NIH). Modela el freno metabólico (<span className="font-mono text-emerald-300">dW/dt = -k(W - W∞)</span>), donde el gasto energético en reposo decrece a medida que disminuye la masa celular activa.
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> Permite saber si tu ritmo actual está entrando en una meseta fisiológica natural y predice el peso límite de equilibrio (<span className="font-mono font-bold text-emerald-400">{report.metabolic.asymptoteWeight} kg</span>) si no modificas tus calorías o tu nivel de actividad física.
                    </p>
                  </div>
                )}

                {activeMode === "montecarlo" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                      <ZapIcon className="w-4 h-4" />
                      <span>Modo 3: Simulación Estocástica de Monte Carlo (1.000 Iteraciones AR(1))</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      <strong>Fundamento Estadístico:</strong> Corre 1.000 simulaciones numéricas del camino aleatorio del peso incorporando la autocorrelación serial empírica (<span className="font-mono text-amber-300">AR(1), ρ={report.linear.durbinWatson ? ((2 - report.linear.durbinWatson) / 2).toFixed(2) : "0.20"}</span>) observada en tus fluctuaciones hídricas.
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> Revela las densidades empíricas de los percentiles P10, P25, P50 (mediana), P75 y P90. Muestra escenarios optimistas vs conservadores respetando las leyes de correlación temporal del cuerpo humano.
                    </p>
                  </div>
                )}

                {activeMode === "thermo" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                      <FlameIcon className="w-4 h-4" />
                      <span>Modo 4: Termodinámica & Balance Energético Neto Real Implícito</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      <strong>Fundamento Termodinámico:</strong> Aplica la constante energética de tejido humano mixto (<span className="font-mono text-rose-300">~7.700 kcal/kg</span> de Wishnofsky) sobre la primera derivada temporal de tu peso (<span className="font-mono">Ẇ = dW/dt</span>).
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> No depende de si calculaste bien tus calorías en una app: te dice el <em>déficit o superávit neto real sostenido por tus mitocondrias</em> con su intervalo de confianza estadístico.
                    </p>
                  </div>
                )}

                {activeMode === "inverse" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-300 font-bold text-xs uppercase tracking-wider">
                      <TargetIcon className="w-4 h-4" />
                      <span>Modo 5: Proyección Inversa / Time-to-Target (Tiempo Estimado hacia Peso Objetivo)</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      <strong>Fundamento Analítico:</strong> Resuelve el problema inverso en el espacio de estados: dado un peso objetivo meta <span className="font-mono text-blue-300">W_meta</span>, calcula la fecha más probable de llegada (P50) junto con la ventana de dispersión P10-P90.
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <strong>Por qué es útil:</strong> Diagnostica si tu ritmo actual es físicamente viable para tu meta o si existe divergencia termodinámica (ritmo en sentido contrario al objetivo deseado).
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Panel Ribbon de Telemetría Numérica */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {/* 1. Peso Inicial Calibrado */}
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Peso de Partida
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold font-mono text-zinc-200">
                      {report.latestWeight.toFixed(1)}
                    </span>
                    <span className="text-xs text-zinc-500">kg</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-0.5">Última medición</span>
                </div>

                {/* 2. Proyección Esperada */}
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-purple-500/30 flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center justify-between">
                    <span>Estimado ({report.horizonDays}d)</span>
                    <span className="text-[9px] bg-purple-500/20 px-1 rounded text-purple-300">P50</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-purple-300">
                      {activeMode === "metabolic"
                        ? report.metabolic.projectedWeight.toFixed(1)
                        : report.linear.projectedWeight.toFixed(1)}
                    </span>
                    <span className="text-xs text-purple-400/80">kg</span>
                    <span
                      className={`text-[11px] font-mono font-bold ml-1 ${
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
                  <span className="text-[10px] text-purple-300/70 font-mono">
                    🎯 {report.targetDateLabel}
                  </span>
                </div>

                {/* 3. Velocidad Semanal (dW/dt) */}
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Velocidad (dW/dt)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-lg font-bold font-mono ${
                        report.linear.slopeWeekly < 0
                          ? "text-emerald-400"
                          : report.linear.slopeWeekly > 0
                          ? "text-amber-400"
                          : "text-zinc-200"
                      }`}
                    >
                      {report.linear.slopeWeekly > 0 ? `+${report.linear.slopeWeekly}` : report.linear.slopeWeekly}
                    </span>
                    <span className="text-xs text-zinc-400">kg/sem</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {Math.round(report.linear.slopeDaily * 1000)} g/día
                  </span>
                </div>

                {/* 4. Aceleración / Curvatura (d2W/dt2) */}
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Aceleración (d²W/dt²)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold font-mono text-zinc-200">
                      {report.metabolic.currentDeceleration > 0 ? `+${report.metabolic.currentDeceleration}` : report.metabolic.currentDeceleration}
                    </span>
                    <span className="text-[10px] text-zinc-500">g/día²</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate">
                    {report.metabolic.hasPlateauTendency ? "Freno metabólico detectado" : "Ritmo estable"}
                  </span>
                </div>

                {/* 5. Calidad Estadística (R2 / RMSE) */}
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Ruido Biológico (RMSE)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold font-mono text-zinc-200">
                      ±{report.linear.rmse.toFixed(2)}
                    </span>
                    <span className="text-xs text-zinc-400">kg</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    R²={report.linear.r2.toFixed(2)} {report.linear.isSignificant ? "(p<0.05)" : "(p≥0.05)"}
                  </span>
                </div>

                {/* 6. Déficit/Superávit Calórico Implícito */}
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Balance Neto Implícito
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-lg font-bold font-mono ${
                        report.thermodynamics.impliedNetKcalDaily < 0
                          ? "text-emerald-400"
                          : report.thermodynamics.impliedNetKcalDaily > 0
                          ? "text-amber-400"
                          : "text-zinc-200"
                      }`}
                    >
                      {report.thermodynamics.impliedNetKcalDaily > 0 ? `+${report.thermodynamics.impliedNetKcalDaily}` : report.thermodynamics.impliedNetKcalDaily}
                    </span>
                    <span className="text-xs text-zinc-400">kcal/d</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ~{Math.abs(report.thermodynamics.impliedNetKcalWeekly)} kcal/sem
                  </span>
                </div>
              </div>

              {/* 4. GRÁFICO INTERACTIVO SVG DE ALTA DEFINICIÓN */}
              <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 shadow-xl flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                      Trayectoria Cinemática & Espacio de Estados
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span>Pesajes reales</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-0.5 bg-purple-400" />
                      <span>Tendencia esperada</span>
                    </span>
                    {(activeMode === "cone" || activeMode === "montecarlo") && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 bg-purple-500/20 border border-purple-500/40 rounded-xs" />
                        <span>Cono de predicción (95%)</span>
                      </span>
                    )}
                    {activeMode === "metabolic" && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-0.5 border-t border-dashed border-emerald-400" />
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
                      className="w-full h-auto max-h-[460px] overflow-visible"
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
                        {/* Gradiente Cono de Incertidumbre al 95% */}
                        <linearGradient id="coneGradient95" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
                        </linearGradient>

                        {/* Gradiente Cono al 68% */}
                        <linearGradient id="coneGradient68" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.16" />
                        </linearGradient>

                        {/* Gradiente Monte Carlo Fan */}
                        <linearGradient id="mcGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#d97706" stopOpacity="0.08" />
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
                              x={svgDimensions.padding.left - 8}
                              y={y + 3.5}
                              textAnchor="end"
                              className="text-[10px] fill-zinc-500 font-mono"
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
                              y={svgDimensions.height - svgDimensions.padding.bottom + 16}
                              textAnchor="middle"
                              className="text-[10px] fill-zinc-500 font-mono"
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
                        stroke="#71717a"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                      />
                      <text
                        x={scales.getX(report.latestTimestamp) - 6}
                        y={svgDimensions.padding.top + 10}
                        textAnchor="end"
                        className="text-[9px] fill-zinc-400 font-mono font-semibold"
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
                            fill="url(#coneGradient95)"
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
                            fill="url(#coneGradient68)"
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
                            fill="url(#mcGradient)"
                          />
                        </>
                      )}

                      {/* =============================================================
                          CURVAS DE TRAYECTORIA FUTURA
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
                        stroke="#c084fc"
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
                            y={scales.getY(report.metabolic.asymptoteWeight) - 6}
                            textAnchor="end"
                            className="text-[10px] fill-emerald-400 font-mono font-bold"
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
                            y={scales.getY(report.inverseTarget.targetWeight) - 6}
                            textAnchor="end"
                            className="text-[10px] fill-blue-400 font-mono font-bold"
                          >
                            Meta Objetivo: {report.inverseTarget.targetWeight} kg
                          </text>
                        </>
                      )}

                      {/* =============================================================
                          PUNTOS HISTÓRICOS REALES DE CALIBRACIÓN
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
                              r={isLatest ? 5.5 : 3.5}
                              fill={isLatest ? "#a855f7" : "#3b82f6"}
                              stroke={isLatest ? "#ffffff" : "#1e3a8a"}
                              strokeWidth={1.5}
                              className="transition-transform hover:scale-150 cursor-pointer"
                            />
                          </g>
                        );
                      })}

                      {/* Baliza terminal en la fecha objetivo */}
                      <g
                        transform={`translate(${scales.getX(report.targetTimestamp)}, ${scales.getY(
                          activeMode === "metabolic"
                            ? report.metabolic.projectedWeight
                            : report.linear.projectedWeight
                        )})`}
                      >
                        <circle r={8} fill="#a855f7" opacity={0.3} className="animate-ping" />
                        <circle r={5} fill="#9333ea" stroke="#ffffff" strokeWidth={2} />
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
                            stroke="#a855f7"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={hoveredPoint.x}
                            cy={hoveredPoint.y}
                            r={5}
                            fill="#c084fc"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        </g>
                      )}
                    </svg>
                  )}

                  {/* Tooltip flotante con detalles estadísticos */}
                  {hoveredPoint && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${(hoveredPoint.x / svgDimensions.width) * 100}%`,
                        top: "12px",
                        transform: "translateX(-50%)",
                      }}
                      className="pointer-events-none z-30 p-2.5 rounded-xl bg-zinc-950/95 border border-purple-500/40 shadow-2xl text-[11px] font-mono flex flex-col gap-1 min-w-[210px] backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-1 font-bold text-zinc-200">
                        <span>{hoveredPoint.dateLabel}</span>
                        <span className="text-purple-400">
                          {activeMode === "metabolic"
                            ? `${hoveredPoint.metabolicVal} kg`
                            : `${hoveredPoint.linearVal} kg`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                        <span>Intervalo 95% (2σ):</span>
                        <span className="text-zinc-300">
                          [{hoveredPoint.lower95} — {hoveredPoint.upper95}] kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                        <span>Intervalo 68% (1σ):</span>
                        <span className="text-zinc-300">
                          [{hoveredPoint.lower68} — {hoveredPoint.upper68}] kg
                        </span>
                      </div>
                      {activeMode === "montecarlo" && (
                        <div className="flex items-center justify-between text-amber-400 text-[10px] pt-0.5 border-t border-zinc-900">
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
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-blue-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                        <TargetIcon className="w-4 h-4" />
                        <span>Configuración de Peso Meta Objetivo</span>
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Define el peso que deseas alcanzar para resolver el tiempo estocástico necesario.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 font-mono">Peso Meta:</span>
                      <div className="relative w-28">
                        <input
                          type="number"
                          step="0.1"
                          value={userTargetWeight}
                          onChange={(e) => setUserTargetWeight(e.target.value)}
                          placeholder={report.inverseTarget.targetWeight.toString()}
                          className="w-full bg-zinc-950 border border-blue-500/40 rounded-xl px-3 py-1.5 text-xs text-blue-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {report.inverseTarget.isDiverging ? (
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
                      <AlertTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <strong className="block font-semibold">Divergencia de Trayectoria Detectada</strong>
                        <span>
                          Tu peso actual es de {report.latestWeight} kg y tu meta es {report.inverseTarget.targetWeight} kg,
                          pero tu velocidad actual es de {report.linear.slopeWeekly > 0 ? `+${report.linear.slopeWeekly}` : report.linear.slopeWeekly} kg/sem
                          (en dirección contraria a la meta). Necesitas un cambio calórico neto de signo contrario.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-blue-500/20">
                        <span className="text-[10px] text-zinc-500 uppercase block">Fecha Esperada (P50)</span>
                        <span className="text-base font-bold text-blue-300 mt-1 block">
                          🎯 {report.inverseTarget.expectedDateLabel}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          En aprox. {report.inverseTarget.expectedDays} días
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-emerald-500/20">
                        <span className="text-[10px] text-zinc-500 uppercase block">Escenario Rápido (P10)</span>
                        <span className="text-base font-bold text-emerald-400 mt-1 block">
                          ⚡ {report.inverseTarget.optimisticDateLabel}
                        </span>
                        <span className="text-[10px] text-zinc-400">Si se mantiene el ritmo superior</span>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase block">Escenario Conservador (P90)</span>
                        <span className="text-base font-bold text-zinc-300 mt-1 block">
                          🛡️ {report.inverseTarget.conservativeDateLabel}
                        </span>
                        <span className="text-[10px] text-zinc-400">Contemplando mesetas menores</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeMode === "thermo" && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-rose-500/30 space-y-3">
                  <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                    <FlameIcon className="w-4 h-4" />
                    <span>Física del Balance Energético Sostenido</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Interpretación Fisiológica</span>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {report.thermodynamics.interpretation}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Incertidumbre Térmica (95%)</span>
                      <p className="text-xs text-zinc-300 mt-1 font-mono">
                        ±{report.thermodynamics.confidenceKcalMargin} kcal/día
                      </p>
                      <span className="text-[10px] text-zinc-500">Derivada del error estándar muestral</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Compensación Metabólica Estimada</span>
                      <p className="text-xs text-zinc-300 mt-1 font-mono">
                        ~{report.thermodynamics.tdeeShiftEstimate > 0 ? `+${report.thermodynamics.tdeeShiftEstimate}` : report.thermodynamics.tdeeShiftEstimate} kcal/día
                      </p>
                      <span className="text-[10px] text-zinc-500">Ajuste adaptativo en BMR/NEAT</span>
                    </div>
                  </div>
                </div>
              )}

              {activeMode === "montecarlo" && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <ZapIcon className="w-4 h-4" />
                      <span>Distribución Percentil de Monte Carlo al Horizonte ({report.horizonDays}d)</span>
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      1.000 trayectorias autorregresivas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-[10px] text-zinc-500 block">P10 (Rápido)</span>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{report.monteCarlo.finalP10} kg</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-[10px] text-zinc-500 block">P25 (Favorable)</span>
                      <span className="text-sm font-bold text-emerald-300 mt-0.5 block">{report.monteCarlo.finalP25} kg</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-amber-500/40 text-center bg-amber-500/10">
                      <span className="text-[10px] text-amber-300 block font-bold">P50 (Mediana)</span>
                      <span className="text-sm font-bold text-amber-200 mt-0.5 block">{report.monteCarlo.finalP50} kg</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-[10px] text-zinc-500 block">P75 (Moderado)</span>
                      <span className="text-sm font-bold text-zinc-300 mt-0.5 block">{report.monteCarlo.finalP75} kg</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                      <span className="text-[10px] text-zinc-500 block">P90 (Lento)</span>
                      <span className="text-sm font-bold text-zinc-400 mt-0.5 block">{report.monteCarlo.finalP90} kg</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                    La dispersión total esperada al horizonte es de <strong>{report.monteCarlo.spread90} kg</strong> entre el percentil 10 y el 90, reflejando el ancho del cono de variabilidad biológica.
                  </p>
                </div>
              )}

              {activeMode === "metabolic" && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/30 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                    <TrendingDownIcon className="w-4 h-4" />
                    <span>Diagnóstico de Freno y Adaptación Asintótica</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Diagnóstico de Meseta</span>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {report.metabolic.explanation}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Constante k & Vida Media</span>
                      <p className="text-xs text-zinc-300 mt-1 font-mono">
                        k = {report.metabolic.rateConstantK} d⁻¹ (t½ = {report.metabolic.halfLifeDays} días)
                      </p>
                      <span className="text-[10px] text-zinc-500">Tiempo de relajación al 50% del equilibrio</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Impacto en el Horizonte</span>
                      <p className="text-xs text-zinc-300 mt-1 font-mono">
                        Δ = {report.metabolic.deltaFromLinear > 0 ? `+${report.metabolic.deltaFromLinear}` : report.metabolic.deltaFromLinear} kg vs lineal
                      </p>
                      <span className="text-[10px] text-zinc-500">Diferencia proyectada por resistencia metabólica</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>byteHevy Scientific Engine · Proyección libre de impedancia (% grasa excluido)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cerrar Módulo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
