"use client";

import React, { useState, useMemo } from "react";
import { JournalWorkout } from "@/lib/actions";
import {
  FlameIcon,
  TrophyIcon,
  CalendarIcon,
  DumbbellIcon,
  XIcon,
} from "../Icons";
import { formatVolume } from "./WorkoutCard";
import { toLocalDateKey } from "./JournalCalendar";

const MONTH_SHORT_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const WEEKDAY_NAMES = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAY_FULL_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

type HeatmapMode = "sets" | "sessions";

interface JournalHeatmapProps {
  workouts: JournalWorkout[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

export function JournalHeatmap({
  workouts,
  selectedDate,
  onSelectDate,
}: JournalHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>("sets");
  const [hoveredDay, setHoveredDay] = useState<{
    dateKey: string;
    formattedDate: string;
    workoutsCount: number;
    totalSets: number;
    totalVolume: number;
    titles: string[];
    x: number;
    y: number;
  } | null>(null);

  // Group workouts by date key (YYYY-MM-DD)
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, JournalWorkout[]>();
    for (const w of workouts) {
      const key = toLocalDateKey(w.startTimestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return map;
  }, [workouts]);

  // Extract available years from workouts
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const w of workouts) {
      const y = new Date(w.startTimestamp * 1000).getFullYear();
      years.add(y);
    }
    if (years.size === 0) years.add(2026);
    return Array.from(years).sort((a, b) => b - a);
  }, [workouts]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);

  // Generate 52/53 weeks matrix for the selected year
  const { weeks, monthBlocks, yearStats, maxSetsDay, weekdayDistribution } = useMemo(() => {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);

    // Monday-based start of the first week
    const startOffset = (startDate.getDay() + 6) % 7;
    const calendarStart = new Date(startDate);
    calendarStart.setDate(startDate.getDate() - startOffset);

    const generatedWeeks: {
      days: {
        dateKey: string;
        date: Date;
        inSelectedYear: boolean;
        workouts: JournalWorkout[];
        totalSets: number;
        totalVolume: number;
      }[];
    }[] = [];

    let currentWeek: (typeof generatedWeeks)[0]["days"] = [];
    const iterDate = new Date(calendarStart);
    let weekIdx = 0;

    let totalYearWorkouts = 0;
    let totalYearSets = 0;
    let totalYearVolume = 0;
    let maxDaySets = 0;
    let bestDayRecord: { dateKey: string; sets: number; title: string } | null = null;

    // Distribution by day of week (0 = Monday, 6 = Sunday)
    const weekdaySets = [0, 0, 0, 0, 0, 0, 0];
    const weekdaySessions = [0, 0, 0, 0, 0, 0, 0];

    while (iterDate <= endDate || currentWeek.length > 0) {
      const y = iterDate.getFullYear();
      const m = String(iterDate.getMonth() + 1).padStart(2, "0");
      const d = String(iterDate.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${d}`;
      const inYear = iterDate.getFullYear() === selectedYear;

      const dayWorkouts = inYear ? workoutsByDate.get(dateKey) || [] : [];
      const daySets = dayWorkouts.reduce((acc, w) => acc + (w.totalSets ?? 0), 0);
      const dayVol = dayWorkouts.reduce((acc, w) => acc + (w.totalVolumeKg ?? 0), 0);

      if (inYear) {
        if (dayWorkouts.length > 0) {
          totalYearWorkouts += dayWorkouts.length;
          totalYearSets += daySets;
          totalYearVolume += dayVol;

          const dayOfWeek = (iterDate.getDay() + 6) % 7;
          weekdaySets[dayOfWeek] += daySets;
          weekdaySessions[dayOfWeek] += dayWorkouts.length;

          if (daySets > maxDaySets) {
            maxDaySets = daySets;
            bestDayRecord = {
              dateKey,
              sets: daySets,
              title: dayWorkouts[0]?.title || "Entrenamiento",
            };
          }
        }
      }

      currentWeek.push({
        dateKey,
        date: new Date(iterDate),
        inSelectedYear: inYear,
        workouts: dayWorkouts,
        totalSets: daySets,
        totalVolume: dayVol,
      });

      if (currentWeek.length === 7) {
        generatedWeeks.push({ days: currentWeek });
        currentWeek = [];
        weekIdx++;
      }

      iterDate.setDate(iterDate.getDate() + 1);
      if (iterDate > endDate && currentWeek.length === 0) break;
    }

    // Determinar la semana de inicio de cada mes (la semana que contiene el día 1 de dicho mes)
    const monthStarts = new Map<number, number>();
    monthStarts.set(0, 0); // Enero siempre arranca en la semana 0

    for (let m = 1; m < 12; m++) {
      const wIdx = generatedWeeks.findIndex((w) =>
        w.days.some(
          (d) =>
            d.date.getFullYear() === selectedYear &&
            d.date.getMonth() === m &&
            d.date.getDate() === 1
        )
      );
      monthStarts.set(m, wIdx !== -1 ? wIdx : 0);
    }

    const blocks: {
      month: number;
      label: string;
      weeks: typeof generatedWeeks;
    }[] = [];

    for (let m = 0; m < 12; m++) {
      const startW = monthStarts.get(m) ?? 0;
      const endW =
        m < 11
          ? (monthStarts.get(m + 1) ?? generatedWeeks.length) - 1
          : generatedWeeks.length - 1;
      const weeksForMonth = generatedWeeks.slice(startW, endW + 1);
      blocks.push({
        month: m,
        label: MONTH_SHORT_NAMES[m],
        weeks: weeksForMonth,
      });
    }

    return {
      weeks: generatedWeeks,
      monthBlocks: blocks,
      yearStats: {
        totalWorkouts: totalYearWorkouts,
        totalSets: totalYearSets,
        totalVolume: totalYearVolume,
        activeDays: Array.from(workoutsByDate.keys()).filter((k) => k.startsWith(String(selectedYear))).length,
        avgSetsPerSession:
          totalYearWorkouts > 0 ? (totalYearSets / totalYearWorkouts).toFixed(1) : "0",
      },
      maxSetsDay: bestDayRecord,
      weekdayDistribution: {
        sets: weekdaySets,
        sessions: weekdaySessions,
      },
    };
  }, [selectedYear, workoutsByDate]);

  // Get color for cell in Sets mode
  const getSetsColor = (count: number, inYear: boolean) => {
    if (!inYear) return "bg-zinc-950/20 border-transparent";
    if (count === 0) return "bg-zinc-900 border-zinc-800/60 hover:border-zinc-700";
    if (count <= 6) return "bg-emerald-950 border-emerald-800/60 hover:border-emerald-600";
    if (count <= 12) return "bg-emerald-700/80 border-emerald-600/70 hover:border-emerald-400";
    if (count <= 18) return "bg-emerald-500 border-emerald-400 hover:border-emerald-300 shadow-sm shadow-emerald-500/20";
    return "bg-accent border-accent-light hover:brightness-110 shadow-sm shadow-accent/30";
  };

  // Get color for cell in Sessions mode
  const getSessionsColor = (count: number, inYear: boolean) => {
    if (!inYear) return "bg-zinc-950/20 border-transparent";
    if (count === 0) return "bg-zinc-900 border-zinc-800/60 hover:border-zinc-700";
    if (count === 1) return "bg-accent/60 border-accent/80 hover:border-accent";
    return "bg-accent border-accent-light shadow-sm shadow-accent/30";
  };

  const maxWeekdaySets = Math.max(...weekdayDistribution.sets, 1);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md p-5 flex flex-col gap-6 shadow-sm">
      {/* Heatmap Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shadow-sm">
            <FlameIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>Mapas de Calor de Actividad</span>
              <span className="text-xs font-normal text-zinc-400">({selectedYear})</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Visualiza tus picos de entrenamiento y volumen de series a lo largo del año
            </p>
          </div>
        </div>

        {/* Mode Selector and Year Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-center">
          {/* Heatmap Metric Mode: Sets vs Sessions */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
            <button
              onClick={() => setMode("sets")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer border ${
                mode === "sets"
                  ? "bg-accent/20 text-accent-light border-transparent hover:border-accent/40 shadow-xs"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/60"
              }`}
            >
              <span>🔢 Series Realizadas</span>
            </button>
            <button
              onClick={() => setMode("sessions")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer border ${
                mode === "sessions"
                  ? "bg-accent/20 text-accent-light border-transparent hover:border-accent/40 shadow-xs"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/60"
              }`}
            >
              <span>🏋️ Sesiones</span>
            </button>
          </div>

          {/* Year select */}
          {availableYears.length > 1 && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent/40"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Año {yr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Year Highlights Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Días de Entreno
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {yearStats.activeDays} <span className="text-xs font-normal text-zinc-400">días</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <TrophyIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Series Acumuladas
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {yearStats.totalSets.toLocaleString("es-ES")}{" "}
              <span className="text-xs font-normal text-zinc-400">series</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <DumbbellIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Volumen Total Anual
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {formatVolume(yearStats.totalVolume)}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <FlameIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Récord en un Día
            </span>
            {maxSetsDay ? (
              <span
                className="text-sm font-bold text-accent-light font-mono tabular-nums truncate block"
                title={`${maxSetsDay.sets} series en ${maxSetsDay.title} (${maxSetsDay.dateKey})`}
              >
                {maxSetsDay.sets} series{" "}
                <span className="text-[10px] text-zinc-400 font-sans font-normal">
                  ({maxSetsDay.dateKey.split("-").slice(1).join("/")})
                </span>
              </span>
            ) : (
              <span className="text-xs text-zinc-500">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Heatmap Matrix Container */}
      <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 flex flex-col gap-3">
        <div className="overflow-x-auto pb-3 custom-scrollbar">
          <div className="flex items-stretch min-w-max">
            {/* Left: Weekday Labels Column */}
            <div className="flex flex-col shrink-0 select-none pr-2">
              {/* Header spacer matching month labels row height */}
              <div className="h-6 flex items-center pb-1 text-[10px] text-transparent select-none" aria-hidden="true">
                ·
              </div>
              {/* Weekday letters matching the 7 day rows */}
              <div className="flex flex-col gap-1 mt-1">
                {WEEKDAY_NAMES.map((d, idx) => (
                  <div
                    key={idx}
                    className="w-4 h-3.5 sm:h-4 flex items-center justify-center text-[9px] font-mono font-medium text-zinc-500"
                  >
                    {idx % 2 === 0 ? d : ""}
                  </div>
                ))}
              </div>
            </div>

            {/* Months and Weeks Grid with Vertical Dotted Separators */}
            <div className="flex items-stretch">
              {monthBlocks.map((mb, mIdx) => (
                <React.Fragment key={mIdx}>
                  {/* Línea vertical punteada que separa los meses entre los recuadros */}
                  {mIdx > 0 && (
                    <div
                      className="w-0 border-l border-dotted border-zinc-700/35 mx-1 self-stretch"
                      title={`Separador de mes: ${mb.label}`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Bloque del Mes: Cabecera con nombre del mes + Columnas de semanas */}
                  <div className="flex flex-col shrink-0">
                    {/* Cabecera del Mes perfectamente alineada con sus semanas */}
                    <div className="h-6 flex items-center text-[11px] font-bold text-zinc-300 font-mono tracking-tight pb-1 px-0.5">
                      {mb.label}
                    </div>

                    {/* Columnas de Semanas del Mes */}
                    <div className="flex gap-1 mt-1">
                      {mb.weeks.map((week, wIdx) => (
                        <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                          {week.days.map((day, dIdx) => {
                            const isSelected = selectedDate === day.dateKey;
                            const hasData = day.workouts.length > 0;
                            const cellColor =
                              mode === "sets"
                                ? getSetsColor(day.totalSets, day.inSelectedYear)
                                : getSessionsColor(day.workouts.length, day.inSelectedYear);

                            return (
                              <div
                                key={dIdx}
                                onClick={() => {
                                  if (hasData) {
                                    onSelectDate(isSelected ? null : day.dateKey);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  if (day.inSelectedYear) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHoveredDay({
                                      dateKey: day.dateKey,
                                      formattedDate: day.date.toLocaleDateString("es-ES", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      }),
                                      workoutsCount: day.workouts.length,
                                      totalSets: day.totalSets,
                                      totalVolume: day.totalVolume,
                                      titles: day.workouts.map((w) => w.title),
                                      x: rect.left + rect.width / 2,
                                      y: rect.top,
                                    });
                                  }
                                }}
                                onMouseLeave={() => setHoveredDay(null)}
                                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs sm:rounded-sm border transition-all ${cellColor} ${
                                  hasData ? "cursor-pointer" : "cursor-default"
                                } ${
                                  isSelected
                                    ? "ring-2 ring-accent scale-125 z-10"
                                    : ""
                                }`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Heatmap Footer Legend & Information */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-300">
              {mode === "sets" ? "Escala de Series:" : "Escala de Sesiones:"}
            </span>
            <span>
              {mode === "sets"
                ? "los días más intensos en verde y acento brillante"
                : "días con 1 o más entrenamientos registrados"}
            </span>
          </div>

          {/* Color Legend Bar */}
          <div className="flex items-center gap-2 self-start sm:self-center font-mono text-[10px]">
            <span>Menos</span>
            {mode === "sets" ? (
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-zinc-900 border border-zinc-800" title="0 series" />
                <span className="w-3 h-3 rounded-sm bg-emerald-950 border border-emerald-800" title="1-6 series" />
                <span className="w-3 h-3 rounded-sm bg-emerald-700 border border-emerald-600" title="7-12 series" />
                <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-400" title="13-18 series" />
                <span className="w-3 h-3 rounded-sm bg-accent border border-accent-light" title="19+ series" />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-zinc-900 border border-zinc-800" title="0 sesiones" />
                <span className="w-3 h-3 rounded-sm bg-accent/60 border border-accent/80" title="1 sesión" />
                <span className="w-3 h-3 rounded-sm bg-accent border border-accent-light" title="2+ sesiones" />
              </div>
            )}
            <span>Más</span>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && (
        <div
          style={{
            position: "fixed",
            left: `${hoveredDay.x}px`,
            top: `${hoveredDay.y - 10}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="p-3 rounded-xl bg-zinc-950/95 border border-zinc-750 shadow-2xl text-xs flex flex-col gap-1 min-w-[190px] backdrop-blur-md animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1">
            <span className="font-bold text-zinc-100 capitalize">
              {hoveredDay.formattedDate}
            </span>
            <span className="font-mono text-[10px] text-zinc-400">
              {hoveredDay.dateKey}
            </span>
          </div>

          {hoveredDay.workoutsCount > 0 ? (
            <div className="flex flex-col gap-1 pt-1 font-mono tabular-nums">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-400 font-sans">Series totales:</span>
                <strong className="text-accent-light">{hoveredDay.totalSets} series</strong>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-400 font-sans">Volumen:</span>
                <span>{formatVolume(hoveredDay.totalVolume)}</span>
              </div>
              <div className="pt-1 text-[11px] font-sans text-zinc-200">
                {hoveredDay.titles.map((t, idx) => (
                  <span key={idx} className="block truncate text-zinc-300">
                    • {t}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-zinc-500 pt-1">Sin entrenamientos este día</span>
          )}
        </div>
      )}

      {/* Day of Week Volume Distribution */}
      <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <span>Distribución de Series por Día de la Semana</span>
          </h4>
          <span className="text-[11px] text-zinc-500">
            Total en {selectedYear}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-1">
          {WEEKDAY_FULL_NAMES.map((name, idx) => {
            const count = weekdayDistribution.sets[idx];
            const sessions = weekdayDistribution.sessions[idx];
            const pct = Math.round((count / maxWeekdaySets) * 100);

            return (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">{name.slice(0, 3)}</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {sessions} {sessions === 1 ? "sesión" : "sesiones"}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold font-mono tabular-nums text-accent-light">
                    {count}{" "}
                    <span className="text-[10px] font-normal font-sans text-zinc-400">
                      series
                    </span>
                  </span>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-accent transition-all duration-500"
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Banner */}
      {selectedDate && (
        <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between gap-3 text-xs text-accent-lighter animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-accent-light">Filtrando fecha:</span>
            <span className="font-mono bg-zinc-950/70 border border-accent/25 px-2 py-0.5 rounded text-accent-light font-bold">
              {selectedDate}
            </span>
            <span className="text-zinc-400">
              ({workoutsByDate.get(selectedDate)?.length || 0} entrenamientos encontrados)
            </span>
          </div>

          <button
            onClick={() => onSelectDate(null)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
          >
            <XIcon className="w-3.5 h-3.5" />
            <span>Quitar filtro</span>
          </button>
        </div>
      )}
    </div>
  );
}
