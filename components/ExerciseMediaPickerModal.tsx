"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ExerciseMedia } from "@/types/exercise-media";
import {
  FilmIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  PhotoIcon,
  SparklesIcon,
  UploadCloudIcon,
  TrashIcon,
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

export interface UploadedMediaItem {
  id: string;
  filename: string;
  url: string;
  gifUrl: string;
  videoUrl?: string;
  posterUrl?: string;
  title: string;
  sizeBytes: number;
  mtime: number;
  isVideo: boolean;
  ext: string;
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

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  // Tabs: "catalog" (1.323 GymVisual 3D) o "uploaded" (archivos subidos propios)
  const [activeTab, setActiveTab] = useState<"catalog" | "uploaded">("catalog");

  // Estado Catálogo 3D
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Estado Contenido Subido
  const [uploadedItems, setUploadedItems] = useState<UploadedMediaItem[]>([]);
  const [loadingUploaded, setLoadingUploaded] = useState(false);
  const [uploadedFilter, setUploadedFilter] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado común
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Buscar en el catálogo anatómico 3D
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
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error al buscar en catálogo:", error);
        setErrorToast("No se pudo conectar con el catálogo de GIFs");
      } finally {
        setLoadingCatalog(false);
      }
    },
    []
  );

  // Cargar lista de archivos subidos
  const fetchUploadedMedia = useCallback(async () => {
    setLoadingUploaded(true);
    try {
      const res = await fetch("/api/exercise-media/upload");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUploadedItems(json.data);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error al cargar multimedia subido:", error);
    } finally {
      setLoadingUploaded(false);
    }
  }, []);

  // Inicializar al abrir el modal
  useEffect(() => {
    if (isOpen && exerciseName) {
      setSuccessToast(null);
      setErrorToast(null);

      const cleanName = exerciseName.replace(/\s*\([^)]*\)/g, "").trim();
      setCatalogQuery(cleanName);

      const cat = currentMedia?.primaryMuscle
        ? MUSCLE_TO_CAT[currentMedia.primaryMuscle] || "all"
        : "all";
      setCatalogCategory(cat);

      executeCatalogSearch(cleanName, cat);
      fetchUploadedMedia();
    } else if (!isOpen) {
      setCatalogResults([]);
      setSuccessToast(null);
      setErrorToast(null);
      setActiveTab("catalog");
    }
  }, [isOpen, exerciseName, currentMedia, executeCatalogSearch, fetchUploadedMedia]);

  // Subir archivo propio (GIF, MP4, WebM, PNG, JPG)
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setErrorToast(null);
    setSuccessToast(null);

    const isVideo =
      file.type.startsWith("video/") ||
      file.name.toLowerCase().endsWith(".mp4") ||
      file.name.toLowerCase().endsWith(".mov") ||
      file.name.toLowerCase().endsWith(".webm");

    setUploadProgressText(
      isVideo
        ? "Subiendo e interceptando vídeo MP4 para convertir a GIF con FFmpeg..."
        : "Subiendo archivo multimedia..."
    );

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (exerciseName) {
        formData.append("exerciseName", exerciseName);
      }

      const res = await fetch("/api/exercise-media/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data) {
        const item = json.data;
        setSuccessToast(
          isVideo
            ? `¡Vídeo "${file.name}" procesado con éxito y convertido a animación GIF!`
            : `¡Archivo "${file.name}" subido y listo para asignar!`
        );

        // Recargar lista completa de archivos subidos
        await fetchUploadedMedia();

        // Asignar inmediatamente al ejercicio
        if (exerciseName) {
          const updatedMedia: ExerciseMedia = {
            id: `custom-${file.name}`,
            name: exerciseName,
            aliases: [exerciseName],
            primaryMuscle: currentMedia?.primaryMuscle || "chest",
            secondaryMuscles: currentMedia?.secondaryMuscles || [],
            equipment: currentMedia?.equipment || "Other",
            gifUrl: item.gifUrl || item.url,
            videoUrl: item.videoUrl,
            posterUrl: item.posterUrl || item.gifUrl || item.url,
            difficulty: "intermediate",
          };

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
        }
      } else {
        setErrorToast(json.error || "Error al subir archivo");
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error al subir archivo:", error);
      setErrorToast(error.message || "Error al subir y procesar archivo");
    } finally {
      setIsUploading(false);
      setUploadProgressText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Asignar carátula seleccionada del catálogo
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

        setTimeout(() => {
          onClose();
        }, 850);
      } else {
        setErrorToast(json.error || "No se pudo actualizar la carátula");
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error al actualizar carátula:", error);
      setErrorToast(error.message || "Error al conectar con el servidor");
    } finally {
      setUpdatingId(null);
    }
  };

  // Asignar archivo propio previamente subido
  const handleAssignUploadedMedia = async (item: UploadedMediaItem) => {
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
          gifUrl: item.gifUrl || item.url,
          videoUrl: item.videoUrl,
          posterUrl: item.posterUrl,
          title: item.title,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const updatedMedia: ExerciseMedia = json.data;

        setSuccessToast(`¡Multimedia asignado con éxito a ${exerciseName}!`);

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

        setTimeout(() => {
          onClose();
        }, 850);
      } else {
        setErrorToast(json.error || "No se pudo asignar el archivo multimedia");
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error al asignar multimedia subido:", error);
      setErrorToast(error.message || "Error al conectar con el servidor");
    } finally {
      setUpdatingId(null);
    }
  };

  // Eliminar archivo subido
  const handleDeleteUploadedItem = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar definitivamente el archivo "${filename}" del servidor?`)) return;

    try {
      const res = await fetch(
        `/api/exercise-media/upload?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        setUploadedItems((prev) => prev.filter((i) => i.filename !== filename));
        setSuccessToast(`Archivo "${filename}" eliminado correctamente`);
      } else {
        setErrorToast(json.error || "Error al eliminar archivo");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorToast(error.message || "Error al conectar con el servidor");
    }
  };

  if (!isOpen) return null;

  // Filtrar archivos subidos según término de búsqueda
  const filteredUploadedItems = uploadedItems.filter((item) => {
    if (!uploadedFilter.trim()) return true;
    const q = uploadedFilter.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      item.filename.toLowerCase().includes(q)
    );
  });

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
                <span>Reasignar Carátula:</span>
                <span className="text-accent-light truncate font-mono">
                  {exerciseName}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                Elige entre las 1.300+ animaciones del catálogo o sube tu propio archivo multimedia (GIF o MP4).
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

        {/* Pestañas Principales: Catálogo 3D vs Contenido Subido */}
        <div className="flex items-center border-b border-zinc-800/80 bg-zinc-900/40 px-4 sm:px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "catalog"
                ? "border-accent text-accent-light"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Catálogo 3D (1.300+ GIFs)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("uploaded");
              fetchUploadedMedia();
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "uploaded"
                ? "border-accent text-accent-light"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <PhotoIcon className="w-4 h-4" />
            <span>Contenido Subido</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
              {uploadedItems.length}
            </span>
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

        {/* CONTENIDO PESTAÑA 1: CATÁLOGO 3D */}
        {activeTab === "catalog" && (
          <>
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
                    placeholder="Buscar en catálogo (ej: press banca, curl bíceps, sentadilla)..."
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

            {/* Grid de Resultados del Catálogo */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingCatalog ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                  <RefreshCwIcon className="w-8 h-8 animate-spin text-accent-light" />
                  <span>Explorando catálogo anatómico 3D...</span>
                </div>
              ) : catalogResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {catalogResults.map((item) => {
                    const isCurrent = Boolean(
                      currentMedia?.gifUrl?.includes(item.filename) ||
                      currentMedia?.aliases?.includes(item.title)
                    );
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
                    Prueba con otro término o sube tu propio archivo en la pestaña "Contenido Subido".
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* CONTENIDO PESTAÑA 2: CONTENIDO SUBIDO */}
        {activeTab === "uploaded" && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Zona de Subida Directa Drag & Drop */}
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/30 flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/gif,video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => {
                  if (!isUploading && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                className={`relative rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  isDragging
                    ? "border-accent bg-accent/10"
                    : "border-zinc-700/80 bg-zinc-900/60 hover:border-accent/60 hover:bg-zinc-900/90"
                } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
              >
                {isUploading ? (
                  <div className="py-3 flex flex-col items-center gap-2">
                    <RefreshCwIcon className="w-7 h-7 text-accent animate-spin" />
                    <span className="text-xs font-semibold text-accent-light">
                      {uploadProgressText || "Procesando archivo..."}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Esto puede tardar unos segundos según la duración del vídeo.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 text-accent-light flex items-center justify-center shadow-inner">
                      <UploadCloudIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-100">
                        Pulsa aquí o arrastra un archivo para subirlo
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Soporta <span className="text-zinc-200 font-semibold">GIF, MP4, WebM, PNG, JPG</span>. Los vídeos MP4 se convertirán a GIF animado automáticamente mediante FFmpeg.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Filtro de archivos subidos y contador */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-sm">
                  <SearchIcon className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={uploadedFilter}
                    onChange={(e) => setUploadedFilter(e.target.value)}
                    placeholder="Filtrar archivos subidos..."
                    className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent"
                  />
                  {uploadedFilter && (
                    <button
                      type="button"
                      onClick={() => setUploadedFilter("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={fetchUploadedMedia}
                  disabled={loadingUploaded}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Refrescar lista"
                >
                  <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingUploaded ? "animate-spin" : ""}`} />
                  <span>Refrescar</span>
                </button>
              </div>
            </div>

            {/* Grid de Archivos Subidos */}
            <div className="flex-1 p-4 sm:p-5">
              {loadingUploaded ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-xs text-zinc-500">
                  <RefreshCwIcon className="w-8 h-8 animate-spin text-accent-light" />
                  <span>Cargando archivos multimedia subidos...</span>
                </div>
              ) : filteredUploadedItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredUploadedItems.map((item) => {
                    const isCurrent = Boolean(
                      (item.filename && currentMedia?.gifUrl?.includes(item.filename)) ||
                      (item.filename && currentMedia?.videoUrl?.includes(item.filename)) ||
                      (item.gifUrl && currentMedia?.gifUrl === item.gifUrl)
                    );
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
                        {/* Contenedor Visual (Vídeo o GIF/Imagen) */}
                        <div className="relative aspect-square w-full rounded-xl bg-white overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shadow-inner">
                          {item.isVideo ? (
                            <video
                              src={item.url}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <img
                              src={item.url}
                              alt={item.title}
                              loading="lazy"
                              className="w-full h-full object-contain p-1"
                            />
                          )}

                          {/* Badge de formato */}
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase shadow-md bg-zinc-950/80 text-zinc-200 border border-zinc-700/80 backdrop-blur-md">
                            {item.ext.replace(".", "").toUpperCase()}
                          </div>

                          {/* Badge de asignado actual */}
                          {isCurrent && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-md flex items-center gap-1">
                              <CheckIcon className="w-3 h-3" />
                              <span>Actual</span>
                            </div>
                          )}

                          {/* Tamaño en la esquina inferior izquierda */}
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-zinc-950/80 text-[9px] font-mono text-zinc-400 border border-zinc-800 backdrop-blur-md">
                            {formatBytes(item.sizeBytes)}
                          </div>

                          {/* Botón de eliminar archivo */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteUploadedItem(item.filename, e)}
                            className="absolute bottom-2 right-2 w-6 h-6 rounded-md bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/50 flex items-center justify-center transition-colors cursor-pointer"
                            title="Eliminar archivo del servidor"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Título & Botón de asignación */}
                        <div className="pt-2.5 flex flex-col gap-2">
                          <h5
                            className="text-xs font-semibold text-zinc-200 truncate group-hover:text-accent-light transition-colors"
                            title={item.filename}
                          >
                            {item.title}
                          </h5>

                          <button
                            onClick={() => handleAssignUploadedMedia(item)}
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
                                <span>Asignando...</span>
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
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                  <PhotoIcon className="w-10 h-10 text-zinc-600" />
                  <p className="text-xs text-zinc-400">
                    {uploadedFilter
                      ? `No hay archivos que coincidan con "${uploadedFilter}"`
                      : "Aún no has subido ningún multimedia propio."}
                  </p>
                  <p className="text-[11px] text-zinc-500 max-w-sm">
                    Arrastra un archivo arriba o haz clic en la zona de subida para añadir tus propios vídeos (MP4) o animaciones (GIF).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer del Modal */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono text-[11px]">
            {activeTab === "catalog"
              ? `${catalogResults.length} resultados en el catálogo`
              : `${filteredUploadedItems.length} de ${uploadedItems.length} archivos subidos`}
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
