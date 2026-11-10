"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ExerciseMedia } from "@/types/exercise-media";
import { MUSCLE_LABELS } from "@/lib/exercise-media";
import {
  FilmIcon,
  SearchIcon,
  CheckIcon,
  RefreshCwIcon,
  PhotoIcon,
} from "./Icons";
import { ExerciseMediaPickerModal } from "./ExerciseMediaPickerModal";

interface ExerciseItemWithMedia {
  id: string;
  name: string;
  metricType: string;
  sessionCount: number;
  latestTimestamp?: number;
  media: ExerciseMedia;
  hasCustomMedia: boolean;
  updatedAt: number | null;
}

export function ExerciseMediaManager() {
  const [exercises, setExercises] = useState<ExerciseItemWithMedia[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal / Picker State
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItemWithMedia | null>(null);

  // 1. Cargar lista de ejercicios del usuario y sus carátulas actuales
  const loadExercises = useCallback(async () => {
    setLoadingExercises(true);
    try {
      const res = await fetch("/api/exercise-media/list");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setExercises(json.data);
      }
    } catch (err) {
      console.error("Error al cargar lista de ejercicios:", err);
    } finally {
      setLoadingExercises(false);
    }
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  useEffect(() => {
    const handleMediaUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ exerciseName: string; media: ExerciseMedia }>;
      if (!customEvent.detail) return;
      const { exerciseName, media } = customEvent.detail;
      setExercises((prev) =>
        prev.map((ex) =>
          ex.name.toLowerCase().trim() === exerciseName.toLowerCase().trim()
            ? { ...ex, media, hasCustomMedia: true, updatedAt: Date.now() }
            : ex
        )
      );
      setSelectedExercise((prev) =>
        prev && prev.name.toLowerCase().trim() === exerciseName.toLowerCase().trim()
          ? { ...prev, media, hasCustomMedia: true, updatedAt: Date.now() }
          : prev
      );
    };

    window.addEventListener("exercise-media-updated", handleMediaUpdated);
    return () => window.removeEventListener("exercise-media-updated", handleMediaUpdated);
  }, []);

  const handleOpenPicker = (ex: ExerciseItemWithMedia) => {
    setSelectedExercise(ex);
  };

  const handleClosePicker = () => {
    setSelectedExercise(null);
  };

  // Filtrar lista de ejercicios del usuario y ordenar por mayor frecuencia de uso
  const filteredExercises = useMemo(() => {
    let list = exercises;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      list = exercises.filter(
        (ex) =>
          ex.name.toLowerCase().includes(lower) ||
          MUSCLE_LABELS[ex.media?.primaryMuscle]?.toLowerCase().includes(lower)
      );
    }
    return [...list].sort((a, b) => {
      // 1. Mayor cantidad de sesiones primero
      if ((b.sessionCount ?? 0) !== (a.sessionCount ?? 0)) {
        return (b.sessionCount ?? 0) - (a.sessionCount ?? 0);
      }
      // 2. Desempate: sesión más reciente primero
      return (b.latestTimestamp ?? 0) - (a.latestTimestamp ?? 0);
    });
  }, [exercises, searchTerm]);

  return (
    <div className="flex flex-col gap-6">
      {/* Banner / Header informativo */}
      <div className="p-6 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent-light shrink-0 shadow-inner">
            <FilmIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-100 tracking-tight">
                Gestor de Carátulas & Animaciones 3D
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent-light">
                Estilo Jellyfin
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Modifica la carátula y el vídeo 3D de cualquier ejercicio. Explora el catálogo de{" "}
              <strong className="text-zinc-200">1.323 modelos 3D</strong> anatómicos de alta calidad. Al elegir uno, se descarga automáticamente a tu almacenamiento local en{" "}
              <code className="text-accent-light font-mono text-[11px]">public/media/exercises/</code> y se asigna al ejercicio en SQLite para funcionar 100% offline.
            </p>
          </div>
        </div>

        {/* Input de filtro para ejercicios de la biblioteca */}
        <div className="relative min-w-[260px]">
          <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar tus ejercicios..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/70 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
      </div>

      {/* Grid de Ejercicios del Usuario */}
      {loadingExercises ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
          <RefreshCwIcon className="w-6 h-6 animate-spin text-accent-light" />
          <span>Cargando ejercicios de tu base de datos...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredExercises.map((ex, index) => {
            const muscleLabel =
              MUSCLE_LABELS[ex.media?.primaryMuscle] || ex.media?.primaryMuscle || "Músculo";
            const videoSrc =
              ex.media?.videoUrl ||
              (ex.media?.gifUrl &&
              (ex.media.gifUrl.toLowerCase().endsWith(".mp4") ||
                ex.media.gifUrl.toLowerCase().endsWith(".webm") ||
                ex.media.gifUrl.toLowerCase().endsWith(".mov"))
                ? ex.media.gifUrl
                : undefined);
            const imageSrc = ex.media?.gifUrl || ex.media?.posterUrl;
            const rank = index + 1;

            return (
              <div
                key={ex.id || ex.name}
                className="group relative rounded-2xl border border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900/80 hover:border-accent/40 transition-all flex flex-col justify-between overflow-hidden p-3.5 shadow-lg"
              >
                {/* Visual Media Poster */}
                <div className="relative w-full aspect-square rounded-xl bg-white dark:bg-white overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-800/60 shadow-inner group-hover:scale-[1.01] transition-transform">
                  {videoSrc ? (
                    <video
                      src={videoSrc}
                      poster={ex.media?.posterUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={ex.name}
                      loading="lazy"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400 gap-1 text-[11px]">
                      <PhotoIcon className="w-6 h-6 opacity-40" />
                      <span>Sin imagen</span>
                    </div>
                  )}

                  {/* Badges superiores sobre la imagen */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                    {/* Rank Badge */}
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border backdrop-blur-md shadow-sm ${
                        rank === 1
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : rank === 2
                          ? "bg-slate-400/20 border-slate-400/40 text-slate-200"
                          : rank === 3
                          ? "bg-amber-700/25 border-amber-600/40 text-amber-400"
                          : "bg-zinc-900/80 border-zinc-700/70 text-zinc-400"
                      }`}
                      title={`Posición #${rank} por frecuencia de uso`}
                    >
                      #{rank}
                    </span>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-950/80 border border-zinc-700/80 text-zinc-200 backdrop-blur-md">
                      {muscleLabel}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    {/* Badge de número de sesiones */}
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-accent/20 border border-accent/40 text-accent-lighter backdrop-blur-md shadow-sm">
                      {ex.sessionCount} {ex.sessionCount === 1 ? "sesión" : "ses"}
                    </span>

                    {ex.hasCustomMedia && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold backdrop-blur-md">
                        <CheckIcon className="w-2.5 h-2.5" />
                        <span>Editado</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalles y botón */}
                <div className="pt-3 flex flex-col gap-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-100 group-hover:text-accent-light transition-colors line-clamp-1" title={ex.name}>
                      {ex.name}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-0.5">
                      <span className="line-clamp-1">{ex.media?.equipment || "Gimnasio"}</span>
                      <span className="text-zinc-500 font-mono text-[10px] shrink-0 font-medium">
                        {ex.sessionCount} {ex.sessionCount === 1 ? "sesión" : "sesiones"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenPicker(ex)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-zinc-700/70 bg-zinc-800/60 hover:bg-accent/15 hover:border-accent/40 text-zinc-200 hover:text-accent-light text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    <FilmIcon className="w-3.5 h-3.5 text-accent-light" />
                    <span>Cambiar Carátula 3D</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredExercises.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
              No se encontraron ejercicios coincidentes con "{searchTerm}".
            </div>
          )}
        </div>
      )}

      {/* MODAL PICKER UNIFICADO CON SOPORTE PARA CATÁLOGO Y CONTENIDO SUBIDO */}
      {selectedExercise && (
        <ExerciseMediaPickerModal
          isOpen={Boolean(selectedExercise)}
          onClose={handleClosePicker}
          exerciseName={selectedExercise.name}
          currentMedia={selectedExercise.media}
          onMediaUpdated={(updatedMedia) => {
            setExercises((prev) =>
              prev.map((ex) =>
                ex.name.toLowerCase().trim() === selectedExercise.name.toLowerCase().trim()
                  ? {
                      ...ex,
                      media: updatedMedia,
                      hasCustomMedia: true,
                      updatedAt: Date.now(),
                    }
                  : ex
              )
            );
            setSelectedExercise((prev) =>
              prev
                ? {
                    ...prev,
                    media: updatedMedia,
                    hasCustomMedia: true,
                    updatedAt: Date.now(),
                  }
                : null
            );
          }}
        />
      )}
    </div>
  );
}

