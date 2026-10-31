"use client";

import React, { useState, useEffect, useMemo } from "react";
import { JournalWorkout } from "@/lib/actions";
import { BookOpenIcon, SearchIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon, XIcon, CalendarIcon } from "./Icons";
import { JournalSkeleton } from "./skeletons/JournalSkeleton";
import { useSeason } from "@/lib/season-context";

export function JournalTab() {
  const { activeSeasonId, activeSeason, setActiveSeasonId } = useSeason();
  const [workouts, setWorkouts] = useState<JournalWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  const filteredWorkouts = useMemo(() => {
    if (!searchQuery.trim()) return workouts;
    const q = searchQuery.toLowerCase();
    return workouts.filter((w) => {
      return (
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.exercises.some((e) => e.name.toLowerCase().includes(q))
      );
    });
  }, [workouts, searchQuery]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "-";
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="py-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <BookOpenIcon className="w-5 h-5 text-accent-light" />
            <span>Diario de Entrenamientos & Bitácora</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-normal">
            Histórico cronológico de cada sesión con tus reflexiones, frases y desglose completo.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por frase o ejercicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Workouts Feed */}
      {loading ? (
        <JournalSkeleton />
      ) : filteredWorkouts.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl p-8 bg-zinc-950/40">
          <p className="text-xs text-zinc-500">
            No se encontraron entrenamientos que coincidan con la búsqueda.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredWorkouts.map((wo) => {
            const isExpanded = expandedIds.has(wo.id);

            return (
              <div
                key={wo.id}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm p-5 flex flex-col gap-4 hover:border-zinc-750 transition-all"
              >
                {/* Workout Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono tabular-nums text-accent-light font-semibold bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-lg">
                      {wo.startTime}
                    </span>
                    <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                      {wo.title}
                    </h3>
                  </div>

                  {wo.durationSeconds && (
                    <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 self-start sm:self-auto">
                      <ClockIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{formatDuration(wo.durationSeconds)}</span>
                    </div>
                  )}
                </div>

                {/* Unhinged Quote / Workout Notes Box */}
                {wo.description && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-accent/10 via-zinc-950/80 to-zinc-950/80 border border-accent/20 text-xs text-accent-lighter/90 italic leading-relaxed">
                    "{wo.description}"
                  </div>
                )}

                {/* Exercises Summary Chips */}
                <div className="flex flex-wrap gap-2">
                  {wo.exercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs"
                    >
                      <span className="font-semibold text-zinc-200">{ex.name}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="font-mono tabular-nums text-accent-light font-medium">
                        {ex.topSetLabel}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Expand / Collapse Button */}
                <div className="pt-1">
                  <button
                    onClick={() => toggleExpand(wo.id)}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDownIcon className="w-4 h-4 text-accent-light" />
                        <span>Ocultar desglose de series</span>
                      </>
                    ) : (
                      <>
                        <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
                        <span>Ver desglose de series y ajustes</span>
                      </>
                    )}
                  </button>

                  {/* Collapsible Sets Breakdown Table */}
                  {isExpanded && (
                    <div className="mt-4 flex flex-col gap-4 animate-fade-in">
                      {wo.exercises.map((ex, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-zinc-200">
                              {ex.name}
                            </span>
                            {ex.exerciseNotes && (
                              <span className="text-[11px] text-zinc-400 font-normal">
                                Ajuste: {ex.exerciseNotes}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs font-mono tabular-nums">
                            {ex.sets.map((s) => (
                              <span
                                key={s.id}
                                className="px-2.5 py-1 rounded-lg border bg-zinc-900 border-zinc-800 text-zinc-300"
                              >
                                #{s.setIndex}:{" "}
                                {s.weightKg !== null && s.reps !== null
                                  ? ex.metricType === "weighted_bodyweight"
                                    ? s.weightKg > 0
                                      ? `+${s.weightKg}k × ${s.reps}`
                                      : s.weightKg < 0
                                      ? `${s.weightKg}k × ${s.reps}`
                                      : `BW × ${s.reps}`
                                    : `${s.weightKg}k × ${s.reps}`
                                  : s.reps !== null
                                  ? ex.metricType === "weighted_bodyweight"
                                    ? `BW × ${s.reps}`
                                    : `${s.reps}r`
                                  : s.durationSeconds !== null
                                  ? `${s.durationSeconds}s`
                                  : "—"}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
