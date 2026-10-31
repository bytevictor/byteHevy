"use client";

import React, { useState, useRef } from "react";
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
} from "./Icons";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { ExerciseMediaManager } from "./ExerciseMediaManager";
import { useSeason } from "@/lib/season-context";
import { Season } from "@/lib/actions";

interface SettingsTabProps {
  onSyncComplete?: () => void;
}

export function SettingsTab({ onSyncComplete }: SettingsTabProps) {
  // Sync state
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showMediaManager, setShowMediaManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Season context & modal state
  const { seasons, activeSeasonId, setActiveSeasonId, refreshSeasons } = useSeason();
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonForm, setSeasonForm] = useState<{
    name: string;
    startDate: string;
    isOngoing: boolean;
    endDate: string;
    description: string;
  }>({
    name: "",
    startDate: "",
    isOngoing: true,
    endDate: "",
    description: "",
  });
  const [seasonSubmitting, setSeasonSubmitting] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

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
        await refreshSeasons();
        alert("Base de datos SQLite reiniciada con éxito.");
        if (onSyncComplete) onSyncComplete();
      }
    } catch (e) {
      console.error("Error clearing db:", e);
    } finally {
      setClearing(false);
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
      // If creating new, automatically activate it
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

  // Helper to format date nicely
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

  // Helper to calculate days or duration
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
    <div className="py-6 max-w-4xl mx-auto flex flex-col gap-8">
      {/* 1. Header with Appearance & 3D Media shortcuts */}
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5 text-accent-light" />
            <span>Configuración del Sistema</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Actualiza tus datos de Hevy, define tus temporadas de entrenamiento para aislar tus marcas y personaliza la estética visual.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center shrink-0">
          <button
            onClick={() => setShowMediaManager((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
              showMediaManager
                ? "bg-accent/15 border-accent/40 text-accent-light ring-1 ring-accent/20"
                : "bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
            title="Editar y buscar carátulas/vídeos 3D de ejercicios"
          >
            <FilmIcon
              className={`w-4 h-4 transition-transform duration-300 ${
                showMediaManager ? "scale-110 text-accent-light" : "text-zinc-400"
              }`}
            />
            <span>{showMediaManager ? "Ocultar Carátulas 3D" : "Carátulas & Vídeos 3D"}</span>
          </button>

          <button
            onClick={() => setShowAppearance((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
              showAppearance
                ? "bg-accent/15 border-accent/40 text-accent-light ring-1 ring-accent/20"
                : "bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
            title="Configurar temas y color secundario"
          >
            <SettingsIcon
              className={`w-4 h-4 transition-transform duration-300 ${
                showAppearance ? "rotate-90 text-accent-light" : "text-zinc-400"
              }`}
            />
            <span>{showAppearance ? "Ocultar Apariencia" : "Personalizar Apariencia"}</span>
          </button>
        </div>
      </div>

      {/* Exercise Cover Art & 3D Media Manager */}
      {showMediaManager && <ExerciseMediaManager />}

      {/* Theme & Appearance Customizer */}
      {showAppearance && <ThemeCustomizer />}

      {/* 2. Top / Central Section: Sincronización y Actualizador de Datos CSV */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light">
              <UploadCloudIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Actualizador de Datos (CSV)</h3>
              <p className="text-xs text-zinc-400">
                Sube tu exportación periódica de la app oficial de Hevy para incorporar nuevos entrenamientos.
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

      {/* 3. Below: Gestor de SEASONS (Temporadas de Entrenamiento) */}
      <section className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Gestor de Seasons</h3>
              <p className="text-xs text-zinc-400">
                Aísla tus etapas de entrenamiento para eliminar distorsiones de periodos de inactividad.
              </p>
            </div>
          </div>

          <button
            onClick={openNewSeasonModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-xs shadow-md transition-all cursor-pointer self-start sm:self-center"
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
                Crea seasons (por ejemplo: por años, etapas de preparación o bloques tras una pausa) para analizar tu progresión y récords de forma aislada.
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

              return (
                <div
                  key={season.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isActive
                      ? "bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20 shadow-md"
                      : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Top info */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-100 truncate">{season.name}</h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                              Activa
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap font-mono">
                          <span>{formatDateDisplay(season.startDate)}</span>
                          <span className="text-zinc-600">→</span>
                          <span className={!season.endDate ? "text-amber-400 font-semibold" : ""}>
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
                        <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Filtrando la app
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveSeasonId(season.id)}
                          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
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

      {/* 4. Bottom: Maintenance Box */}
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

      {/* Season Modal (Create / Edit) */}
      {isSeasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col gap-4 text-zinc-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-amber-400" />
                <span>{editingSeason ? "Editar Temporada" : "Nueva Temporada"}</span>
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
                  Nombre de la temporada *
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
                  Temporada en curso (hasta la actualidad)
                </label>
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
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {seasonSubmitting
                    ? "Guardando..."
                    : editingSeason
                    ? "Actualizar Temporada"
                    : "Crear Temporada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

