"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExerciseMedia } from "@/types/exercise-media";
import {
  FilmIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  PhotoIcon,
  SparklesIcon,
} from "./Icons";

export interface CatalogItem {
  id: string;
  category: string;
  categoryLabel: string;
  filename: string;
  title: string;
  cdnUrl: string;
  score?: number;
}

export interface CatalogCategory {
  id: string;
  label: string;
  count: number;
}

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

interface ExerciseMediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  currentMedia?: ExerciseMedia | null;
  onMediaUpdated?: (media: ExerciseMedia) => void;
}

export function ExerciseMediaPickerModal({
  isOpen,
  onClose,
  exerciseName,
  currentMedia,
  onMediaUpdated,
}: ExerciseMediaPickerModalProps) {
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Buscar en el catálogo anatómico de 1.323 GIFs
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

  // Inicializar búsqueda al abrir el modal para el ejercicio específico
  useEffect(() => {
    if (isOpen && exerciseName) {
      setSuccessToast(null);
      setErrorToast(null);

      // Limpiar nombre del ejercicio (eliminar paréntesis o aclaraciones)
      const cleanName = exerciseName.replace(/\s*\([^)]*\)/g, "").trim();
      setCatalogQuery(cleanName);

      const cat = currentMedia?.primaryMuscle
        ? MUSCLE_TO_CAT[currentMedia.primaryMuscle] || "all"
        : "all";
      setCatalogCategory(cat);

      executeCatalogSearch(cleanName, cat);
    } else if (!isOpen) {
      setCatalogResults([]);
      setSuccessToast(null);
      setErrorToast(null);
    }
  }, [isOpen, exerciseName, currentMedia, executeCatalogSearch]);

  // Asignar carátula seleccionada y descargarla localmente
  const handleAssignArtwork = async (item: CatalogItem) => {
    if (!exerciseName) return;

    setUpdatingId(item.id);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      const res = await fetch("/api/exercise-media/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName: exerciseName,
          gifUrl: item.cdnUrl,
          title: item.title,
          category: item.category,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const updatedMedia: ExerciseMedia = json.data;

        setSuccessToast(`¡Carátula 3D asignada y guardada localmente para ${exerciseName}!`);

        // Notificar evento global para sincronizar todas las vistas
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("exercise-media-updated", {
              detail: {
                exerciseName: exerciseName,
                media: updatedMedia,
              },
            })
          );
        }

        if (onMediaUpdated) {
          onMediaUpdated(updatedMedia);
        }

        // Cerrar modal automáticamente tras 800ms para confirmar visualmente
        setTimeout(() => {
          onClose();
        }, 850);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header del Modal */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shrink-0">
              <FilmIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 flex-wrap">
                <span>Reasignar Carátula 3D:</span>
                <span className="text-accent-light truncate font-mono">
                  {exerciseName}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                Busca y selecciona una animación anatómica del catálogo para asignarla a este ejercicio.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="Cerrar"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Notificaciones dentro del modal */}
        {successToast && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckIcon className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successToast}</span>
          </div>
        )}

        {errorToast && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <XIcon className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorToast}</span>
          </div>
        )}

        {/* Barra de Búsqueda y Filtro de Categorías */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/60 flex flex-col gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeCatalogSearch(catalogQuery, catalogCategory);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1 min-w-0">
              <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Buscar por nombre (ej: press banca, curl bíceps, sentadilla, lats)..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-sans"
              />
              {catalogQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setCatalogQuery("");
                    executeCatalogSearch("", catalogCategory);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
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

          {/* Category Pills */}
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loadingCatalog ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
              <RefreshCwIcon className="w-8 h-8 animate-spin text-accent-light" />
              <span>Explorando catálogo anatómico 3D...</span>
            </div>
          ) : catalogResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {catalogResults.map((item) => {
                const isCurrent =
                  currentMedia?.gifUrl?.includes(item.filename) ||
                  currentMedia?.aliases?.includes(item.title);
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
            {catalogResults.length} resultados disponibles en el catálogo
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-medium transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
