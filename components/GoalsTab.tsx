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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 font-sans flex items-center gap-2">
            <TargetIcon className="w-5 h-5 text-amber-400" />
            <span>Objetivos & Hitos de Rendimiento</span>
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Progreso medido desde tu punto de partida real hacia la proyección intermedia y la meta final.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-semibold transition-colors cursor-pointer self-start sm:self-center shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Nuevo Objetivo</span>
        </button>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs font-mono text-zinc-500">
          Cargando objetivos...
        </div>
      ) : goals.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 p-8">
          <TargetIcon className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-mono font-semibold text-zinc-300 mb-1">No hay objetivos definidos</h3>
          <p className="text-xs font-mono text-zinc-500 max-w-sm mx-auto mb-4">
            Crea tu primer objetivo para fijar un hito a plazo y una meta final sobre cualquiera de tus ejercicios.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors cursor-pointer"
          >
            Añadir objetivo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const unit = getUnit(g.metricType);
            const isMilestoneReached = g.currentValue >= g.targetMilestone;
            const isFinalReached = g.currentValue >= g.targetFinal;

            return (
              <div
                key={g.id}
                className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 transition-all flex flex-col justify-between gap-5 relative group"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-base font-bold text-zinc-100 font-sans">
                        {g.exerciseName}
                      </h3>
                      {g.notes && (
                        <p className="text-xs font-mono text-zinc-400 mt-0.5">
                          {g.notes}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Eliminar objetivo"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3-Point Progress Nodes */}
                  <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/60 font-mono">
                    {/* Current */}
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-zinc-500 font-semibold">Punto Actual</span>
                      <span className="text-sm font-bold text-zinc-200 mt-0.5">
                        {g.currentValue} {unit}
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate" title={g.currentLabel}>
                        {g.currentLabel}
                      </span>
                    </div>

                    {/* Milestone / Projection */}
                    <div className="flex flex-col border-x border-zinc-800/60 px-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-amber-400/80 font-semibold">Proyección</span>
                        {isMilestoneReached && <CheckIcon className="w-3 h-3 text-emerald-400" />}
                      </div>
                      <span className="text-sm font-bold text-amber-300 mt-0.5">
                        {g.targetMilestone} {unit}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {g.progressMilestonePct}%
                      </span>
                    </div>

                    {/* Final Target */}
                    <div className="flex flex-col text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[10px] uppercase text-emerald-400/80 font-semibold">Meta Final</span>
                        {isFinalReached && <CheckIcon className="w-3 h-3 text-emerald-400" />}
                      </div>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5">
                        {g.targetFinal} {unit}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {g.progressFinalPct}%
                      </span>
                    </div>
                  </div>

                  {/* Dual Step Progress Bar */}
                  <div className="relative pt-1">
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isFinalReached ? "bg-emerald-400" : isMilestoneReached ? "bg-amber-400" : "bg-amber-500/80"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, g.progressFinalPct))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer status badge */}
                <div className="flex items-center justify-between text-[11px] font-mono border-t border-zinc-800/60 pt-3 text-zinc-400">
                  <span className="text-zinc-500">Estado:</span>
                  {isFinalReached ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <TrophyIcon className="w-3.5 h-3.5" /> ¡Meta Final Superada!
                    </span>
                  ) : isMilestoneReached ? (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <CheckIcon className="w-3.5 h-3.5" /> Hito intermedio completado
                    </span>
                  ) : (
                    <span className="text-zinc-400">
                      En camino hacia el hito ({Math.round(g.targetMilestone - g.currentValue)} {unit} restantes)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Goal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <TargetIcon className="w-4 h-4 text-amber-400" />
                <span>Definir Nuevo Objetivo</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="flex flex-col gap-4">
              {/* Exercise Selector */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Ejercicio a trackear</label>
                <select
                  value={selectedExId}
                  onChange={(e) => setSelectedExId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700"
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} (actual: {ex.bestLabel || "0"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Milestone & Final */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Hito / Proyección a plazo
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="ej: 15"
                    value={targetMilestone}
                    onChange={(e) => setTargetMilestone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Objetivo Final Definitivo
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="ej: 25"
                    value={targetFinal}
                    onChange={(e) => setTargetFinal(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Notas / Detalles (opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej: Con parada en el pecho o a 5 reps limpias"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Submit buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800 mt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors cursor-pointer disabled:opacity-50"
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

