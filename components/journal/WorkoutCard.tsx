"use client";

import React from "react";
import { JournalWorkout } from "@/lib/actions";
import { MUSCLE_LABELS } from "@/lib/exercise-media";
import { MuscleGroup } from "@/types/exercise-media";
import {
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TrophyIcon,
  DumbbellIcon,
} from "../Icons";

interface WorkoutCardProps {
  workout: JournalWorkout;
  isExpanded: boolean;
  onToggleExpand: () => void;
  highlightExerciseName?: string;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "-";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRestTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

export function formatVolume(volumeKg?: number): string {
  if (!volumeKg || volumeKg <= 0) return "-";
  return `${Math.round(volumeKg).toLocaleString("es-ES")} kg`;
}

export function WorkoutCard({
  workout,
  isExpanded,
  onToggleExpand,
  highlightExerciseName,
}: WorkoutCardProps) {
  const totalSets = workout.totalSets ?? workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const totalVolume = workout.totalVolumeKg ?? 0;
  const avgRest = workout.averageRestSeconds ?? 0;

  return (
    <div
      id={`workout-${workout.id}`}
      className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm p-5 flex flex-col gap-4 hover:border-zinc-700/80 transition-all duration-200 shadow-sm"
    >
      {/* Workout Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-zinc-800/70">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono tabular-nums text-accent-light font-semibold bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-lg">
              {workout.startTime}
            </span>
            {workout.endTime && (
              <span className="text-[11px] font-mono text-zinc-500">
                hasta {workout.endTime.includes(",") ? workout.endTime.split(",")[1].trim() : workout.endTime}
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight truncate mt-0.5">
            {workout.title}
          </h3>
        </div>

        {/* Workout Summary Metric Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono tabular-nums self-start sm:self-center shrink-0">
          {workout.durationSeconds > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-300"
              title="Duración total del entrenamiento"
            >
              <ClockIcon className="w-3.5 h-3.5 text-zinc-500" />
              <span>{formatDuration(workout.durationSeconds)}</span>
            </div>
          )}

          {avgRest > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-300"
              title="Descanso medio estimado entre series"
            >
              <span className="text-zinc-500 font-sans text-[11px]">⏸</span>
              <span>
                <span className="text-zinc-400 font-sans text-[11px]">Descanso:</span> {formatRestTime(avgRest)}
              </span>
            </div>
          )}

          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-300"
            title="Series totales realizadas"
          >
            <span className="text-accent-light font-bold">{totalSets}</span>
            <span className="text-zinc-500 text-[11px] font-sans">series</span>
          </div>

          {totalVolume > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-300"
              title="Volumen total de carga"
            >
              <DumbbellIcon className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-200">{formatVolume(totalVolume)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Unhinged Quote / Workout Notes Box */}
      {workout.description && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-accent/10 via-zinc-950/80 to-zinc-950/80 border border-accent/25 text-xs text-accent-lighter/95 italic leading-relaxed flex items-start gap-2.5">
          <span className="text-accent-light font-serif text-lg leading-none shrink-0 select-none">“</span>
          <div className="flex-1">
            <span>{workout.description}</span>
          </div>
          <span className="text-accent-light font-serif text-lg leading-none shrink-0 select-none self-end">”</span>
        </div>
      )}

      {/* Exercises Summary Chips (Collapsed View) */}
      {!isExpanded && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {workout.exercises.map((ex, idx) => {
            const isMatch =
              highlightExerciseName &&
              ex.name.toLowerCase().trim() === highlightExerciseName.toLowerCase().trim();

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors ${
                  isMatch
                    ? "bg-accent/15 border-accent/40 text-accent-light"
                    : "bg-zinc-950/70 border-zinc-800/80 text-zinc-300"
                }`}
              >
                {ex.gifUrl && (
                  <div className="w-5 h-5 rounded-md overflow-hidden bg-white shrink-0 border border-zinc-700/50 flex items-center justify-center">
                    <img src={ex.gifUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
                <span className="font-semibold text-zinc-200">{ex.name}</span>
                <span className="text-zinc-600 text-[10px]">•</span>
                <span className="font-mono tabular-nums text-accent-light font-medium text-[11px]">
                  {ex.topSetLabel}
                </span>
                <span className="text-zinc-500 font-mono text-[10px]">({ex.sets.length} ser.)</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expand / Collapse Control */}
      <div className="pt-1">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer select-none group"
        >
          {isExpanded ? (
            <>
              <div className="w-5 h-5 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light group-hover:bg-accent/25 transition-colors">
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </div>
              <span>Ocultar desglose detallado ({workout.exercises.length} ejercicios)</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-lg bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 group-hover:bg-zinc-700 transition-colors">
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </div>
              <span>Ver desglose de series, carátulas 3D y ajustes ({workout.exercises.length} ejercicios)</span>
            </>
          )}
        </button>

        {/* Detailed Exercises & Sets Breakdown (Expanded View) */}
        {isExpanded && (
          <div className="mt-4 flex flex-col gap-4 animate-in fade-in duration-200">
            {workout.exercises.map((ex, exIdx) => {
              const isMatch =
                highlightExerciseName &&
                ex.name.toLowerCase().trim() === highlightExerciseName.toLowerCase().trim();
              const muscleLabel = ex.primaryMuscle
                ? MUSCLE_LABELS[ex.primaryMuscle as MuscleGroup] || ex.primaryMuscle
                : null;

              // Find best set index to highlight top set
              let bestSetIdx = -1;
              let maxScore = -1;
              ex.sets.forEach((s, idx) => {
                const wt = s.weightKg ?? 0;
                const rp = s.reps ?? 0;
                const score = wt > 0 ? wt * 1000 + rp : rp;
                if (score > maxScore) {
                  maxScore = score;
                  bestSetIdx = idx;
                }
              });

              return (
                <div
                  key={ex.id || exIdx}
                  className={`p-4 rounded-xl border flex flex-col gap-3.5 transition-all ${
                    isMatch
                      ? "bg-accent/10 border-accent/40 shadow-sm shadow-accent/5"
                      : "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-750"
                  }`}
                >
                  {/* Exercise Header Card with 3D GIF */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 3D Visual GIF Container */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-white shrink-0 border border-zinc-750 flex items-center justify-center shadow-inner">
                        {ex.gifUrl ? (
                          <img
                            src={ex.gifUrl}
                            alt={ex.name}
                            className="w-full h-full object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-xs font-mono text-zinc-500 font-bold">
                            3D
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-zinc-100 tracking-tight">
                            {ex.name}
                          </h4>
                          {muscleLabel && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
                              {muscleLabel}
                            </span>
                          )}
                        </div>

                        {/* Exercise Notes / Machine Adjustments */}
                        {ex.exerciseNotes ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg self-start">
                            <span className="text-[11px]">📝</span>
                            <span className="font-medium italic">Ajuste / Nota: {ex.exerciseNotes}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Top Set & Volume Pill */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {ex.volumeKg ? (
                        <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">
                          Vol: <strong className="text-zinc-200">{formatVolume(ex.volumeKg)}</strong>
                        </span>
                      ) : null}

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/25 text-xs font-mono text-accent-light font-semibold">
                        <TrophyIcon className="w-3.5 h-3.5 text-accent" />
                        <span>{ex.topSetLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sets Breakdown Table */}
                  <div className="rounded-xl border border-zinc-800/80 overflow-hidden bg-zinc-900/40">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono tabular-nums">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                            <th className="py-2 px-3 w-16">Serie</th>
                            <th className="py-2 px-3">Tipo</th>
                            <th className="py-2 px-3">Carga / Reps</th>
                            <th className="py-2 px-3 text-right">Volumen</th>
                            <th className="py-2 px-3 text-right">1RM Est.</th>
                            {ex.sets.some((s) => s.rpe !== null) && (
                              <th className="py-2 px-3 text-right">RPE</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                          {ex.sets.map((s, sIdx) => {
                            const isTopSet = sIdx === bestSetIdx;
                            const isWeightedBw = ex.metricType === "weighted_bodyweight";
                            const setVol =
                              s.weightKg !== null && s.reps !== null && s.weightKg > 0 && s.reps > 0
                                ? Math.round(s.weightKg * s.reps)
                                : null;

                            // Brzycki 1RM formula: weight * (36 / (37 - reps)) for reps between 1 and 30
                            let est1RM: number | null = null;
                            if (s.weightKg !== null && s.reps !== null && s.weightKg > 0 && s.reps > 0) {
                              if (s.reps === 1) est1RM = s.weightKg;
                              else if (s.reps < 37) {
                                est1RM = Math.round((s.weightKg * 36) / (37 - s.reps));
                              }
                            }

                            return (
                              <tr
                                key={s.id || sIdx}
                                className={`transition-colors ${
                                  isTopSet
                                    ? "bg-accent/10 font-medium text-zinc-100"
                                    : "hover:bg-zinc-800/30"
                                }`}
                              >
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                        isTopSet
                                          ? "bg-accent text-zinc-950 font-bold"
                                          : "bg-zinc-800 text-zinc-400"
                                      }`}
                                    >
                                      {s.setIndex || sIdx + 1}
                                    </span>
                                    {isTopSet && (
                                      <span className="text-[10px] text-accent-light" title="Mejor serie">
                                        ★
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      s.setType === "warmup"
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        : s.setType === "drop"
                                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                        : s.setType === "failure"
                                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                        : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/40"
                                    }`}
                                  >
                                    {s.setType === "warmup"
                                      ? "Calent."
                                      : s.setType === "drop"
                                      ? "Drop"
                                      : s.setType === "failure"
                                      ? "Fallo"
                                      : "Normal"}
                                  </span>
                                </td>

                                <td className="py-2 px-3">
                                  <span className="font-semibold text-zinc-100">
                                    {s.weightKg !== null && s.reps !== null
                                      ? isWeightedBw
                                        ? s.weightKg > 0
                                          ? `+${s.weightKg} kg × ${s.reps}`
                                          : `0 kg + BW × ${s.reps}`
                                        : `${s.weightKg} kg × ${s.reps}`
                                      : s.reps !== null
                                      ? isWeightedBw
                                        ? `BW × ${s.reps}`
                                        : `${s.reps} reps`
                                      : s.durationSeconds !== null
                                      ? `${s.durationSeconds}s`
                                      : s.distanceKm !== null
                                      ? `${s.distanceKm} km`
                                      : "—"}
                                  </span>
                                </td>

                                <td className="py-2 px-3 text-right text-zinc-400">
                                  {setVol ? `${setVol.toLocaleString("es-ES")} kg` : "—"}
                                </td>

                                <td className="py-2 px-3 text-right">
                                  {est1RM ? (
                                    <span className="text-accent-light/90 font-medium">
                                      {est1RM} kg
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>

                                {ex.sets.some((item) => item.rpe !== null) && (
                                  <td className="py-2 px-3 text-right font-semibold text-zinc-400">
                                    {s.rpe ? `@${s.rpe}` : "—"}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

