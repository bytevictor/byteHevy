"use client";

import React, { useState } from "react";
import {
  useTheme,
  BASE_THEMES,
  ACCENT_COLORS,
  THEME_PRESETS,
  ATMOSPHERE_OPTIONS,
  BaseTheme,
} from "@/lib/theme-context";
import {
  ByteHevyLogo,
  CheckIcon,
  SparklesIcon,
  RefreshCwIcon,
  TargetIcon,
  TrophyIcon,
  FlameIcon,
  GridIcon,
} from "./Icons";

export function ThemeCustomizer() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    atmosphere,
    setAtmosphere,
    accentHex,
    currentThemeConfig,
    applyPreset,
    resetToDefault,
  } = useTheme();

  const [themeFilter, setThemeFilter] = useState<"all" | "clasico" | "elemental" | "especial">("all");

  const filteredThemes = themeFilter === "all"
    ? BASE_THEMES
    : BASE_THEMES.filter((t) => t.category === themeFilter);

  return (
    <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col gap-8 shadow-xl animate-fade-in">
      {/* 1. Header and Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent-light">
              <SparklesIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-zinc-100 tracking-tight">
              Personalización de Apariencia & Atmósferas
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Transforma la estética de byteHevy con atmósferas inmersivas, temas tonales, acentos cromáticos y efectos de fondo.
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

      {/* 2. Live Preview Box (Refleja el tema, acento y atmósfera en tiempo real) */}
      <div
        className="p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden shadow-lg"
        style={{
          backgroundColor: currentThemeConfig.cardHex,
          borderColor: currentThemeConfig.borderHex,
        }}
      >
        {/* Ambient Glow / Mesh in Preview */}
        {atmosphere === "glow" && (
          <div
            className="absolute top-0 right-0 w-80 h-40 pointer-events-none rounded-full blur-3xl opacity-40 -mr-10 -mt-10"
            style={{ backgroundColor: accentHex }}
          />
        )}
        {atmosphere === "grid" && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
            }}
          />
        )}
        {atmosphere === "dots" && (
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: `radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)`,
              backgroundSize: "16px 16px",
            }}
          />
        )}
        {atmosphere === "aurora" && (
          <div
            className="absolute -top-12 -left-12 -right-12 h-36 pointer-events-none blur-2xl opacity-40"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${accentHex} 0%, transparent 60%), radial-gradient(circle at 70% 30%, #6366f1 0%, transparent 60%)`,
            }}
          />
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-2xl border flex items-center justify-center shadow-md transition-colors"
              style={{
                backgroundColor: currentThemeConfig.bgHex,
                borderColor: currentThemeConfig.borderHex,
              }}
            >
              <ByteHevyLogo className="w-6 h-6" accentColor={accentHex} />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">
                <span style={{ color: currentThemeConfig.foreground }}>byte</span>
                <span style={{ color: accentHex }}>Hevy</span>
              </span>
              <span className="block text-[11px] text-zinc-400 font-mono">
                {currentThemeConfig.name} · {ACCENT_COLORS.find((a) => a.id === accent)?.name} · {ATMOSPHERE_OPTIONS.find((o) => o.id === atmosphere)?.name}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sample Badge */}
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-mono font-bold border shadow-xs"
              style={{
                backgroundColor: `${accentHex}1a`,
                borderColor: `${accentHex}40`,
                color: accentHex,
              }}
            >
              <TrophyIcon className="w-3.5 h-3.5" />
              <span>PR: 140 kg (+5 kg)</span>
            </span>

            {/* Sample Active Button */}
            <div
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-950 shadow-sm cursor-default"
              style={{
                backgroundColor: accentHex,
                boxShadow: `0 0 16px ${accentHex}40`,
              }}
            >
              <TargetIcon className="w-3.5 h-3.5" />
              <span>Objetivo Activo</span>
            </div>

            {/* Mini Progress */}
            <div
              className="w-20 h-2.5 rounded-full overflow-hidden p-0.5 border"
              style={{
                backgroundColor: currentThemeConfig.bgHex,
                borderColor: currentThemeConfig.borderHex,
              }}
            >
              <div
                className="h-full rounded-full w-3/4 transition-all"
                style={{ backgroundColor: accentHex }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN 1: ATMÓSFERAS & TEMAS BASE */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>1. Atmósfera & Tema Base</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Determina el color de fondo estructural, las superficies de las tarjetas y los bordes.
            </p>
          </div>

          {/* Filtros de Categoría */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950/80 border border-zinc-800 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setThemeFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                themeFilter === "all" ? "bg-zinc-800 text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Todos ({BASE_THEMES.length})
            </button>
            <button
              type="button"
              onClick={() => setThemeFilter("clasico")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                themeFilter === "clasico" ? "bg-zinc-800 text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Clásicos
            </button>
            <button
              type="button"
              onClick={() => setThemeFilter("elemental")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                themeFilter === "elemental" ? "bg-zinc-800 text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Elementales
            </button>
            <button
              type="button"
              onClick={() => setThemeFilter("especial")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                themeFilter === "especial" ? "bg-zinc-800 text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Especiales
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredThemes.map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id as BaseTheme)}
                className={`flex flex-col p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850/90 shadow-md scale-[1.01]"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-850/50"
                }`}
              >
                {/* Visual miniature preview */}
                <div
                  className="w-full h-14 rounded-xl border mb-2.5 p-2 flex flex-col justify-between transition-transform duration-200 group-hover:scale-[1.02] shadow-inner"
                  style={{
                    backgroundColor: t.bgHex,
                    borderColor: t.borderHex,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="w-4 h-1.5 rounded-full opacity-60"
                      style={{ backgroundColor: t.foreground }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full shadow-xs"
                      style={{ backgroundColor: accentHex }}
                    />
                  </div>
                  <div
                    className="w-full h-4 rounded-lg border flex items-center px-1.5"
                    style={{
                      backgroundColor: t.cardHex,
                      borderColor: t.borderHex,
                    }}
                  >
                    <div
                      className="w-10 h-1 rounded-full opacity-40"
                      style={{ backgroundColor: t.foreground }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate ${isSelected ? "text-accent-light" : "text-zinc-100"}`}>
                    {t.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center shrink-0">
                      <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. SECCIÓN 2: COLOR SECUNDARIO DE ACENTO */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
              <span>2. Color Secundario de Acento</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Afecta a botones de acción, etiquetas de récords (PR), gráficos y destacados.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400 hidden sm:block">
            <strong style={{ color: accentHex }}>{ACCENT_COLORS.find((c) => c.id === accent)?.name}</strong> ({accentHex})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {ACCENT_COLORS.map((col) => {
            const isSelected = accent === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setAccent(col.id)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-zinc-800/90 border-zinc-600 shadow-md ring-2 ring-accent/30 scale-[1.01]"
                    : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700"
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center shadow-md border border-white/10"
                  style={{ backgroundColor: col.hex }}
                >
                  {isSelected && (
                    <CheckIcon className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
                  )}
                </div>
                <div className="truncate min-w-0">
                  <span className={`block text-xs font-medium truncate ${isSelected ? "text-zinc-100 font-bold" : "text-zinc-300"}`}>
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

      {/* 5. SECCIÓN 3: EFECTOS DE FONDO Y TEXTURA DE ATMÓSFERA */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/60">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <SparklesIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Textura de Fondo & Efecto Ambiental</span>
          </label>
          <p className="text-xs text-zinc-400 mt-0.5">
            Agrega una capa sutil de profundidad óptica que envuelve toda la aplicación.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {ATMOSPHERE_OPTIONS.map((opt) => {
            const isSelected = atmosphere === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAtmosphere(opt.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? "border-accent/80 bg-accent/10 shadow-md ring-1 ring-accent/30"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-850/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? "text-accent-light" : "text-zinc-200"}`}>
                    {opt.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center shrink-0">
                      <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. SECCIÓN 4: COMBINACIONES Y PRESETS POPULARES */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <FlameIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>4. Colecciones & Presets Diseñados</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Paletas completas calibradas por atmósfera, acento y textura en 1 clic.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {THEME_PRESETS.map((preset) => {
            const isMatch = theme === preset.theme && accent === preset.accent && (preset.atmosphere ? atmosphere === preset.atmosphere : true);
            const presetColor = ACCENT_COLORS.find((c) => c.id === preset.accent)?.hex || "#f59e0b";
            const presetTheme = BASE_THEMES.find((t) => t.id === preset.theme);

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`flex flex-col p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isMatch
                    ? "border-accent/90 bg-accent/15 shadow-md ring-1 ring-accent/30 scale-[1.01]"
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-850/60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: presetColor }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-white/10"
                      style={{ backgroundColor: presetTheme?.bgHex || "#000" }}
                    />
                  </div>
                  {preset.tag && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-mono">
                      {preset.tag}
                    </span>
                  )}
                </div>

                <span className={`text-xs font-bold truncate ${isMatch ? "text-accent-light" : "text-zinc-100"}`}>
                  {preset.name}
                </span>
                <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                  {presetTheme?.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
