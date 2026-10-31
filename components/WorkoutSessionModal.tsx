"use client";

import React, { useEffect } from "react";
import { JournalWorkout } from "@/lib/actions";
import { getExerciseMedia } from "@/lib/exercise-media";
import { XIcon, ClockIcon, TrophyIcon } from "./Icons";

interface WorkoutSessionModalProps {
  workout: JournalWorkout | null;
  isOpen: boolean;
  onClose: () => void;
  highlightExerciseName?: string;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "-";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function WorkoutSessionModal({
  workout,
  isOpen,
  onClose,
  highlightExerciseName,
}: WorkoutSessionModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !workout) return null;

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden z-10 text-zinc-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/70 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-accent/15 border border-accent/30 text-accent-light">
                {workout.startTime}
              </span>
              {workout.durationSeconds > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                  <ClockIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatDuration(workout.durationSeconds)}</span>
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">
              {workout.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-5">
          {/* Workout Quote / Personal notes */}
          {workout.description && (
            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-xs italic text-accent-lighter/90 leading-relaxed">
              "{workout.description}"
            </div>
          )}

          {/* Session Overview Stats Pill */}
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs font-mono text-zinc-400">
            <span>
              <strong className="text-zinc-200">{workout.exercises.length}</strong> ejercicios
            </span>
            <span className="text-zinc-700">•</span>
            <span>
              <strong className="text-zinc-200">{totalSets}</strong> series totales
            </span>
          </div>

          {/* Exercises Breakdown in this session */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Ejercicios y Series Realizadas en Esta Sesión
            </h4>

            {workout.exercises.map((ex, exIdx) => {
              const isHighlighted =
                highlightExerciseName &&
                ex.name.toLowerCase().trim() === highlightExerciseName.toLowerCase().trim();
              const media = getExerciseMedia(ex.name);
              const gifUrl = ex.gifUrl || media.gifUrl;

              return (
                <div
                  key={ex.id || exIdx}
                  className={`rounded-xl border transition-all p-4 flex flex-col gap-3 ${
                    isHighlighted
                      ? "bg-accent/5 border-accent/40 shadow-md shadow-accent/5"
                      : "bg-zinc-950/60 border-zinc-800"
                  }`}
                >
                  {/* Exercise Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 3D Visual thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white shrink-0 border border-zinc-800 flex items-center justify-center">
                        {gifUrl ? (
                          <img
                            src={gifUrl}
                            alt={ex.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] font-mono text-zinc-500">
                            3D
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-zinc-100 truncate">
                            {ex.name}
                          </span>
                          {isHighlighted && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-accent/20 text-accent-lighter border border-accent/30">
                              Seleccionado en gráfica
                            </span>
                          )}
                        </div>

                        {ex.exerciseNotes && (
                          <span className="text-[11px] text-zinc-400 italic">
                            Nota: {ex.exerciseNotes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Top Set pill */}
                    <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-accent-light">
                      <TrophyIcon className="w-3.5 h-3.5 text-accent" />
                      <span>{ex.topSetLabel}</span>
                    </div>
                  </div>

                  {/* Sets Table */}
                  <div className="rounded-lg border border-zinc-800/80 overflow-hidden bg-zinc-900/60">
                    <table className="w-full text-left text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/90 text-[10px] text-zinc-400 uppercase tracking-wider">
                          <th className="py-2 px-3">Serie</th>
                          <th className="py-2 px-3">Tipo</th>
                          <th className="py-2 px-3">Carga / Reps</th>
                          <th className="py-2 px-3 text-right">RPE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {ex.sets.map((s) => {
                          const isWeightedBw = ex.metricType === "weighted_bodyweight";
                          let weightLabel = "—";
                          if (isWeightedBw && s.reps !== null) {
                            if (s.weightKg !== null && s.weightKg > 0) {
                              weightLabel = `+${s.weightKg} kg × ${s.reps}`;
                            } else {
                              weightLabel = `0kg + BW × ${s.reps}`;
                            }
                          } else if (s.weightKg !== null && s.reps !== null) {
                            weightLabel = `${s.weightKg} kg × ${s.reps}`;
                          } else if (s.weightKg === null && s.reps !== null) {
                            weightLabel = `${s.reps} reps`;
                          } else if (s.distanceKm !== null) {
                            weightLabel = `${s.distanceKm} km`;
                          } else if (s.durationSeconds !== null) {
                            weightLabel = `${s.durationSeconds}s`;
                          }

                          const isTop = weightLabel !== "—" && (
                            weightLabel === ex.topSetLabel ||
                            `${s.weightKg} kg × ${s.reps}` === ex.topSetLabel ||
                            `+${s.weightKg} kg × ${s.reps}` === ex.topSetLabel
                          );

                          return (
                            <tr
                              key={s.id}
                              className={`transition-colors ${
                                isTop ? "bg-accent/10 font-semibold" : "hover:bg-zinc-800/30"
                              }`}
                            >
                              <td className="py-2 px-3 text-zinc-400 font-normal">
                                #{s.setIndex}
                              </td>
                              <td className="py-2 px-3">
                                {isTop ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/20 text-accent-lighter border border-accent/30 font-medium">
                                    TOP SET
                                  </span>
                                ) : s.setType === "warmup" ? (
                                  <span className="text-zinc-500 text-[11px]">Calentamiento</span>
                                ) : (
                                  <span className="text-zinc-400 text-[11px]">Efectiva</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-zinc-200">
                                {weightLabel}
                              </td>
                              <td className="py-2 px-3 text-right text-zinc-500 text-[11px]">
                                {s.rpe ? `@${s.rpe}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">
            ID: {workout.id.slice(0, 8)}...
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

