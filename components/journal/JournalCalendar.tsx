"use client";

import React, { useState, useMemo } from "react";
import { JournalWorkout } from "@/lib/actions";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  DumbbellIcon,
  TrophyIcon,
  XIcon,
} from "../Icons";
import { formatDuration, formatVolume } from "./WorkoutCard";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface JournalCalendarProps {
  workouts: JournalWorkout[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

export function toLocalDateKey(timestampSeconds: number): string {
  const d = new Date(timestampSeconds * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function JournalCalendar({
  workouts,
  selectedDate,
  onSelectDate,
}: JournalCalendarProps) {
  // Map workouts by date key (YYYY-MM-DD)
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, JournalWorkout[]>();
    for (const w of workouts) {
      const key = toLocalDateKey(w.startTimestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return map;
  }, [workouts]);

  // Determine initial month/year from latest workout or today
  const initialDate = useMemo(() => {
    if (workouts.length > 0) {
      return new Date(workouts[0].startTimestamp * 1000);
    }
    return new Date();
  }, [workouts]);

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-11

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToLatest = () => {
    if (workouts.length > 0) {
      const latest = new Date(workouts[0].startTimestamp * 1000);
      setCurrentYear(latest.getFullYear());
      setCurrentMonth(latest.getMonth());
      onSelectDate(toLocalDateKey(workouts[0].startTimestamp));
    }
  };

  // Calendar matrix calculations
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Monday-based day of week for the 1st (0 = Mon, 6 = Sun)
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const days: {
      dayNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      workouts: JournalWorkout[];
      totalSets: number;
      totalVolume: number;
    }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, "0");
      const day = String(dayNum).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      const dayWorkouts = workoutsByDate.get(dateKey) || [];

      days.push({
        dayNumber: dayNum,
        dateKey,
        isCurrentMonth: false,
        workouts: dayWorkouts,
        totalSets: dayWorkouts.reduce((acc, w) => acc + (w.totalSets ?? 0), 0),
        totalVolume: dayWorkouts.reduce((acc, w) => acc + (w.totalVolumeKg ?? 0), 0),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
      const dayWorkouts = workoutsByDate.get(dateKey) || [];

      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: true,
        workouts: dayWorkouts,
        totalSets: dayWorkouts.reduce((acc, w) => acc + (w.totalSets ?? 0), 0),
        totalVolume: dayWorkouts.reduce((acc, w) => acc + (w.totalVolumeKg ?? 0), 0),
      });
    }

    // Next month padding days to complete 35 or 42 cells grid
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const year = nextDate.getFullYear();
      const month = String(nextDate.getMonth() + 1).padStart(2, "0");
      const day = String(d).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      const dayWorkouts = workoutsByDate.get(dateKey) || [];

      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: false,
        workouts: dayWorkouts,
        totalSets: dayWorkouts.reduce((acc, w) => acc + (w.totalSets ?? 0), 0),
        totalVolume: dayWorkouts.reduce((acc, w) => acc + (w.totalVolumeKg ?? 0), 0),
      });
    }

    return days;
  }, [currentYear, currentMonth, workoutsByDate]);

  // Monthly stats
  const monthStats = useMemo(() => {
    let sessionCount = 0;
    let totalSets = 0;
    let totalVolume = 0;
    let totalDuration = 0;

    for (const day of calendarDays) {
      if (day.isCurrentMonth && day.workouts.length > 0) {
        sessionCount += day.workouts.length;
        totalSets += day.totalSets;
        totalVolume += day.totalVolume;
        for (const w of day.workouts) {
          totalDuration += w.durationSeconds || 0;
        }
      }
    }

    return {
      sessionCount,
      totalSets,
      totalVolume,
      totalDuration,
    };
  }, [calendarDays]);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md p-5 flex flex-col gap-5 shadow-sm">
      {/* Calendar Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shadow-sm">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>{MONTH_NAMES[currentMonth]}</span>
              <span className="text-zinc-500 font-normal">{currentYear}</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Explora tus sesiones y el volumen de series por día
            </p>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleGoToLatest}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs font-medium transition-colors cursor-pointer"
            title="Ir al mes del último entreno registrado"
          >
            Último entreno
          </button>

          <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Month Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Sesiones del Mes
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {monthStats.sessionCount} <span className="text-xs font-normal text-zinc-400">días</span>
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <TrophyIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Series Totales
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {monthStats.totalSets} <span className="text-xs font-normal text-zinc-400">series</span>
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <DumbbellIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Carga / Volumen
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {formatVolume(monthStats.totalVolume)}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-accent-light shrink-0">
            <ClockIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block">
              Tiempo Entrenado
            </span>
            <span className="text-base font-bold text-zinc-100 font-mono tabular-nums">
              {formatDuration(monthStats.totalDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Weekday Columns Header */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wider py-1">
        {WEEKDAY_NAMES.map((name, idx) => (
          <div key={idx} className={idx >= 5 ? "text-zinc-500" : ""}>
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {calendarDays.map((day, idx) => {
          const hasWorkouts = day.workouts.length > 0;
          const isSelected = selectedDate === day.dateKey;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (hasWorkouts) {
                  onSelectDate(isSelected ? null : day.dateKey);
                } else if (selectedDate) {
                  onSelectDate(null);
                }
              }}
              className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all select-none relative group ${
                !day.isCurrentMonth
                  ? "opacity-30 border-transparent bg-zinc-950/20"
                  : hasWorkouts
                  ? isSelected
                    ? "border-accent bg-accent/20 ring-2 ring-accent/30 shadow-md shadow-accent/10 scale-[1.02] z-10 cursor-pointer"
                    : "border-zinc-800 bg-zinc-950/70 hover:border-accent/40 hover:bg-zinc-900/90 cursor-pointer"
                  : "border-zinc-850/40 bg-zinc-950/30 text-zinc-600 hover:bg-zinc-900/40 cursor-default"
              }`}
            >
              {/* Day Number and status badge */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs font-mono font-semibold ${
                    !day.isCurrentMonth
                      ? "text-zinc-600"
                      : hasWorkouts
                      ? isSelected
                        ? "text-accent-light font-bold"
                        : "text-zinc-100"
                      : "text-zinc-500"
                  }`}
                >
                  {day.dayNumber}
                </span>

                {hasWorkouts && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSelected ? "bg-accent shadow-sm" : "bg-accent-light/80"
                    }`}
                  />
                )}
              </div>

              {/* Workouts preview inside cell */}
              {hasWorkouts && (
                <div className="flex flex-col gap-1 w-full mt-1">
                  {day.workouts.slice(0, 1).map((w, wIdx) => (
                    <div
                      key={wIdx}
                      className="text-[10px] font-medium text-zinc-200 truncate rounded bg-zinc-900/90 border border-zinc-750 px-1.5 py-0.5 leading-tight"
                      title={w.title}
                    >
                      {w.title}
                    </div>
                  ))}

                  {day.workouts.length > 1 && (
                    <span className="text-[9px] font-mono text-accent-light font-medium">
                      +{day.workouts.length - 1} más
                    </span>
                  )}

                  {/* Summary sets & volume */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 mt-0.5">
                    <span className="text-accent-lighter font-medium" title={`${day.totalSets} series completadas`}>
                      {day.totalSets} ser.
                    </span>
                    <span>{formatVolume(day.totalVolume)}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
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
