"use client";

import React, { useState, useEffect } from "react";
import { GoalItem, ExerciseSummary } from "@/lib/actions";
import { getExerciseMedia } from "@/lib/exercise-media";
import { TargetIcon, PlusIcon, TrashIcon, CheckIcon, XIcon, TrophyIcon, EditIcon, CalendarIcon, CrownIcon } from "./Icons";
import { GoalsSkeleton } from "./skeletons/GoalsSkeleton";
import { useSeason } from "@/lib/season-context";

export function GoalsTab() {
  const { activeSeasonId, activeSeason, setActiveSeasonId } = useSeason();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Form states for ideal goal
  const [selectedExId, setSelectedExId] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetSeconds, setTargetSeconds] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeSeasonId]);

  async function loadData() {
    setLoading(true);
    try {
      const query =
        activeSeasonId && activeSeasonId !== "all"
          ? `?seasonId=${encodeURIComponent(activeSeasonId)}`
          : "";
      const [goalsRes, exRes] = await Promise.all([
        fetch(`/api/goals${query}`, { cache: "no-store" }),
        fetch(`/api/exercises${query}`, { cache: "no-store" }),
      ]);
      const goalsJson = await goalsRes.json();
      const exJson = await exRes.json();
      if (goalsJson.success) setGoals(goalsJson.data);
      if (exJson.success) {
        setExercises(exJson.data);
        if (exJson.data.length > 0 && !selectedExId) {
          setSelectedExId(exJson.data[0].id);
        }
      }
    } catch (e) {
      console.error("Error loading goals data:", e);
    } finally {
      setLoading(false);
    }
  }

  const selectedExercise = exercises.find((ex) => ex.id === selectedExId);
  const isWeightBased =
    selectedExercise?.metricType === "weight_reps" ||
    selectedExercise?.metricType === "weighted_bodyweight" ||
    !selectedExercise?.metricType;

  // When opening modal for a new goal
  function handleOpenNewGoal() {
    setEditingGoalId(null);
    const firstEx = exercises[0];
    if (firstEx) {
      setSelectedExId(firstEx.id);
      populateFormFromExercise(firstEx.id);
    } else {
      resetFormFields();
    }
    setModalOpen(true);
  }

  // When opening modal to edit an existing goal
  function handleOpenEditGoal(goal: GoalItem) {
    setEditingGoalId(goal.id);
    setSelectedExId(goal.exerciseId);
    setTargetWeight(goal.targetWeight !== undefined ? String(goal.targetWeight) : "");
    setTargetReps(goal.targetReps !== undefined ? String(goal.targetReps) : "");
    setTargetSeconds(goal.targetSeconds !== undefined ? String(goal.targetSeconds) : "");
    setTargetDistance(goal.targetDistanceKm !== undefined ? String(goal.targetDistanceKm) : "");
    setNotes(goal.notes || "");
    setModalOpen(true);
  }

  function resetFormFields() {
    setTargetWeight("");
    setTargetReps("");
    setTargetSeconds("");
    setTargetDistance("");
    setNotes("");
  }

  function populateFormFromExercise(exId: string) {
    // If a goal already exists for this exercise, prefill it
    const existing = goals.find((g) => g.exerciseId === exId);
    if (existing) {
      setTargetWeight(existing.targetWeight !== undefined ? String(existing.targetWeight) : "");
      setTargetReps(existing.targetReps !== undefined ? String(existing.targetReps) : "");
      setTargetSeconds(existing.targetSeconds !== undefined ? String(existing.targetSeconds) : "");
      setTargetDistance(existing.targetDistanceKm !== undefined ? String(existing.targetDistanceKm) : "");
      setNotes(existing.notes || "");
    } else {
      resetFormFields();
    }
  }

  function handleExerciseChange(exId: string) {
    setSelectedExId(exId);
    populateFormFromExercise(exId);
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExId) return;

    const metric = selectedExercise?.metricType || "weight_reps";
    setSubmitting(true);
    try {
      const payload: any = {
        exerciseId: selectedExId,
        metricType: metric,
        notes: notes.trim() || undefined,
      };

      if (editingGoalId) {
        payload.id = editingGoalId;
      }

      if (metric === "weight_reps" || metric === "weighted_bodyweight") {
        if (!targetWeight && !targetReps) {
          alert("Por favor, introduce el peso y/o repeticiones ideales.");
          setSubmitting(false);
          return;
        }
        if (targetWeight) payload.targetWeight = parseFloat(targetWeight);
        if (targetReps) payload.targetReps = parseInt(targetReps, 10);
      } else if (metric === "bodyweight_reps") {
        if (!targetReps) {
          alert("Por favor, introduce las repeticiones ideales.");
          setSubmitting(false);
          return;
        }
        payload.targetReps = parseInt(targetReps, 10);
      } else if (metric === "seconds") {
        if (!targetSeconds) {
          alert("Por favor, introduce los segundos ideales.");
          setSubmitting(false);
          return;
        }
        payload.targetSeconds = parseInt(targetSeconds, 10);
      } else if (metric === "cardio") {
        if (!targetDistance) {
          alert("Por favor, introduce la distancia ideal en km.");
          setSubmitting(false);
          return;
        }
        payload.targetDistanceKm = parseFloat(targetDistance);
      }

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setModalOpen(false);
        resetFormFields();
        setEditingGoalId(null);
        await loadData();
      } else {
        alert("Error al guardar el objetivo: " + (json.error || "desconocido"));
      }
    } catch (e: any) {
      console.error("Error saving goal:", e);
      alert("Error en la petición: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm("¿Eliminar este objetivo ideal?")) return;
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
      }
    } catch (e) {
      console.error("Error deleting goal:", e);
    }
  }

  // Summary stats
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.isCompleted).length;
  const avgProgress =
    totalGoals > 0
      ? Math.round(goals.reduce((acc, g) => acc + g.progressPct, 0) / totalGoals)
      : 0;

  return (
    <div className="py-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <TargetIcon className="w-5 h-5 text-accent-light" />
            <span>Objetivos de Rendimiento</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-normal">
            Define el peso y repeticiones ideal para cada ejercicio y mide tu progreso real respecto a tu récord histórico.
          </p>
        </div>

        <button
          onClick={handleOpenNewGoal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-zinc-950 text-xs font-semibold transition-all cursor-pointer self-start sm:self-center shadow-lg shadow-accent/10 hover:shadow-accent/20 active:scale-[0.98]"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Fijar Objetivo Ideal</span>
        </button>
      </div>

      {/* Season Active Banner */}
      {activeSeason && (
        <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-300">
                  Temporada: {activeSeason.name}
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  Progreso de temporada
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Evaluando metas en base a los entrenamientos de esta temporada ({activeSeason.startDate} → {activeSeason.endDate || "Actualidad"}).
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveSeasonId("all")}
            className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer self-start sm:self-center shrink-0"
          >
            Ver Histórico Completo
          </button>
        </div>
      )}

      {/* Global Progress Strip */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/30">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-zinc-400">Objetivos Fijados</span>
            <span className="text-lg font-bold font-mono text-zinc-100 mt-0.5">{totalGoals}</span>
          </div>
          <div className="flex flex-col border-x border-zinc-800/80 px-4">
            <span className="text-[11px] font-medium text-zinc-400">Completados</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-lg font-bold font-mono text-emerald-400">{completedGoals}</span>
              <span className="text-xs text-zinc-500 font-mono">/ {totalGoals}</span>
            </div>
          </div>
          <div className="flex flex-col pl-2">
            <span className="text-[11px] font-medium text-zinc-400">Progreso Medio</span>
            <span className="text-lg font-bold font-mono text-accent-light mt-0.5">{avgProgress}%</span>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {loading ? (
        <GoalsSkeleton />
      ) : goals.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40 p-8 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-accent-light">
            <TargetIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-1">No hay objetivos definidos</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-5 leading-relaxed">
            Fija para cada ejercicio cuál es tu peso y número de repeticiones ideal al que aspiras llegar. El sistema comparará automáticamente tu mejor serie histórica y te mostrará el avance hacia esa meta.
          </p>
          <button
            onClick={handleOpenNewGoal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-zinc-950 text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-accent/15"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Fijar mi primer objetivo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((goal) => {
            const media = getExerciseMedia(goal.exerciseName);
            const isCompleted = goal.isCompleted || goal.progressPct >= 100;
            const progress = Math.min(100, Math.max(0, goal.progressPct));

            return (
              <div
                key={goal.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-4 relative group ${
                  isCompleted
                    ? "border-emerald-500/40 bg-zinc-900/60 shadow-lg shadow-emerald-500/5"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80"
                } backdrop-blur-sm`}
              >
                {/* Header: Media Thumbnail + Exercise Name + Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* 3D Exercise Thumbnail */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex-shrink-0 flex items-center justify-center relative">
                      <img
                        src={media.gifUrl}
                        alt={goal.exerciseName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-accent-light font-semibold">
                          {goal.metricType.replace("_", " ")}
                        </span>
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                            <TrophyIcon className="w-3 h-3" />
                            <span>¡Conseguido!</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight truncate mt-0.5">
                        {goal.exerciseName}
                      </h3>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleOpenEditGoal(goal)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors cursor-pointer"
                      title="Editar objetivo"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/70 transition-colors cursor-pointer"
                      title="Eliminar objetivo"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Comparative Box: Récord Actual vs Objetivo Ideal */}
                <div className="grid grid-cols-2 gap-2.5 my-0.5">
                  {/* Card 1: Récord Actual */}
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                      {activeSeason ? "Récord Temporada" : "Récord Actual"}
                    </span>
                    <div className="mt-1">
                      <span className="text-base font-mono font-bold text-zinc-200 tabular-nums">
                        {goal.currentLabel}
                      </span>
                    </div>
                    {goal.allTimeReached && activeSeason ? (
                      <span className="text-[10px] text-amber-400 font-mono mt-0.5 flex items-center gap-1 font-semibold">
                        👑 Histórico: {goal.allTimeLabel}
                      </span>
                    ) : goal.current1RM ? (
                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        1RM est: <strong className="text-zinc-400">{goal.current1RM} kg</strong>
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 mt-0.5">
                        {activeSeason ? "Mejor serie en temporada" : "Mejor serie histórica"}
                      </span>
                    )}
                  </div>

                  {/* Card 2: Objetivo Ideal */}
                  <div
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      isCompleted
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                        : "bg-accent/10 border-accent/30 text-zinc-100"
                    }`}
                  >
                    <span
                      className={`text-[10px] uppercase font-semibold tracking-wider ${
                        isCompleted ? "text-emerald-400" : "text-accent-light"
                      }`}
                    >
                      Objetivo Ideal
                    </span>
                    <div className="mt-1">
                      <span className="text-base font-mono font-bold tabular-nums">
                        {goal.targetLabel}
                      </span>
                    </div>
                    {goal.target1RM ? (
                      <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                        1RM est:{" "}
                        <strong className={isCompleted ? "text-emerald-300" : "text-accent-lighter"}>
                          {goal.target1RM} kg
                        </strong>
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 mt-0.5">Meta a alcanzar</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Status */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="w-full h-2.5 rounded-full bg-zinc-800/90 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isCompleted
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-sm shadow-emerald-500/50"
                          : "bg-gradient-to-r from-accent to-accent-light shadow-sm shadow-accent/50"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-medium flex items-center gap-1 ${
                        isCompleted ? "text-emerald-400" : "text-zinc-400"
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Objetivo ideal superado!</span>
                        </>
                      ) : (
                        <span>
                          Faltan:{" "}
                          <strong className="text-zinc-200 font-normal">
                            {goal.remainingGapLabel}
                          </strong>
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-bold ${
                        isCompleted ? "text-emerald-400" : "text-accent-light"
                      }`}
                    >
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Notes (if provided) */}
                {goal.notes && (
                  <div className="pt-2 border-t border-zinc-800/60 text-xs italic text-zinc-400 bg-zinc-950/30 px-3 py-2 rounded-lg">
                    "{goal.notes}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal (Create & Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-950/60">
              <div className="flex flex-col">
                <span className="text-xs text-accent-light font-semibold mb-1">
                  {editingGoalId ? "Editar Meta" : "Nueva Meta Ideal"}
                </span>
                <h3 className="text-lg font-bold text-zinc-100">
                  {editingGoalId ? "Modificar Objetivo de Rendimiento" : "Definir Peso y Repeticiones Ideal"}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveGoal} className="p-5 flex flex-col gap-4">
              {/* Exercise Selector */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Ejercicio
                </label>
                <select
                  value={selectedExId}
                  onChange={(e) => handleExerciseChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-accent/50 cursor-pointer"
                  required
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} (Récord: {ex.bestLabel || ex.latestTopSetLabel})
                    </option>
                  ))}
                </select>

                {selectedExercise && (
                  <div className="mt-2 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Récord histórico:</span>
                    <span className="font-mono font-bold text-zinc-200">
                      {selectedExercise.bestLabel || selectedExercise.latestTopSetLabel || "Sin datos aún"}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Inputs Based on Metric */}
              {isWeightBased ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Peso Ideal (kg)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Ej. 25"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-accent/50"
                      required
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      {selectedExercise?.metricType === "weighted_bodyweight"
                        ? "Lastre adicional (kg)"
                        : "Carga objetivo total (kg)"}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Repeticiones Ideales
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Ej. 6"
                      value={targetReps}
                      onChange={(e) => setTargetReps(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-accent/50"
                      required
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Repeticiones con el peso ideal
                    </span>
                  </div>
                </div>
              ) : selectedExercise?.metricType === "bodyweight_reps" ? (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Repeticiones Ideales (Peso Corporal)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ej. 30"
                    value={targetReps}
                    onChange={(e) => setTargetReps(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-accent/50"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Número máximo de repeticiones en una serie
                  </span>
                </div>
              ) : selectedExercise?.metricType === "seconds" ? (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Tiempo Ideal (Segundos)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ej. 120"
                    value={targetSeconds}
                    onChange={(e) => setTargetSeconds(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-accent/50"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Duración objetivo mantenida (e.g. Dead Hang)
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Distancia Ideal (km)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="Ej. 10"
                    value={targetDistance}
                    onChange={(e) => setTargetDistance(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-accent/50"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Distancia a recorrer en una sesión
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Mantener técnica estricta, pausa en contracción..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-accent/50 resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-accent text-zinc-950 text-xs font-semibold hover:bg-accent-light transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-accent/20"
                >
                  {submitting ? "Guardando..." : "Guardar Objetivo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
