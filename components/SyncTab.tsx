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
      <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
        <h2 className="text-xl font-bold tracking-tight text-zinc-100 font-sans flex items-center gap-2">
          <UploadCloudIcon className="w-5 h-5 text-amber-400" />
          <span>Actualización & Sincronización de Datos</span>
        </h2>
        <p className="text-xs font-mono text-zinc-400 mt-1 leading-relaxed">
          Sube tu exportación de Hevy en formato <code className="text-amber-400">.csv</code>. La aplicación procesa los entrenamientos nuevos y los fusiona en tu base de datos SQLite local sin duplicados.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
          dragActive
            ? "border-amber-400 bg-amber-500/10"
            : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/40 hover:border-zinc-700"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
          {uploading ? (
            <RefreshCwIcon className="w-6 h-6 animate-spin" />
          ) : (
            <UploadCloudIcon className="w-6 h-6" />
          )}
        </div>

        <div>
          <p className="text-sm font-mono font-medium text-zinc-200">
            {uploading ? "Procesando archivo CSV..." : "Arrastra y suelta tu archivo CSV de Hevy aquí"}
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            o haz clic para seleccionar el archivo desde tu explorador
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
          <InfoIcon className="w-3.5 h-3.5" />
          <span>Soporta fechas en español, comillas multilínea y series de todo tipo</span>
        </div>
      </div>

      {/* Result Card */}
      {result && (
        <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 font-mono text-xs flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckIcon className="w-4 h-4" />
            <span>Sincronización completada con éxito</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">Filas CSV</span>
              <span className="text-base font-bold text-zinc-200">{result.totalRows}</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 flex flex-col">
              <span className="text-[10px] text-emerald-400/80 uppercase">Nuevos Entrenos</span>
              <span className="text-base font-bold text-emerald-400">{result.newWorkouts}</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">Ya Existentes</span>
              <span className="text-base font-bold text-zinc-400">{result.skippedWorkouts}</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 flex flex-col">
              <span className="text-[10px] text-amber-400/80 uppercase">Series Insertadas</span>
              <span className="text-base font-bold text-amber-400">{result.newSets}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 font-mono text-xs">
          {error}
        </div>
      )}

      {/* Database Maintenance Card */}
      <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
        <div>
          <span className="font-semibold text-zinc-200 block mb-0.5">Mantenimiento de SQLite</span>
          <span className="text-zinc-500 text-[11px]">
            Archivo local en <code className="text-zinc-400">data/bytehevy.db</code> preparado para réplicas y snapshots de tu contenedor LXC.
          </span>
        </div>

        <button
          onClick={handleClearDb}
          disabled={clearing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/50 bg-red-950/20 hover:bg-red-900/30 text-red-400 transition-colors self-start sm:self-center cursor-pointer disabled:opacity-50"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          <span>{clearing ? "Vaciando..." : "Vaciar entrenamientos"}</span>
        </button>
      </div>
    </div>
  );
}

