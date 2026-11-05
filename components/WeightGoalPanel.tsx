"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ScaleIcon,
  TargetIcon,
  TrophyIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  FlameIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ActivityIcon,
  SparklesIcon,
  PlusIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ZapIcon,
} from "./Icons";
import { WeightGoalData } from "@/lib/actions";

interface LatestWeightInfo {
  weight: number;
  date: string;
}

export function WeightGoalPanel() {
  const [goal, setGoal] = useState<WeightGoalData | null>(null);
  const [latestWeight, setLatestWeight] = useState<LatestWeightInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states (estrictamente peso objetivo y punto de partida, sin fechas ni selectores redundantes)
  const [targetWeight, setTargetWeight] = useState<string>("");
  const [startWeight, setStartWeight] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const derivedGoalType: "deficit" | "surplus" | "maintenance" = React.useMemo(() => {
    const t = parseFloat(targetWeight);
    const s = parseFloat(startWeight) || (latestWeight?.weight ?? 0);
    if (isNaN(t) || s <= 0) return "deficit";
    if (t < s - 0.1) return "deficit";
    if (t > s + 0.1) return "surplus";
    return "maintenance";
  }, [targetWeight, startWeight, latestWeight]);

  const loadGoal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weight/goal", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setGoal(json.data);
        if (json.latestWeight) {
          setLatestWeight(json.latestWeight);
        }
      }
    } catch (e: any) {
      console.error("Error fetching weight goal:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  // Open edit / creation form
  const handleOpenForm = useCallback(() => {
    if (goal) {
      setTargetWeight(String(goal.targetWeight));
      setStartWeight(String(goal.startWeight));
      setStartDate(goal.startDate || "");
      setNotes(goal.notes || "");
    } else {
      const defaultStart = latestWeight?.weight ? String(latestWeight.weight) : "";
      const defaultStartDate = latestWeight?.date || new Date().toISOString().split("T")[0];
      setTargetWeight("");
      setStartWeight(defaultStart);
      setStartDate(defaultStartDate);
      setNotes("");
    }
    setIsEditing(true);
    setShowDeleteConfirm(false);
  }, [goal, latestWeight]);

  // Save goal handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tWeight = parseFloat(targetWeight);
    if (isNaN(tWeight) || tWeight <= 0) {
      alert("Introduce un peso objetivo válido.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        targetWeight: tWeight,
        startWeight: startWeight ? parseFloat(startWeight) : undefined,
        startDate: startDate || undefined,
        goalType: derivedGoalType,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/weight/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setGoal(json.data);
        setIsEditing(false);
      } else {
        alert(json.error || "Error al guardar el objetivo");
      }
    } catch (e: any) {
      console.error("Failed to save weight goal:", e);
      alert("Error de conexión al guardar el objetivo");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete goal handler
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/weight/goal", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setGoal(null);
        setShowDeleteConfirm(false);
        setIsEditing(false);
      } else {
        alert(json.error || "Error al eliminar el objetivo");
      }
    } catch (e) {
      console.error("Failed to delete weight goal:", e);
      alert("Error de conexión al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm animate-pulse">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-4 w-44 bg-zinc-800 rounded" />
              <div className="h-3 w-64 bg-zinc-850 rounded" />
            </div>
          </div>
          <div className="h-8 w-28 bg-zinc-800 rounded-xl" />
        </div>
        <div className="h-16 bg-zinc-800/60 rounded-xl" />
      </div>
    );
  }

  // Phase badges & accents (sin brillos extraños en contenedor)
  const phaseConfig = {
    deficit: {
      label: "Déficit Calórico",
      tag: "Definición",
      badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      barColor: "bg-gradient-to-r from-amber-500 to-amber-400",
      icon: FlameIcon,
      directionText: "a perder",
    },
    surplus: {
      label: "Superávit Calórico",
      tag: "Volumen Muscular",
      badgeClass: "text-sky-400 bg-sky-500/10 border-sky-500/30",
      barColor: "bg-gradient-to-r from-sky-500 to-sky-400",
      icon: TrendingUpIcon,
      directionText: "a ganar",
    },
    maintenance: {
      label: "Mantenimiento",
      tag: "Recomposición",
      badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      barColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      icon: ActivityIcon,
      directionText: "de margen",
    },
  }[goal?.goalType || "deficit"];

  const PhaseIcon = phaseConfig.icon;

  // Form helper comparison
  const parsedTarget = parseFloat(targetWeight);
  const parsedStart = parseFloat(startWeight) || (latestWeight?.weight ?? 0);
  const targetDiffKg = !isNaN(parsedTarget) && parsedStart > 0
    ? Math.round(Math.abs(parsedTarget - parsedStart) * 10) / 10
    : null;

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm transition-all">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent-light shrink-0 shadow-sm">
            <ScaleIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                Objetivo de Peso Corporal
              </h2>
              {goal && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${phaseConfig.badgeClass}`}
                >
                  <PhaseIcon className="w-3 h-3" />
                  <span>{phaseConfig.label}</span>
                </span>
              )}
              {goal?.isCompleted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 shadow-xs">
                  <TrophyIcon className="w-3 h-3" />
                  <span>¡Alcanzado!</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {goal
                ? `Último registro: ${goal.currentWeight} kg ${
                    goal.currentDate ? `(${goal.currentDate})` : ""
                  } · Meta fijada en ${goal.targetWeight} kg`
                : latestWeight
                ? `Tu último peso registrado es de ${latestWeight.weight} kg (${latestWeight.date}). Define tu objetivo de peso.`
                : "Fija tu meta de peso corporal y obtén estimaciones automáticas según tu tendencia actual."}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {goal && !isEditing && (
            <>
              <Link
                href="/peso"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition-all border border-zinc-700/60 cursor-pointer shadow-xs"
                title="Ver gráfica, curvas y proyecciones completas en Peso"
              >
                <ActivityIcon className="w-3.5 h-3.5 text-accent-light" />
                <span className="hidden sm:inline">Ver Proyección en Pesos</span>
                <span className="sm:hidden">Proyección</span>
                <ExternalLinkIcon className="w-3 h-3 opacity-60" />
              </Link>
              <button
                onClick={handleOpenForm}
                className="p-2 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors border border-zinc-700/60 cursor-pointer"
                title="Editar objetivo de peso"
              >
                <EditIcon className="w-4 h-4" />
              </button>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 rounded-xl p-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-2.5 py-1 text-[11px] font-bold text-red-300 bg-red-800/60 hover:bg-red-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {deleting ? "Borrando..." : "Confirmar"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800/70 transition-colors border border-transparent hover:border-zinc-700/60 cursor-pointer"
                  title="Eliminar objetivo de peso"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {!goal && !isEditing && (
            <button
              onClick={handleOpenForm}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-zinc-950 text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-accent/15 active:scale-[0.98]"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Fijar Objetivo de Peso</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isEditing ? (
        /* ================= FORMULARIO SIMPLIFICADO DE DEFINICIÓN ================= */
        <form onSubmit={handleSave} className="mt-5 space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Peso Objetivo con indicador automático de fase */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <TargetIcon className="w-3.5 h-3.5 text-accent-light" />
                  <span>Peso Objetivo (kg) *</span>
                </label>
                {/* Badge automático de fase */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                    derivedGoalType === "deficit"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : derivedGoalType === "surplus"
                      ? "text-sky-400 bg-sky-500/10 border-sky-500/30"
                      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  }`}
                >
                  {derivedGoalType === "deficit" ? (
                    <>
                      <FlameIcon className="w-3 h-3" />
                      <span>Déficit (Definición)</span>
                    </>
                  ) : derivedGoalType === "surplus" ? (
                    <>
                      <TrendingUpIcon className="w-3 h-3" />
                      <span>Volumen (Superávit)</span>
                    </>
                  ) : (
                    <>
                      <ActivityIcon className="w-3 h-3" />
                      <span>Mantenimiento</span>
                    </>
                  )}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="30"
                max="250"
                required
                placeholder="Ej. 75.0"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none font-mono"
              />
            </div>

            {/* Peso Inicial de Referencia */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ScaleIcon className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Peso de Partida (kg)</span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {latestWeight?.weight ? `Báscula: ${latestWeight.weight} kg` : "Base"}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="30"
                max="250"
                placeholder={latestWeight?.weight ? String(latestWeight.weight) : "79.7"}
                value={startWeight}
                onChange={(e) => setStartWeight(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Notas / Estrategia */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Estrategia o Notas (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Déficit moderado de 400 kcal, 10.000 pasos diarios y 160g de proteína"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            />
          </div>

          {/* Live Preview Info */}
          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center gap-2.5 text-xs text-zinc-300">
            <SparklesIcon className="w-4 h-4 text-accent-light shrink-0" />
            <span>
              {targetDiffKg !== null ? (
                <>
                  Variación a alcanzar:{" "}
                  <strong className="text-zinc-100 font-mono">
                    {targetDiffKg} kg
                  </strong>{" "}
                  ({derivedGoalType === "deficit" ? "pérdida" : derivedGoalType === "surplus" ? "ganancia" : "recomposición"}).
                  Las estimaciones de tiempo y balance calórico se calcularán automáticamente según tu tendencia real de pesajes.
                </>
              ) : (
                "Introduce el peso objetivo para sincronizar tus estimaciones con la tendencia actual de pesajes."
              )}
            </span>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl border border-zinc-700/80 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent-light text-zinc-950 text-xs font-semibold transition-all cursor-pointer shadow-md shadow-accent/15 active:scale-[0.98]"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{submitting ? "Guardando..." : "Guardar Objetivo"}</span>
            </button>
          </div>
        </form>
      ) : goal ? (
        /* ================= MODO DE VISUALIZACIÓN ACTIVA ================= */
        <div className="mt-5 space-y-4">
          {/* Main Weight Progress Bar & Key Weights */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
            <div className="flex items-baseline justify-between text-xs text-zinc-400">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                  Partida {goal.startDate ? `(${goal.startDate})` : ""}
                </span>
                <span className="text-base font-bold font-mono text-zinc-300 mt-0.5">
                  {goal.startWeight} kg
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-accent-light">
                  Peso Actual
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-zinc-100 tracking-tight mt-0.5">
                  {goal.currentWeight} <span className="text-xs text-zinc-400 font-normal">kg</span>
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                  Meta Objetivo
                </span>
                <span className="text-base font-bold font-mono text-zinc-300 mt-0.5">
                  {goal.targetWeight} kg
                </span>
              </div>
            </div>

            {/* Custom Multi-Point Progress Track */}
            <div className="relative pt-1">
              <div className="h-3 w-full bg-zinc-800/80 rounded-full overflow-hidden p-0.5 border border-zinc-700/50 relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${phaseConfig.barColor}`}
                  style={{ width: `${Math.max(3, Math.min(100, goal.progressPct))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono font-medium text-zinc-400 mt-1.5">
                <span className="text-zinc-400">
                  {goal.totalChangeKg !== 0 ? (
                    <>
                      {goal.totalChangeKg > 0 ? "+" : ""}
                      {goal.totalChangeKg} kg desde el inicio
                    </>
                  ) : (
                    "Punto de partida"
                  )}
                </span>
                <span className="font-semibold text-zinc-200">
                  {goal.progressPct}% completado
                </span>
                <span
                  className={
                    goal.isCompleted ? "text-emerald-400 font-bold" : "text-zinc-300"
                  }
                >
                  {goal.isCompleted
                    ? "¡Meta cumplida!"
                    : `${goal.remainingKg} kg ${phaseConfig.directionText}`}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostic Callout: Estimación Basada en la Tendencia Actual */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              goal.trendStatus === "diverging"
                ? "bg-amber-950/20 border-amber-800/40 text-amber-200"
                : goal.trendStatus === "aggressive"
                ? "bg-amber-950/20 border-amber-800/40 text-amber-200"
                : goal.trendStatus === "optimal"
                ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-200"
                : "bg-zinc-950 border-zinc-800 text-zinc-300"
            }`}
          >
            <div className="flex items-start sm:items-center gap-2.5">
              {goal.trendStatus === "diverging" ? (
                <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : goal.trendStatus === "optimal" ? (
                <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : goal.trendStatus === "aggressive" ? (
                <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <ActivityIcon className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-semibold text-zinc-100">
                  Diagnóstico según tendencia:
                </span>
                <span className="leading-snug">{goal.trendStatusText}</span>
              </div>
            </div>

            {goal.estimatedDateToGoal && !goal.isDiverging && !goal.isCompleted && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-700 shrink-0 self-start sm:self-center font-mono">
                <span className="text-[11px] text-zinc-400 font-sans">Llegada estimada:</span>
                <strong className="text-accent-light text-xs">
                  {goal.estimatedDateToGoal}
                </strong>
              </div>
            )}
          </div>

          {/* 4 Cards de Métricas de Tendencia Real */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Card 1: Velocidad / Tendencia Actual */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <ActivityIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Tendencia Real</span>
              </span>
              <div className="mt-1">
                <span
                  className={`text-base font-bold font-mono ${
                    goal.goalType === "deficit"
                      ? goal.currentTrendWeeklyRate < 0
                        ? "text-emerald-400"
                        : "text-amber-400"
                      : goal.currentTrendWeeklyRate > 0
                      ? "text-emerald-400"
                      : "text-zinc-200"
                  }`}
                >
                  {goal.currentTrendWeeklyRate > 0 ? `+${goal.currentTrendWeeklyRate}` : goal.currentTrendWeeklyRate} kg
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  por semana (dW/dt)
                </span>
              </div>
            </div>

            {/* Card 2: Balance Calórico Implícito (Wishnofsky) */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <FlameIcon className="w-3.5 h-3.5 text-accent-light" />
                <span>Balance Calórico</span>
              </span>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-accent-light">
                  {goal.currentTrendKcal > 0 ? `+${goal.currentTrendKcal}` : goal.currentTrendKcal}{" "}
                  <span className="text-xs">kcal/d</span>
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  {goal.currentTrendKcal < 0
                    ? "Déficit real implícito"
                    : goal.currentTrendKcal > 0
                    ? "Superávit real implícito"
                    : "Balance neutro"}
                </span>
              </div>
            </div>

            {/* Card 3: Tiempo al Ritmo Actual */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <ZapIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Llegada a Meta</span>
              </span>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-zinc-100">
                  {goal.isCompleted
                    ? "¡Completada!"
                    : goal.isDiverging
                    ? "Divergente"
                    : goal.estimatedDaysToGoal !== null
                    ? `~${Math.round(goal.estimatedDaysToGoal / 7)} sem`
                    : "En análisis"}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5 truncate">
                  {goal.isCompleted
                    ? "Meta consolidada"
                    : goal.isDiverging
                    ? "Requiere ajuste"
                    : goal.estimatedDateToGoal
                    ? goal.estimatedDateToGoal
                    : "Al ritmo actual"}
                </span>
              </div>
            </div>

            {/* Card 4: Distancia Restante */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <TargetIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Distancia a Meta</span>
              </span>
              <div className="mt-1">
                <span
                  className={`text-base font-bold font-mono ${
                    goal.isCompleted ? "text-emerald-400" : "text-zinc-100"
                  }`}
                >
                  {goal.isCompleted ? "0.0 kg" : `${goal.remainingKg} kg`}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  {goal.isCompleted ? "Objetivo completado" : `${goal.progressPct}% superado`}
                </span>
              </div>
            </div>
          </div>

          {/* Strategy Notes if provided */}
          {goal.notes && (
            <div className="px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center gap-2 text-xs text-zinc-400">
              <span className="text-zinc-500 font-semibold uppercase text-[10px] tracking-wider shrink-0">
                Estrategia:
              </span>
              <span className="text-zinc-300 italic truncate">{goal.notes}</span>
            </div>
          )}
        </div>
      ) : (
        /* ================= ESTADO INICIAL SIN OBJETIVO ================= */
        <div className="mt-4 p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
              <TargetIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Aún no has fijado tu meta de peso
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Establece tu meta corporal en kg. El sistema comparará tu velocidad actual de pesajes para estimar cuándo llegarás y tu balance calórico diario.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenForm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-light text-zinc-950 text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-md shadow-accent/10 active:scale-[0.98]"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Fijar Objetivo de Peso</span>
          </button>
        </div>
      )}
    </div>
  );
}
