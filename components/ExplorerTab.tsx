"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ExerciseSummary, ExerciseDetailData, ExerciseSessionHistory, JournalWorkout } from "@/lib/actions";
import { ProgressionChart, type ChartMetricView } from "./charts/ProgressionChart";
import { ExerciseAnimationView } from "./ExerciseAnimationView";
import { WorkoutSessionModal } from "./WorkoutSessionModal";
import { ExerciseMediaPickerModal } from "./ExerciseMediaPickerModal";
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
  ByteHevyLogo,
  RefreshCwIcon,
} from "./Icons";
import { useSeason } from "@/lib/season-context";
import { getSeasonColor, hexToRgba } from "@/lib/season-colors";
import { useSync } from "@/lib/sync-context";

// Estilos de medallas olímpicas (Oro, Plata y Bronce) para el Top 3 de ejercicios
const RANK_BADGE_STYLES: Record<number, { bg: string; title: string }> = {
  0: {
    // 1º Puesto: Oro
    bg: "bg-gradient-to-b from-[#FFE885] via-[#F5B800] to-[#C98A00] text-zinc-950 border-yellow-100/90 shadow-[0_2px_5px_rgba(180,130,0,0.4)]",
    title: "1º puesto (Oro) en número de sesiones",
  },
  1: {
    // 2º Puesto: Plata
    bg: "bg-gradient-to-b from-[#FFFFFF] via-[#E2E8F0] to-[#94A3B8] text-zinc-950 border-white shadow-[0_2px_5px_rgba(100,116,139,0.35)]",
    title: "2º puesto (Plata) en número de sesiones",
  },
  2: {
    // 3º Puesto: Bronce
    bg: "bg-gradient-to-b from-[#FFB787] via-[#DF7B35] to-[#9C4312] text-zinc-950 border-orange-200/90 shadow-[0_2px_5px_rgba(156,67,18,0.4)]",
    title: "3º puesto (Bronce) en número de sesiones",
  },
};

interface ExplorerTabProps {
  initialExercises?: ExerciseSummary[];
  onGoToSync?: () => void;
}

export function ExplorerTab({ initialExercises = [], onGoToSync }: ExplorerTabProps) {
  const { activeSeasonId, activeSeason, setActiveSeasonId } = useSeason();
  const { hevyConnected, isHevySyncing, triggerHevySync } = useSync();
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
  const [mediaCache, setMediaCache] = useState<Record<string, ExerciseMedia>>({});
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState<boolean>(false);
  const [chartMetric, setChartMetric] = useState<ChartMetricView>("top_set");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bytehevy_chart_metric");
      if (saved === "top_set" || saved === "avg_1rm") {
        setChartMetric(saved as ChartMetricView);
      }
    } catch {}
  }, []);

  const isWeightMetric =
    detailData?.exercise.metricType === "weight_reps" ||
    detailData?.exercise.metricType === "weighted_bodyweight";
  const isRepsMetric = detailData?.exercise.metricType === "bodyweight_reps";
  const isAvgMetricApplicable = isWeightMetric || isRepsMetric;
  const isAvg1RMMetric = isAvgMetricApplicable && chartMetric === "avg_1rm";

  // Pre-calculate per-session metrics and PR badges matching active metric
  const sessionDisplayMap = useMemo(() => {
    if (!detailData) return new Map();

    const map = new Map<
      string,
      {
        badge: "all_time" | "season" | "pr" | null;
        primaryLabel: string;
        secondaryLabel?: string;
      }
    >();

    if (isAvg1RMMetric) {
      const chronological = [...detailData.sessions].sort(
        (a, b) => a.startTimestamp - b.startTimestamp
      );

      const allTimeBestVal =
        detailData.exercise.allTimeBestAvg1RM?.value ??
        (detailData.exercise.allTimeMaxAvg1RM ?? 0);
      const seasonBestVal = detailData.exercise.seasonBestAvg1RM?.value ?? 0;
      let runningBest = 0;

      for (const sess of chronological) {
        const val = isRepsMetric
          ? (sess.avgReps ?? sess.topSet.primaryValue)
          : (sess.avg1RM ?? sess.topSet.secondaryValue ?? sess.topSet.primaryValue);

        let badge: "all_time" | "season" | "pr" | null = null;
        if (allTimeBestVal > 0 && val >= allTimeBestVal) {
          badge = "all_time";
        } else if (activeSeason && seasonBestVal > 0 && val >= seasonBestVal) {
          badge = "season";
        } else if (val > runningBest && val > 0) {
          badge = "pr";
        }

        if (val > runningBest && val > 0) {
          runningBest = val;
        }

        const primaryLabel = isRepsMetric
          ? `${val} reps/serie`
          : `${val} kg 1RM`;
        const secondaryLabel = `Top: ${sess.topSet.label}`;

        map.set(sess.workoutId, { badge, primaryLabel, secondaryLabel });
      }
    } else {
      for (const sess of detailData.sessions) {
        const badge = sess.topSet.isAllTimePR
          ? "all_time"
          : sess.topSet.isSeasonPR
          ? "season"
          : sess.topSet.isPR
          ? "pr"
          : null;
        const primaryLabel = sess.topSet.label;
        const secondaryLabel = sess.topSet.secondaryValue
          ? `1RM: ${sess.topSet.secondaryValue} kg`
          : undefined;
        map.set(sess.workoutId, { badge, primaryLabel, secondaryLabel });
      }
    }

    return map;
  }, [detailData, isAvg1RMMetric, isRepsMetric, activeSeason]);

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

  // Populate mediaCache whenever exercises are loaded/updated
  useEffect(() => {
    if (!exercises || exercises.length === 0) return;
    setMediaCache((prev) => {
      const next = { ...prev };
      for (const ex of exercises) {
        const key = ex.name.toLowerCase().trim();
        if (!next[key] && ex.gifUrl) {
          const fallback = getExerciseMedia(ex.name);
          next[key] = {
            ...fallback,
            gifUrl: ex.gifUrl,
            primaryMuscle: ex.primaryMuscle || fallback.primaryMuscle,
          };
        }
      }
      return next;
    });
  }, [exercises]);

  // Global listener for artwork changes from ExerciseMediaManager
  useEffect(() => {
    const handleMediaUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ exerciseName: string; media: ExerciseMedia }>;
      if (!customEvent.detail) return;
      const { exerciseName, media } = customEvent.detail;
      const key = exerciseName.toLowerCase().trim();

      setMediaCache((prev) => ({
        ...prev,
        [key]: media,
      }));

      setExercises((prev) =>
        prev.map((ex) =>
          ex.name.toLowerCase().trim() === key
            ? { ...ex, gifUrl: media.gifUrl, primaryMuscle: media.primaryMuscle }
            : ex
        )
      );

      if (
        detailData &&
        detailData.exercise.name.toLowerCase().trim() === key
      ) {
        setCurrentMedia(media);
      }
    };

    window.addEventListener("exercise-media-updated", handleMediaUpdated);
    return () => window.removeEventListener("exercise-media-updated", handleMediaUpdated);
  }, [detailData]);

  // Sync ExerciseDB media asynchronously with SQLite caching and local mediaCache
  useEffect(() => {
    if (!detailData?.exercise.name) return;
    const key = detailData.exercise.name.toLowerCase().trim();
    const cached = mediaCache[key] || detailData.exercise.media;

    if (cached) {
      setCurrentMedia(cached);
    } else {
      setCurrentMedia(getExerciseMedia(detailData.exercise.name));
    }

    fetch(`/api/exercise-media/${encodeURIComponent(detailData.exercise.name)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCurrentMedia(res.data);
          setMediaCache((prev) => ({
            ...prev,
            [key]: res.data,
          }));
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

    const handleSyncComplete = () => {
      loadList();
    };
    window.addEventListener("bytehevy-sync-complete", handleSyncComplete);
    return () => {
      window.removeEventListener("bytehevy-sync-complete", handleSyncComplete);
    };
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
        {onGoToSync ? (
          <button
            onClick={onGoToSync}
            className="px-5 py-2.5 rounded-xl bg-accent text-zinc-950 text-sm font-semibold hover:bg-accent-light transition-colors cursor-pointer shadow-lg shadow-accent/10"
          >
            Importar archivo CSV
          </button>
        ) : (
          <Link
            href="/ajustes"
            className="px-5 py-2.5 rounded-xl bg-accent text-zinc-950 text-sm font-semibold hover:bg-accent-light transition-colors cursor-pointer shadow-lg shadow-accent/10"
          >
            Importar archivo CSV
          </Link>
        )}
      </div>
    );
  }

  const activeMedia =
    currentMedia ||
    (detailData
      ? mediaCache[detailData.exercise.name.toLowerCase().trim()] ||
        detailData.exercise.media ||
        getExerciseMedia(detailData.exercise.name)
      : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-3 lg:py-4">
      {/* Left Sidebar: Exercise List */}
      <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3 lg:sticky lg:top-[84px] lg:h-[calc(100vh-7.25rem)] min-h-0">
        {/* Top pinned controls */}
        <div className="shrink-0 flex flex-col gap-2.5">
          {/* Search & Granular Hevy Sync Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar ejercicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
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

            {/* Botón granular de Sincronizar Hevy */}
            <button
              type="button"
              onClick={triggerHevySync}
              disabled={isHevySyncing}
              title={
                hevyConnected
                  ? "Sincronizar entrenamientos con Hevy"
                  : "Conectar cuenta de Hevy para sincronizar"
              }
              className={`h-[38px] px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-all cursor-pointer shadow-sm active:scale-[0.98] ${
                hevyConnected
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
                  : "bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              } disabled:opacity-50`}
            >
              <ByteHevyLogo className="w-4 h-4" />
              <RefreshCwIcon
                className={`w-3.5 h-3.5 ${
                  isHevySyncing ? "animate-spin text-blue-400" : "text-zinc-400"
                }`}
              />
              <span className="hidden sm:inline">
                {isHevySyncing ? "Sincronizando..." : "Hevy"}
              </span>
            </button>
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
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-850"
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
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer shrink-0"
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
        </div>

        {/* List of Exercises: fills 100% of remaining sidebar space down to viewport bottom with custom themed scrollbar */}
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1.5 pb-4 custom-scrollbar">
          {filteredExercises.map((ex, idx) => {
            const isSelected = selectedId === ex.id;
            const key = ex.name.toLowerCase().trim();
            const cachedMedia = mediaCache[key];
            const fallbackMedia = getExerciseMedia(ex.name);
            const gifUrl = cachedMedia?.gifUrl || ex.gifUrl || fallbackMedia.gifUrl;
            const primaryMuscle = cachedMedia?.primaryMuscle || ex.primaryMuscle || fallbackMedia.primaryMuscle;
            const muscleName = MUSCLE_LABELS[primaryMuscle] || primaryMuscle;
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
                    ? "bg-zinc-850 border-accent/60 shadow-lg ring-1 ring-accent/30"
                    : "bg-zinc-900 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700"
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
                      src={gifUrl}
                      alt={ex.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  {idx < 3 && !searchQuery && categoryFilter === "all" && (
                    <span
                      className={`absolute -top-1.5 -left-1.5 w-4.5 h-4.5 rounded-full text-[10px] font-black flex items-center justify-center border shadow-md tabular-nums select-none leading-none ${
                        RANK_BADGE_STYLES[idx]?.bg || "bg-accent text-zinc-950 border-accent"
                      }`}
                      title={RANK_BADGE_STYLES[idx]?.title || `Top ${idx + 1}`}
                    >
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

            {/* Above-the-fold Viewport Stage: Exercise Profile + Progression Chart fill the screen with clean bottom margin */}
            <div className="flex flex-col gap-3.5 lg:gap-4 lg:min-h-[calc(100vh-7.25rem)]">
              {/* HERO STAGE: Anatomical Visualizer & Exercise Profile */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center gap-4 sm:gap-5">
                {/* 3D Animation Showcase (Prominent and Impressive) */}
                <div className="w-full lg:w-[350px] xl:w-[390px] shrink-0 flex items-center justify-center my-auto">
                  <ExerciseAnimationView
                    media={activeMedia}
                    onReassignMedia={() => setIsMediaPickerOpen(true)}
                    className="w-full h-[270px] sm:h-[285px] lg:h-[295px] rounded-xl shadow-lg"
                  />
                </div>

                {/* Right: Exercise Name, Metric, Category, Session Count & Anatomy */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-2.5 my-auto">
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
                    </div>

                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 truncate" title={detailData.exercise.name}>
                      {detailData.exercise.name}
                    </h1>

                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>
                        {detailData.sessions.length} entrenamientos {activeSeason ? "en esta temporada" : "registrados"}
                      </span>
                    </p>
                  </div>

                  {/* PR & 1RM Hero Cards */}
                  {activeSeason && seasonColor ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Season PR Card (Contenido en vertical) */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-orange-500/10 via-zinc-900 to-zinc-900 border border-orange-500/25 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-orange-500/20">
                          <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold flex items-center gap-1.5">
                            <FlameIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span>PR Season</span>
                          </span>
                          <span className="text-[9px] font-mono text-orange-400/90 uppercase px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 truncate max-w-[130px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: seasonColor }} />
                            <span>{activeSeason.name}</span>
                          </span>
                        </div>

                        {isWeightMetric ? (
                          <div className="flex flex-col divide-y divide-zinc-800/70 pt-1">
                            {/* Row 1: Mayor Peso Season */}
                            <div className="py-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400/80 shrink-0" />
                                <span>Mayor Peso</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-zinc-100 mt-0.5">
                                {detailData.exercise.seasonBest?.label || "Sin registros"}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                {detailData.exercise.seasonBest?.date || "—"}
                              </span>
                            </div>

                            {/* Row 2: Top Set 1RM Season */}
                            <div className="pt-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                <span>Top Set 1RM</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-orange-300 mt-0.5">
                                {detailData.exercise.seasonMax1RM?.label ||
                                  (detailData.exercise.estimated1RM
                                    ? `${detailData.exercise.estimated1RM} kg 1RM`
                                    : "—")}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {detailData.exercise.seasonMax1RM?.setLabel && (
                                  <>
                                    <span className="text-zinc-300 font-medium">{detailData.exercise.seasonMax1RM.setLabel}</span>
                                    <span className="text-zinc-600">·</span>
                                  </>
                                )}
                                <span>
                                  {detailData.exercise.seasonMax1RM?.date ||
                                    detailData.exercise.seasonBest?.date ||
                                    "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                              {detailData.exercise.metricType === "bodyweight_reps"
                                ? "Récord Repeticiones"
                                : detailData.exercise.metricType === "seconds"
                                ? "Récord Duración"
                                : "Récord Distancia"}
                            </span>
                            <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-orange-200 mt-0.5">
                              {detailData.exercise.seasonBest?.label || "Sin registros"}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                              {detailData.exercise.seasonBest?.date || "—"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ALL-TIME PR Card (Contenido en vertical) */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-yellow-500/10 via-zinc-900 to-zinc-900 border border-yellow-500/30 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-yellow-500/20">
                          <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-bold flex items-center gap-1.5">
                            <CrownIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            <span>ALL-TIME PR</span>
                          </span>
                        </div>

                        {isWeightMetric ? (
                          <div className="flex flex-col divide-y divide-zinc-800/70 pt-1">
                            {/* Row 1: Mayor Peso Histórico */}
                            <div className="py-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 shrink-0" />
                                <span>Mayor Peso</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-yellow-100 mt-0.5">
                                {detailData.exercise.allTimeBest?.label || "—"}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                {detailData.exercise.allTimeBest?.date || "Sin registro"}
                              </span>
                            </div>

                            {/* Row 2: Top Set 1RM Histórico */}
                            <div className="pt-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>Top Set 1RM</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-yellow-300 mt-0.5">
                                {detailData.exercise.allTimeMax1RM?.label ||
                                  (detailData.exercise.allTimeEstimated1RM
                                    ? `${detailData.exercise.allTimeEstimated1RM} kg 1RM`
                                    : "—")}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {detailData.exercise.allTimeMax1RM?.setLabel && (
                                  <>
                                    <span className="text-zinc-300 font-medium">{detailData.exercise.allTimeMax1RM.setLabel}</span>
                                    <span className="text-zinc-600">·</span>
                                  </>
                                )}
                                <span>
                                  {detailData.exercise.allTimeMax1RM?.date ||
                                    detailData.exercise.allTimeBest?.date ||
                                    "Sin registro"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                              {detailData.exercise.metricType === "bodyweight_reps"
                                ? "Récord Repeticiones"
                                : detailData.exercise.metricType === "seconds"
                                ? "Récord Duración"
                                : "Récord Distancia"}
                            </span>
                            <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-yellow-200 mt-0.5">
                              {detailData.exercise.allTimeBest?.label || "—"}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                              {detailData.exercise.allTimeBest?.date || "Sin registro"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1RM Estimado Card (Contenido en vertical) */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-orange-500/10 via-zinc-900 to-zinc-900 border border-orange-500/25 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-orange-500/20">
                          <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold flex items-center gap-1.5">
                            <FlameIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span>1RM Estimado</span>
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">Fórmula Brzycki</span>
                        </div>

                        {isWeightMetric ? (
                          <div className="flex flex-col divide-y divide-zinc-800/70 pt-1">
                            {/* Row 1: Mayor Peso */}
                            <div className="py-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400/80 shrink-0" />
                                <span>Mayor Peso</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-zinc-100 mt-0.5">
                                {detailData.exercise.allTimeBest?.label || "—"}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                {detailData.exercise.allTimeBest?.date || "Sin registro"}
                              </span>
                            </div>

                            {/* Row 2: Top Set 1RM */}
                            <div className="pt-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                <span>Top Set 1RM</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-orange-300 mt-0.5">
                                {detailData.exercise.allTimeMax1RM?.label ||
                                  (detailData.exercise.allTimeEstimated1RM
                                    ? `${detailData.exercise.allTimeEstimated1RM} kg 1RM`
                                    : "—")}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {detailData.exercise.allTimeMax1RM?.setLabel && (
                                  <>
                                    <span className="text-zinc-300 font-medium">{detailData.exercise.allTimeMax1RM.setLabel}</span>
                                    <span className="text-zinc-600">·</span>
                                  </>
                                )}
                                <span>
                                  {detailData.exercise.allTimeMax1RM?.date ||
                                    detailData.exercise.allTimeBest?.date ||
                                    "Sin registro"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                              {detailData.exercise.metricType === "bodyweight_reps"
                                ? "Récord Repeticiones"
                                : detailData.exercise.metricType === "seconds"
                                ? "Récord Duración"
                                : "Récord Distancia"}
                            </span>
                            <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-orange-200 mt-0.5">
                              {detailData.exercise.allTimeBest?.label || "—"}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                              {detailData.exercise.allTimeBest?.date || "Sin registro"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ALL-TIME PR Card (Contenido en vertical) */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-yellow-500/10 via-zinc-900 to-zinc-900 border border-yellow-500/30 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-yellow-500/20">
                          <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-bold flex items-center gap-1.5">
                            <CrownIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            <span>ALL-TIME PR</span>
                          </span>
                        </div>

                        {isWeightMetric ? (
                          <div className="flex flex-col divide-y divide-zinc-800/70 pt-1">
                            {/* Row 1: Mayor Peso Histórico */}
                            <div className="py-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 shrink-0" />
                                <span>Mayor Peso</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-yellow-100 mt-0.5">
                                {detailData.exercise.allTimeBest?.label || "—"}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                {detailData.exercise.allTimeBest?.date || "Sin registro"}
                              </span>
                            </div>

                            {/* Row 2: Top Set 1RM Histórico */}
                            <div className="pt-2 flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>Top Set 1RM</span>
                              </span>
                              <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-yellow-300 mt-0.5">
                                {detailData.exercise.allTimeMax1RM?.label ||
                                  (detailData.exercise.allTimeEstimated1RM
                                    ? `${detailData.exercise.allTimeEstimated1RM} kg 1RM`
                                    : "—")}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {detailData.exercise.allTimeMax1RM?.setLabel && (
                                  <>
                                    <span className="text-zinc-300 font-medium">{detailData.exercise.allTimeMax1RM.setLabel}</span>
                                    <span className="text-zinc-600">·</span>
                                  </>
                                )}
                                <span>
                                  {detailData.exercise.allTimeMax1RM?.date ||
                                    detailData.exercise.allTimeBest?.date ||
                                    "Sin registro"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                              {detailData.exercise.metricType === "bodyweight_reps"
                                ? "Récord Repeticiones"
                                : detailData.exercise.metricType === "seconds"
                                ? "Récord Duración"
                                : "Récord Distancia"}
                            </span>
                            <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-yellow-200 mt-0.5">
                              {detailData.exercise.allTimeBest?.label || "—"}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                              {detailData.exercise.allTimeBest?.date || "Sin registro"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progression Chart Card: Stretches vertically to fill remaining above-the-fold space */}
              <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl min-h-[320px]">
                <div className="flex items-center justify-between mb-2.5 shrink-0">
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
                  <div className="py-12 text-center text-xs text-zinc-500 my-auto">
                    No hay sesiones de este ejercicio en la {activeSeason?.endDate ? `season "${activeSeason?.name}"` : `season activa (${activeSeason?.name})`}.
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    <ProgressionChart
                      data={detailData.chartPoints}
                      unit={getUnit(detailData.exercise.metricType)}
                      metricName="Peso Máximo"
                      secondaryMetricName="1RM Estimado"
                      exerciseName={detailData.exercise.name}
                      metricType={detailData.exercise.metricType}
                      seasonName={activeSeason?.name}
                      seasonColor={seasonColor || undefined}
                      metric={chartMetric}
                      onMetricChange={setChartMetric}
                      allTimeBestLabel={detailData.exercise.allTimeBest?.label}
                      seasonBestLabel={detailData.exercise.seasonBest?.label}
                      allTimeBestValue={detailData.exercise.allTimeBest?.value}
                      allTimeBestAvg1RM={detailData.exercise.allTimeMaxAvg1RM ?? undefined}
                      targetGoal={detailData.exercise.targetGoal}
                      onPointClick={(pt) => {
                        if (pt.workoutId) {
                          handleOpenWorkout(pt.workoutId);
                        }
                      }}
                    />
                  </div>
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
                <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-900 text-center text-xs text-zinc-500">
                  No hay sesiones registradas en este periodo
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {detailData.sessions.map((sess) => (
                    <div
                      key={sess.workoutId}
                      onClick={() => handleOpenWorkout(sess.workoutId)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700 transition-all cursor-pointer group"
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
                        {(() => {
                          const sessDisplay = sessionDisplayMap.get(sess.workoutId);
                          const badge = sessDisplay?.badge;
                          if (badge === "all_time") {
                            return (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-mono font-bold shadow-sm">
                                👑 ALL-TIME
                              </span>
                            );
                          }
                          if (badge === "season") {
                            return (
                              <span
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shadow-sm"
                                style={{
                                  backgroundColor: "rgba(251, 191, 36, 0.15)",
                                  color: "#fbbf24",
                                  borderColor: "rgba(251, 191, 36, 0.35)",
                                }}
                              >
                                🏆 PR SEASON
                              </span>
                            );
                          }
                          if (badge === "pr") {
                            return (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/20 text-accent-lighter border border-accent/40 text-[10px] font-mono font-bold shadow-sm">
                                ★ PR
                              </span>
                            );
                          }
                          return null;
                        })()}

                        <div className="flex flex-col text-right font-mono tabular-nums">
                          <span className="text-xs font-bold text-accent-light">
                            {sessionDisplayMap.get(sess.workoutId)?.primaryLabel ?? sess.topSet.label}
                          </span>
                          {sessionDisplayMap.get(sess.workoutId)?.secondaryLabel ? (
                            <span className="text-[10px] text-zinc-500">
                              {sessionDisplayMap.get(sess.workoutId)?.secondaryLabel}
                            </span>
                          ) : sess.topSet.secondaryValue ? (
                            <span className="text-[10px] text-zinc-500">
                              1RM: {sess.topSet.secondaryValue} kg
                            </span>
                          ) : null}
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
                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
                  <table className="w-full text-left text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900 text-[11px] text-zinc-400 uppercase tracking-wider">
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
                        if (isWeightedBw && s.reps !== null) {
                          setLabel = s.weightKg !== null && s.weightKg > 0 ? `+${s.weightKg} kg × ${s.reps}` : `0kg + BW × ${s.reps}`;
                        } else if (s.weightKg !== null && s.reps !== null) {
                          setLabel = `${s.weightKg} kg × ${s.reps}`;
                        } else if (s.weightKg === null && s.reps !== null) {
                          setLabel = `${s.reps} reps`;
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
                                ) : activeModalSession.topSet.isSeasonPR ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                                    🏆 PR SEASON
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

      {/* Modal para reasignar carátula 3D directamente desde el Explorador */}
      {detailData && (
        <ExerciseMediaPickerModal
          isOpen={isMediaPickerOpen}
          onClose={() => setIsMediaPickerOpen(false)}
          exerciseName={detailData.exercise.name}
          currentMedia={activeMedia}
          onMediaUpdated={(updatedMedia) => {
            setCurrentMedia(updatedMedia);
            setMediaCache((prev) => ({
              ...prev,
              [detailData.exercise.name.toLowerCase().trim()]: updatedMedia,
            }));
          }}
        />
      )}
    </div>
  );
}
