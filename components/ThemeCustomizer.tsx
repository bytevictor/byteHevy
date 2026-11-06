"use client";

import React, { useState, useEffect } from "react";
import {
  useTheme,
  BASE_THEMES,
  ACCENT_COLORS,
  ATMOSPHERE_OPTIONS,
  RADIUS_OPTIONS,
  CARD_STYLE_OPTIONS,
  FONT_STYLE_OPTIONS,
  COMPREHENSIVE_PRESETS,
  OKTAVO_INK_PAIRS,
  BaseTheme,
  AccentColor,
  Atmosphere,
  RadiusStyle,
  CardStyle,
  FontStyle,
  ComprehensivePreset,
  InkPairOption,
} from "@/lib/theme-context";
import {
  ByteHevyLogo,
  CheckIcon,
  SparklesIcon,
  RefreshCwIcon,
  TargetIcon,
  TrophyIcon,
  FlameIcon,
  ZapIcon,
  ActivityIcon,
} from "./Icons";

export function ThemeCustomizer() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    customAccentHex,
    setCustomAccent,
    selectedInkPairId,
    setInkPair,
    secondInk,
    setSecondInk,
    atmosphere,
    setAtmosphere,
    radius,
    setRadius,
    cardStyle,
    setCardStyle,
    fontStyle,
    setFontStyle,
    activePresetId,
    accentHex,
    currentThemeConfig,
    applyComprehensivePreset,
    resetToDefault,
  } = useTheme();

  // Filter for base themes
  const [themeFilter, setThemeFilter] = useState<"all" | "clasico" | "editorial" | "elemental" | "especial">("all");
  // Custom color input states
  const [customHexInput, setCustomHexInput] = useState<string>(customAccentHex || "#ff48b0");
  const [secondHexInput, setSecondHexInput] = useState<string>(secondInk || "#00857c");

  useEffect(() => {
    if (secondInk) {
      setSecondHexInput(secondInk);
    }
  }, [secondInk]);

  useEffect(() => {
    if (customAccentHex) {
      setCustomHexInput(customAccentHex);
    }
  }, [customAccentHex]);

  const filteredThemes = themeFilter === "all"
    ? BASE_THEMES
    : BASE_THEMES.filter((t) => t.category === themeFilter);

  const handleCustomColorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^#[0-9A-Fa-f]{6}$/.test(customHexInput)) {
      setCustomAccent(customHexInput);
    }
  };

  const currentPreset = COMPREHENSIVE_PRESETS.find((p) => p.id === activePresetId);

  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 flex flex-col gap-8 shadow-xl animate-fade-in">
      {/* =========================================================================
          1. HEADER & STATUS RESUMEN
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent-light shadow-xs">
              <SparklesIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
              Sistema de Diseño & Personalización Integral
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Personaliza radicalmente la estética y el feeling de byteHevy: desde presets inspirados en sistemas editoriales como Oktavo hasta terminales cyber HUD, redondez de esquinas, grosores de borde y texturas táctiles.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {currentPreset && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-accent/15 border border-accent/30 text-accent-light shrink-0">
              Preset: {currentPreset.name}
            </span>
          )}
          <button
            type="button"
            onClick={resetToDefault}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-xl hover:bg-zinc-800 cursor-pointer border border-zinc-800 shrink-0"
            title="Restaurar a Hevy Clásico"
          >
            <RefreshCwIcon className="w-3.5 h-3.5" />
            <span>Restaurar</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. VISTA PREVIA INTERACTIVA EN TIEMPO REAL
          ========================================================================= */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-300 flex items-center gap-1.5">
            <ActivityIcon className="w-3.5 h-3.5 text-accent-light" />
            <span>Vista Previa Interactiva en Vivo</span>
          </span>
          <span className="font-mono text-[11px] text-zinc-400">
            Esquinas: <strong className="text-zinc-200">{radius}</strong> · Bordes: <strong className="text-zinc-200">{cardStyle}</strong> · Fuente: <strong className="text-zinc-200">{fontStyle}</strong>
          </span>
        </div>

        <div
          className="p-5 sm:p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden shadow-lg"
          style={{
            backgroundColor: currentThemeConfig.cardHex,
            borderColor: currentThemeConfig.borderHex,
          }}
        >
          {/* Atmósfera en la vista previa */}
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
                backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)`,
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
          {atmosphere === "scanlines" && (
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 50%)`,
                backgroundSize: "100% 4px",
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

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Branding Preview */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl border flex items-center justify-center shadow-md transition-all shrink-0"
                style={{
                  backgroundColor: currentThemeConfig.bgHex,
                  borderColor: currentThemeConfig.borderHex,
                }}
              >
                <ByteHevyLogo className="w-7 h-7" accentColor={accentHex} />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight flex items-center gap-0.5">
                  <span style={{ color: currentThemeConfig.foreground }}>byte</span>
                  <span style={{ color: accentHex }}>Hevy</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ml-1.5 border"
                    style={{
                      borderColor: `${accentHex}40`,
                      backgroundColor: `${accentHex}15`,
                      color: accentHex,
                    }}
                  >
                    PREVIEW
                  </span>
                </span>
                <span className="block text-xs font-mono text-zinc-400 mt-0.5">
                  {currentThemeConfig.name} · {accent === "custom" ? `Custom (${customAccentHex})` : ACCENT_COLORS.find((a) => a.id === accent)?.name}
                </span>
              </div>
            </div>

            {/* Interactive Components Sample */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Metric Card Preview */}
              <div
                className="p-3 rounded-xl border flex flex-col justify-between shadow-xs min-w-[170px]"
                style={{
                  backgroundColor: currentThemeConfig.bgHex,
                  borderColor: currentThemeConfig.borderHex,
                }}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-400">Press Militar</span>
                  <span
                    className="font-bold flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border font-mono"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${secondInk} 20%, transparent)`,
                      borderColor: `color-mix(in srgb, ${secondInk} 45%, transparent)`,
                      color: secondInk,
                    }}
                  >
                    <TrophyIcon className="w-3 h-3" />
                    <span>PR</span>
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold font-mono tracking-tight" style={{ color: currentThemeConfig.foreground }}>
                    80.0
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">kg × 5 reps</span>
                </div>
              </div>

              {/* Sample Action Button */}
              <button
                type="button"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                style={{
                  backgroundColor: accentHex,
                  color: "#09090b",
                  boxShadow: cardStyle === "brutalist" ? `4px 4px 0px 0px ${theme === "paper" ? "#1f1b24" : "#000000"}` : `0 0 16px ${accentHex}40`,
                }}
              >
                <TargetIcon className="w-3.5 h-3.5" />
                <span>Iniciar Entrenamiento</span>
              </button>

              {/* Sample Pill Badge */}
              <span
                className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold border flex items-center gap-1.5"
                style={{
                  backgroundColor: `${accentHex}18`,
                  borderColor: `${accentHex}40`,
                  color: accentHex,
                }}
              >
                <ZapIcon className="w-3.5 h-3.5" />
                <span>1RM: 93 kg</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. SECCIÓN 1: PRESETS DE ESTILO INTEGRAL (FLAGSHIP DESIGN SYSTEMS)
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>1. Presets de Estilo Integral (Diseño Completo en 1 Clic)</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Transforman todo el feeling de la interfaz a la vez: paleta cromática, grosor de bordes, curvatura de esquinas, sombras y tipografía.
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            {COMPREHENSIVE_PRESETS.length} estilos insignia
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {COMPREHENSIVE_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyComprehensivePreset(preset)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850 shadow-lg scale-[1.01]"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-850"
                }`}
              >
                {/* Visual miniature mockup of the preset */}
                <div
                  className="w-full h-20 rounded-xl p-2.5 flex flex-col justify-between transition-transform duration-200 group-hover:scale-[1.02] shadow-inner relative overflow-hidden"
                  style={{
                    backgroundColor: preset.preview.bgHex,
                    borderColor: preset.preview.borderHex,
                    borderWidth: preset.preview.borderWidth,
                    borderRadius: preset.radius === "sharp" ? "0px" : preset.radius === "soft" ? "6px" : preset.radius === "pill" ? "14px" : "10px",
                    boxShadow: preset.preview.hasOffsetShadow ? `3px 3px 0px ${preset.theme === "paper" ? "#1f1b24" : "#000000"}` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold tracking-tight"
                      style={{ color: preset.preview.accentHex }}
                    >
                      byteHevy
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: preset.preview.accentHex,
                        boxShadow: preset.preview.hasGlow ? `0 0 8px ${preset.preview.accentHex}` : undefined,
                      }}
                    />
                  </div>

                  {/* Mock card inside mockup */}
                  <div
                    className="w-full p-1.5 flex items-center justify-between"
                    style={{
                      backgroundColor: preset.preview.cardHex,
                      borderColor: preset.preview.borderHex,
                      borderWidth: preset.preview.borderWidth,
                      borderRadius: preset.radius === "sharp" ? "0px" : preset.radius === "soft" ? "4px" : preset.radius === "pill" ? "10px" : "6px",
                      boxShadow: preset.preview.hasOffsetShadow ? `2px 2px 0px ${preset.theme === "paper" ? "#1f1b24" : "#000000"}` : undefined,
                    }}
                  >
                    <span
                      className="text-[9px] font-mono font-bold"
                      style={{ color: preset.theme === "paper" || preset.theme === "light" ? "#1f1b24" : "#ffffff" }}
                    >
                      140 KG
                    </span>
                    <span
                      className="text-[8px] font-mono px-1 py-0.2 rounded font-bold"
                      style={{
                        backgroundColor: preset.secondInk || preset.preview.accentHex,
                        color: "#09090b",
                      }}
                    >
                      PR
                    </span>
                  </div>
                </div>

                {/* Preset Information */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
                      style={{
                        borderColor: `${preset.preview.accentHex}40`,
                        color: preset.preview.accentHex,
                        backgroundColor: `${preset.preview.accentHex}15`,
                      }}
                    >
                      {preset.preview.badge}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center shrink-0">
                        <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <h4 className={`text-sm font-bold tracking-tight truncate ${isSelected ? "text-accent-light" : "text-zinc-100"}`}>
                    {preset.name}
                  </h4>
                  <span className="block text-[11px] text-zinc-400 font-medium truncate">
                    {preset.tagline}
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          4. SECCIÓN 2: REDONDEZ DE ESQUINAS (CORNERS / BORDER RADIUS)
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>2. Curvatura de Esquinas (Border Radius)</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Controla el ángulo geométrico de todas las tarjetas, botones, modales y campos de la web.
            </p>
          </div>
          <span className="text-xs font-mono text-accent-light uppercase font-bold">
            {radius}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {RADIUS_OPTIONS.map((opt) => {
            const isSelected = radius === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRadius(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850 shadow-md"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-850"
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Corner Visual Indicator */}
                  <div
                    className="w-8 h-8 border-2 border-accent bg-accent/15 flex items-center justify-center shadow-xs"
                    style={{
                      borderRadius: opt.id === "sharp" ? "0px" : opt.id === "soft" ? "6px" : opt.id === "round" ? "10px" : "16px",
                    }}
                  >
                    <span className="text-[9px] font-mono font-bold text-accent-light">
                      {opt.cardRadius}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center shrink-0">
                      <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div>
                  <span className={`block text-xs font-bold ${isSelected ? "text-accent-light" : "text-zinc-100"}`}>
                    {opt.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {opt.badge}
                  </span>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-snug line-clamp-2">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          5. SECCIÓN 3: ESTILO DE COMPONENTES & BORDES (CARD ARCHITECTURE)
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>3. Estilo de Componentes & Bordes</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Define el grosor de los bordes, el comportamiento de las sombras y el acabado estético de las tarjetas.
            </p>
          </div>
          <span className="text-xs font-mono text-accent-light font-bold">
            {CARD_STYLE_OPTIONS.find((c) => c.id === cardStyle)?.badge}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CARD_STYLE_OPTIONS.map((opt) => {
            const isSelected = cardStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCardStyle(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850 shadow-md"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-850"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? "text-accent-light" : "text-zinc-100"}`}>
                    {opt.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center shrink-0">
                      <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-accent-light/90">
                  {opt.badge}
                </span>

                <p className="text-[10px] text-zinc-400 leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          6. SECCIÓN 4: TIPOGRAFÍA & PERSONALIDAD (FONT STYLES)
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>4. Tipografía & Personalidad</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Adapta la familia tipográfica principal y el espaciado entre caracteres en títulos y métricas.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {fontStyle}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FONT_STYLE_OPTIONS.map((opt) => {
            const isSelected = fontStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFontStyle(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850 shadow-md"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-850"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? "text-accent-light" : "text-zinc-100"}`}>
                    {opt.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-accent text-zinc-950 flex items-center justify-center shrink-0">
                      <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Sample rendering in its own font style */}
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 font-semibold text-xs text-zinc-200 truncate">
                  <span
                    style={{
                      fontFamily:
                        opt.id === "editorial"
                          ? "'Bricolage Grotesque', sans-serif"
                          : opt.id === "mono"
                          ? "'JetBrains Mono', monospace"
                          : opt.id === "sans"
                          ? "'Plus Jakarta Sans', sans-serif"
                          : opt.id === "display"
                          ? "'Syne', 'Space Grotesk', sans-serif"
                          : opt.id === "serif"
                          ? "'Instrument Serif', Georgia, serif"
                          : opt.id === "tech"
                          ? "'Chakra Petch', sans-serif"
                          : "inherit",
                      fontStyle: opt.id === "serif" ? "italic" : undefined,
                      fontWeight: opt.id === "editorial" || opt.id === "display" ? 800 : undefined,
                      letterSpacing: opt.id === "editorial" ? "-0.035em" : opt.id === "tech" ? "0.04em" : undefined,
                    }}
                  >
                    {opt.sample}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-accent-light/90 font-semibold">
                    {opt.badge}
                  </span>
                </div>

                <p className="text-[10px] text-zinc-400 leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          7. SECCIÓN 5: LIENZO BASE & PAPEL (BASE THEMES)
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>5. Lienzo Base & Superficie (Fondo & Tarjetas)</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Determina el tono cromático estructural del fondo, las tarjetas y los textos.
            </p>
          </div>

          {/* Categorías */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 self-start sm:self-center overflow-x-auto max-w-full">
            {(["all", "clasico", "editorial", "elemental", "especial"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setThemeFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  themeFilter === cat ? "bg-zinc-800 text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {cat === "all" ? `Todos (${BASE_THEMES.length})` : cat === "clasico" ? "Clásicos" : cat === "editorial" ? "Editoriales & Claros" : cat === "elemental" ? "Elementales" : "Especiales"}
              </button>
            ))}
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
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850 shadow-md scale-[1.01]"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-850"
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

      {/* =========================================================================
          8. SECCIÓN 6: TINTAS DE ACENTO & SELECTOR LIBRE (INKS)
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
              <span>6. Tintas de Acento Cromático & Selector Libre</span>
            </label>
            <p className="text-xs text-zinc-400 mt-0.5">
              Afecta a botones principales, etiquetas de récords (PR), gráficos de evolución y elementos destacados.
            </p>
          </div>

          {/* Selectores libres de tinta dual (Primaria y Secundaria) */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {/* Tinta Primaria */}
            <label
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 hover:border-zinc-500 cursor-pointer transition-colors shadow-xs"
              title="Escoger color primario con el selector nativo"
            >
              <input
                type="color"
                value={customHexInput}
                onChange={(e) => {
                  setCustomHexInput(e.target.value);
                  setCustomAccent(e.target.value);
                }}
                className="w-5 h-5 rounded-md border-0 p-0 bg-transparent cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                {customHexInput}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                Primaria
              </span>
            </label>

            {/* Tinta Secundaria */}
            <label
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 hover:border-zinc-500 cursor-pointer transition-colors shadow-xs"
              title="Escoger color secundario con el selector nativo (utilizado en badges de Teenage Engineering, telemetría y acentos complementarios)"
            >
              <input
                type="color"
                value={secondHexInput}
                onChange={(e) => {
                  setSecondHexInput(e.target.value);
                  setSecondInk(e.target.value);
                }}
                className="w-5 h-5 rounded-md border-0 p-0 bg-transparent cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                {secondHexInput}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                Secundaria
              </span>
            </label>
          </div>
        </div>

        {/* Pares de Tintas Duotono (Inspiración Imprenta Risograph de Oktavo) */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Pares de Tintas Risograph (Duotono Imprenta)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {OKTAVO_INK_PAIRS.map((pair) => {
              const isSelected = selectedInkPairId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() => setInkPair(pair)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-zinc-800 border-accent ring-2 ring-accent/30 shadow-md scale-[1.01]"
                      : "bg-zinc-950/60 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700"
                  }`}
                >
                  {/* Split Duotone Disc */}
                  <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden relative border border-white/20 shadow-xs flex">
                    <div className="w-1/2 h-full" style={{ backgroundColor: pair.primary }} />
                    <div className="w-1/2 h-full" style={{ backgroundColor: pair.secondary }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold truncate ${isSelected ? "text-accent-light" : "text-zinc-200"}`}>
                        {pair.name}
                      </span>
                      {isSelected && (
                        <CheckIcon className="w-3.5 h-3.5 text-accent-light shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono block truncate">
                      {pair.tag}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tintas Monocromáticas Individuales */}
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-2">
          Tintas Individuales Curadas
        </span>

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
                    ? "bg-zinc-800 border-zinc-600 shadow-md ring-2 ring-accent/30 scale-[1.01]"
                    : "bg-zinc-950/60 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700"
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

      {/* =========================================================================
          9. SECCIÓN 7: TEXTURAS DE FONDO & ATMÓSFERA
          ========================================================================= */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-zinc-800/80">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <SparklesIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>7. Texturas de Fondo & Atmósfera Ambiental</span>
          </label>
          <p className="text-xs text-zinc-400 mt-0.5">
            Agrega una capa sutil de textura óptica (grano analógico de papel, rejilla blueprint, scanlines retro) que envuelve toda la aplicación.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {ATMOSPHERE_OPTIONS.map((opt) => {
            const isSelected = atmosphere === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAtmosphere(opt.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-zinc-850 shadow-md"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-850"
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
                <span className="text-[10px] font-mono text-zinc-400">
                  {opt.badge}
                </span>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
