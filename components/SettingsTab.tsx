"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ImportResult } from "@/lib/csv-parser";
import {
  UploadCloudIcon,
  CheckIcon,
  RefreshCwIcon,
  TrashIcon,
  SettingsIcon,
  FilmIcon,
  CalendarIcon,
  PlusIcon,
  EditIcon,
  TrophyIcon,
  XIcon,
  DatabaseIcon,
  DownloadIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  PhotoIcon,
  UserIcon,
  ByteHevyLogo,
  ScaleIcon,
  QrCodeIcon,
  SparklesIcon,
} from "./Icons";
import { useSync } from "@/lib/sync-context";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { ExerciseMediaManager } from "./ExerciseMediaManager";
import { BiometricProfileSettings } from "./BiometricProfileSettings";
import { useSeason } from "@/lib/season-context";
import { Season } from "@/lib/actions";
import {
  SEASON_COLOR_PALETTE,
  getSeasonColor,
  hexToRgba,
} from "@/lib/season-colors";

interface DbRestoreResult {
  workoutsCount: number;
  exercisesCount: number;
  setsCount: number;
  seasonsCount: number;
  goalsCount: number;
  mediaPresentCount: number;
  mediaMissingCount: number;
  fileSizeFormatted: string;
}

interface MediaRestoreResult {
  processed: number;
  downloaded: number;
  alreadyValid: number;
  failed: number;
  diskUsageFormatted: string;
}

interface MediaCacheStatus {
  totalExercises: number;
  cachedCount: number;
  missingCount: number;
  missingList: string[];
  diskUsageFormatted: string;
  diskFilesCount: number;
}

type SettingsSubTab = "datos" | "perfil" | "temporadas" | "multimedia" | "apariencia";

interface SettingsTabProps {
  onSyncComplete?: () => void;
}

export function SettingsTab({ onSyncComplete }: SettingsTabProps) {
  const searchParams = useSearchParams();

  // Tab state with query param sync
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(() => {
    const tab = searchParams?.get("tab");
    if (tab === "perfil" || tab === "profile" || tab === "biometrics") return "perfil";
    if (tab === "temporadas" || tab === "seasons") return "temporadas";
    if (tab === "multimedia" || tab === "media") return "multimedia";
    if (tab === "apariencia" || tab === "appearance" || tab === "theme") return "apariencia";
    return "datos";
  });

  const handleSubTabChange = (tab: SettingsSubTab) => {
    setActiveSubTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Cloud Sync Context (Hevy + Xiaomi)
  const {
    hevyConnected,
    hevyHasRefreshToken,
    hevyUsername,
    lastHevySync,
    isHevySyncing,
    triggerHevySync,
    setHevyModalOpen,
    xiaomiConnected,
    xiaomiUserId,
    lastXiaomiSync,
    isXiaomiSyncing,
    triggerXiaomiSync,
    setXiaomiModalOpen,
    refreshStatuses,
  } = useSync();

  // CSV Sync state
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Season context & modal state
  const { seasons, activeSeasonId, setActiveSeasonId, refreshSeasons } = useSeason();
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);

  // SQLite .db Restore state
  const [dbDragActive, setDbDragActive] = useState(false);
  const [dbUploading, setDbUploading] = useState(false);
  const [dbResult, setDbResult] = useState<DbRestoreResult | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  // Media Cache Restore & Audit state
  const [mediaStatus, setMediaStatus] = useState<MediaCacheStatus | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaRestoring, setMediaRestoring] = useState(false);
  const [mediaForce, setMediaForce] = useState(false);
  const [mediaResult, setMediaResult] = useState<MediaRestoreResult | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const fetchMediaStatus = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await fetch("/api/exercise-media/restore");
      const json = await res.json();
      if (json.success && json.data) {
        setMediaStatus(json.data);
      }
    } catch (e) {
      console.error("Error al cargar estado de caché de imágenes:", e);
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/exercise-media/restore")
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && json.data) {
          setMediaStatus(json.data);
        }
      })
      .catch((e) => {
        console.error("Error al cargar estado de caché de imágenes:", e);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Season form state
  const [seasonForm, setSeasonForm] = useState<{
    name: string;
    startDate: string;
    isOngoing: boolean;
    endDate: string;
    description: string;
    color: string;
  }>({
    name: "",
    startDate: "",
    isOngoing: true,
    endDate: "",
    description: "",
    color: "#3b82f6",
  });
  const [seasonSubmitting, setSeasonSubmitting] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  // CSV Handlers
  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        await refreshSeasons();
        await refreshStatuses();
        await fetchMediaStatus();
        if (onSyncComplete) onSyncComplete();
      } else {
        setError(json.error || "Error al procesar el archivo CSV");
      }
    } catch (e: any) {
      console.error("Upload error:", e);
      setError(e.message || "Error en la subida del archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearDb = async () => {
    if (!confirm("¿Seguro que deseas vaciar todos los entrenamientos de la base de datos SQLite?")) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/sync", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setResult(null);
        setDbResult(null);
        await refreshSeasons();
        await refreshStatuses();
        await fetchMediaStatus();
        alert("Base de datos SQLite reiniciada con éxito.");
        if (onSyncComplete) onSyncComplete();
      }
    } catch (e) {
      console.error("Error clearing db:", e);
    } finally {
      setClearing(false);
    }
  };

  // SQLite .db Restore Handlers
  const handleDbFile = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isDb = lowerName.endsWith(".db") || lowerName.endsWith(".sqlite") || lowerName.endsWith(".sqlite3");
    if (!isDb) {
      setDbError("Por favor selecciona un archivo con extensión .db, .sqlite o .sqlite3");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de que deseas restaurar la base de datos con "${file.name}"?\n\nSe creará una copia de seguridad automática de tus datos actuales antes de reemplazarla.`
      )
    ) {
      return;
    }

    setDbUploading(true);
    setDbError(null);
    setDbResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/database/restore", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setDbResult(json.data);
        await refreshSeasons();
        await refreshStatuses();
        await fetchMediaStatus();
        if (onSyncComplete) onSyncComplete();
      } else {
        setDbError(json.error || "Error al restaurar la base de datos");
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error("DB restore error:", err);
      setDbError(err.message || "Error al subir y restaurar la base de datos");
    } finally {
      setDbUploading(false);
    }
  };

  const handleDbDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDbDragActive(true);
    } else if (e.type === "dragleave") {
      setDbDragActive(false);
    }
  };

  const handleDbDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDbDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleDbFile(e.dataTransfer.files[0]);
    }
  };

  // Media Restore & Cache Handlers
  const handleRestoreMedia = async () => {
    setMediaRestoring(true);
    setMediaError(null);
    setMediaResult(null);

    try {
      const res = await fetch("/api/exercise-media/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: mediaForce }),
      });
      const json = await res.json();
      if (json.success) {
        setMediaResult(json.data);
        await fetchMediaStatus();
      } else {
        setMediaError(json.error || "Error al sincronizar imágenes multimedia");
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error("Media restore error:", err);
      setMediaError(err.message || "Error de red al sincronizar imágenes multimedia");
    } finally {
      setMediaRestoring(false);
    }
  };

  const handleCustomMediaUpload = async (file: File) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/exercise-media/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        await fetchMediaStatus();
        alert(`Imagen "${file.name}" guardada con éxito en public/media/exercises/`);
      } else {
        alert(json.error || "Error al subir archivo de imagen");
      }
    } catch (e: unknown) {
      const err = e as Error;
      alert(err.message || "Error al subir archivo de imagen");
    }
  };

  // Seasons Management Handlers
  const openNewSeasonModal = () => {
    setEditingSeason(null);
    const today = new Date().toISOString().split("T")[0];
    setSeasonForm({
      name: "",
      startDate: today,
      isOngoing: true,
      endDate: "",
      description: "",
      color: "#3b82f6",
    });
    setSeasonError(null);
    setIsSeasonModalOpen(true);
  };

  const openEditSeasonModal = (season: Season) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      startDate: season.startDate,
      isOngoing: !season.endDate,
      endDate: season.endDate || "",
      description: season.description || "",
      color: getSeasonColor(season),
    });
    setSeasonError(null);
    setIsSeasonModalOpen(true);
  };

  const handleSaveSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonForm.name.trim() || !seasonForm.startDate) {
      setSeasonError("Por favor completa el nombre y la fecha de inicio.");
      return;
    }

    setSeasonSubmitting(true);
    setSeasonError(null);

    try {
      const payload = {
        name: seasonForm.name.trim(),
        startDate: seasonForm.startDate,
        endDate: seasonForm.isOngoing ? null : seasonForm.endDate || null,
        description: seasonForm.description.trim(),
        color: seasonForm.color || null,
      };

      let res: Response;
      if (editingSeason) {
        res = await fetch("/api/seasons", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingSeason.id, ...payload }),
        });
      } else {
        res = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Error al guardar la temporada");
      }

      await refreshSeasons();
      if (!editingSeason && json.data?.id) {
        setActiveSeasonId(json.data.id);
      }
      setIsSeasonModalOpen(false);
    } catch (err: any) {
      console.error("Season save error:", err);
      setSeasonError(err.message || "Error al guardar temporada");
    } finally {
      setSeasonSubmitting(false);
    }
  };

  const handleDeleteSeason = async (season: Season) => {
    if (!confirm(`¿Eliminar la temporada "${season.name}"? Los entrenamientos continuarán en la base de datos.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/seasons?id=${encodeURIComponent(season.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        if (activeSeasonId === season.id) {
          setActiveSeasonId("all");
        }
        await refreshSeasons();
      } else {
        alert(json.error || "No se pudo eliminar la temporada");
      }
    } catch (err) {
      console.error("Season delete error:", err);
      alert("Error al eliminar la temporada");
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      if (y && m && d) {
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch (e) {}
    return dateStr;
  };

  const getSeasonDuration = (startStr: string, endStr: string | null) => {
    try {
      const start = new Date(startStr);
      const end = endStr ? new Date(endStr) : new Date();
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 365) {
        const years = (diffDays / 365).toFixed(1);
        return `${years} años (${diffDays} días)`;
      }
      if (diffDays >= 30) {
        const months = Math.round(diffDays / 30);
        return `${months} ${months === 1 ? "mes" : "meses"} (${diffDays} días)`;
      }
      return `${diffDays} días`;
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="py-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Selector de Sub-pestañas Protagonista */}
      <div className="w-full flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md overflow-x-auto shadow-md">
        <button
          onClick={() => handleSubTabChange("datos")}
          className={`flex-1 min-w-[140px] sm:min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "datos"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <UploadCloudIcon className="w-4 h-4 text-accent-light shrink-0" />
          <span>Datos & Conexiones</span>
        </button>

        <button
          onClick={() => handleSubTabChange("perfil")}
          className={`flex-1 min-w-[140px] sm:min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "perfil"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <UserIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Perfil Biométrico</span>
        </button>

        <button
          onClick={() => handleSubTabChange("temporadas")}
          className={`flex-1 min-w-[140px] sm:min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "temporadas"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Temporadas</span>
          {seasons.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 shrink-0">
              {seasons.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleSubTabChange("multimedia")}
          className={`flex-1 min-w-[140px] sm:min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "multimedia"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <FilmIcon className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Multimedia 3D</span>
          {mediaStatus && mediaStatus.missingCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title={`${mediaStatus.missingCount} pendientes`} />
          )}
        </button>

        <button
          onClick={() => handleSubTabChange("apariencia")}
          className={`flex-1 min-w-[140px] sm:min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "apariencia"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <SparklesIcon className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Apariencia</span>
        </button>
      </div>

      {/* =========================================================================
          SUB-TAB 1: DATOS Y CONEXIONES (CSV PRIMERO, LUEGO LAS CONEXIONES)
         ========================================================================= */}
      {activeSubTab === "datos" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* 1. PRIMERO: Importador Manual de Archivos CSV */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shrink-0">
                  <UploadCloudIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">1. Importación Manual de Archivos (CSV)</h3>
                  <p className="text-xs text-zinc-400">
                    Carga directa y sin conexión de tu archivo de exportación .csv de Hevy.
                  </p>
                </div>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-9 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                dragActive
                  ? "border-accent-light bg-accent/10 scale-[1.01]"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50 shadow-inner"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-accent-light mb-3 shadow-md">
                <UploadCloudIcon className="w-6 h-6" />
              </div>

              <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                {uploading ? "Procesando archivo CSV..." : "Haz clic o arrastra tu exportación de Hevy aquí"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Deduplicación automática por ID y fecha. Los datos existentes no se sobrescriben repetidamente.
              </p>

              {uploading && (
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-accent-light">
                  <RefreshCwIcon className="w-4 h-4 animate-spin" />
                  <span>Parseando sesiones y deduplicando...</span>
                </div>
              )}
            </div>

            {/* Result feedback */}
            {result && (
              <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <CheckIcon className="w-5 h-5" />
                  <span>Sincronización completada exitosamente</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono tabular-nums">
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px] font-sans">Nuevos Entrenamientos</span>
                    <span className="text-base font-bold text-zinc-100">+{result.newWorkouts}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px] font-sans">Entrenamientos Omitidos</span>
                    <span className="text-base font-bold text-zinc-400">{result.skippedWorkouts}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px] font-sans">Nuevas Series</span>
                    <span className="text-base font-bold text-zinc-100">+{result.newSets}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px] font-sans">Filas Leídas</span>
                    <span className="text-base font-bold text-zinc-400">{result.totalRows}</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
                <strong>Error de importación:</strong> {error}
              </div>
            )}
          </section>

          {/* 2. LUEGO: Conexiones Cloud & Integraciones (Hevy + Xiaomi) */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <RefreshCwIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  2. Conexiones Cloud & Integraciones
                </h3>
                <p className="text-xs text-zinc-400">
                  Gestiona tus accesos remotos y sincroniza entrenamientos y pesajes con 1 clic.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta 1: Hevy */}
              <div className="p-5 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/20 via-zinc-900/40 to-zinc-900/60 backdrop-blur-md flex flex-col justify-between gap-4 shadow-lg">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-md">
                    <ByteHevyLogo className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-zinc-100">Hevy Cloud</h4>
                      {hevyConnected ? (
                        hevyHasRefreshToken ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Sesión permanente con auto-renovación continua">
                            <CheckCircleIcon className="w-3 h-3" />
                            Permanente {hevyUsername ? `@${hevyUsername}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Token temporal (expira en ~1 hora sin refresh_token)">
                            <AlertTriangleIcon className="w-3 h-3" />
                            Temporal (~1h) {hevyUsername ? `@${hevyUsername}` : ""}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                          Desconectado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {hevyConnected
                        ? `Última sinc: ${lastHevySync || "Reciente"}. ${
                            hevyHasRefreshToken
                              ? "Auto-renovación continua activa."
                              : "Sesión temporal de 1 hora."
                          } Descarga directa a SQLite.`
                        : "Conecta tu cuenta para sincronizar tus entrenamientos de Hevy con 1 clic."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 justify-end">
                  {hevyConnected ? (
                    <>
                      <button
                        onClick={triggerHevySync}
                        disabled={isHevySyncing}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
                      >
                        <RefreshCwIcon className={`w-3.5 h-3.5 ${isHevySyncing ? "animate-spin" : ""}`} />
                        <span>{isHevySyncing ? "Sincronizando..." : "Sincronizar Hevy"}</span>
                      </button>
                      <button
                        onClick={() => setHevyModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700/80 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-xs font-semibold transition-colors cursor-pointer"
                        title="Gestionar estado de conexión con Hevy"
                      >
                        <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Ajustes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setHevyModalOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <UploadCloudIcon className="w-3.5 h-3.5" />
                      <span>Conectar con Hevy</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tarjeta 2: Xiaomi Mi Scale / Zepp */}
              <div className="p-5 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/20 via-zinc-900/40 to-zinc-900/60 backdrop-blur-md flex flex-col justify-between gap-4 shadow-lg">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#FF6900]/20 to-[#FF6900]/10 border border-[#FF6900]/30 flex items-center justify-center text-[#FF6900] shrink-0 shadow-md">
                    <ScaleIcon className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-zinc-100">Xiaomi Mi Scale / Zepp</h4>
                      {xiaomiConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircleIcon className="w-3 h-3" />
                          Conectado {xiaomiUserId ? `(${xiaomiUserId})` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                          Desconectado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {xiaomiConnected
                        ? `Última sinc: ${lastXiaomiSync || "Reciente"}. Sincroniza peso, grasa corporal y bioimpedancia.`
                        : "Inicia sesión con tu cuenta de Xiaomi o Zepp mediante código QR para sincronizar tu báscula."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 justify-end">
                  {xiaomiConnected ? (
                    <>
                      <button
                        onClick={triggerXiaomiSync}
                        disabled={isXiaomiSyncing}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FF6900] hover:bg-[#e05d00] text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
                      >
                        <RefreshCwIcon className={`w-3.5 h-3.5 ${isXiaomiSyncing ? "animate-spin" : ""}`} />
                        <span>{isXiaomiSyncing ? "Sincronizando..." : "Sincronizar Xiaomi"}</span>
                      </button>
                      <button
                        onClick={() => setXiaomiModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700/80 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-xs font-semibold transition-colors cursor-pointer"
                        title="Configurar conexión con Xiaomi"
                      >
                        <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Ajustes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setXiaomiModalOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FF6900] hover:bg-[#e05d00] text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <QrCodeIcon className="w-3.5 h-3.5" />
                      <span>Conectar Xiaomi (QR)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Copias de Seguridad y Base de Datos SQLite (.db) */}
          <section className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light shrink-0">
                  <DatabaseIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    3. Base de Datos SQLite (.db) y Copias de Seguridad
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Descarga una copia completa de tu archivo <code className="text-zinc-300 font-mono">bytehevy.db</code> o restaura un respaldo previo.
                  </p>
                </div>
              </div>

              <a
                href="/api/database/backup"
                download
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-sm self-start sm:self-center shrink-0"
                title="Descargar copia de seguridad actual de bytehevy.db"
              >
                <DownloadIcon className="w-4 h-4 text-accent-light" />
                <span>Descargar Copia (.db)</span>
              </a>
            </div>

            {/* Dropzone para .db */}
            <div
              onDragEnter={handleDbDrag}
              onDragLeave={handleDbDrag}
              onDragOver={handleDbDrag}
              onDrop={handleDbDrop}
              onClick={() => dbFileInputRef.current?.click()}
              className={`p-9 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                dbDragActive
                  ? "border-accent-light bg-accent/10 scale-[1.01]"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50 shadow-inner"
              }`}
            >
              <input
                ref={dbFileInputRef}
                type="file"
                accept=".db,.sqlite,.sqlite3"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleDbFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-accent-light mb-3 shadow-md">
                <DatabaseIcon className="w-6 h-6" />
              </div>

              <h4 className="text-sm font-semibold text-zinc-200 mb-1">
                {dbUploading
                  ? "Validando integridad y restaurando base de datos SQLite..."
                  : "Arrastra y suelta tu archivo .db aquí o haz clic para explorar"}
              </h4>
              <p className="text-xs text-zinc-500 max-w-sm">
                Admite archivos SQLite 3 (<span className="text-zinc-400 font-mono">.db, .sqlite</span>). Se generará automáticamente un respaldo previo de tus datos.
              </p>
            </div>

            {/* Error de restauración de DB */}
            {dbError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-start gap-3">
                <AlertTriangleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-200">Error en la restauración de la base de datos</p>
                  <p className="mt-0.5 text-red-300/90">{dbError}</p>
                </div>
              </div>
            )}

            {/* Éxito de restauración de DB */}
            {dbResult && (
              <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>Base de datos SQLite restaurada correctamente ({dbResult.fileSizeFormatted})</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1">
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="block text-base font-bold text-zinc-100">{dbResult.workoutsCount}</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Entrenamientos</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="block text-base font-bold text-zinc-100">{dbResult.exercisesCount}</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Ejercicios</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="block text-base font-bold text-zinc-100">{dbResult.setsCount}</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Series</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="block text-base font-bold text-zinc-100">{dbResult.seasonsCount}</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Temporadas</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="block text-base font-bold text-zinc-100">{dbResult.goalsCount}</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Objetivos</span>
                  </div>
                </div>

                {dbResult.mediaMissingCount > 0 ? (
                  <div className="mt-1 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Atención:</strong> {dbResult.mediaMissingCount} de los {dbResult.exercisesCount} ejercicios no tienen animación 3D en disco.
                      </span>
                    </div>
                    <button
                      onClick={() => handleSubTabChange("multimedia")}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      Ir a Multimedia 3D
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-emerald-400/90 flex items-center gap-1.5">
                    <CheckIcon className="w-3.5 h-3.5" />
                    <span>Todas las animaciones 3D están verificadas y disponibles localmente ({dbResult.mediaPresentCount} ejercicios).</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 4. Mantenimiento y Zona de Peligro */}
          <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Almacenamiento Local Autónomo
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tus datos residen en <code className="text-zinc-300 font-mono">data/bytehevy.db</code> y los vídeos 3D en <code className="text-zinc-300 font-mono">public/media/exercises/</code>.
              </p>
            </div>

            <button
              onClick={handleClearDb}
              disabled={clearing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer self-start sm:self-center disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              <span>{clearing ? "Vaciando..." : "Vaciar entrenamientos"}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: GESTOR DE TEMPORADAS (SEASONS)
         ========================================================================= */}
      {activeSubTab === "temporadas" && (
        <section className="flex flex-col gap-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Gestor de Seasons (Temporadas)</h3>
                <p className="text-xs text-zinc-400">
                  Aísla tus etapas de entrenamiento para eliminar distorsiones de periodos de inactividad o comparar fases.
                </p>
              </div>
            </div>

            <button
              onClick={openNewSeasonModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-xs shadow-md transition-all cursor-pointer self-start sm:self-center shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Nueva Season</span>
            </button>
          </div>

          {/* Global/Historical Card */}
          <div
            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              !activeSeasonId || activeSeasonId === "all"
                ? "bg-zinc-900/90 border-amber-500/40 ring-1 ring-amber-500/20 shadow-md"
                : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-amber-400 shrink-0">
                <TrophyIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-100">Histórico Completo</h4>
                  {(!activeSeasonId || activeSeasonId === "all") && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Activa
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Muestra todos los entrenamientos y récords acumulados de toda tu vida deportiva.
                </p>
              </div>
            </div>

            {activeSeasonId && activeSeasonId !== "all" && (
              <button
                onClick={() => setActiveSeasonId("all")}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer self-start sm:self-center shrink-0"
              >
                Activar Histórico
              </button>
            )}
          </div>

          {/* Seasons Cards Grid */}
          {seasons.length === 0 ? (
            <div className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/60 flex items-center justify-center text-zinc-500">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">No hay seasons definidas todavía</h4>
                <p className="text-xs text-zinc-400 max-w-md mt-1">
                  Crea seasons (por ejemplo: por años, etapas de volumen/definición o bloques tras una pausa) para analizar tu progresión y récords de forma aislada.
                </p>
              </div>
              <button
                onClick={openNewSeasonModal}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 text-amber-400" />
                <span>Crear mi primera season</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {seasons.map((season) => {
                const isActive = activeSeasonId === season.id;
                const duration = getSeasonDuration(season.startDate, season.endDate);
                const seasonColor = getSeasonColor(season);

                return (
                  <div
                    key={season.id}
                    style={
                      isActive
                        ? {
                            borderColor: hexToRgba(seasonColor, 0.45),
                            backgroundColor: hexToRgba(seasonColor, 0.05),
                            boxShadow: `0 0 20px ${hexToRgba(seasonColor, 0.12)}`,
                          }
                        : undefined
                    }
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isActive
                        ? "ring-1"
                        : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {/* Top info */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-white/10"
                              style={{ backgroundColor: seasonColor }}
                              title={`Color: ${seasonColor}`}
                            />
                            <h4 className="text-sm font-bold text-zinc-100 truncate">{season.name}</h4>
                            {isActive && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0"
                                style={{
                                  backgroundColor: hexToRgba(seasonColor, 0.18),
                                  color: seasonColor,
                                  borderColor: hexToRgba(seasonColor, 0.35),
                                }}
                              >
                                Activa
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap font-mono">
                            <span>{formatDateDisplay(season.startDate)}</span>
                            <span className="text-zinc-600">→</span>
                            <span
                              style={!season.endDate ? { color: seasonColor, fontWeight: 600 } : undefined}
                            >
                              {season.endDate ? formatDateDisplay(season.endDate) : "Actualidad"}
                            </span>
                            {duration && <span className="text-zinc-500 font-sans">({duration})</span>}
                          </div>
                        </div>

                        {/* Workout count badge */}
                        <div className="px-2.5 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-[11px] font-mono text-zinc-300 shrink-0 text-center">
                          <span className="font-bold text-zinc-100">{season.workoutCount ?? 0}</span>
                          <span className="text-zinc-500 text-[10px] block font-sans">entrenos</span>
                        </div>
                      </div>

                      {season.description && (
                        <p className="text-xs text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed">
                          {season.description}
                        </p>
                      )}
                    </div>

                    {/* Actions footer */}
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                      <div>
                        {isActive ? (
                          <span
                            className="text-[11px] font-medium flex items-center gap-1.5"
                            style={{ color: seasonColor }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full animate-pulse"
                              style={{ backgroundColor: seasonColor }}
                            />
                            Filtrando la app
                          </span>
                        ) : (
                          <button
                            onClick={() => setActiveSeasonId(season.id)}
                            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Activar
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditSeasonModal(season)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Editar temporada"
                        >
                          <EditIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSeason(season)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Eliminar temporada"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          SUB-TAB 3: MULTIMEDIA 3D & CARÁTULAS
         ========================================================================= */}
      {activeSubTab === "multimedia" && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* Panel dedicado de Restauración y Auditoría de Caché */}
          <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <PhotoIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>Caché y Restauración de Animaciones 3D</span>
                    {mediaStatus && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          mediaStatus.missingCount === 0
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        }`}
                      >
                        {mediaStatus.missingCount === 0
                          ? "100% Sincronizado"
                          : `${mediaStatus.missingCount} pendientes`}
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Verifica que las animaciones de <code className="text-zinc-300 font-mono">public/media/exercises/</code> coincidan con tus ejercicios o descárgalas desde el CDN si faltan.
                  </p>
                </div>
              </div>

              <button
                onClick={fetchMediaStatus}
                disabled={mediaLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-xs transition-colors cursor-pointer self-start sm:self-center shrink-0 disabled:opacity-50"
                title="Auditar archivos multimedia en disco"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${mediaLoading ? "animate-spin" : ""}`} />
                <span>Verificar Estado</span>
              </button>
            </div>

            {/* Métricas de estado de medios */}
            {mediaStatus && (
              <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase tracking-wider font-semibold">Ejercicios en disco</span>
                    <span className="font-semibold text-zinc-200">
                      {mediaStatus.cachedCount} / {mediaStatus.totalExercises} listos
                    </span>
                  </div>
                  <div className="w-px h-6 bg-zinc-800 hidden sm:block" />
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase tracking-wider font-semibold">Espacio en disco</span>
                    <span className="font-semibold text-zinc-200">{mediaStatus.diskUsageFormatted}</span>
                  </div>
                  {mediaStatus.missingCount > 0 && (
                    <>
                      <div className="w-px h-6 bg-zinc-800 hidden sm:block" />
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase tracking-wider font-semibold">Faltantes</span>
                        <span className="font-semibold text-amber-400">{mediaStatus.missingCount} ejercicios</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={mediaFileInputRef}
                    accept=".gif,.mp4,.webm,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCustomMediaUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    onClick={() => mediaFileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                    title="Subir un archivo .gif o de vídeo local directamente"
                  >
                    + Subir GIF local
                  </button>
                </div>
              </div>
            )}

            {/* Opciones y botón de acción */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mediaForce}
                  onChange={(e) => setMediaForce(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-accent focus:ring-accent/30"
                />
                <span>Forzar regeneración completa (re-descargar todas las imágenes desde CDN)</span>
              </label>

              <button
                onClick={handleRestoreMedia}
                disabled={mediaRestoring}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-zinc-950 font-semibold text-xs transition-all shadow-md cursor-pointer self-start sm:self-center shrink-0 disabled:opacity-50"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${mediaRestoring ? "animate-spin" : ""}`} />
                <span>
                  {mediaRestoring
                    ? "Sincronizando imágenes 3D..."
                    : mediaForce
                    ? "Re-descargar Todo el Catálogo"
                    : "Reparar y Sincronizar Imágenes"}
                </span>
              </button>
            </div>

            {/* Feedback de resultado de restauración de imágenes */}
            {mediaResult && (
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-300 flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-200">Sincronización de imágenes finalizada</p>
                  <p className="text-emerald-300/90 mt-0.5">
                    {mediaResult.downloaded} imágenes descargadas/actualizadas, {mediaResult.alreadyValid} ya estaban listas ({mediaResult.diskUsageFormatted} en disco).
                    {mediaResult.failed > 0 && ` (${mediaResult.failed} descargas pendientes por conexión)`}
                  </p>
                </div>
              </div>
            )}

            {mediaError && (
              <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2.5">
                <AlertTriangleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-200">Error al sincronizar imágenes</p>
                  <p className="text-red-300/90 mt-0.5">{mediaError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Gestor y buscador interactivo de carátulas 3D por ejercicio */}
          <div>
            <div className="mb-3">
              <h4 className="text-sm font-bold text-zinc-200">Buscador y Personalizador de Carátulas</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Elige qué animación o vídeo 3D se muestra para cada ejercicio de tu biblioteca.
              </p>
            </div>
            <ExerciseMediaManager />
          </div>
        </section>
      )}

      {/* =========================================================================
          SUB-TAB: PERFIL BIOMÉTRICO
         ========================================================================= */}
      {activeSubTab === "perfil" && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-150">
          <BiometricProfileSettings />
        </section>
      )}

      {/* =========================================================================
          SUB-TAB: APARIENCIA & TEMAS
         ========================================================================= */}
      {activeSubTab === "apariencia" && (
        <section className="flex flex-col gap-6 animate-in fade-in duration-150">
          <ThemeCustomizer />
        </section>
      )}

      {/* Season Modal (Create / Edit) */}
      {isSeasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col gap-4 text-zinc-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" style={{ color: seasonForm.color }} />
                <span>{editingSeason ? "Editar Season" : "Nueva Season"}</span>
              </h3>
              <button
                onClick={() => setIsSeasonModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {seasonError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {seasonError}
              </div>
            )}

            <form onSubmit={handleSaveSeason} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Nombre de la season *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Season 2024, Vuelta al grind, Pre-Competición..."
                  value={seasonForm.name}
                  onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={seasonForm.startDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    disabled={seasonForm.isOngoing}
                    value={seasonForm.endDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border text-zinc-100 font-mono transition-colors ${
                      seasonForm.isOngoing
                        ? "border-zinc-800/40 opacity-40 cursor-not-allowed"
                        : "border-zinc-800 focus:outline-none focus:border-amber-500"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ongoingSeasonCheckbox"
                  checked={seasonForm.isOngoing}
                  onChange={(e) =>
                    setSeasonForm({
                      ...seasonForm,
                      isOngoing: e.target.checked,
                      endDate: e.target.checked ? "" : seasonForm.endDate,
                    })
                  }
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 bg-zinc-950 cursor-pointer"
                />
                <label
                  htmlFor="ongoingSeasonCheckbox"
                  className="text-zinc-300 cursor-pointer select-none"
                >
                  Season en curso (hasta la actualidad)
                </label>
              </div>

              {/* Selector de Color de Season */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-zinc-300 font-medium">
                    Color de la season
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-zinc-700 shadow-xs"
                      style={{ backgroundColor: seasonForm.color }}
                    />
                    <span className="font-mono text-[11px] text-zinc-400 uppercase">
                      {seasonForm.color}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  {SEASON_COLOR_PALETTE.map((pal) => {
                    const isSelected = seasonForm.color.toLowerCase() === pal.hex.toLowerCase();
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setSeasonForm({ ...seasonForm, color: pal.hex })}
                        title={pal.label}
                        className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center cursor-pointer relative ${
                          isSelected
                            ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110 shadow-lg"
                            : "hover:scale-105 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: pal.hex }}
                      >
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}

                  {/* Custom Color Input */}
                  <label
                    title="Seleccionar color personalizado"
                    className="w-7 h-7 rounded-lg border border-zinc-700 hover:border-zinc-500 bg-zinc-900 flex items-center justify-center cursor-pointer relative overflow-hidden transition-all hover:scale-105"
                  >
                    <input
                      type="color"
                      value={seasonForm.color}
                      onChange={(e) => setSeasonForm({ ...seasonForm, color: e.target.value })}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-zinc-400">#</span>
                  </label>
                </div>

                {/* Live Badge Preview */}
                <div className="mt-2 p-2 rounded-xl bg-zinc-950/70 border border-zinc-850 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Vista previa en la app:</span>
                  <span
                    className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold flex items-center gap-1.5 border shadow-xs"
                    style={{
                      backgroundColor: hexToRgba(seasonForm.color, 0.16),
                      borderColor: hexToRgba(seasonForm.color, 0.4),
                      color: seasonForm.color,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: seasonForm.color }}
                    />
                    <span>{seasonForm.name.trim() || "Nombre de Season"}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Descripción u objetivos (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Periodo de hipertrofia enfocado en torso..."
                  value={seasonForm.description}
                  onChange={(e) => setSeasonForm({ ...seasonForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSeasonModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={seasonSubmitting}
                  style={{ backgroundColor: seasonForm.color }}
                  className="px-4 py-2 rounded-xl text-zinc-950 font-bold transition-all hover:brightness-110 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {seasonSubmitting
                    ? "Guardando..."
                    : editingSeason
                    ? "Actualizar Season"
                    : "Crear Season"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
