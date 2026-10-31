"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExerciseMedia } from "@/types/exercise-media";
import { MUSCLE_LABELS } from "@/lib/exercise-media";
import {
  FilmIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  PhotoIcon,
} from "./Icons";

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

interface ArtworkPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  initialMuscle?: string;
  currentGifUrl?: string;
  onMediaAssigned?: (media: ExerciseMedia) => void;
}

export function ArtworkPickerModal({
  isOpen,
  onClose,
  exerciseName,
  initialMuscle,
  currentGifUrl,
  onMediaAssigned,
}: ArtworkPickerModalProps) {
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isOpen || !exerciseName) return;

    setSuccessToast(null);
    setErrorToast(null);

    const cleanName = exerciseName.replace(/\s*\([^)]*\)/g, "").trim();
    setCatalogQuery(cleanName);

    const cat = (initialMuscle && MUSCLE_TO_CAT[initialMuscle]) || "all";
    setCatalogCategory(cat);

    executeCatalogSearch(cleanName, cat);
  }, [isOpen, exerciseName, initialMuscle, executeCatalogSearch]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleAssignArtwork = async (item: CatalogItem) => {
    setUpdatingId(item.id);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      const res = await fetch("/api/exercise-media/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName,
          gifUrl: item.cdnUrl,
          title: item.title,
          category: item.category,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const updatedMedia: ExerciseMedia = json.data;

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("exercise-media-updated", {
              detail: {
                exerciseName,
                media: updatedMedia,
              },
            })
          );
        }

        onMediaAssigned?.(updatedMedia);
        setSuccessToast(`¡Carátula guardada y sincronizada correctamente para ${exerciseName}!`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between gap-4 bg-zinc-900/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shrink-0">
              <FilmIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold">
                  Catálogo 3D (1.323 Modelos)
                </span>
              </div>
              <h3 className="text-base font-bold text-zinc-100 truncate mt-0.5">
                Elegir Carátula 3D para: <span className="text-accent-lighter">{exerciseName}</span>
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Notificaciones */}
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

        {/* Barra de Búsqueda y Filtros de Categoría */}
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

          {/* Categorías */}
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

        {/* Grid de Resultados */}
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
                  Boolean(currentGifUrl && (currentGifUrl.includes(item.filename) || currentGifUrl.includes(item.id)));
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

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono text-[11px]">
            {catalogResults.length} resultados encontrados en el catálogo
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
