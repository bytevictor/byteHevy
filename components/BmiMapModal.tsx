"use client";

import React, { useState, useMemo } from "react";
import {
  XIcon,
  ScaleIcon,
  UserIcon,
  TargetIcon,
  InfoIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from "./Icons";
import { useUserProfile, getBmiCategory } from "@/lib/user-profile-context";

export interface BmiMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  weight?: number; // Peso a evaluar (por defecto usa el peso actual o más reciente)
}

interface BmiRangeDef {
  id: string;
  label: string;
  subLabel: string;
  minBmi: number;
  maxBmi: number;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  fillColor: string;
  gradientId: string;
  description: string;
}

const BMI_RANGES: BmiRangeDef[] = [
  {
    id: "underweight",
    label: "Bajo Peso",
    subLabel: "Insuficiencia ponderal",
    minBmi: 0,
    maxBmi: 18.5,
    color: "#38bdf8", // Sky-400
    textColor: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    fillColor: "#0284c7",
    gradientId: "grad-underweight",
    description: "Peso por debajo del rango estándar recomendado por la OMS.",
  },
  {
    id: "normal",
    label: "Normopeso",
    subLabel: "Peso saludable",
    minBmi: 18.5,
    maxBmi: 24.9,
    color: "#10b981", // Emerald-500
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    fillColor: "#059669",
    gradientId: "grad-normal",
    description: "Rango óptimo con menor riesgo epidemiológico cardiovascular y metabólico.",
  },
  {
    id: "overweight",
    label: "Sobrepeso",
    subLabel: "Preobesidad",
    minBmi: 25.0,
    maxBmi: 29.9,
    color: "#f59e0b", // Amber-500
    textColor: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    fillColor: "#d97706",
    gradientId: "grad-overweight",
    description: "En personas que entrenan fuerza suele deberse a masa muscular y no a grasa.",
  },
  {
    id: "obesity1",
    label: "Obesidad Clase I",
    subLabel: "Leve / Moderada",
    minBmi: 30.0,
    maxBmi: 34.9,
    color: "#f97316", // Orange-500
    textColor: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    fillColor: "#ea580c",
    gradientId: "grad-obesity1",
    description: "Incremento moderado del riesgo para la salud general.",
  },
  {
    id: "obesity2",
    label: "Obesidad Clase II",
    subLabel: "Severa",
    minBmi: 35.0,
    maxBmi: 39.9,
    color: "#ef4444", // Red-500
    textColor: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    fillColor: "#dc2626",
    gradientId: "grad-obesity2",
    description: "Incremento severo del riesgo cardiovascular y metabólico.",
  },
  {
    id: "obesity3",
    label: "Obesidad Clase III",
    subLabel: "Mórbida",
    minBmi: 40.0,
    maxBmi: 60.0,
    color: "#a855f7", // Purple-500
    textColor: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    fillColor: "#9333ea",
    gradientId: "grad-obesity3",
    description: "Alto riesgo clínico, requiere supervisión médica especializada.",
  },
];

export function BmiMapModal({ isOpen, onClose, weight: propWeight }: BmiMapModalProps) {
  const { profile, updateProfile, calculateBmi, getIdealWeightRange } = useUserProfile();

  // Peso a evaluar: o el pasado por prop o fallback a 75 kg
  const activeWeight = propWeight && propWeight > 0 ? propWeight : 75;
  const activeHeight = profile.alturaCm > 0 ? profile.alturaCm : 178;

  // Estado para simulación interactiva sobre el mapa
  const [simulatedPoint, setSimulatedPoint] = useState<{ weight: number; height: number } | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<{ weight: number; height: number; bmi: number } | null>(null);

  // Valores a mostrar (o el real o el simulado si el usuario hizo clic en otro sitio del mapa)
  const displayWeight = simulatedPoint ? simulatedPoint.weight : activeWeight;
  const displayHeight = simulatedPoint ? simulatedPoint.height : activeHeight;
  const displayBmi = calculateBmi(displayWeight);
  const displayCategory = getBmiCategory(displayBmi);
  const idealRange = getIdealWeightRange();

  // Dimensiones del SVG del mapa 2D
  const svgWidth = 720;
  const svgHeight = 440;
  const padding = { top: 35, right: 35, bottom: 45, left: 55 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Rangos de los ejes del mapa
  const minWeight = 40;
  const maxWeight = Math.max(135, Math.ceil((Math.max(activeWeight, displayWeight) + 15) / 5) * 5);
  const minHeight = 145;
  const maxHeight = 205;

  // Funciones de escala
  const getX = (w: number) => padding.left + ((w - minWeight) / (maxWeight - minWeight)) * innerWidth;
  const getY = (h: number) => padding.top + ((maxHeight - h) / (maxHeight - minHeight)) * innerHeight;

  const getWeightFromX = (x: number) => {
    const raw = minWeight + ((x - padding.left) / innerWidth) * (maxWeight - minWeight);
    return Math.round(Math.max(minWeight, Math.min(maxWeight, raw)) * 10) / 10;
  };

  const getHeightFromY = (y: number) => {
    const raw = maxHeight - ((y - padding.top) / innerHeight) * (maxHeight - minHeight);
    return Math.round(Math.max(minHeight, Math.min(maxHeight, raw)));
  };

  // Muestras de altura para generar las curvas suaves (cada 2 cm)
  const heightSamples = useMemo(() => {
    const list: number[] = [];
    for (let h = minHeight; h <= maxHeight; h += 2) list.push(h);
    if (list[list.length - 1] !== maxHeight) list.push(maxHeight);
    return list;
  }, [minHeight, maxHeight]);

  const clampW = (w: number) => Math.min(maxWeight, Math.max(minWeight, w));

  // Generación de polígonos de zonas en formato SVG path
  const zonePaths = useMemo(() => {
    // 1. Bajo peso: área a la izquierda de BMI = 18.5
    const pUnder: string[] = [];
    // Recorrer alturas de minHeight a maxHeight siguiendo w = 18.5 * (h/100)^2
    heightSamples.forEach((h, idx) => {
      const w = clampW(18.5 * Math.pow(h / 100, 2));
      const x = getX(w);
      const y = getY(h);
      if (idx === 0) pUnder.push(`M ${x} ${y}`);
      else pUnder.push(`L ${x} ${y}`);
    });
    // Borde superior a la izquierda
    pUnder.push(`L ${getX(minWeight)} ${getY(maxHeight)}`);
    // Borde izquierdo hasta abajo
    pUnder.push(`L ${getX(minWeight)} ${getY(minHeight)}`);
    pUnder.push("Z");

    // Función auxiliar para bandas entre bmiLower y bmiUpper
    const buildBandPath = (bmiLower: number, bmiUpper: number) => {
      const pts: string[] = [];
      // Subir por la curva superior (bmiUpper)
      heightSamples.forEach((h, idx) => {
        const w = clampW(bmiUpper * Math.pow(h / 100, 2));
        const x = getX(w);
        const y = getY(h);
        if (idx === 0) pts.push(`M ${x} ${y}`);
        else pts.push(`L ${x} ${y}`);
      });
      // Bajar por la curva inferior (bmiLower)
      for (let i = heightSamples.length - 1; i >= 0; i--) {
        const h = heightSamples[i];
        const w = clampW(bmiLower * Math.pow(h / 100, 2));
        const x = getX(w);
        const y = getY(h);
        pts.push(`L ${x} ${y}`);
      }
      pts.push("Z");
      return pts.join(" ");
    };

    const pNormal = buildBandPath(18.5, 24.9);
    const pOver = buildBandPath(24.9, 29.9);
    const pObese1 = buildBandPath(29.9, 34.9);
    const pObese2 = buildBandPath(34.9, 39.9);

    // Obesidad III: área a la derecha de BMI = 40.0
    const pObese3: string[] = [];
    heightSamples.forEach((h, idx) => {
      const w = clampW(40.0 * Math.pow(h / 100, 2));
      const x = getX(w);
      const y = getY(h);
      if (idx === 0) pObese3.push(`M ${x} ${y}`);
      else pObese3.push(`L ${x} ${y}`);
    });
    pObese3.push(`L ${getX(maxWeight)} ${getY(maxHeight)}`);
    pObese3.push(`L ${getX(maxWeight)} ${getY(minHeight)}`);
    pObese3.push("Z");

    // Curvas divisorias individuales
    const makeCurveLine = (bmi: number) => {
      return heightSamples
        .map((h, i) => {
          const w = clampW(bmi * Math.pow(h / 100, 2));
          return `${i === 0 ? "M" : "L"} ${getX(w)} ${getY(h)}`;
        })
        .join(" ");
    };

    return {
      under: pUnder.join(" "),
      normal: pNormal,
      over: pOver,
      obese1: pObese1,
      obese2: pObese2,
      obese3: pObese3.join(" "),
      line18_5: makeCurveLine(18.5),
      line25: makeCurveLine(25.0),
      line30: makeCurveLine(30.0),
      line35: makeCurveLine(35.0),
      line40: makeCurveLine(40.0),
    };
  }, [heightSamples, minWeight, maxWeight, minHeight, maxHeight, innerWidth, innerHeight]);

  if (!isOpen) return null;

  // Coordenadas del punto real del usuario
  const userPointX = getX(activeWeight);
  const userPointY = getY(activeHeight);

  // Coordenadas del punto simulado (si existe)
  const simPointX = simulatedPoint ? getX(simulatedPoint.weight) : null;
  const simPointY = simulatedPoint ? getY(simulatedPoint.height) : null;

  // Manejo de eventos del SVG
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const svgX = (clientX / rect.width) * svgWidth;
    const svgY = (clientY / rect.height) * svgHeight;

    if (
      svgX >= padding.left &&
      svgX <= svgWidth - padding.right &&
      svgY >= padding.top &&
      svgY <= svgHeight - padding.bottom
    ) {
      const w = getWeightFromX(svgX);
      const h = getHeightFromY(svgY);
      const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
      setHoveredCoord({ weight: w, height: h, bmi });
    } else {
      setHoveredCoord(null);
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const svgX = (clientX / rect.width) * svgWidth;
    const svgY = (clientY / rect.height) * svgHeight;

    if (
      svgX >= padding.left &&
      svgX <= svgWidth - padding.right &&
      svgY >= padding.top &&
      svgY <= svgHeight - padding.bottom
    ) {
      const w = getWeightFromX(svgX);
      const h = getHeightFromY(svgY);
      setSimulatedPoint({ weight: w, height: h });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* 1. Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
              <TargetIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Mapa de Tipos de Peso e IMC</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  OMS / Clinical
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Clasificación de Índice de Masa Corporal según tu estatura y peso corporal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Tarjetas de Métricas Biométricas Actuales */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 text-center font-mono">
          {/* Card: Peso Actual */}
          <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <div className="flex items-center justify-center gap-1 text-[11px] font-sans text-zinc-400 mb-0.5">
              <ScaleIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Tu Peso</span>
            </div>
            <div className="text-xl font-extrabold text-blue-400 tracking-tight">
              {activeWeight.toFixed(1)}{" "}
              <span className="text-xs font-normal text-zinc-500">kg</span>
            </div>
          </div>

          {/* Card: Altura */}
          <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <div className="flex items-center justify-center gap-1 text-[11px] font-sans text-zinc-400 mb-0.5">
              <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tu Altura</span>
            </div>
            <div className="text-xl font-extrabold text-zinc-100 tracking-tight">
              {activeHeight}{" "}
              <span className="text-xs font-normal text-zinc-500">cm</span>
            </div>
          </div>

          {/* Card: IMC (BMI) */}
          <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <div className="text-[11px] font-sans text-zinc-400 mb-0.5">IMC / BMI</div>
            <div className="text-xl font-extrabold text-indigo-300 tracking-tight">
              {displayBmi.toFixed(1)}
            </div>
          </div>

          {/* Card: Clasificación */}
          <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <div className="text-[11px] font-sans text-zinc-400 mb-0.5">Estado Clínico</div>
            <div className={`text-xs font-bold font-sans mt-1 px-2 py-0.5 rounded-md border inline-block ${displayCategory.bgColor} ${displayCategory.color} ${displayCategory.borderColor}`}>
              {displayCategory.label.split(" ")[0]}
            </div>
          </div>

          {/* Card: Rango Normopeso Personalizado */}
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <div className="text-[11px] font-sans text-zinc-400 mb-0.5">Normopeso (178 cm)</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">
              {idealRange.min} - {idealRange.max} <span className="text-[10px] text-zinc-500">kg</span>
            </div>
          </div>
        </div>

        {/* 3. Barra de Espectro Lineal de IMC (1D Spectrum Bar) */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5 font-sans">
              <span>Escala de Clasificación del IMC (kg/m²)</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              Tu valor: <strong className="text-indigo-300 font-bold">{displayBmi.toFixed(1)}</strong> ({displayCategory.label})
            </span>
          </div>

          {/* Barra segmentada */}
          <div className="relative pt-6 pb-2">
            {/* Marcador puntero apuntando hacia abajo con el valor exacto */}
            {(() => {
              // Mapeamos BMI de 15 a 45 en porcentaje 0% a 100%
              const clampedBmi = Math.max(15, Math.min(45, displayBmi));
              const pct = ((clampedBmi - 15) / (45 - 15)) * 100;
              return (
                <div
                  className="absolute top-0 transition-all duration-300 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
                  style={{ left: `${pct}%` }}
                >
                  <span className="px-2 py-0.5 rounded bg-white text-zinc-950 text-[10px] font-mono font-extrabold shadow-md whitespace-nowrap border border-zinc-300">
                    {displayBmi.toFixed(1)}
                  </span>
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-white" />
                </div>
              );
            })()}

            {/* Segmentos de la barra */}
            <div className="h-3 w-full rounded-full overflow-hidden flex shadow-inner bg-zinc-800">
              <div style={{ width: "11.6%" }} className="bg-sky-500 hover:opacity-90" title="Bajo Peso (< 18.5)" />
              <div style={{ width: "21.3%" }} className="bg-emerald-500 hover:opacity-90" title="Normopeso (18.5 - 24.9)" />
              <div style={{ width: "16.6%" }} className="bg-amber-500 hover:opacity-90" title="Sobrepeso (25.0 - 29.9)" />
              <div style={{ width: "16.6%" }} className="bg-orange-500 hover:opacity-90" title="Obesidad I (30.0 - 34.9)" />
              <div style={{ width: "16.6%" }} className="bg-red-500 hover:opacity-90" title="Obesidad II (35.0 - 39.9)" />
              <div style={{ width: "17.3%" }} className="bg-purple-600 hover:opacity-90" title="Obesidad III (≥ 40.0)" />
            </div>

            {/* Ticks numéricos de referencia */}
            <div className="relative h-4 mt-1 text-[9px] font-mono text-zinc-500 select-none">
              <span className="absolute left-[0%]">15</span>
              <span className="absolute left-[11.6%] -translate-x-1/2">18.5</span>
              <span className="absolute left-[33%] -translate-x-1/2">25</span>
              <span className="absolute left-[49.6%] -translate-x-1/2">30</span>
              <span className="absolute left-[66.3%] -translate-x-1/2">35</span>
              <span className="absolute left-[83%] -translate-x-1/2">40</span>
              <span className="absolute right-[0%]">45+</span>
            </div>
          </div>
        </div>

        {/* 4. MAPA 2D INTERACTIVO: Estatura (cm) vs Peso (kg) con Zonas y el Punto */}
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                <span>Mapa 2D de Zonas de Peso (Estatura vs Peso)</span>
                {simulatedPoint && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Modo simulación activo
                  </span>
                )}
              </span>
              <p className="text-[11px] text-zinc-400">
                Punto marcado en tu posición actual. Puedes hacer clic en el mapa para simular otros pesos y estaturas.
              </p>
            </div>

            {simulatedPoint && (
              <button
                type="button"
                onClick={() => setSimulatedPoint(null)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer self-start"
              >
                Restablecer a mi peso actual
              </button>
            )}
          </div>

          {/* SVG Canvas del Mapa 2D */}
          <div className="relative w-full overflow-hidden select-none bg-zinc-950 rounded-xl border border-zinc-800/80">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto cursor-crosshair overflow-visible"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoveredCoord(null)}
              onClick={handleSvgClick}
            >
              <defs>
                {/* Gradientes para las zonas */}
                <linearGradient id="grad-underweight" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.12" />
                </linearGradient>
                <linearGradient id="grad-normal" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.18" />
                </linearGradient>
                <linearGradient id="grad-overweight" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#d97706" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.18" />
                </linearGradient>
                <linearGradient id="grad-obesity1" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.18" />
                </linearGradient>
                <linearGradient id="grad-obesity2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.18" />
                </linearGradient>
                <linearGradient id="grad-obesity3" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#9333ea" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.20" />
                </linearGradient>
              </defs>

              {/* Polígonos de las 6 zonas de peso */}
              <path d={zonePaths.under} fill="url(#grad-underweight)" />
              <path d={zonePaths.normal} fill="url(#grad-normal)" />
              <path d={zonePaths.over} fill="url(#grad-overweight)" />
              <path d={zonePaths.obese1} fill="url(#grad-obesity1)" />
              <path d={zonePaths.obese2} fill="url(#grad-obesity2)" />
              <path d={zonePaths.obese3} fill="url(#grad-obesity3)" />

              {/* Cuadrícula de referencia */}
              {/* Líneas horizontales de altura cada 10 cm */}
              {[150, 160, 170, 180, 190, 200].map((hVal) => {
                const y = getY(hVal);
                return (
                  <g key={`h-${hVal}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="rgba(63, 63, 70, 0.45)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill="#71717a"
                      fontFamily="monospace"
                    >
                      {hVal}
                    </text>
                  </g>
                );
              })}

              {/* Líneas verticales de peso cada 10 kg */}
              {[40, 50, 60, 70, 80, 90, 100, 110, 120, 130].map((wVal) => {
                if (wVal > maxWeight) return null;
                const x = getX(wVal);
                return (
                  <g key={`w-${wVal}`}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={svgHeight - padding.bottom}
                      stroke="rgba(63, 63, 70, 0.45)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x}
                      y={svgHeight - padding.bottom + 16}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#71717a"
                      fontFamily="monospace"
                    >
                      {wVal}
                    </text>
                  </g>
                );
              })}

              {/* Curvas divisorias entre categorías con etiquetas de IMC */}
              <path d={zonePaths.line18_5} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.8" />
              <path d={zonePaths.line25} fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.8" />
              <path d={zonePaths.line30} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.8" />
              <path d={zonePaths.line35} fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.8" />
              <path d={zonePaths.line40} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.8" />

              {/* Rótulos de texto dentro de cada zona (orientativos) */}
              <text x={getX(48)} y={getY(185)} fill="#38bdf8" fontSize="10" fontWeight="bold" opacity="0.75">
                BAJO PESO
              </text>
              <text x={getX(65)} y={getY(185)} fill="#34d399" fontSize="10" fontWeight="bold" opacity="0.85">
                NORMOPESO
              </text>
              <text x={getX(83)} y={getY(185)} fill="#fbbf24" fontSize="10" fontWeight="bold" opacity="0.85">
                SOBREPESO
              </text>
              <text x={getX(100)} y={getY(185)} fill="#fb923c" fontSize="10" fontWeight="bold" opacity="0.85">
                OBESIDAD I
              </text>
              <text x={getX(116)} y={getY(185)} fill="#f87171" fontSize="10" fontWeight="bold" opacity="0.85">
                OBESIDAD II
              </text>
              {maxWeight >= 135 && (
                <text x={getX(130)} y={getY(185)} fill="#c084fc" fontSize="9" fontWeight="bold" opacity="0.85">
                  OBESIDAD III
                </text>
              )}

              {/* Líneas de guía hacia los ejes (Crosshairs para el punto del usuario) */}
              <line
                x1={userPointX}
                y1={userPointY}
                x2={userPointX}
                y2={svgHeight - padding.bottom}
                stroke="#60a5fa"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />
              <line
                x1={padding.left}
                y1={userPointY}
                x2={userPointX}
                y2={userPointY}
                stroke="#818cf8"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />

              {/* Resaltadores en los ejes */}
              {/* Eje X: Peso */}
              <rect
                x={userPointX - 24}
                y={svgHeight - padding.bottom + 4}
                width="48"
                height="16"
                rx="4"
                fill="#2563eb"
              />
              <text
                x={userPointX}
                y={svgHeight - padding.bottom + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#ffffff"
                fontFamily="monospace"
              >
                {activeWeight.toFixed(1)}k
              </text>

              {/* Eje Y: Altura */}
              <rect
                x={padding.left - 42}
                y={userPointY - 8}
                width="36"
                height="16"
                rx="4"
                fill="#4f46e5"
              />
              <text
                x={padding.left - 24}
                y={userPointY + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#ffffff"
                fontFamily="monospace"
              >
                {activeHeight}
              </text>

              {/* EL PUNTO EN EL MAPA (Punto del usuario) */}
              <g className="cursor-pointer">
                {/* Pulso exterior animado */}
                <circle
                  cx={userPointX}
                  cy={userPointY}
                  r="14"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  opacity="0.75"
                  className="animate-ping"
                />
                {/* Halo exterior */}
                <circle
                  cx={userPointX}
                  cy={userPointY}
                  r="11"
                  fill="#2563eb"
                  fillOpacity="0.25"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                />
                {/* Núcleo central del punto */}
                <circle
                  cx={userPointX}
                  cy={userPointY}
                  r="6.5"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
              </g>

              {/* Cartel flotante anclado al punto del usuario */}
              {(() => {
                const badgeW = 150;
                const badgeH = 46;
                // Posicionar a la derecha o izquierda según espacio
                const badgeX = userPointX + 15 + badgeW > svgWidth - padding.right
                  ? userPointX - badgeW - 15
                  : userPointX + 15;
                const badgeY = Math.max(padding.top, userPointY - 48);

                return (
                  <g className="pointer-events-none">
                    <rect
                      x={badgeX}
                      y={badgeY}
                      width={badgeW}
                      height={badgeH}
                      rx="8"
                      fill="#18181b"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      className="shadow-xl"
                    />
                    <text x={badgeX + 8} y={badgeY + 16} fontSize="10" fontWeight="bold" fill="#60a5fa">
                      📍 Tú estás aquí
                    </text>
                    <text x={badgeX + 8} y={badgeY + 30} fontSize="10" fill="#f4f4f5" fontFamily="monospace">
                      {activeWeight.toFixed(1)} kg · {activeHeight} cm
                    </text>
                    <text x={badgeX + 8} y={badgeY + 42} fontSize="9" fontWeight="bold" fill={displayCategory.color === "text-emerald-400" ? "#34d399" : "#fbbf24"}>
                      IMC {displayBmi.toFixed(1)} ({displayCategory.label.split(" ")[0]})
                    </text>
                  </g>
                );
              })()}

              {/* Punto simulado si el usuario hizo clic en otra parte */}
              {simulatedPoint && simPointX !== null && simPointY !== null && (
                <g>
                  <circle
                    cx={simPointX}
                    cy={simPointY}
                    r="8"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <line
                    x1={simPointX}
                    y1={simPointY}
                    x2={simPointX}
                    y2={svgHeight - padding.bottom}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={padding.left}
                    y1={simPointY}
                    x2={simPointX}
                    y2={simPointY}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                </g>
              )}

              {/* Títulos de los Ejes */}
              <text
                x={padding.left + innerWidth / 2}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize="11"
                fill="#a1a1aa"
                fontWeight="600"
              >
                Peso Corporal (kg)
              </text>

              <text
                x={-padding.top - innerHeight / 2}
                y={16}
                textAnchor="middle"
                fontSize="11"
                fill="#a1a1aa"
                fontWeight="600"
                transform="rotate(-90)"
              >
                Estatura / Altura (cm)
              </text>
            </svg>

            {/* Tooltip de inspección al pasar el ratón */}
            {hoveredCoord && (
              <div className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700 text-xs text-zinc-300 font-mono shadow-xl backdrop-blur-md pointer-events-none flex items-center gap-3">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Cursor</span>
                  <span className="text-zinc-200 font-bold">{hoveredCoord.weight} kg · {hoveredCoord.height} cm</span>
                </div>
                <div className="border-l border-zinc-800 pl-3">
                  <span className="text-zinc-500 text-[10px] block">IMC Estimado</span>
                  <span className="text-indigo-400 font-extrabold">{hoveredCoord.bmi.toFixed(1)}</span>
                </div>
                <div className="border-l border-zinc-800 pl-3">
                  <span className="text-zinc-500 text-[10px] block">Categoría</span>
                  <span className="font-semibold text-zinc-300">{getBmiCategory(hoveredCoord.bmi).label.split(" ")[0]}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. Tabla de Desglose de Categorías y Rango en Kilogramos para tu Estatura */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span>Rango de Kilogramos exactos para tu estatura ({activeHeight} cm)</span>
            <span className="text-zinc-500 font-mono text-[11px]">Fórmula OMS: Peso = IMC × (Altura/100)²</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  <th className="py-2 px-3">Categoría de Peso</th>
                  <th className="py-2 px-3">Rango IMC</th>
                  <th className="py-2 px-3">Peso en kg (para {activeHeight} cm)</th>
                  <th className="py-2 px-3">Tu Estado</th>
                  <th className="py-2 px-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 font-sans">
                {BMI_RANGES.map((cat) => {
                  const hM = activeHeight / 100;
                  const h2 = hM * hM;
                  const minKg = cat.minBmi > 0 ? (cat.minBmi * h2).toFixed(1) : "0";
                  const maxKg = cat.maxBmi < 60 ? (cat.maxBmi * h2).toFixed(1) : "+";
                  const isCurrent = displayCategory.label.toLowerCase().startsWith(cat.label.toLowerCase().split(" ")[0]);

                  // Cálculo de diferencia en kg al rango
                  let diffText = "-";
                  let diffColor = "text-zinc-500";
                  const minKgNum = parseFloat(minKg);
                  const maxKgNum = cat.maxBmi < 60 ? parseFloat(maxKg) : 999;

                  if (isCurrent) {
                    diffText = "Tu peso se sitúa aquí";
                    diffColor = "text-emerald-400 font-semibold";
                  } else if (activeWeight < minKgNum) {
                    const toGain = (minKgNum - activeWeight).toFixed(1);
                    diffText = `+${toGain} kg para entrar`;
                    diffColor = "text-sky-400";
                  } else if (activeWeight > maxKgNum) {
                    const toLose = (activeWeight - maxKgNum).toFixed(1);
                    diffText = `-${toLose} kg para salir`;
                    diffColor = "text-amber-400";
                  }

                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        isCurrent ? "bg-zinc-800/60 font-semibold" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <div>
                            <span className="text-zinc-200 font-medium">{cat.label}</span>
                            <span className="text-[10px] text-zinc-500 block">{cat.subLabel}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-zinc-300">
                        {cat.minBmi > 0 ? `${cat.minBmi}` : "< 18.5"}
                        {cat.maxBmi < 60 && cat.minBmi > 0 ? ` – ${cat.maxBmi}` : ""}
                        {cat.maxBmi >= 60 ? " +" : ""} kg/m²
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-100">
                        {cat.minBmi === 0 && `< ${maxKg} kg`}
                        {cat.minBmi > 0 && cat.maxBmi < 60 && `${minKg} – ${maxKg} kg`}
                        {cat.maxBmi >= 60 && `≥ ${minKg} kg`}
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircleIcon className="w-3 h-3" />
                            <span>Posición actual</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>

                      <td className={`py-2.5 px-3 text-right font-mono text-[11px] ${diffColor}`}>
                        {diffText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Nota Importante para Entrenamiento de Fuerza / Culturismo */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400">
          <InfoIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-zinc-200 block">
              Nota sobre gimnasio y entrenamiento de hipertrofia:
            </span>
            <p className="leading-relaxed text-[11px] text-zinc-400">
              El IMC no distingue entre masa muscular y tejido adiposo (grasa). En atletas y deportistas con buen desarrollo muscular, un IMC superior a 25.0 a menudo representa musculatura densa en lugar de sobrepeso graso. Para una valoración completa, cruza este valor con tu <strong>% de Grasa Corporal</strong> y tu <strong>FFMI (Índice de Masa Libre de Grasa)</strong>.
            </p>
          </div>
        </div>

        {/* 7. Botón de Cierre */}
        <div className="flex items-center justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cerrar Mapa
          </button>
        </div>
      </div>
    </div>
  );
}
