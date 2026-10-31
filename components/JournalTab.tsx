"use client";

import React, { useState, useEffect, useMemo } from "react";
import { JournalWorkout } from "@/lib/actions";
import { BookOpenIcon, SearchIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "./Icons";

export function JournalTab() {
  const [workouts, setWorkouts] = useState<JournalWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadJournal() {
      setLoading(true);
      try {
        const res = await fetch("/api/journal");
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
  }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 font-sans flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-amber-400" />
            <span>Diario de Entrenamientos & Bitácora</span>
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Histórico cronológico de cada sesión con tus reflexiones, frases y desglose completo.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por frase o ejercicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Workouts Feed */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs font-mono text-zinc-500">
          Cargando diario de entrenamientos...
        </div>
      ) : filteredWorkouts.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 p-8 font-mono text-xs text-zinc-500">
          No se encontraron entrenamientos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredWorkouts.map((w) => {
            const isExpanded = expandedIds.has(w.id);
            return (
              <div
                key={w.id}
                className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 transition-all flex flex-col gap-3"
              >
                {/* Header row: Title, Date, Duration */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <h3 className="text-base font-bold text-zinc-100 font-sans tracking-tight">
                      {w.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                    <span>{w.startTime}</span>
                    {w.durationSeconds > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-300 text-[11px]">
                        <ClockIcon className="w-3 h-3 text-zinc-400" />
                        {formatDuration(w.durationSeconds)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Personal Diary Description (Hero block) */}
                {w.description && (
                  <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200/90 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                    "{w.description}"
                  </div>
                )}

                {/* Exercises Summary Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {w.exercises.map((ex, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-300"
                    >
                      <span className="text-zinc-200 font-medium">{ex.name}</span>
                      <span className="text-amber-400/90 text-[10px]">({ex.topSetLabel})</span>
                    </span>
                  ))}
                </div>

                {/* Toggle Detail Button */}
                <button
                  onClick={() => toggleExpand(w.id)}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors pt-2 self-start cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                      <span>Ocultar desglose de series</span>
                    </>
                  ) : (
                    <>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                      <span>Ver desglose de series y ajustes ({w.exercises.length} ejercicios)</span>
                    </>
                  )}
                </button>

                {/* Expanded Details Table */}
                {isExpanded && (
                  <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800/80 animate-fade-in">
                    {w.exercises.map((ex, exIdx) => (
                      <div key={exIdx} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-semibold text-zinc-200">
                            {ex.name}
                          </span>
                          {ex.exerciseNotes && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                              Ajuste: {ex.exerciseNotes}
                            </span>
                          )}
                        </div>

                        {/* Sets Mini Table */}
                        <div className="border border-zinc-800/80 rounded overflow-hidden">
                          <table className="w-full text-left text-[11px] font-mono">
                            <thead>
                              <tr className="bg-zinc-900/60 text-zinc-500 text-[10px] border-b border-zinc-800/60">
                                <th className="py-1 px-2.5">Serie</th>
                                <th className="py-1 px-2.5 text-right">Peso</th>
                                <th className="py-1 px-2.5 text-right">Reps / Tiempo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                              {ex.sets.map((s) => (
                                <tr key={s.id} className="text-zinc-300">
                                  <td className="py-1 px-2.5 text-zinc-500">{s.setIndex + 1}</td>
                                  <td className="py-1 px-2.5 text-right">
                                    {s.weightKg !== null ? `${s.weightKg} kg` : "BW"}
                                  </td>
                                  <td className="py-1 px-2.5 text-right text-amber-400/90 font-medium">
                                    {s.durationSeconds ? `${s.durationSeconds}s` : s.reps ? `${s.reps} reps` : s.distanceKm ? `${s.distanceKm} km` : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

