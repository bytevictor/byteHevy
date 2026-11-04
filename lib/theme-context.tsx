"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type BaseTheme =
  | "zinc"
  | "oled"
  | "midnight"
  | "carbon"
  | "cyberpunk"
  | "abyss"
  | "forest"
  | "espresso"
  | "crimson"
  | "matrix"
  | "solar"
  | "light";

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
  | "platinum"
  | "gold"
  | "mint"
  | "ruby"
  | "indigo"
  | "coral";

export type Atmosphere = "clean" | "glow" | "grid" | "dots" | "aurora";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: BaseTheme;
  accent: AccentColor;
  atmosphere?: Atmosphere;
  tag?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "classic",
    name: "Hevy Clásico",
    description: "Look original con fondo neutro y acento amarillo cálido",
    theme: "zinc",
    accent: "amber",
    atmosphere: "clean",
    tag: "Original",
  },
  {
    id: "cyber-lime",
    name: "Cyber Lime",
    description: "Contraste OLED absoluto con lima neón deportivo y resplandor",
    theme: "oled",
    accent: "lime",
    atmosphere: "glow",
    tag: "Popular",
  },
  {
    id: "deep-space",
    name: "Deep Space",
    description: "Azul marino cósmico con cian eléctrico y rejilla Blueprint",
    theme: "midnight",
    accent: "cyan",
    atmosphere: "grid",
    tag: "Tech",
  },
  {
    id: "synthwave",
    name: "Neon Dusk",
    description: "Atmósfera nocturna con violeta brillante y aurora",
    theme: "cyberpunk",
    accent: "violet",
    atmosphere: "aurora",
  },
  {
    id: "volcano",
    name: "Blood & Iron",
    description: "Acero forjado con rubí de alta intensidad y aura de calor",
    theme: "crimson",
    accent: "ruby",
    atmosphere: "glow",
  },
  {
    id: "spartan-forest",
    name: "Nordic Spartan",
    description: "Verde bosque nórdico profundo con menta glacial",
    theme: "forest",
    accent: "mint",
    atmosphere: "aurora",
    tag: "Orgánico",
  },
  {
    id: "abyssal-depths",
    name: "Abyssal Trench",
    description: "Azul marino abisal profundo con matriz de puntos y cobalto",
    theme: "abyss",
    accent: "blue",
    atmosphere: "dots",
  },
  {
    id: "espresso-club",
    name: "Warm Espresso",
    description: "Tonos café moca y madera oscura con acento ámbar tostado",
    theme: "espresso",
    accent: "amber",
    atmosphere: "glow",
    tag: "Elegante",
  },
  {
    id: "matrix-runner",
    name: "Matrix CRT",
    description: "Negro hacker fósforo con rejilla técnica y lima puro",
    theme: "matrix",
    accent: "lime",
    atmosphere: "grid",
    tag: "Retro",
  },
  {
    id: "olympic-gold",
    name: "Oro Olímpico",
    description: "Contraste puro de podio con oro resplandeciente",
    theme: "oled",
    accent: "gold",
    atmosphere: "glow",
    tag: "Campeón",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    description: "Bronce cósmico con naranja fuego de alta energía",
    theme: "solar",
    accent: "orange",
    atmosphere: "aurora",
  },
  {
    id: "stealth-force",
    name: "Stealth Platinum",
    description: "Monocromo puro minimalista en negro absoluto",
    theme: "oled",
    accent: "platinum",
    atmosphere: "clean",
  },
  {
    id: "studio-paper",
    name: "Studio Minimal",
    description: "Modo claro minimalista para entrenar a plena luz del sol",
    theme: "light",
    accent: "indigo",
    atmosphere: "clean",
    tag: "Claro",
  },
];

export interface BaseThemeOption {
  id: BaseTheme;
  name: string;
  category: "clasico" | "elemental" | "especial";
  description: string;
  bgHex: string;
  cardHex: string;
  borderHex: string;
  foreground: string;
  headerBg: string;
}

export const BASE_THEMES: BaseThemeOption[] = [
  // 1. Clásicos & Neutros
  {
    id: "zinc",
    name: "Zinc Clásico",
    category: "clasico",
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
    category: "clasico",
    description: "Negro puro (#000000) de máximo contraste y ahorro energético",
    bgHex: "#000000",
    cardHex: "#0a0a0c",
    borderHex: "#1f1f23",
    foreground: "#ffffff",
    headerBg: "rgba(0, 0, 0, 0.9)",
  },
  {
    id: "carbon",
    name: "Carbon Matrix",
    category: "clasico",
    description: "Grafito cálido con textura de fibra de carbono",
    bgHex: "#121214",
    cardHex: "#1a1a1d",
    borderHex: "#2e2e33",
    foreground: "#f4f4f5",
    headerBg: "rgba(18, 18, 20, 0.85)",
  },
  {
    id: "midnight",
    name: "Midnight Slate",
    category: "clasico",
    description: "Azul noche espacial y analítico",
    bgHex: "#070a12",
    cardHex: "#0e1526",
    borderHex: "#1e293b",
    foreground: "#f1f5f9",
    headerBg: "rgba(7, 10, 18, 0.85)",
  },
  {
    id: "cyberpunk",
    name: "Cyber Dusk",
    category: "clasico",
    description: "Atmósfera nocturna con matiz violeta profundo y sintetizador",
    bgHex: "#0b0914",
    cardHex: "#141024",
    borderHex: "#2c224a",
    foreground: "#f5f3ff",
    headerBg: "rgba(11, 9, 20, 0.85)",
  },

  // 2. Atmósferas Elementales
  {
    id: "abyss",
    name: "Abyssal Ocean",
    category: "elemental",
    description: "Azul marino abisal profundo y misterioso",
    bgHex: "#030712",
    cardHex: "#081026",
    borderHex: "#152238",
    foreground: "#f1f5f9",
    headerBg: "rgba(3, 7, 18, 0.88)",
  },
  {
    id: "forest",
    name: "Nordic Moss",
    category: "elemental",
    description: "Verde bosque esmeralda y musgo nórdico sereno",
    bgHex: "#040a06",
    cardHex: "#0a140e",
    borderHex: "#162e20",
    foreground: "#f0fdf4",
    headerBg: "rgba(4, 10, 6, 0.88)",
  },
  {
    id: "espresso",
    name: "Warm Espresso",
    category: "elemental",
    description: "Tonos café moca oscuro y madera tostada elegante",
    bgHex: "#0c0908",
    cardHex: "#171210",
    borderHex: "#2e231f",
    foreground: "#faf5f0",
    headerBg: "rgba(12, 9, 8, 0.88)",
  },
  {
    id: "crimson",
    name: "Iron & Forge",
    category: "elemental",
    description: "Hierro forjado y carmesí volcánico de máxima intensidad",
    bgHex: "#0b0507",
    cardHex: "#170b10",
    borderHex: "#331521",
    foreground: "#fff1f2",
    headerBg: "rgba(11, 5, 7, 0.88)",
  },

  // 3. Especiales
  {
    id: "matrix",
    name: "Terminal CRT",
    category: "especial",
    description: "Negro puro con matiz fósforo hacker y vibe retro de terminal",
    bgHex: "#020803",
    cardHex: "#061208",
    borderHex: "#0d2913",
    foreground: "#86efac",
    headerBg: "rgba(2, 8, 3, 0.88)",
  },
  {
    id: "solar",
    name: "Solar Bronze",
    category: "especial",
    description: "Bronce cósmico cálido y resplandor de llamarada solar",
    bgHex: "#0d0a07",
    cardHex: "#17130e",
    borderHex: "#30261b",
    foreground: "#fef3c7",
    headerBg: "rgba(13, 10, 7, 0.88)",
  },
  {
    id: "light",
    name: "Studio Minimal",
    category: "especial",
    description: "Modo claro minimalista en blanco puro para entrenos bajo el sol",
    bgHex: "#f8fafc",
    cardHex: "#ffffff",
    borderHex: "#e2e8f0",
    foreground: "#0f172a",
    headerBg: "rgba(248, 250, 252, 0.92)",
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
    id: "gold",
    name: "Oro Olímpico",
    hex: "#eab308",
    lightHex: "#facc15",
    lighterHex: "#fde047",
    darkHex: "#ca8a04",
    glow: "rgba(234, 179, 8, 0.25)",
    subtle: "rgba(234, 179, 8, 0.1)",
    border: "rgba(234, 179, 8, 0.35)",
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
    id: "mint",
    name: "Menta Glacial",
    hex: "#14b8a6",
    lightHex: "#2dd4bf",
    lighterHex: "#5eead4",
    darkHex: "#0d9488",
    glow: "rgba(20, 184, 166, 0.25)",
    subtle: "rgba(20, 184, 166, 0.1)",
    border: "rgba(20, 184, 166, 0.35)",
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
    id: "indigo",
    name: "Índigo Profundo",
    hex: "#6366f1",
    lightHex: "#818cf8",
    lighterHex: "#a5b4fc",
    darkHex: "#4f46e5",
    glow: "rgba(99, 102, 241, 0.25)",
    subtle: "rgba(99, 102, 241, 0.1)",
    border: "rgba(99, 102, 241, 0.35)",
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
    id: "coral",
    name: "Coral Sunset",
    hex: "#fb7185",
    lightHex: "#f43f5e",
    lighterHex: "#fda4af",
    darkHex: "#e11d48",
    glow: "rgba(251, 113, 133, 0.25)",
    subtle: "rgba(251, 113, 133, 0.1)",
    border: "rgba(251, 113, 133, 0.35)",
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
    id: "ruby",
    name: "Rubí Sangre",
    hex: "#e11d48",
    lightHex: "#f43f5e",
    lighterHex: "#fb7185",
    darkHex: "#be123c",
    glow: "rgba(225, 29, 72, 0.25)",
    subtle: "rgba(225, 29, 72, 0.1)",
    border: "rgba(225, 29, 72, 0.35)",
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

export interface AtmosphereOption {
  id: Atmosphere;
  name: string;
  description: string;
}

export const ATMOSPHERE_OPTIONS: AtmosphereOption[] = [
  {
    id: "clean",
    name: "Limpio & Plano",
    description: "Superficie minimalista sin reflejos de fondo",
  },
  {
    id: "glow",
    name: "Resplandor Ambiental",
    description: "Halo de luz superior suave proyectado según tu color de acento",
  },
  {
    id: "grid",
    name: "Rejilla Blueprint",
    description: "Trama técnica sutil estilo planos de ingeniería deportiva",
  },
  {
    id: "dots",
    name: "Matriz de Puntos",
    description: "Patrón discreto de micropuntos para una textura tecnológica moderna",
  },
  {
    id: "aurora",
    name: "Aurora Boreal",
    description: "Gradientes cromáticos orgánicos profundos que iluminan suavemente la pantalla",
  },
];

export function applyThemeToDOM(
  themeId: BaseTheme,
  accentId: AccentColor,
  atmosphereId: Atmosphere = "clean"
) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;
  const currentAccent = ACCENT_COLORS.find((a) => a.id === accentId) || ACCENT_COLORS[0];
  const currentTheme = BASE_THEMES.find((t) => t.id === themeId) || BASE_THEMES[0];

  // Set data attributes for CSS rules
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-accent", accentId);
  root.setAttribute("data-atmosphere", atmosphereId);
  if (body) {
    body.setAttribute("data-atmosphere", atmosphereId);
    body.setAttribute("data-theme", themeId);
  }

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
  atmosphere: Atmosphere;
  setAtmosphere: (atmosphere: Atmosphere) => void;
  accentHex: string;
  accentLightHex: string;
  accentLighterHex: string;
  currentThemeConfig: BaseThemeOption;
  applyPreset: (preset: ThemePreset) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BaseTheme>("zinc");
  const [accent, setAccentState] = useState<AccentColor>("amber");
  const [atmosphere, setAtmosphereState] = useState<Atmosphere>("clean");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("bytehevy_theme") as BaseTheme | null;
      const savedAccent = localStorage.getItem("bytehevy_accent") as AccentColor | null;
      const savedAtmo = localStorage.getItem("bytehevy_atmosphere") as Atmosphere | null;

      const targetTheme = savedTheme && BASE_THEMES.some((t) => t.id === savedTheme) ? savedTheme : "zinc";
      const targetAccent = savedAccent && ACCENT_COLORS.some((a) => a.id === savedAccent) ? savedAccent : "amber";
      const targetAtmo = savedAtmo && ATMOSPHERE_OPTIONS.some((o) => o.id === savedAtmo) ? savedAtmo : "clean";

      setThemeState(targetTheme);
      setAccentState(targetAccent);
      setAtmosphereState(targetAtmo);
      applyThemeToDOM(targetTheme, targetAccent, targetAtmo);
    } catch {}
  }, []);

  const setTheme = (newTheme: BaseTheme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme, accent, atmosphere);
    try {
      localStorage.setItem("bytehevy_theme", newTheme);
    } catch {}
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    applyThemeToDOM(theme, newAccent, atmosphere);
    try {
      localStorage.setItem("bytehevy_accent", newAccent);
    } catch {}
  };

  const setAtmosphere = (newAtmo: Atmosphere) => {
    setAtmosphereState(newAtmo);
    applyThemeToDOM(theme, accent, newAtmo);
    try {
      localStorage.setItem("bytehevy_atmosphere", newAtmo);
    } catch {}
  };

  const applyPreset = (preset: ThemePreset) => {
    const atmo = preset.atmosphere || "clean";
    setThemeState(preset.theme);
    setAccentState(preset.accent);
    setAtmosphereState(atmo);
    applyThemeToDOM(preset.theme, preset.accent, atmo);
    try {
      localStorage.setItem("bytehevy_theme", preset.theme);
      localStorage.setItem("bytehevy_accent", preset.accent);
      localStorage.setItem("bytehevy_atmosphere", atmo);
    } catch {}
  };

  const resetToDefault = () => {
    setThemeState("zinc");
    setAccentState("amber");
    setAtmosphereState("clean");
    applyThemeToDOM("zinc", "amber", "clean");
    try {
      localStorage.removeItem("bytehevy_theme");
      localStorage.removeItem("bytehevy_accent");
      localStorage.removeItem("bytehevy_atmosphere");
    } catch {}
  };

  const currentThemeConfig = BASE_THEMES.find((t) => t.id === theme) || BASE_THEMES[0];
  const currentAccentConfig = ACCENT_COLORS.find((a) => a.id === accent) || ACCENT_COLORS[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        accent,
        setAccent,
        atmosphere,
        setAtmosphere,
        accentHex: currentAccentConfig.hex,
        accentLightHex: currentAccentConfig.lightHex,
        accentLighterHex: currentAccentConfig.lighterHex,
        currentThemeConfig,
        applyPreset,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
