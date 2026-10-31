"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type BaseTheme = "zinc" | "oled" | "midnight" | "carbon" | "cyberpunk";

export type AccentColor =
  | "amber"
  | "lime"
  | "emerald"
  | "cyan"
  | "blue"
  | "violet"
  | "pink"
  | "rose"
  | "orange"
  | "platinum";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: BaseTheme;
  accent: AccentColor;
  tag?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "classic",
    name: "Hevy Clásico",
    description: "Look original con fondo neutro y acento amarillo cálido",
    theme: "zinc",
    accent: "amber",
    tag: "Original",
  },
  {
    id: "cyber-lime",
    name: "Cyber Lime",
    description: "Contraste OLED absoluto con lima neón deportivo",
    theme: "oled",
    accent: "lime",
    tag: "Popular",
  },
  {
    id: "deep-space",
    name: "Deep Space",
    description: "Azul marino cósmico con cian eléctrico",
    theme: "midnight",
    accent: "cyan",
    tag: "Tech",
  },
  {
    id: "synthwave",
    name: "Neon Dusk",
    description: "Atmósfera nocturna con violeta brillante",
    theme: "cyberpunk",
    accent: "violet",
  },
  {
    id: "volcano",
    name: "Volcano Red",
    description: "Carbón volcánico con carmesí de alta intensidad",
    theme: "carbon",
    accent: "rose",
  },
  {
    id: "stealth-force",
    name: "Stealth Platinum",
    description: "Monocromo puro minimalista en negro absoluto",
    theme: "oled",
    accent: "platinum",
  },
];

export interface BaseThemeOption {
  id: BaseTheme;
  name: string;
  description: string;
  bgHex: string;
  cardHex: string;
  borderHex: string;
  foreground: string;
  headerBg: string;
}

export const BASE_THEMES: BaseThemeOption[] = [
  {
    id: "zinc",
    name: "Zinc Clásico",
    description: "Tono oscuro neutro original de ByteHevy",
    bgHex: "#09090b",
    cardHex: "#18181b",
    borderHex: "#27272a",
    foreground: "#fafafa",
    headerBg: "rgba(9, 9, 11, 0.85)",
  },
  {
    id: "oled",
    name: "OLED Pitch Black",
    description: "Negro puro (#000000) de máximo contraste",
    bgHex: "#000000",
    cardHex: "#0a0a0c",
    borderHex: "#1f1f23",
    foreground: "#ffffff",
    headerBg: "rgba(0, 0, 0, 0.9)",
  },
  {
    id: "midnight",
    name: "Midnight Slate",
    description: "Azul noche espacial y analítico",
    bgHex: "#070a12",
    cardHex: "#0e1526",
    borderHex: "#1e293b",
    foreground: "#f1f5f9",
    headerBg: "rgba(7, 10, 18, 0.85)",
  },
  {
    id: "carbon",
    name: "Carbon Matrix",
    description: "Grafito cálido con textura carbón",
    bgHex: "#121214",
    cardHex: "#1a1a1d",
    borderHex: "#2e2e33",
    foreground: "#f4f4f5",
    headerBg: "rgba(18, 18, 20, 0.85)",
  },
  {
    id: "cyberpunk",
    name: "Cyber Dusk",
    description: "Atmósfera nocturna con matiz violeta profundo",
    bgHex: "#0b0914",
    cardHex: "#141024",
    borderHex: "#2c224a",
    foreground: "#f5f3ff",
    headerBg: "rgba(11, 9, 20, 0.85)",
  },
];

export interface AccentColorOption {
  id: AccentColor;
  name: string;
  hex: string;
  lightHex: string;
  lighterHex: string;
  darkHex: string;
  glow: string;
  subtle: string;
  border: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  {
    id: "amber",
    name: "Ámbar Hevy",
    hex: "#f59e0b",
    lightHex: "#fbbf24",
    lighterHex: "#fcd34d",
    darkHex: "#d97706",
    glow: "rgba(245, 158, 11, 0.25)",
    subtle: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  {
    id: "lime",
    name: "Lima Neón",
    hex: "#84cc16",
    lightHex: "#a3e635",
    lighterHex: "#bef264",
    darkHex: "#65a30d",
    glow: "rgba(132, 204, 22, 0.25)",
    subtle: "rgba(132, 204, 22, 0.1)",
    border: "rgba(132, 204, 22, 0.35)",
  },
  {
    id: "emerald",
    name: "Esmeralda",
    hex: "#10b981",
    lightHex: "#34d399",
    lighterHex: "#6ee7b7",
    darkHex: "#059669",
    glow: "rgba(16, 185, 129, 0.25)",
    subtle: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.35)",
  },
  {
    id: "cyan",
    name: "Azul Eléctrico",
    hex: "#06b6d4",
    lightHex: "#22d3ee",
    lighterHex: "#67e8f9",
    darkHex: "#0891b2",
    glow: "rgba(6, 182, 212, 0.25)",
    subtle: "rgba(6, 182, 212, 0.1)",
    border: "rgba(6, 182, 212, 0.35)",
  },
  {
    id: "blue",
    name: "Cobalto",
    hex: "#3b82f6",
    lightHex: "#60a5fa",
    lighterHex: "#93c5fd",
    darkHex: "#2563eb",
    glow: "rgba(59, 130, 246, 0.25)",
    subtle: "rgba(59, 130, 246, 0.1)",
    border: "rgba(59, 130, 246, 0.35)",
  },
  {
    id: "violet",
    name: "Ultra Violeta",
    hex: "#8b5cf6",
    lightHex: "#a78bfa",
    lighterHex: "#c4b5fd",
    darkHex: "#7c3aed",
    glow: "rgba(139, 92, 246, 0.25)",
    subtle: "rgba(139, 92, 246, 0.1)",
    border: "rgba(139, 92, 246, 0.35)",
  },
  {
    id: "pink",
    name: "Rosa Neón",
    hex: "#ec4899",
    lightHex: "#f472b6",
    lighterHex: "#f9a8d4",
    darkHex: "#db2777",
    glow: "rgba(236, 72, 153, 0.25)",
    subtle: "rgba(236, 72, 153, 0.1)",
    border: "rgba(236, 72, 153, 0.35)",
  },
  {
    id: "rose",
    name: "Rojo Carmesí",
    hex: "#f43f5e",
    lightHex: "#fb7185",
    lighterHex: "#fda4af",
    darkHex: "#e11d48",
    glow: "rgba(244, 63, 94, 0.25)",
    subtle: "rgba(244, 63, 94, 0.1)",
    border: "rgba(244, 63, 94, 0.35)",
  },
  {
    id: "orange",
    name: "Naranja Fuego",
    hex: "#f97316",
    lightHex: "#fb923c",
    lighterHex: "#fdba74",
    darkHex: "#ea580c",
    glow: "rgba(249, 115, 22, 0.25)",
    subtle: "rgba(249, 115, 22, 0.1)",
    border: "rgba(249, 115, 22, 0.35)",
  },
  {
    id: "platinum",
    name: "Platino / Blanco",
    hex: "#e4e4e7",
    lightHex: "#ffffff",
    lighterHex: "#ffffff",
    darkHex: "#a1a1aa",
    glow: "rgba(255, 255, 255, 0.25)",
    subtle: "rgba(255, 255, 255, 0.1)",
    border: "rgba(255, 255, 255, 0.35)",
  },
];

/**
 * Directly injects CSS custom properties and attributes into document.documentElement.
 * This guarantees instantaneous, 100% reliable cascade on every element and SVG.
 */
export function applyThemeToDOM(themeId: BaseTheme, accentId: AccentColor) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const currentAccent = ACCENT_COLORS.find((a) => a.id === accentId) || ACCENT_COLORS[0];
  const currentTheme = BASE_THEMES.find((t) => t.id === themeId) || BASE_THEMES[0];

  // Set data attributes for CSS rules
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-accent", accentId);

  // Directly set inline CSS variables on document.documentElement
  root.style.setProperty("--accent", currentAccent.hex);
  root.style.setProperty("--accent-light", currentAccent.lightHex);
  root.style.setProperty("--accent-lighter", currentAccent.lighterHex);
  root.style.setProperty("--accent-dark", currentAccent.darkHex);
  root.style.setProperty("--accent-glow", currentAccent.glow);
  root.style.setProperty("--accent-subtle", currentAccent.subtle);
  root.style.setProperty("--accent-border", currentAccent.border);

  root.style.setProperty("--background", currentTheme.bgHex);
  root.style.setProperty("--foreground", currentTheme.foreground);
  root.style.setProperty("--surface", currentTheme.cardHex);
  root.style.setProperty("--header-bg", currentTheme.headerBg);
}

interface ThemeContextType {
  theme: BaseTheme;
  setTheme: (theme: BaseTheme) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  accentHex: string;
  accentLightHex: string;
  accentLighterHex: string;
  currentThemeConfig: BaseThemeOption;
  applyPreset: (preset: ThemePreset) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with default values identical on both server and client to avoid SSR hydration mismatches
  const [theme, setThemeState] = useState<BaseTheme>("zinc");
  const [accent, setAccentState] = useState<AccentColor>("amber");

  // On client mount, load preferences from localStorage and apply them
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("bytehevy_theme") as BaseTheme | null;
      const savedAccent = localStorage.getItem("bytehevy_accent") as AccentColor | null;
      const targetTheme = savedTheme && BASE_THEMES.some((t) => t.id === savedTheme) ? savedTheme : "zinc";
      const targetAccent = savedAccent && ACCENT_COLORS.some((a) => a.id === savedAccent) ? savedAccent : "amber";

      setThemeState(targetTheme);
      setAccentState(targetAccent);
      applyThemeToDOM(targetTheme, targetAccent);
    } catch {}
  }, []);

  const setTheme = (newTheme: BaseTheme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme, accent);
    try {
      localStorage.setItem("bytehevy_theme", newTheme);
    } catch {}
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    applyThemeToDOM(theme, newAccent);
    try {
      localStorage.setItem("bytehevy_accent", newAccent);
    } catch {}
  };

  const applyPreset = (preset: ThemePreset) => {
    setThemeState(preset.theme);
    setAccentState(preset.accent);
    applyThemeToDOM(preset.theme, preset.accent);
    try {
      localStorage.setItem("bytehevy_theme", preset.theme);
      localStorage.setItem("bytehevy_accent", preset.accent);
    } catch {}
  };

  const resetToDefault = () => {
    setThemeState("zinc");
    setAccentState("amber");
    applyThemeToDOM("zinc", "amber");
    try {
      localStorage.setItem("bytehevy_theme", "zinc");
      localStorage.setItem("bytehevy_accent", "amber");
    } catch {}
  };

  const currentAccent = ACCENT_COLORS.find((a) => a.id === accent) || ACCENT_COLORS[0];
  const currentThemeConfig = BASE_THEMES.find((t) => t.id === theme) || BASE_THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        accent,
        setAccent,
        accentHex: currentAccent.hex,
        accentLightHex: currentAccent.lightHex,
        accentLighterHex: currentAccent.lighterHex,
        currentThemeConfig,
        applyPreset,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
