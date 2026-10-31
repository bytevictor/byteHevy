"use client";

import React from "react";
import {
  useTheme,
  BASE_THEMES,
  ACCENT_COLORS,
  THEME_PRESETS,
} from "@/lib/theme-context";
import { ByteHevyLogo, CheckIcon, SparklesIcon, RefreshCwIcon, TargetIcon, TrophyIcon } from "./Icons";

export function ThemeCustomizer() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    accentHex,
    applyPreset,
    resetToDefault,
  } = useTheme();

  return (
    <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col gap-6 shadow-xl animate-fade-in">
      {/* Header and Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent-light">
              <SparklesIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-zinc-100 tracking-tight">
              Personalización de Apariencia & Temas
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Modifica la atmósfera general de la aplicación y el color secundario de acento a tu gusto.
          </p>
        </div>

        <button
          type="button"
          onClick={resetToDefault}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer self-start sm:self-center border border-transparent hover:border-zinc-700/60"
          title="Restaurar a Zinc Clásico + Ámbar Hevy"
        >
          <RefreshCwIcon className="w-3.5 h-3.5" />
          <span>Restaurar por defecto</span>
        </button>
      </div>

      {/* Live Preview Box */}
      <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center shadow-md">
            <ByteHevyLogo className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight">
              <span className="text-zinc-100">byte</span>
              <span className="text-accent-light">Hevy</span>
            </span>
            <span className="block text-[11px] text-zinc-400 font-mono">
              Previsualización en tiempo real
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sample Badge */}
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/20 text-accent-lighter border border-accent/40 text-[11px] font-mono font-bold shadow-sm">
            <TrophyIcon className="w-3 h-3 text-accent-light" />
            <span>PR: 140 kg (+5 kg)</span>
          </span>

          {/* Sample Active Button */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-zinc-950 text-xs font-semibold shadow-sm shadow-accent/20">
            <TargetIcon className="w-3.5 h-3.5" />
            <span>Objetivo Activo</span>
          </div>

          {/* Sample Mini Progress Bar */}
          <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/40">
            <div className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full w-3/4" />
          </div>
        </div>
      </div>

      {/* 1. Selector de Color Secundario (Acento) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            1. Color Secundario de Acento
          </label>
          <span className="text-xs font-mono text-zinc-400">
            Seleccionado: <strong className="text-accent-light">{ACCENT_COLORS.find((c) => c.id === accent)?.name}</strong> ({accentHex})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {ACCENT_COLORS.map((col) => {
            const isSelected = accent === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setAccent(col.id)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-zinc-800/90 border-zinc-500 shadow-md ring-2 ring-accent/30"
                    : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center shadow-inner"
                  style={{ backgroundColor: col.hex }}
                >
                  {isSelected && (
                    <CheckIcon className="w-3 h-3 text-zinc-950 stroke-[3]" />
                  )}
                </div>
                <div className="truncate">
                  <span className={`block text-xs font-medium truncate ${isSelected ? "text-zinc-100 font-semibold" : "text-zinc-300"}`}>
                    {col.name}
                  </span>
                  <span className="block text-[10px] font-mono text-zinc-500 uppercase">
                    {col.hex}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selector de Temas Variados (Atmósfera / Base Theme) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            2. Atmósfera & Tema Base
          </label>
          <span className="text-xs font-mono text-zinc-400">
            Tema actual: <strong className="text-zinc-200">{BASE_THEMES.find((t) => t.id === theme)?.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {BASE_THEMES.map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/20 bg-zinc-850/90 shadow-md"
                    : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-850/60"
                }`}
              >
                {/* Visual miniature preview */}
                <div
                  className="w-full h-12 rounded-lg border mb-2.5 p-1.5 flex flex-col justify-between transition-transform duration-200 group-hover:scale-[1.02]"
                  style={{
                    backgroundColor: t.bgHex,
                    borderColor: t.borderHex,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-3 h-1 rounded-full bg-zinc-600" />
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: accentHex }}
                    />
                  </div>
                  <div
                    className="w-full h-3.5 rounded border flex items-center px-1.5"
                    style={{
                      backgroundColor: t.cardHex,
                      borderColor: t.borderHex,
                    }}
                  >
                    <div className="w-8 h-1 rounded-full bg-zinc-700" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isSelected ? "text-accent-light" : "text-zinc-200"}`}>
                    {t.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center">
                      <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Combinaciones Rápidas (Presets Populares) */}
      <div className="flex flex-col gap-3 pt-2 border-t border-zinc-800/60">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Combinaciones Rápidas (Presets)
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {THEME_PRESETS.map((preset) => {
            const isMatch = theme === preset.theme && accent === preset.accent;
            const presetColor = ACCENT_COLORS.find((c) => c.id === preset.accent)?.hex || "#f59e0b";

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isMatch
                    ? "border-accent/80 bg-accent/10 shadow-sm"
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-850/60"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: presetColor }}
                  />
                  {preset.tag && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                      {preset.tag}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-semibold truncate ${isMatch ? "text-accent-light" : "text-zinc-200"}`}>
                  {preset.name}
                </span>
                <span className="text-[10px] text-zinc-500 truncate mt-0.5">
                  {BASE_THEMES.find((t) => t.id === preset.theme)?.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
