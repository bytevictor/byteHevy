"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ExerciseSummary, ExerciseDetailData, ExerciseSessionHistory } from "@/lib/actions";
import { ProgressionChart } from "./charts/ProgressionChart";
import { ExerciseAnimationView } from "./ExerciseAnimationView";
import { getExerciseMedia } from "@/lib/exercise-media";
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
    if (l.includes("chest") || l.includes("press") || l.includes("push") || l.includes("shoulder") || l.includes("triceps")) return "empuje";
    if (l.includes("pull") || l.includes("row") || l.includes("curl") || l.includes("hang")) return "tiron";
    if (l.includes("leg") || l.includes("squat")) return "pierna";
    if (l.includes("treadmill") || l.includes("running")) return "cardio";
    return "otros";
  };

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (categoryFilter === "all") return true;
      return getCategory(ex.name) === categoryFilter;
    });
  }, [exercises, searchQuery, categoryFilter]);

  // Unit by metric type
  const getUnit = (type: string) => {
    if (type === "seconds") return "s";
    if (type === "cardio") return "km";
    if (type === "bodyweight_reps") return "reps";
    return "kg";
  };

  if (exercises.length === 0 && !loadingList) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <InfoIcon className="w-6 h-6" />
        </div>
        <h3 className="font-mono text-lg font-semibold text-zinc-200 mb-2">No hay entrenamientos cargados</h3>
        <p className="text-sm text-zinc-400 max-w-md mb-6 font-mono">
          Tu base de datos SQLite está vacía. Sube tu archivo CSV de Hevy en la pestaña de sincronización para comenzar.
        </p>
        {onGoToSync && (
          <button
            onClick={onGoToSync}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Ir a Actualizar / Subir CSV
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-6">
      {/* Left Sidebar: Exercise List */}
      <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
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

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
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
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === cat.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium"
                  : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* List of Exercises */}
        <div className="flex flex-col gap-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
          {filteredExercises.map((ex) => {
            const isSelected = selectedId === ex.id;
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedId(ex.id)}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all duration-100 cursor-pointer ${
                  isSelected
                    ? "bg-zinc-800/90 border-amber-500/50 shadow-md ring-1 ring-amber-500/20"
                    : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-800/40 hover:border-zinc-700/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-xs font-semibold truncate ${isSelected ? "text-zinc-100" : "text-zinc-300"}`}>
                    {ex.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-400 shrink-0">
                    {ex.sessionCount} ses
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="text-zinc-500 text-[10px]">Top set:</span>
                  <span className={isSelected ? "text-amber-400 font-medium" : "text-zinc-300"}>
                    {ex.latestTopSetLabel}
                  </span>
                </div>
              </button>
            );
          })}
          {filteredExercises.length === 0 && (
            <div className="py-8 text-center text-xs font-mono text-zinc-500">
              No se encontraron ejercicios
            </div>
          )}
        </div>
      </div>

      {/* Main Right Pane: Progression & Detail */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
        {loadingDetail ? (
          <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500 border border-zinc-900 bg-zinc-950/40 rounded-xl">
            Cargando historial de progresión...
          </div>
        ) : detailData ? (
          <>
            {/* Header Card with 3D Anatomy Animation */}
            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5 items-center">
                {/* 3D Anatomical Animation Box */}
                <div className="md:col-span-5 lg:col-span-4">
                  <ExerciseAnimationView
                    media={currentMedia || getExerciseMedia(detailData.exercise.name)}
                    compact
                    className="w-full shadow-lg"
                  />
                </div>

                {/* Details & PR / 1RM Hero Badges */}
                <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold tracking-tight text-zinc-100 font-sans">
                        {detailData.exercise.name}
                      </h2>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                        {detailData.exercise.metricType.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-zinc-400">
                      Historial de {detailData.sessions.length} entrenamientos registrados
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {detailData.exercise.allTimeBest && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        <TrophyIcon className="w-4 h-4 text-amber-400" />
                        <div className="flex flex-col text-left">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/80">
                            Récord Personal (PR)
                          </span>
                          <span className="text-sm font-mono font-bold text-amber-300">
                            {detailData.exercise.allTimeBest.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {detailData.exercise.estimated1RM && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-300">
                        <div className="flex flex-col text-left">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
                            1RM Estimado Máx
                          </span>
                          <span className="text-sm font-mono font-bold text-zinc-200">
                            {detailData.exercise.estimated1RM} {getUnit(detailData.exercise.metricType)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Progression Chart (Hero) */}
              <div className="mt-2 border-t border-zinc-800/60 pt-4">
                <ProgressionChart
                  data={detailData.chartPoints}
                  unit={getUnit(detailData.exercise.metricType)}
                  metricName="Top Set Real"
                  secondaryMetricName="1RM Estimado"
                  height={240}
                />
              </div>
            </div>

            {/* Historical Sessions List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Historial de Sesiones</span>
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  Haz clic en cualquier sesión para ver notas y series completas
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {detailData.sessions.map((sess) => (
                  <div
                    key={sess.workoutId}
                    onClick={() => setActiveModalSession(sess)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-zinc-700/80 transition-all cursor-pointer group"
                  >
                    {/* Left: Date & Title */}
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-amber-400 transition-colors" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-zinc-200">
                            {sess.startTime}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 truncate max-w-[160px]">
                            {sess.workoutTitle}
                          </span>
                        </div>
                        {sess.exerciseNotes && (
                          <span className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1">
                            <span className="text-zinc-600">Ajuste:</span> {sess.exerciseNotes}
                          </span>
                        )}
                        {sess.workoutDescription && (
                          <span className="text-[11px] italic text-zinc-500 truncate max-w-[280px] sm:max-w-md mt-0.5">
                            "{sess.workoutDescription.split("\n")[0]}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Top Set & PR Badge */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {sess.topSet.isPR && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                          ★ PR
                        </span>
                      )}

                      <div className="flex flex-col text-right font-mono">
                        <span className="text-xs font-bold text-amber-400">
                          {sess.topSet.label}
                        </span>
                        {sess.topSet.secondaryValue && (
                          <span className="text-[10px] text-zinc-500">
                            1RM: {sess.topSet.secondaryValue} kg
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-zinc-500">
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

      {/* Drill-down Modal for Full Session Detail */}
      {activeModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-zinc-100 font-sans">
                    {activeModalSession.workoutTitle}
                  </h3>
                  {activeModalSession.topSet.isPR && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                      ★ PR
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                  <span>{activeModalSession.startTime}</span>
                </div>
              </div>

              <button
                onClick={() => setActiveModalSession(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scrollable */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Personal Diary Description (Prominently Quoted) */}
              {activeModalSession.workoutDescription && (
                <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200/90 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                  <span className="text-[10px] uppercase font-bold text-amber-400/80 block mb-1">
                    Diario de bitácora de la sesión:
                  </span>
                  "{activeModalSession.workoutDescription}"
                </div>
              )}

              {/* Machine notes if present */}
              {activeModalSession.exerciseNotes && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                  <span className="text-zinc-500 font-semibold">Ajustes / Notas:</span>
                  <span>{activeModalSession.exerciseNotes}</span>
                </div>
              )}

              {/* Full Sets Table */}
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block mb-2">
                  Desglose de series realizadas ({detailData?.exercise.name})
                </span>

                <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-[10px]">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3 text-right">Peso (kg)</th>
                        <th className="py-2 px-3 text-right">Reps / Tiempo</th>
                        <th className="py-2 px-3 text-right">1RM Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {activeModalSession.sets.map((s, idx) => {
                        const isTop = s.weightKg === activeModalSession.topSet.primaryValue ||
                          s.durationSeconds === activeModalSession.topSet.primaryValue;
                        const est = s.weightKg && s.reps ? Math.round(s.weightKg * (1 + s.reps / 30) * 10) / 10 : null;

                        return (
                          <tr
                            key={s.id || idx}
                            className={`hover:bg-zinc-800/30 transition-colors ${
                              isTop ? "bg-amber-500/5 font-semibold text-zinc-100" : "text-zinc-300"
                            }`}
                          >
                            <td className="py-2 px-3 text-zinc-500">{s.setIndex + 1}</td>
                            <td className="py-2 px-3 capitalize text-zinc-400">{s.setType || "normal"}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              {s.weightKg !== null ? `${s.weightKg} kg` : "BW (0 kg)"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {s.durationSeconds ? `${s.durationSeconds}s` : s.reps ? `${s.reps} reps` : s.distanceKm ? `${s.distanceKm} km` : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-zinc-400">
                              {est ? `${est} kg` : "-"}
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
            <div className="pt-4 mt-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setActiveModalSession(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors cursor-pointer"
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

