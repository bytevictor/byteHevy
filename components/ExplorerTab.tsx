"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ExerciseSummary, ExerciseDetailData, ExerciseSessionHistory } from "@/lib/actions";
import { ProgressionChart } from "./charts/ProgressionChart";
import { ExerciseAnimationView } from "./ExerciseAnimationView";
import { getExerciseMedia, MUSCLE_LABELS } from "@/lib/exercise-media";
import { ExerciseMedia } from "@/types/exercise-media";
import {
  SearchIcon,
  TrophyIcon,
  FlameIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  XIcon,
  InfoIcon,
} from "./Icons";

interface ExplorerTabProps {
  initialExercises?: ExerciseSummary[];
  onGoToSync?: () => void;
}

export function ExplorerTab({ initialExercises = [], onGoToSync }: ExplorerTabProps) {
  const [exercises, setExercises] = useState<ExerciseSummary[]>(initialExercises);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ExerciseDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeModalSession, setActiveModalSession] = useState<ExerciseSessionHistory | null>(null);
  const [currentMedia, setCurrentMedia] = useState<ExerciseMedia | null>(null);

  // Sync ExerciseDB media asynchronously with SQLite caching
  useEffect(() => {
    if (!detailData?.exercise.name) return;
    setCurrentMedia(getExerciseMedia(detailData.exercise.name));

    fetch(`/api/exercise-media/${encodeURIComponent(detailData.exercise.name)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCurrentMedia(res.data);
        }
      })
      .catch(() => {});
  }, [detailData?.exercise.name]);

  // Fetch exercises list if empty
  useEffect(() => {
    async function loadList() {
      setLoadingList(true);
      try {
        const res = await fetch("/api/exercises");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setExercises(json.data);
          if (json.data.length > 0 && !selectedId) {
            setSelectedId(json.data[0].id);
          }
        }
      } catch (e) {
        console.error("Error loading exercises:", e);
      } finally {
        setLoadingList(false);
      }
    }

    if (exercises.length === 0) {
      loadList();
    } else if (!selectedId && exercises.length > 0) {
      setSelectedId(exercises[0].id);
    }
  }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/exercises/${selectedId}`);
        const json = await res.json();
        if (json.success) {
          setDetailData(json.data);
        }
      } catch (e) {
        console.error("Error loading exercise detail:", e);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedId]);

  // Exercise categorization for filters
  const getCategory = (name: string) => {
    const l = name.toLowerCase();
    if (
      l.includes("press") ||
      l.includes("push") ||
      l.includes("dip") ||
      l.includes("triceps") ||
      l.includes("butterfly") ||
      l.includes("pec deck") ||
      l.includes("extension triceps")
    ) {
      return "empuje";
    }
    if (
      l.includes("pull") ||
      l.includes("row") ||
      l.includes("curl") ||
      l.includes("chin") ||
      l.includes("hang") ||
      l.includes("antebrazo") ||
      l.includes("dominada") ||
      l.includes("front lever")
    ) {
      return "tiron";
    }
    if (
      l.includes("leg") ||
      l.includes("squat") ||
      l.includes("curl femoral") ||
      l.includes("prensa")
    ) {
      return "pierna";
    }
    if (l.includes("treadmill") || l.includes("cinta") || l.includes("run")) {
      return "cardio";
    }
    return "otro";
  };

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;
      if (categoryFilter === "all") return true;
      return getCategory(ex.name) === categoryFilter;
    });
  }, [exercises, searchQuery, categoryFilter]);

  const getUnit = (type: string) => {
    if (type === "seconds") return "seg";
    if (type === "bodyweight_reps") return "reps";
    if (type === "weighted_bodyweight") return "kg lastre";
    if (type === "cardio") return "km";
    return "kg";
  };

  if (exercises.length === 0 && !loadingList) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4 shadow-inner">
          <InfoIcon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-zinc-100 mb-2">
          No hay ejercicios registrados
        </h3>
        <p className="text-sm text-zinc-400 max-w-sm mb-6">
          Sube tu exportación CSV de Hevy para comenzar a visualizar tus entrenamientos.
        </p>
        {onGoToSync && (
          <button
            onClick={onGoToSync}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer shadow-lg shadow-amber-500/10"
          >
            Importar archivo CSV
          </button>
        )}
      </div>
    );
  }

  const activeMedia = currentMedia || (detailData ? getExerciseMedia(detailData.exercise.name) : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-6">
      {/* Left Sidebar: Exercise List */}
      <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3.5">
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl pl-10 pr-9 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
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

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          {[
            { id: "all", label: "Todos" },
            { id: "empuje", label: "Empuje" },
            { id: "tiron", label: "Tirón" },
            { id: "pierna", label: "Pierna" },
            { id: "cardio", label: "Cardio" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                  : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 border border-zinc-850 hover:bg-zinc-800/40"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* List of Exercises */}
        <div className="flex flex-col gap-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
          {filteredExercises.map((ex) => {
            const isSelected = selectedId === ex.id;
            const media = getExerciseMedia(ex.name);
            const muscleName = MUSCLE_LABELS[media.primaryMuscle] || media.primaryMuscle;
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedId(ex.id)}
                className={`group flex items-center gap-3 text-left p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-zinc-850/90 border-amber-500/50 shadow-lg ring-1 ring-amber-500/20"
                    : "bg-zinc-900/40 border-zinc-800/70 hover:bg-zinc-850/50 hover:border-zinc-750"
                }`}
              >
                {/* 3D Visual Thumbnail */}
                <div
                  className={`w-12 h-12 rounded-lg bg-white shrink-0 overflow-hidden flex items-center justify-center p-0.5 border transition-all ${
                    isSelected
                      ? "border-amber-400 ring-2 ring-amber-500/20"
                      : "border-zinc-300 group-hover:border-zinc-200"
                  }`}
                >
                  <img
                    src={media.gifUrl}
                    alt={ex.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                {/* Exercise Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isSelected
                          ? "text-zinc-100"
                          : "text-zinc-300 group-hover:text-zinc-100"
                      }`}
                    >
                      {ex.name}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 shrink-0">
                      {ex.sessionCount} ses
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs gap-1">
                    <span className="text-[11px] text-zinc-400 truncate max-w-[110px] flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? "bg-amber-400" : "bg-zinc-600"
                        }`}
                      />
                      {muscleName}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                        isSelected ? "text-amber-400" : "text-zinc-300"
                      }`}
                    >
                      {ex.latestTopSetLabel}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredExercises.length === 0 && (
            <div className="py-12 text-center text-xs text-zinc-500">
              No se encontraron ejercicios
            </div>
          )}
        </div>
      </div>

      {/* Main Right Pane: Progression & Detail */}
      <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-6">
        {loadingDetail ? (
          <div className="h-64 flex items-center justify-center text-xs text-zinc-500 border border-zinc-850 bg-zinc-900/30 rounded-2xl">
            Cargando historial de progresión...
          </div>
        ) : detailData && activeMedia ? (
          <>
            {/* HERO STAGE: 3D Anatomical Visualizer & Profile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Massive 3D Animation Showcase */}
              <div className="lg:col-span-7 flex flex-col">
                <ExerciseAnimationView
                  media={activeMedia}
                  className="w-full h-[360px] sm:h-[420px] shadow-2xl"
                />
              </div>

              {/* Exercise Profile, Records & Anatomy */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                      {MUSCLE_LABELS[activeMedia.primaryMuscle] || activeMedia.primaryMuscle}
                    </span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-400 font-medium">
                      {detailData.exercise.metricType.replace("_", " ")}
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 mb-1.5">
                    {detailData.exercise.name}
                  </h1>

                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{detailData.sessions.length} entrenamientos registrados</span>
                  </p>
                </div>

                {/* PR & 1RM Hero Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* PR Card */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-900 border border-amber-500/30 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-amber-400 font-medium">
                        Récord Personal (PR)
                      </span>
                      <TrophyIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-lg font-mono tabular-nums font-bold text-amber-300">
                      {detailData.exercise.allTimeBest?.label || "—"}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1">
                      {detailData.exercise.allTimeBest?.date || "Sin registro"}
                    </span>
                  </div>

                  {/* 1RM Estimado Card */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        1RM Estimado
                      </span>
                      <FlameIcon className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="text-lg font-mono tabular-nums font-bold text-zinc-200">
                      {detailData.exercise.estimated1RM ? `${detailData.exercise.estimated1RM} ${getUnit(detailData.exercise.metricType)}` : "—"}
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1">
                      Fórmula Brzycki
                    </span>
                  </div>
                </div>

                {/* Muscle Activation Guide */}
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-2 font-medium">
                    Activación Anatómica
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {MUSCLE_LABELS[activeMedia.primaryMuscle]} (Primario)
                    </span>
                    {activeMedia.secondaryMuscles.map((sec, i) => (
                      <span key={i} className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                        {MUSCLE_LABELS[sec] || sec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Progression Chart Card */}
            <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-100">
                    Curva de Progresión Temporal
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Evolución del Top Set real frente al 1RM teórico estimado
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-amber-400" />
                    <span className="text-zinc-300 text-[11px]">Top Set Real</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-zinc-500 border-b border-dashed border-zinc-400" />
                    <span className="text-zinc-400 text-[11px]">1RM Estimado</span>
                  </div>
                </div>
              </div>

              <ProgressionChart
                data={detailData.chartPoints}
                unit={getUnit(detailData.exercise.metricType)}
                metricName="Top Set Real"
                secondaryMetricName="1RM Estimado"
                height={260}
              />
            </div>

            {/* Historical Sessions List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Historial de Sesiones</span>
                </h3>
                <span className="text-xs text-zinc-500 font-normal">
                  Haz clic en cualquier sesión para ver notas y series completas
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {detailData.sessions.map((sess) => (
                  <div
                    key={sess.workoutId}
                    onClick={() => setActiveModalSession(sess)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800/70 bg-zinc-900/30 hover:bg-zinc-850/50 hover:border-zinc-700/80 transition-all cursor-pointer group"
                  >
                    {/* Left: Date & Title */}
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-amber-400 transition-colors" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-zinc-200">
                            {sess.startTime}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/50 truncate max-w-[180px]">
                            {sess.workoutTitle}
                          </span>
                        </div>
                        {sess.exerciseNotes && (
                          <span className="text-xs text-zinc-400 mt-1 flex items-center gap-1 font-normal">
                            <span className="text-zinc-500 font-medium">Ajuste:</span> {sess.exerciseNotes}
                          </span>
                        )}
                        {sess.workoutDescription && (
                          <span className="text-xs italic text-zinc-400 truncate max-w-[280px] sm:max-w-md mt-0.5">
                            "{sess.workoutDescription.split("\n")[0]}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Top Set & PR Badge */}
                    <div className="flex items-center gap-3.5 self-end sm:self-center">
                      {sess.topSet.isPR && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold shadow-sm">
                          ★ PR
                        </span>
                      )}

                      <div className="flex flex-col text-right font-mono tabular-nums">
                        <span className="text-xs font-bold text-amber-400">
                          {sess.topSet.label}
                        </span>
                        {sess.topSet.secondaryValue && (
                          <span className="text-[10px] text-zinc-500">
                            1RM: {sess.topSet.secondaryValue} kg
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 font-normal">
                        {sess.sets.length} {sess.sets.length === 1 ? "serie" : "series"}
                      </div>

                      <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Drill-Down Session Modal */}
      {activeModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-950/60">
              <div className="flex flex-col">
                <span className="text-xs text-amber-400 font-medium mb-1">
                  {activeModalSession.startTime}
                </span>
                <h3 className="text-lg font-bold text-zinc-100">
                  {activeModalSession.workoutTitle}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalSession(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex flex-col gap-5">
              {/* Personal Notes / Unhinged quote */}
              {activeModalSession.workoutDescription && (
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-amber-500/20 text-xs italic text-amber-200/90 leading-relaxed">
                  "{activeModalSession.workoutDescription}"
                </div>
              )}

              {/* Exercise Notes */}
              {activeModalSession.exerciseNotes && (
                <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/60 text-xs text-zinc-300 flex items-center gap-2 font-normal">
                  <span className="text-zinc-500 font-semibold">Nota del ejercicio:</span>
                  <span>{activeModalSession.exerciseNotes}</span>
                </div>
              )}

              {/* Sets Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Desglose de Series Realizadas
                </h4>
                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/60">
                  <table className="w-full text-left text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[11px] text-zinc-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Serie</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Carga / Reps</th>
                        <th className="py-2.5 px-3 text-right">Récord</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {activeModalSession.sets.map((s) => {
                        const isSetTop =
                          s.weightKg !== null && s.reps !== null
                            ? `${s.weightKg} kg × ${s.reps}` === activeModalSession.topSet.label
                            : false;
                        return (
                          <tr
                            key={s.id}
                            className={`hover:bg-zinc-800/30 transition-colors ${
                              isSetTop ? "bg-amber-500/10 font-bold" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 text-zinc-400 font-normal">
                              #{s.setIndex}
                            </td>
                            <td className="py-2.5 px-3">
                              {isSetTop ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  TOP SET
                                </span>
                              ) : s.setType === "warmup" ? (
                                <span className="text-zinc-500 text-[11px]">Calentamiento</span>
                              ) : (
                                <span className="text-zinc-400 text-[11px]">Efectiva</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-200">
                              {s.weightKg !== null && s.reps !== null
                                ? `${s.weightKg} kg × ${s.reps}`
                                : s.reps !== null
                                ? `${s.reps} reps`
                                : s.durationSeconds !== null
                                ? `${s.durationSeconds}s`
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isSetTop && activeModalSession.topSet.isPR && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400 text-zinc-950 font-bold">
                                  PR
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
              <button
                onClick={() => setActiveModalSession(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
