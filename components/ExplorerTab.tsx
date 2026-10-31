"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ExerciseSummary, ExerciseDetailData, ExerciseSessionHistory, JournalWorkout } from "@/lib/actions";
import { ProgressionChart } from "./charts/ProgressionChart";
import { ExerciseAnimationView } from "./ExerciseAnimationView";
import { WorkoutSessionModal } from "./WorkoutSessionModal";
import { getExerciseMedia, MUSCLE_LABELS } from "@/lib/exercise-media";
import { ExerciseMedia } from "@/types/exercise-media";
import { ExplorerSkeleton, ExplorerDetailSkeleton } from "./skeletons/ExplorerSkeleton";
import {
  SearchIcon,
  TrophyIcon,
  FlameIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  XIcon,
  InfoIcon,
  CrownIcon,
} from "./Icons";
import { useSeason } from "@/lib/season-context";
import { getSeasonColor, hexToRgba } from "@/lib/season-colors";

interface ExplorerTabProps {
  initialExercises?: ExerciseSummary[];
  onGoToSync?: () => void;
}

export function ExplorerTab({ initialExercises = [], onGoToSync }: ExplorerTabProps) {
  const { activeSeasonId, activeSeason, setActiveSeasonId } = useSeason();
  const seasonColor = activeSeason ? getSeasonColor(activeSeason) : null;
  const [exercises, setExercises] = useState<ExerciseSummary[]>(initialExercises);
  const [loadingList, setLoadingList] = useState(!initialExercises || initialExercises.length === 0);
  const [selectedId, setSelectedId] = useState<string | null>(initialExercises[0]?.id || null);
  const [detailData, setDetailData] = useState<ExerciseDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAllSeasonExercises, setShowAllSeasonExercises] = useState(false);
  const [activeModalSession, setActiveModalSession] = useState<ExerciseSessionHistory | null>(null);
  const [fullWorkoutModal, setFullWorkoutModal] = useState<JournalWorkout | null>(null);
  const [loadingFullWorkout, setLoadingFullWorkout] = useState<boolean>(false);
  const [currentMedia, setCurrentMedia] = useState<ExerciseMedia | null>(null);

  const handleOpenWorkout = async (workoutId: string) => {
    if (!workoutId) return;
    setLoadingFullWorkout(true);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setFullWorkoutModal(json.data);
      }
    } catch (err) {
      console.error("Error loading full workout session:", err);
    } finally {
      setLoadingFullWorkout(false);
    }
  };

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
      .catch(() => { });
  }, [detailData?.exercise.name]);

  // Fetch exercises list on mount or when activeSeasonId changes
  useEffect(() => {
    async function loadList() {
      setLoadingList(true);
      try {
        const query =
          activeSeasonId && activeSeasonId !== "all"
            ? `?seasonId=${encodeURIComponent(activeSeasonId)}`
            : "";
        const res = await fetch(`/api/exercises${query}`, { cache: "no-store" });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setExercises(json.data);
          if (json.data.length > 0) {
            setSelectedId((prev) => {
              if (prev && json.data.some((e: any) => e.id === prev)) {
                return prev;
              }
              return json.data[0].id;
            });
          }
        }
      } catch (e) {
        console.error("Error loading exercises:", e);
      } finally {
        setLoadingList(false);
      }
    }

    loadList();
  }, [activeSeasonId]);

  // Fetch detail when selectedId or activeSeasonId changes
  useEffect(() => {
    if (!selectedId) return;
    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const query =
          activeSeasonId && activeSeasonId !== "all"
            ? `?seasonId=${encodeURIComponent(activeSeasonId)}`
            : "";
        const res = await fetch(`/api/exercises/${selectedId}${query}`, { cache: "no-store" });
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
  }, [selectedId, activeSeasonId]);

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

  const inSeasonCount = useMemo(() => {
    if (!activeSeason) return exercises.length;
    return exercises.filter((ex) => (ex.seasonSessionCount ?? ex.sessionCount) > 0).length;
  }, [exercises, activeSeason]);

  const filteredExercises = useMemo(() => {
    return [...exercises]
      .filter((ex) => {
        // If a season is active and user hasn't toggled to show all, filter to in-season exercises
        if (activeSeason && !showAllSeasonExercises) {
          const sCount = ex.seasonSessionCount ?? ex.sessionCount;
          if (sCount === 0 || ex.inSeason === false) return false;
        }

        const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
        if (!matchesSearch) return false;
        if (categoryFilter === "all") return true;
        return getCategory(ex.name) === categoryFilter;
      })
      .sort((a, b) => {
        const countA = activeSeason ? (a.seasonSessionCount ?? a.sessionCount) : a.sessionCount;
        const countB = activeSeason ? (b.seasonSessionCount ?? b.sessionCount) : b.sessionCount;
        if (countB !== countA) return countB - countA;
        return b.latestTimestamp - a.latestTimestamp;
      });
  }, [exercises, searchQuery, categoryFilter, activeSeason, showAllSeasonExercises]);

  const getUnit = (type: string) => {
    if (type === "seconds") return "seg";
    if (type === "bodyweight_reps") return "reps";
    if (type === "weighted_bodyweight") return "kg lastre";
    if (type === "cardio") return "km";
    return "kg";
  };

  if (loadingList) {
    return <ExplorerSkeleton />;
  }

  if (exercises.length === 0) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center animate-in fade-in">
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
            className="px-5 py-2.5 rounded-xl bg-accent text-zinc-950 text-sm font-semibold hover:bg-accent-light transition-colors cursor-pointer shadow-lg shadow-accent/10"
          >
            Importar archivo CSV
          </button>
        )}
      </div>
    );
  }

  const activeMedia = currentMedia || (detailData ? getExerciseMedia(detailData.exercise.name) : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-4 lg:py-5">
      {/* Left Sidebar: Exercise List */}
      <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3.5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)]">
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl pl-10 pr-9 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${categoryFilter === cat.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                  : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 border border-zinc-850 hover:bg-zinc-800/40"
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Season Filter Bar in Sidebar (if a season is active) */}
        {activeSeason && seasonColor && (
          <div
            className="p-2 rounded-xl border flex items-center justify-between gap-2 text-[11px]"
            style={{
              backgroundColor: hexToRgba(seasonColor, 0.1),
              borderColor: hexToRgba(seasonColor, 0.3),
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: seasonColor }}
              />
              <span
                className="font-semibold truncate"
                style={{ color: seasonColor }}
              >
                {activeSeason.name}
              </span>
            </div>
            <button
              onClick={() => setShowAllSeasonExercises((prev) => !prev)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer shrink-0"
            >
              {showAllSeasonExercises
                ? `Mostrando todos (${exercises.length})`
                : `Solo season (${inSeasonCount})`}
            </button>
          </div>
        )}

        {/* List of Exercises Header */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
            <span>Por cantidad de sesiones</span>
          </span>
          <span className="text-zinc-500">{filteredExercises.length} ejercicios</span>
        </div>

        {/* List of Exercises */}
        <div className="flex flex-col gap-2 flex-1 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
          {filteredExercises.map((ex, idx) => {
            const isSelected = selectedId === ex.id;
            const media = getExerciseMedia(ex.name);
            const muscleName = MUSCLE_LABELS[media.primaryMuscle] || media.primaryMuscle;
            const displaySessionCount = activeSeason
              ? (ex.seasonSessionCount ?? ex.sessionCount)
              : ex.sessionCount;
            const displayTopLabel = activeSeason
              ? (ex.seasonBestLabel || ex.latestTopSetLabel)
              : ex.latestTopSetLabel;

            return (
              <button
                key={ex.id}
                onClick={() => setSelectedId(ex.id)}
                className={`group flex items-center gap-3 text-left p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${isSelected
                    ? "bg-zinc-850/90 border-accent/50 shadow-lg ring-1 ring-accent/20"
                    : "bg-zinc-900/40 border-zinc-800/70 hover:bg-zinc-850/50 hover:border-zinc-755"
                  }`}
              >
                {/* 3D Visual Thumbnail */}
                <div className="relative shrink-0">
                  <div
                    className={`w-12 h-12 rounded-lg bg-white overflow-hidden flex items-center justify-center p-0.5 border transition-all ${isSelected
                        ? "border-accent-light ring-2 ring-accent/20"
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
                  {idx < 3 && !searchQuery && categoryFilter === "all" && (
                    <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-accent text-zinc-950 text-[9px] font-bold flex items-center justify-center shadow-md">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Exercise Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span
                      className={`text-xs font-semibold truncate ${isSelected
                          ? "text-zinc-100"
                          : "text-zinc-300 group-hover:text-zinc-100"
                        }`}
                    >
                      {ex.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md border font-medium shrink-0 ${isSelected
                          ? "bg-accent/20 border-accent/40 text-accent-lighter font-bold shadow-sm"
                          : "bg-zinc-800/80 border-zinc-700/50 text-zinc-300"
                        }`}
                    >
                      {displaySessionCount} ses
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs gap-1">
                    <span className="text-[11px] text-zinc-400 truncate max-w-[110px] flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-accent-light" : "bg-zinc-600"
                          }`}
                      />
                      {muscleName}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${isSelected ? "text-accent-light" : "text-zinc-300"
                        }`}
                    >
                      {displayTopLabel}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredExercises.length === 0 && (
            <div className="py-12 text-center text-xs text-zinc-500">
              No se encontraron ejercicios en esta selección
            </div>
          )}
        </div>
      </div>

      {/* Main Right Pane: Progression & Detail */}
      <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-4 sm:gap-4.5">
        {loadingDetail ? (
          <ExplorerDetailSkeleton />
        ) : detailData && activeMedia ? (
          <>

            {/* Above-the-fold Viewport Stage: Exercise Profile + Progression Chart fill the screen */}
            <div className="flex flex-col gap-4 lg:gap-5 lg:min-h-[calc(100vh-5.5rem)] justify-between">
              {/* HERO STAGE: Anatomical Visualizer & Exercise Profile */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row items-stretch gap-5 backdrop-blur-md">
                {/* 3D Animation Showcase (Prominent and Impressive) */}
                <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0">
                  <ExerciseAnimationView
                    media={activeMedia}
                    className="w-full h-[280px] sm:h-[300px] lg:h-[310px] rounded-xl shadow-lg"
                  />
                </div>

                {/* Right: Exercise Name, Metric, Category, Session Count & Anatomy */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1 gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 border border-accent/30 text-accent-light font-semibold">
                        {MUSCLE_LABELS[activeMedia.primaryMuscle] || activeMedia.primaryMuscle}
                      </span>
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-400 font-medium">
                        {detailData.exercise.metricType.replace("_", " ")}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-850 border border-zinc-700/60 text-zinc-400 font-normal">
                        {activeMedia.equipment}
                      </span>
                      {activeSeason && seasonColor && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium flex items-center gap-1.5"
                          style={{
                            backgroundColor: hexToRgba(seasonColor, 0.16),
                            borderColor: hexToRgba(seasonColor, 0.35),
                            color: seasonColor,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: seasonColor }}
                          />
                          <span>Season: {activeSeason.name}</span>
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 truncate" title={detailData.exercise.name}>
                      {detailData.exercise.name}
                    </h1>

                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>
                        {detailData.sessions.length} entrenamientos {activeSeason ? "en esta temporada" : "registrados"}
                      </span>
                    </p>
                  </div>

                  {/* PR & 1RM Hero Cards */}
                  {activeSeason && seasonColor ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Season PR Card */}
                      <div
                        className="p-3 rounded-xl border flex flex-col justify-between shadow-xs"
                        style={{
                          background: `linear-gradient(to bottom right, ${hexToRgba(seasonColor, 0.18)}, rgba(24, 24, 27, 0.95), rgba(24, 24, 27, 0.95))`,
                          borderColor: hexToRgba(seasonColor, 0.4),
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[10px] uppercase tracking-wider font-bold truncate"
                            style={{ color: seasonColor }}
                          >
                            PR Season
                          </span>
                          <FlameIcon className="w-4 h-4" style={{ color: seasonColor }} />
                        </div>
                        <div
                          className="text-lg font-mono tabular-nums font-bold mt-1"
                          style={{ color: seasonColor }}
                        >
                          {detailData.exercise.seasonBest?.label || "Sin registros"}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between mt-1">
                          <span>{detailData.exercise.seasonBest?.date || "—"}</span>
                          {detailData.exercise.estimated1RM && (
                            <span className="font-sans font-medium" style={{ color: seasonColor }}>
                              1RM: {detailData.exercise.estimated1RM} kg
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ALL-TIME PR Card */}
                      <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 via-zinc-900 to-zinc-900 border border-yellow-500/30 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-bold">
                            ALL-TIME PR
                          </span>
                          <CrownIcon className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div className="text-lg font-mono tabular-nums font-bold text-yellow-200 mt-1">
                          {detailData.exercise.allTimeBest?.label || "—"}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between mt-1">
                          <span>{detailData.exercise.allTimeBest?.date || "Sin registro"}</span>
                          {detailData.exercise.allTimeEstimated1RM && (
                            <span className="text-yellow-400/90 font-sans">
                              1RM: {detailData.exercise.allTimeEstimated1RM} kg
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* PR Card (All-Time) */}
                      <div className="p-3 rounded-xl bg-gradient-to-br from-accent/15 via-zinc-900 to-zinc-900 border border-accent/30 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-accent-light font-bold">
                            Récord Personal (PR)
                          </span>
                          <TrophyIcon className="w-4 h-4 text-accent-light" />
                        </div>
                        <div className="text-lg font-mono tabular-nums font-bold text-accent-lighter mt-1">
                          {detailData.exercise.allTimeBest?.label || "—"}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 mt-1">
                          {detailData.exercise.allTimeBest?.date || "Sin registro"}
                        </span>
                      </div>

                      {/* 1RM Estimado Card */}
                      <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                            1RM Estimado
                          </span>
                          <FlameIcon className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="text-lg font-mono tabular-nums font-bold text-zinc-200 mt-1">
                          {detailData.exercise.estimated1RM
                            ? `${detailData.exercise.estimated1RM} ${getUnit(detailData.exercise.metricType)}`
                            : "—"}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1">
                          Fórmula Brzycki
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Muscle Activation Guide */}
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5 font-medium">
                      Activación Anatómica
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        {MUSCLE_LABELS[activeMedia.primaryMuscle]} (Primario)
                      </span>
                      {activeMedia.secondaryMuscles.map((sec, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400"
                        >
                          {MUSCLE_LABELS[sec] || sec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progression Chart Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
                      <span>Curva de Progresión</span>
                      {activeSeason && seasonColor && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded border font-medium flex items-center gap-1"
                          style={{
                            backgroundColor: hexToRgba(seasonColor, 0.16),
                            borderColor: hexToRgba(seasonColor, 0.35),
                            color: seasonColor,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: seasonColor }}
                          />
                          <span>{activeSeason.name}</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Evolución de rendimiento, carga y 1RM estimado en cada sesión
                    </p>
                  </div>
                </div>

                {detailData.chartPoints.length === 0 ? (
                  <div className="py-16 text-center text-xs text-zinc-500">
                    No hay sesiones de este ejercicio en la {activeSeason?.endDate ? `season "${activeSeason?.name}"` : `season activa (${activeSeason?.name})`}.
                  </div>
                ) : (
                  <ProgressionChart
                    data={detailData.chartPoints}
                    unit={getUnit(detailData.exercise.metricType)}
                    metricName="Peso Máximo"
                    secondaryMetricName="1RM Estimado"
                    exerciseName={detailData.exercise.name}
                    metricType={detailData.exercise.metricType}
                    seasonName={activeSeason?.name}
                    seasonColor={seasonColor || undefined}
                    allTimeBestLabel={detailData.exercise.allTimeBest?.label}
                    seasonBestLabel={detailData.exercise.seasonBest?.label}
                    height={260}
                    onPointClick={(pt) => {
                      if (pt.workoutId) {
                        handleOpenWorkout(pt.workoutId);
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Historical Sessions List: Placed cleanly below the viewport fold */}
            <div className="flex flex-col gap-3 pt-6 border-t border-zinc-800/80">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Historial de Sesiones</span>
                  {activeSeason && seasonColor && (
                    <span
                      className="text-[11px] font-mono font-medium"
                      style={{ color: seasonColor }}
                    >
                      · {activeSeason.name}
                    </span>
                  )}
                </h3>
                <span className="text-xs text-zinc-500 font-normal">
                  Haz clic en cualquier sesión para ver el entrenamiento completo
                </span>
              </div>

              {detailData.sessions.length === 0 ? (
                <div className="p-8 rounded-xl border border-zinc-800/70 bg-zinc-900/20 text-center text-xs text-zinc-500">
                  No hay sesiones registradas en este periodo
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {detailData.sessions.map((sess) => (
                    <div
                      key={sess.workoutId}
                      onClick={() => handleOpenWorkout(sess.workoutId)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800/70 bg-zinc-900/30 hover:bg-zinc-850/50 hover:border-zinc-700/80 transition-all cursor-pointer group"
                    >
                      {/* Left: Date & Title */}
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-accent-light transition-colors" />
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
                              <span className="text-zinc-500 font-medium">Ajuste:</span>{" "}
                              {sess.exerciseNotes}
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
                        {sess.topSet.isAllTimePR ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-mono font-bold shadow-sm">
                            👑 ALL-TIME
                          </span>
                        ) : sess.topSet.isPR ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/20 text-accent-lighter border border-accent/40 text-[10px] font-mono font-bold shadow-sm">
                            ★ PR
                          </span>
                        ) : null}

                        <div className="flex flex-col text-right font-mono tabular-nums">
                          <span className="text-xs font-bold text-accent-light">
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
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Drill-Down Session Modal */}
      {activeModalSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-950/60">
              <div className="flex flex-col">
                <span className="text-xs text-accent-light font-medium mb-1">
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
              {/* Personal Notes / quote */}
              {activeModalSession.workoutDescription && (
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-accent/20 text-xs italic text-accent-lighter/90 leading-relaxed">
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
                        const isWeightedBw = detailData?.exercise.metricType === "weighted_bodyweight";
                        let setLabel = "—";
                        if (s.weightKg !== null && s.reps !== null) {
                          if (isWeightedBw) {
                            setLabel = s.weightKg > 0 ? `+${s.weightKg} kg × ${s.reps}` : s.weightKg < 0 ? `${s.weightKg} kg × ${s.reps}` : `BW × ${s.reps}`;
                          } else if (s.weightKg < 0) {
                            setLabel = `${s.weightKg} kg × ${s.reps}`;
                          } else {
                            setLabel = `${s.weightKg} kg × ${s.reps}`;
                          }
                        } else if (s.weightKg === null && s.reps !== null) {
                          setLabel = isWeightedBw ? `BW × ${s.reps}` : `${s.reps} reps`;
                        } else if (s.durationSeconds !== null) {
                          setLabel = `${s.durationSeconds}s`;
                        } else if (s.distanceKm !== null) {
                          setLabel = `${s.distanceKm} km`;
                        }

                        const isSetTop = setLabel !== "—" && (
                          setLabel === activeModalSession.topSet.label ||
                          `${s.weightKg} kg × ${s.reps}` === activeModalSession.topSet.label ||
                          `+${s.weightKg} kg × ${s.reps}` === activeModalSession.topSet.label
                        );
                        return (
                          <tr
                            key={s.id}
                            className={`hover:bg-zinc-800/30 transition-colors ${isSetTop ? "bg-accent/10 font-bold" : ""
                              }`}
                          >
                            <td className="py-2.5 px-3 text-zinc-400 font-normal">
                              #{s.setIndex}
                            </td>
                            <td className="py-2.5 px-3">
                              {isSetTop ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/20 text-accent-lighter border border-accent/30">
                                  TOP SET
                                </span>
                              ) : s.setType === "warmup" ? (
                                <span className="text-zinc-500 text-[11px]">Calentamiento</span>
                              ) : (
                                <span className="text-zinc-400 text-[11px]">Efectiva</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-200">
                              {setLabel}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isSetTop &&
                                (activeModalSession.topSet.isAllTimePR ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400 text-zinc-950 font-bold">
                                    👑 ALL-TIME
                                  </span>
                                ) : activeModalSession.topSet.isPR ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent-light text-zinc-950 font-bold">
                                    ★ PR
                                  </span>
                                ) : null)}
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

      {/* Full Workout Session Modal */}
      <WorkoutSessionModal
        workout={fullWorkoutModal}
        isOpen={fullWorkoutModal !== null}
        onClose={() => setFullWorkoutModal(null)}
        highlightExerciseName={detailData?.exercise.name}
      />
    </div>
  );
}
