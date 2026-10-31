"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ExerciseMedia } from "@/types/exercise-media";
import { MUSCLE_LABELS } from "@/lib/exercise-media";
import {
  FilmIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  SparklesIcon,
  ChevronRightIcon,
  PhotoIcon,
} from "./Icons";

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

interface CatalogItem {
  id: string;
  category: string;
  categoryLabel: string;
  filename: string;
  title: string;
  cdnUrl: string;
  score?: number;
}

interface CatalogCategory {
  id: string;
  label: string;
  count: number;
}

// Mapeo inverso de MuscleGroup a categoría del catálogo de 1.323 GIFs
const MUSCLE_TO_CAT: Record<string, string> = {
  chest: "pectorals",
  lats: "lats",
  upper_back: "upper-back",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  shoulders: "delts",
  quads: "quads",
  hamstrings: "hamstrings",
  calves: "calves",
  abs: "abs",
  cardio: "cardio",
};

export function ExerciseMediaManager() {
  const [exercises, setExercises] = useState<ExerciseItemWithMedia[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal / Picker State (Jellyfin Style)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItemWithMedia | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

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

  // 2. Buscar en el catálogo de 1.323 GIFs
  const executeCatalogSearch = useCallback(
    async (query: string, category: string) => {
      setLoadingCatalog(true);
      setErrorToast(null);
      try {
        const params = new URLSearchParams({
          q: query,
          category: category,
          limit: "60",
        });
        const res = await fetch(`/api/exercise-media/search?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setCatalogResults(json.results || []);
          if (json.categories && json.categories.length > 0) {
            setCatalogCategories(json.categories);
          }
        }
      } catch (err: any) {
        console.error("Error al buscar en catálogo:", err);
        setErrorToast("No se pudo conectar con el catálogo de GIFs");
      } finally {
        setLoadingCatalog(false);
      }
    },
    []
  );

  // Abrir modal estilo Jellyfin
  const handleOpenPicker = (ex: ExerciseItemWithMedia) => {
    setSelectedExercise(ex);
    setSuccessToast(null);
    setErrorToast(null);

    // Sugerir término de búsqueda limpio basado en el nombre del ejercicio
    const cleanName = ex.name.replace(/\s*\([^)]*\)/g, "").trim();
    setCatalogQuery(cleanName);

    // Deducir categoría inicial
    const cat = MUSCLE_TO_CAT[ex.media?.primaryMuscle] || "all";
    setCatalogCategory(cat);

    // Lanzar búsqueda inicial
    executeCatalogSearch(cleanName, cat);
  };

  const handleClosePicker = () => {
    setSelectedExercise(null);
    setCatalogResults([]);
    setSuccessToast(null);
  };

  // Asignar carátula seleccionada y descargarla localmente
  const handleAssignArtwork = async (item: CatalogItem) => {
    if (!selectedExercise) return;

    setUpdatingId(item.id);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      const res = await fetch("/api/exercise-media/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName: selectedExercise.name,
          gifUrl: item.cdnUrl,
          title: item.title,
          category: item.category,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        // Actualizar el estado del ejercicio seleccionado
        const updatedMedia: ExerciseMedia = json.data;

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

        setSuccessToast(`¡Carátula guardada y descargada localmente para ${selectedExercise.name}!`);
      } else {
        setErrorToast(json.error || "No se pudo actualizar la carátula");
      }
    } catch (err: any) {
      console.error("Error al actualizar carátula:", err);
      setErrorToast(err.message || "Error al conectar con el servidor");
    } finally {
      setUpdatingId(null);
    }
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
            const gifUrl = ex.media?.gifUrl || ex.media?.posterUrl;
            const rank = index + 1;

            return (
              <div
                key={ex.id || ex.name}
                className="group relative rounded-2xl border border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900/80 hover:border-accent/40 transition-all flex flex-col justify-between overflow-hidden p-3.5 shadow-lg"
              >
                {/* Visual Media Poster */}
                <div className="relative w-full aspect-square rounded-xl bg-white dark:bg-white overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-800/60 shadow-inner group-hover:scale-[1.01] transition-transform">
                  {gifUrl ? (
                    <img
                      src={gifUrl}
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

      {/* MODAL PICKER ESTILO JELLYFIN */}
      {selectedExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
            {/* Header del Modal */}
            <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light">
                  <FilmIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>Elegir Carátula 3D para:</span>
                    <span className="text-accent-light">{selectedExercise.name}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Selecciona una animación anatómica del catálogo para asignarla y descargarla automáticamente.
                  </p>
                </div>
              </div>

              <button
                onClick={handleClosePicker}
                className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Notificaciones dentro del modal */}
            {successToast && (
              <div className="mx-5 mt-4 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckIcon className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successToast}</span>
              </div>
            )}

            {errorToast && (
              <div className="mx-5 mt-4 p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium flex items-center gap-2">
                <XIcon className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorToast}</span>
              </div>
            )}

            {/* Barra de Búsqueda y Filtro de Categorías */}
            <div className="p-5 border-b border-zinc-800/60 flex flex-col gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeCatalogSearch(catalogQuery, catalogCategory);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder="Buscar por nombre en inglés o español (ej: press banca, curl, squat, lats)..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  />
                  {catalogQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogQuery("");
                        executeCatalogSearch("", catalogCategory);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loadingCatalog}
                  className="px-4 py-2.5 rounded-xl bg-accent text-zinc-950 font-bold text-xs hover:bg-accent-light transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {loadingCatalog ? (
                    <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <SearchIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Buscar</span>
                </button>
              </form>

              {/* Category Pills (Jellyfin Style Filter Tabs) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {catalogCategories.map((cat) => {
                  const isActive = catalogCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCatalogCategory(cat.id);
                        executeCatalogSearch(catalogQuery, cat.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer text-[11px] ${
                        isActive
                          ? "bg-accent/20 border border-accent/40 text-accent-light font-bold"
                          : "bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {cat.label} ({cat.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid de Resultados de Carátulas (Artwork Posters) */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingCatalog ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                  <RefreshCwIcon className="w-8 h-8 animate-spin text-accent-light" />
                  <span>Explorando catálogo anatómico 3D...</span>
                </div>
              ) : catalogResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {catalogResults.map((item) => {
                    const isCurrent =
                      selectedExercise.media?.gifUrl?.includes(item.filename) ||
                      selectedExercise.media?.aliases?.includes(item.title);
                    const isSaving = updatingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`group rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                          isCurrent
                            ? "border-emerald-500/50 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/30"
                            : "border-zinc-800 bg-zinc-900/40 hover:border-accent/40 hover:bg-zinc-900/80"
                        }`}
                      >
                        {/* Visual 3D GIF */}
                        <div className="relative aspect-square w-full rounded-xl bg-white overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shadow-inner">
                          <img
                            src={item.cdnUrl}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-contain p-1"
                          />

                          {isCurrent && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-md flex items-center gap-1">
                              <CheckIcon className="w-3 h-3" />
                              <span>Actual</span>
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-zinc-950/80 border border-zinc-700/80 text-[9px] font-semibold text-zinc-300 backdrop-blur-md">
                            {item.categoryLabel}
                          </div>
                        </div>

                        {/* Título & Botón de asignación */}
                        <div className="pt-2.5 flex flex-col gap-2">
                          <h5
                            className="text-xs font-semibold text-zinc-200 line-clamp-2 leading-snug group-hover:text-accent-light transition-colors"
                            title={item.title}
                          >
                            {item.title}
                          </h5>

                          <button
                            onClick={() => handleAssignArtwork(item)}
                            disabled={isSaving || isCurrent}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] ${
                              isCurrent
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default"
                                : isSaving
                                ? "bg-accent/30 text-accent-light border border-accent/40 opacity-75"
                                : "bg-accent text-zinc-950 hover:bg-accent-light"
                            }`}
                          >
                            {isSaving ? (
                              <>
                                <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                                <span>Descargando...</span>
                              </>
                            ) : isCurrent ? (
                              <>
                                <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Asignado</span>
                              </>
                            ) : (
                              <>
                                <CheckIcon className="w-3.5 h-3.5" />
                                <span>Asignar Carátula</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <PhotoIcon className="w-10 h-10 text-zinc-600" />
                  <p className="text-xs text-zinc-400">
                    No se encontraron carátulas para "{catalogQuery}".
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Prueba a buscar con un término más general o selecciona otra categoría arriba.
                  </p>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-[11px]">
                {catalogResults.length} resultados encontrados en el catálogo
              </span>
              <button
                onClick={handleClosePicker}
                className="px-4 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-medium transition-colors cursor-pointer"
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

