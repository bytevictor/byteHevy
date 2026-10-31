"use client";

import React, { useState, useEffect } from "react";
import { GoalItem, ExerciseSummary } from "@/lib/actions";
import { TargetIcon, PlusIcon, TrashIcon, CheckIcon, XIcon, InfoIcon, TrophyIcon } from "./Icons";

export function GoalsTab() {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form states for new goal
  const [selectedExId, setSelectedExId] = useState("");
  const [targetMilestone, setTargetMilestone] = useState("");
  const [targetFinal, setTargetFinal] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [goalsRes, exRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/exercises"),
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

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExId || !targetMilestone || !targetFinal) return;
    setSubmitting(true);
    try {
      const selectedEx = exercises.find((ex) => ex.id === selectedExId);
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: selectedExId,
          metricType: selectedEx?.metricType || "weight_reps",
          targetMilestone: parseFloat(targetMilestone),
          targetFinal: parseFloat(targetFinal),
          notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setModalOpen(false);
        setTargetMilestone("");
        setTargetFinal("");
        setNotes("");
        await loadData();
      }
    } catch (e) {
      console.error("Error creating goal:", e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm("¿Eliminar este objetivo?")) return;
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

  const getUnit = (type: string) => {
    if (type === "seconds") return "s";
    if (type === "cardio") return "km";
    if (type === "bodyweight_reps") return "reps";
    return "kg";
  };

  return (
    <div className="py-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <TargetIcon className="w-5 h-5 text-amber-400" />
            <span>Objetivos & Hitos de Rendimiento</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-normal">
            Progreso medido desde tu punto de partida real hacia la proyección intermedia y la meta final.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-all cursor-pointer self-start sm:self-center shadow-lg shadow-amber-500/10"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Nuevo Objetivo</span>
        </button>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-zinc-500">
          Cargando objetivos...
        </div>
      ) : goals.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40 p-8">
          <TargetIcon className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">No hay objetivos definidos</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
            Crea tu primer objetivo para fijar un hito intermedio y una meta final sobre cualquiera de tus ejercicios.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Añadir objetivo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((goal) => {
            const unit = getUnit(goal.metricType);
            const current = goal.currentValue || 0;
            const milestone = goal.targetMilestone;
            const final = goal.targetFinal;
            const isMilestoneReached = goal.progressMilestonePct >= 100;
            const isFinalReached = goal.progressFinalPct >= 100;
            const progress = goal.progressFinalPct;

            return (
              <div
                key={goal.id}
                className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm flex flex-col justify-between gap-4 relative group"
              >
                {/* Top: Exercise Title & Delete Button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1">
                      {goal.metricType.replace("_", " ")}
                    </span>
                    <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                      {goal.exerciseName}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                    title="Eliminar objetivo"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* 3-Point Progression Visualizer */}
                <div className="flex flex-col gap-2.5 my-1">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {/* Point 1: Punto Actual */}
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col">
                      <span className="text-[10px] text-zinc-500 mb-1 font-medium">Actual</span>
                      <span className="text-sm font-mono tabular-nums font-bold text-zinc-200">
                        {current > 0 ? `${current} ${unit}` : "Sin datos"}
                      </span>
                    </div>

                    {/* Point 2: Proyección (Hito) */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col ${
                        isMilestoneReached
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : "bg-zinc-950/60 border-zinc-800/80 text-zinc-300"
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 mb-1 flex items-center justify-center gap-1 font-medium">
                        {isMilestoneReached && <CheckIcon className="w-3 h-3 text-amber-400" />}
                        <span>Hito</span>
                      </span>
                      <span className="text-sm font-mono tabular-nums font-bold">
                        {milestone} {unit}
                      </span>
                    </div>

                    {/* Point 3: Meta Final */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col ${
                        isFinalReached
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-zinc-950/60 border-zinc-800/80 text-zinc-300"
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 mb-1 flex items-center justify-center gap-1 font-medium">
                        {isFinalReached && <TrophyIcon className="w-3 h-3 text-emerald-400" />}
                        <span>Meta Final</span>
                      </span>
                      <span className="text-sm font-mono tabular-nums font-bold">
                        {final} {unit}
                      </span>
                    </div>
                  </div>

                  {/* Dual Progress Bar */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {isFinalReached
                          ? "✓ ¡Meta final completada!"
                          : isMilestoneReached
                          ? "✓ Hito intermedio completado"
                          : "En progreso hacia el hito"}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-amber-400">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                {goal.notes && (
                  <div className="pt-2 border-t border-zinc-800/60 text-xs italic text-zinc-400">
                    "{goal.notes}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Goal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-950/60">
              <div className="flex flex-col">
                <span className="text-xs text-amber-400 font-semibold mb-1">Nueva Meta</span>
                <h3 className="text-lg font-bold text-zinc-100">Configurar Progresión en 3 Puntos</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Ejercicio
                </label>
                <select
                  value={selectedExId}
                  onChange={(e) => setSelectedExId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  required
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} (actual: {ex.latestTopSetLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Hito Intermedio
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ej. 18"
                    value={targetMilestone}
                    onChange={(e) => setTargetMilestone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500/50"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Meta alcanzable a corto plazo
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Meta Final
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ej. 25"
                    value={targetFinal}
                    onChange={(e) => setTargetFinal(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500/50"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Objetivo de fuerza definitivo
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Mantener técnica estricta sin balanceo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                />
              </div>

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
                  className="px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-50"
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
