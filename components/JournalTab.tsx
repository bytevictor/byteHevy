"use client";

import React, { useState, useEffect, useMemo } from "react";
import { JournalWorkout } from "@/lib/actions";
import {
  BookOpenIcon,
  SearchIcon,
  XIcon,
  CalendarIcon,
  FlameIcon,
  GridIcon,
} from "./Icons";
import { JournalSkeleton } from "./skeletons/JournalSkeleton";
import { useSeason } from "@/lib/season-context";
import { WorkoutCard, formatVolume } from "./journal/WorkoutCard";
import { JournalCalendar, toLocalDateKey } from "./journal/JournalCalendar";
import { JournalHeatmap } from "./journal/JournalHeatmap";

type JournalViewMode = "feed" | "calendar" | "heatmap";

export function JournalTab() {
  const { activeSeasonId, activeSeason } = useSeason();
  const [workouts, setWorkouts] = useState<JournalWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<JournalViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadJournal() {
      setLoading(true);
      try {
        const query =
          activeSeasonId && activeSeasonId !== "all"
            ? `?seasonId=${encodeURIComponent(activeSeasonId)}`
            : "";
        const res = await fetch(`/api/journal${query}`, { cache: "no-store" });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setWorkouts(json.data);
          // By default, expand the latest workout
          if (json.data.length > 0) {
            setExpandedIds(new Set([json.data[0].id]));
          }
        }
      } catch (e) {
        console.error("Error loading journal:", e);
      } finally {
        setLoading(false);
      }
    }
    loadJournal();
  }, [activeSeasonId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(workouts.map((w) => w.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Filter workouts by search and optional selectedDate
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      // Date filter from Calendar or Heatmap
      if (selectedDate) {
        const wDateKey = toLocalDateKey(w.startTimestamp);
        if (wDateKey !== selectedDate) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = w.title.toLowerCase().includes(q);
        const matchesDesc = w.description.toLowerCase().includes(q);
        const matchesEx = w.exercises.some(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.exerciseNotes && e.exerciseNotes.toLowerCase().includes(q))
        );
        if (!matchesTitle && !matchesDesc && !matchesEx) return false;
      }

      return true;
    });
  }, [workouts, selectedDate, searchQuery]);

  // Overall journal statistics for the current season / dataset
  const overallStats = useMemo(() => {
    let totalSets = 0;
    let totalVolume = 0;
    let totalDuration = 0;

    for (const w of workouts) {
      totalSets += w.totalSets ?? 0;
      totalVolume += w.totalVolumeKg ?? 0;
      totalDuration += w.durationSeconds ?? 0;
    }

    return {
      totalWorkouts: workouts.length,
      totalSets,
      totalVolume,
      totalDuration,
    };
  }, [workouts]);

  return (
    <div className="py-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* 1. Header with View Mode Switcher and Search */}
      <div className="flex flex-col gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
              <BookOpenIcon className="w-5 h-5 text-accent-light" />
              <span>Diario de Entrenamientos & Bitácora</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-normal">
              Histórico cronológico, calendario de sesiones, mapas de calor de volumen y reflexiones.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por ejercicio, frase, ajuste..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* View Mode Tabs & Season indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center p-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold self-start sm:self-center">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-accent/15 border border-accent/30 text-accent-light shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Vista Calendario</span>
            </button>

            <button
              onClick={() => setViewMode("heatmap")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "heatmap"
                  ? "bg-accent/15 border border-accent/30 text-accent-light shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FlameIcon className="w-3.5 h-3.5" />
              <span>Mapas de Calor</span>
            </button>

            <button
              onClick={() => setViewMode("feed")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "feed"
                  ? "bg-accent/15 border border-accent/30 text-accent-light shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <GridIcon className="w-3.5 h-3.5" />
              <span>Lista de Sesiones</span>
            </button>
          </div>

          {/* Quick stats chips */}
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 flex-wrap">
            {activeSeason && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold bg-accent/10 border-accent/30 text-accent-light">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>{activeSeason.name}</span>
              </span>
            )}
            <span>
              <strong className="text-zinc-200">{overallStats.totalWorkouts}</strong> sesiones
            </span>
            <span className="text-zinc-700">•</span>
            <span>
              <strong className="text-zinc-200">{overallStats.totalSets}</strong> series
            </span>
            <span className="text-zinc-700">•</span>
            <span>
              <strong className="text-zinc-200">{formatVolume(overallStats.totalVolume)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Primary Views: Calendar or Heatmap */}
      {viewMode === "calendar" && (
        <JournalCalendar
          workouts={workouts}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {viewMode === "heatmap" && (
        <JournalHeatmap
          workouts={workouts}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {/* 3. Section Title & Expand/Collapse Controls for the Workouts Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>
              {selectedDate
                ? `Entrenamientos del ${selectedDate}`
                : viewMode === "feed"
                ? "Historial Completo de Entrenamientos"
                : "Desglose de Sesiones"}
            </span>
            <span className="text-xs font-mono font-medium text-zinc-500">
              ({filteredWorkouts.length})
            </span>
          </h3>

          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-[11px] font-medium text-accent-light hover:underline ml-2 cursor-pointer"
            >
              (Ver todos)
            </button>
          )}
        </div>

        {filteredWorkouts.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
            >
              Expandir todos
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
            >
              Contraer todos
            </button>
          </div>
        )}
      </div>

      {/* 4. Workouts Feed / List */}
      {loading ? (
        <JournalSkeleton />
      ) : filteredWorkouts.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl p-8 bg-zinc-950/40 flex flex-col items-center justify-center gap-2">
          <p className="text-sm font-semibold text-zinc-300">
            No se encontraron entrenamientos
          </p>
          <p className="text-xs text-zinc-500 max-w-sm">
            {selectedDate
              ? `No hay registros para la fecha seleccionada (${selectedDate}).`
              : "No coincide ningún entrenamiento con el término de búsqueda."}
          </p>
          {(selectedDate || searchQuery) && (
            <button
              onClick={() => {
                setSelectedDate(null);
                setSearchQuery("");
              }}
              className="mt-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredWorkouts.map((wo) => (
            <WorkoutCard
              key={wo.id}
              workout={wo}
              isExpanded={expandedIds.has(wo.id)}
              onToggleExpand={() => toggleExpand(wo.id)}
              highlightExerciseName={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
