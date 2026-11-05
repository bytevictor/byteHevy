"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ScaleIcon,
  TargetIcon,
  TrophyIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  CalendarIcon,
  FlameIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ActivityIcon,
  SparklesIcon,
  PlusIcon,
  ClockIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [targetWeight, setTargetWeight] = useState<string>("");
  const [startWeight, setStartWeight] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [goalType, setGoalType] = useState<"deficit" | "surplus" | "maintenance">("deficit");
  const [notes, setNotes] = useState<string>("");

  const loadGoal = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/weight/goal", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setGoal(json.data);
        if (json.latestWeight) {
          setLatestWeight(json.latestWeight);
        }
      } else {
        setErrorMsg(json.error || "Error al cargar objetivo de peso");
      }
    } catch (e: any) {
      console.error("Error fetching weight goal:", e);
      setErrorMsg("No se pudo conectar con el servidor");
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
      setTargetDate(goal.targetDate || "");
      setGoalType(goal.goalType);
      setNotes(goal.notes || "");
    } else {
      const defaultStart = latestWeight?.weight ? String(latestWeight.weight) : "";
      const defaultStartDate = latestWeight?.date || new Date().toISOString().split("T")[0];
      setTargetWeight("");
      setStartWeight(defaultStart);
      setStartDate(defaultStartDate);
      setTargetDate("");
      setGoalType("deficit");
      setNotes("");
    }
    setIsEditing(true);
    setShowDeleteConfirm(false);
  }, [goal, latestWeight]);

  // Handle target weight change with auto phase detection
  const handleTargetWeightChange = (val: string) => {
    setTargetWeight(val);
    const targetNum = parseFloat(val);
    const startNum = parseFloat(startWeight) || (latestWeight?.weight ?? 0);
    if (!isNaN(targetNum) && startNum > 0) {
      if (targetNum < startNum - 0.2) {
        setGoalType("deficit");
      } else if (targetNum > startNum + 0.2) {
        setGoalType("surplus");
      } else {
        setGoalType("maintenance");
      }
    }
  };

  // Live calculation of rate and calories in the form
  const formCalculations = useMemo(() => {
    const tWeight = parseFloat(targetWeight);
    const sWeight = parseFloat(startWeight) || (latestWeight?.weight ?? 0);
    if (isNaN(tWeight) || isNaN(sWeight) || sWeight <= 0) return null;

    const diffKg = Math.round(Math.abs(tWeight - sWeight) * 10) / 10;
    let days: number | null = null;
    let weeks: number | null = null;
    let weeklyRate: number | null = null;
    let dailyKcal: number | null = null;

    if (targetDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        days = diffDays;
        weeks = diffDays / 7;
        weeklyRate = Math.round((diffKg / weeks) * 100) / 100;
        dailyKcal = Math.round(weeklyRate * 1100); // 7700 kcal / 7 days = 1100
      }
    }

    return {
      diffKg,
      days,
      weeks: weeks ? Math.round(weeks * 10) / 10 : null,
      weeklyRate,
      dailyKcal,
      isAggressive: (weeklyRate || 0) > 0.9,
      isOptimal: (weeklyRate || 0) >= 0.3 && (weeklyRate || 0) <= 0.7,
    };
  }, [targetWeight, startWeight, targetDate, latestWeight]);

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
        targetDate: targetDate || undefined,
        goalType,
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
      <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md animate-pulse">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-4 w-44 bg-zinc-800 rounded" />
              <div className="h-3 w-64 bg-zinc-850 rounded" />
            </div>
          </div>
          <div className="h-8 w-24 bg-zinc-800 rounded-xl" />
        </div>
        <div className="h-14 bg-zinc-800/60 rounded-xl" />
      </div>
    );
  }

  // Active goal decision-support metrics
  const phaseConfig = {
    deficit: {
      label: "Déficit Calórico",
      tag: "Definición",
      badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      glowBg: "rgba(245, 158, 11, 0.08)",
      barColor: "bg-gradient-to-r from-amber-500 to-amber-400",
      icon: FlameIcon,
      directionText: "a perder",
      calPrefix: "-",
    },
    surplus: {
      label: "Superávit Calórico",
      tag: "Volumen Muscular",
      badgeClass: "text-sky-400 bg-sky-500/10 border-sky-500/30",
      glowBg: "rgba(56, 189, 248, 0.08)",
      barColor: "bg-gradient-to-r from-sky-500 to-sky-400",
      icon: TrendingUpIcon,
      directionText: "a ganar",
      calPrefix: "+",
    },
    maintenance: {
      label: "Mantenimiento",
      tag: "Recomposición",
      badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      glowBg: "rgba(52, 211, 153, 0.08)",
      barColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      icon: ActivityIcon,
      directionText: "de margen",
      calPrefix: "±",
    },
  }[goal?.goalType || "deficit"];

  const PhaseIcon = phaseConfig.icon;
  const currentEstKcal =
    goal?.requiredWeeklyRate !== undefined
      ? Math.round(goal.requiredWeeklyRate * 1100)
      : goal?.weeklyRateKg !== undefined
      ? Math.round(goal.weeklyRateKg * 1100)
      : null;

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-xl transition-all relative overflow-hidden"
      style={{
        boxShadow: goal ? `0 10px 30px -10px ${phaseConfig.glowBg}` : undefined,
      }}
    >
      {/* Background Accent Mesh */}
      {goal && (
        <div
          className="absolute -right-20 -top-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-30 transition-all"
          style={{ background: phaseConfig.glowBg }}
        />
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-zinc-800/60 pb-4">
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 shadow-xs animate-pulse">
                  <TrophyIcon className="w-3 h-3" />
                  <span>¡Alcanzado!</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {goal
                ? `Último registro: ${goal.currentWeight} kg ${
                    goal.currentDate ? `(${goal.currentDate})` : ""
                  }`
                : latestWeight
                ? `Tu último peso registrado es de ${latestWeight.weight} kg (${latestWeight.date}). Establece tu meta corporal.`
                : "Define tu meta de peso corporal, fecha límite y ritmo para calcular tu balance calórico."}
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
                title="Ver gráfica y proyecciones completas de peso"
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
        /* ================= FORMULARIO DE CREACIÓN / EDICIÓN ================= */
        <form onSubmit={handleSave} className="mt-5 space-y-4 relative z-10 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Peso Objetivo */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <TargetIcon className="w-3.5 h-3.5 text-accent-light" />
                <span>Peso Objetivo (kg) *</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="250"
                required
                placeholder="Ej. 75.0"
                value={targetWeight}
                onChange={(e) => handleTargetWeightChange(e.target.value)}
                className="w-full bg-zinc-950/70 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none font-mono"
              />
            </div>

            {/* Peso de Partida */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <ScaleIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Peso Inicial (kg)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="250"
                placeholder={latestWeight?.weight ? String(latestWeight.weight) : "79.7"}
                value={startWeight}
                onChange={(e) => setStartWeight(e.target.value)}
                className="w-full bg-zinc-950/70 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none font-mono"
              />
            </div>

            {/* Fecha Límite */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Fecha Objetivo (opcional)</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-zinc-950/70 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none font-mono"
              />
            </div>

            {/* Tipo de Fase */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tipo de Fase
              </label>
              <div className="grid grid-cols-3 gap-1 bg-zinc-950/70 p-1 rounded-xl border border-zinc-700/80">
                <button
                  type="button"
                  onClick={() => setGoalType("deficit")}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    goalType === "deficit"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FlameIcon className="w-3 h-3" />
                  <span>Déficit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGoalType("surplus")}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    goalType === "surplus"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <TrendingUpIcon className="w-3 h-3" />
                  <span>Volumen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGoalType("maintenance")}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    goalType === "maintenance"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <ActivityIcon className="w-3 h-3" />
                  <span>Mant.</span>
                </button>
              </div>
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
              className="w-full bg-zinc-950/70 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            />
          </div>

          {/* Live Decision Support / Wishnofsky Feedback Preview */}
          {formCalculations && (
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <SparklesIcon className="w-4 h-4 text-accent-light shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-zinc-300 leading-relaxed">
                  Meta de variación:{" "}
                  <strong className="text-zinc-100 font-mono">
                    {formCalculations.diffKg} kg
                  </strong>{" "}
                  {targetDate && formCalculations.days ? (
                    <>
                      en{" "}
                      <strong className="text-zinc-100 font-mono">
                        {formCalculations.days} días
                      </strong>{" "}
                      ({formCalculations.weeks} semanas). Ritmo requerido:{" "}
                      <strong className="text-accent-light font-mono">
                        {formCalculations.weeklyRate} kg/sem
                      </strong>
                      {" · "}
                      Ajuste calórico estimado (Wishnofsky):{" "}
                      <strong className="text-accent-light font-mono">
                        {goalType === "deficit" ? "-" : "+"}
                        {formCalculations.dailyKcal} kcal/día
                      </strong>
                      .
                    </>
                  ) : (
                    "· Añade fecha objetivo para calcular el ritmo y déficit/superávit diario necesario."
                  )}
                </span>
              </div>

              {formCalculations.isAggressive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg shrink-0">
                  <AlertTriangleIcon className="w-3 h-3" />
                  <span>Ritmo agresivo</span>
                </span>
              )}
              {formCalculations.isOptimal && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg shrink-0">
                  <CheckIcon className="w-3 h-3" />
                  <span>Ritmo óptimo</span>
                </span>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
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
        <div className="mt-5 space-y-5 relative z-10">
          {/* Main Weight Progress Bar & Key Weights */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-3">
            {/* Top row with numbers */}
            <div className="flex items-baseline justify-between text-xs text-zinc-400">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                  Inicio {goal.startDate ? `(${goal.startDate})` : ""}
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
                  Meta {goal.targetDate ? `(${goal.targetDate})` : ""}
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

              {/* Progress Labels */}
              <div className="flex items-center justify-between text-[11px] font-mono font-medium text-zinc-400 mt-1.5">
                <span className="text-zinc-400">
                  {goal.totalChangeKg !== 0 ? (
                    <>
                      {goal.totalChangeKg > 0 ? "+" : ""}
                      {goal.totalChangeKg} kg desde el inicio
                    </>
                  ) : (
                    "Inicio fijado"
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

          {/* 4 Decision Support Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Card 1: Ritmo Semanal */}
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <ActivityIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Ritmo Semanal</span>
              </span>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-zinc-100">
                  {goal.requiredWeeklyRate !== undefined
                    ? `${goal.requiredWeeklyRate} kg`
                    : goal.weeklyRateKg !== undefined
                    ? `${goal.weeklyRateKg} kg`
                    : "Libre"}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  {goal.requiredWeeklyRate !== undefined
                    ? "Requerido para la fecha"
                    : "Sin fecha estricta"}
                </span>
              </div>
            </div>

            {/* Card 2: Déficit / Superávit Calórico Estimado */}
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <FlameIcon className="w-3.5 h-3.5 text-accent-light" />
                <span>Ajuste Calórico</span>
              </span>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-accent-light">
                  {currentEstKcal !== null ? (
                    <>
                      {phaseConfig.calPrefix}
                      {currentEstKcal} <span className="text-xs">kcal/d</span>
                    </>
                  ) : (
                    "Variable"
                  )}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  Wishnofsky (7.700 kcal/kg)
                </span>
              </div>
            </div>

            {/* Card 3: Tiempo Restante */}
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <ClockIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Tiempo Restante</span>
              </span>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-zinc-100">
                  {goal.daysRemaining !== undefined
                    ? goal.daysRemaining > 0
                      ? `${goal.daysRemaining} días`
                      : "Fecha vencida"
                    : "A tu ritmo"}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5 truncate">
                  {goal.targetDate ? `Límite: ${goal.targetDate}` : "Sin fecha límite"}
                </span>
              </div>
            </div>

            {/* Card 4: Distancia Restante */}
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 flex flex-col justify-between">
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
                  {goal.isCompleted
                    ? "Objetivo completado"
                    : `${goal.progressPct}% superado`}
                </span>
              </div>
            </div>
          </div>

          {/* Strategy Notes if provided */}
          {goal.notes && (
            <div className="px-3.5 py-2.5 rounded-xl border border-zinc-800/60 bg-zinc-950/30 flex items-center gap-2 text-xs text-zinc-400">
              <span className="text-zinc-500 font-semibold uppercase text-[10px] tracking-wider shrink-0">
                Estrategia:
              </span>
              <span className="text-zinc-300 italic truncate">{goal.notes}</span>
            </div>
          )}
        </div>
      ) : (
        /* ================= ESTADO INICIAL SIN OBJETIVO ================= */
        <div className="mt-4 p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
              <TargetIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Aún no has fijado tu meta de peso
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Define hacia qué peso apuntas y si deseas una fecha límite. El sistema calculará tu ritmo semanal y el déficit calórico requerido.
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
