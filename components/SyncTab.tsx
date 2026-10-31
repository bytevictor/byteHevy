"use client";

import React, { useState, useRef } from "react";
import { ImportResult } from "@/lib/csv-parser";
import { UploadCloudIcon, CheckIcon, RefreshCwIcon, TrashIcon, InfoIcon } from "./Icons";

interface SyncTabProps {
  onSyncComplete?: () => void;
}

export function SyncTab({ onSyncComplete }: SyncTabProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        alert("Base de datos SQLite reiniciada con éxito.");
        if (onSyncComplete) onSyncComplete();
      }
    } catch (e) {
      console.error("Error clearing db:", e);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="py-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md">
        <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <UploadCloudIcon className="w-5 h-5 text-amber-400" />
          <span>Actualización & Sincronización de Datos</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          Sube tu exportación de Hevy en formato <code className="text-amber-400 font-mono">.csv</code>. La aplicación procesa los entrenamientos nuevos y los fusiona en tu base de datos SQLite local sin duplicados.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-10 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
          dragActive
            ? "border-amber-400 bg-amber-500/10 scale-[1.01]"
            : "border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40"
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

        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
          <UploadCloudIcon className="w-7 h-7" />
        </div>

        <h3 className="text-sm font-semibold text-zinc-200 mb-1">
          {uploading ? "Procesando archivo CSV..." : "Haz clic o arrastra tu exportación de Hevy aquí"}
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm">
          Acepta el archivo exportado desde la app oficial de Hevy. Los meses en español y las series especiales se identifican automáticamente.
        </p>

        {uploading && (
          <div className="mt-4 flex items-center gap-2 text-xs font-mono text-amber-400">
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

      {/* Maintenance Box */}
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
    </div>
  );
}
