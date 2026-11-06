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
  | "light"
  | "paper"
  | "teenage"
  | "vaporwave"
  | "luxury";

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
  | "coral"
  | "custom";

export type Atmosphere = "clean" | "glow" | "grid" | "dots" | "aurora" | "grain" | "scanlines";

export type RadiusStyle = "sharp" | "soft" | "round" | "pill";

export type CardStyle =
  | "default"
  | "brutalist"
  | "teenage"
  | "vaporwave"
  | "luxury"
  | "hud"
  | "neon"
  | "minimal";

export type FontStyle = "sans" | "mono" | "editorial" | "display" | "serif" | "tech";

export interface RadiusOption {
  id: RadiusStyle;
  name: string;
  badge: string;
  description: string;
  cardRadius: string;
}

export const RADIUS_OPTIONS: RadiusOption[] = [
  {
    id: "sharp",
    name: "Sharp (0px)",
    badge: "Brutal / Terminal",
    description: "Esquinas 100% rectas y angulares sin curvatura. Estética técnica, industrial y neo-brutalista.",
    cardRadius: "0px",
  },
  {
    id: "soft",
    name: "Soft (8px)",
    badge: "Clásico Equilibrado",
    description: "Bordes sutilmente suavizados de precisión moderna. Equilibrado, nítido y contemporáneo.",
    cardRadius: "8px",
  },
  {
    id: "round",
    name: "Round (16px)",
    badge: "Moderno Suave",
    description: "Curvatura amplia y ergonómica. Suave al tacto y visualmente acogedor.",
    cardRadius: "16px",
  },
  {
    id: "pill",
    name: "Pill / Ultra (24px)",
    badge: "Orgánico & Atlético",
    description: "Esquinas ultra-redondeadas con botones y etiquetas en forma de cápsula deportiva.",
    cardRadius: "24px",
  },
];

export interface CardStyleOption {
  id: CardStyle;
  name: string;
  badge: string;
  description: string;
}

export const CARD_STYLE_OPTIONS: CardStyleOption[] = [
  {
    id: "default",
    name: "Estándar Sleek",
    badge: "Equilibrado",
    description: "Bordes nítidos de 1px con sombras de profundidad orgánica y superficies limpias.",
  },
  {
    id: "brutalist",
    name: "Neo-Brutalista",
    badge: "Oktavo Bold",
    description: "Bordes sólidos de 2px de tinta con sombra angular desplazada (4px 4px 0px) y botones 3D táctiles.",
  },
  {
    id: "teenage",
    name: "Teenage Hardware",
    badge: "OP-1 Industrial",
    description: "Chasis CNC mecanizado, pulsadores mecánicos táctiles 3D y marcas de ingeniería de precisión.",
  },
  {
    id: "vaporwave",
    name: "Vaporwave Neon",
    badge: "Retro 80s / Miami",
    description: "Resplandor dual magenta y cyan eléctrico, bordes neón iridiscentes y vibra retrofuturista.",
  },
  {
    id: "luxury",
    name: "Luxury Broadsheet",
    badge: "Kinfolk Minimal",
    description: "Líneas capilares aristocráticas, cero sombras, aire editorial de revista de arte y máxima sobriedad.",
  },
  {
    id: "hud",
    name: "Cyber HUD Terminal",
    badge: "Aeroespacial",
    description: "Bordes técnicos ultra-finos, micro-rejilla y estética de telemetría e instrumentación.",
  },
  {
    id: "neon",
    name: "Glow Neón",
    badge: "Atlético Neón",
    description: "Bordes perimetrales con halo de luz y sombras reactivas en el color de acento.",
  },
  {
    id: "minimal",
    name: "Minimalista Plano",
    badge: "Swiss Clean",
    description: "Cero sombras, líneas sobrias y máxima ligereza visual estilo editorial suizo.",
  },
];

export interface FontStyleOption {
  id: FontStyle;
  name: string;
  badge: string;
  description: string;
  sample: string;
}

export const FONT_STYLE_OPTIONS: FontStyleOption[] = [
  {
    id: "editorial",
    name: "Grotesque Editorial",
    badge: "Bricolage Grotesque",
    description: "Titulares de alto impacto con ink-traps de imprenta artesanal y cartel de diseño.",
    sample: "RÉCORD HISTÓRICO 140 KG",
  },
  {
    id: "mono",
    name: "Monospace Terminal",
    badge: "JetBrains Mono",
    description: "Consola técnica y telemetría de entrenamiento con dígitos tabulares precisos.",
    sample: "[REC] 140.0 KG // 08:32:15",
  },
  {
    id: "sans",
    name: "Modern Clean Sans",
    badge: "Plus Jakarta Sans",
    description: "Sans-serif geométrica contemporánea, ultra-limpia y neutral.",
    sample: "byteHevy Pro · 140 kg",
  },
  {
    id: "display",
    name: "Futuristic Display",
    badge: "Space Grotesk / Syne",
    description: "Proporciones anchas y geometría vanguardista de cartel deportivo y futurista.",
    sample: "MAX EFFORT · PULL 210",
  },
  {
    id: "serif",
    name: "Editorial Luxury Serif",
    badge: "Instrument Serif",
    description: "Elegancia clásica de alta costura y publicaciones de diseño editorial.",
    sample: "Session de Musculation Royale",
  },
  {
    id: "tech",
    name: "Tactical Mech HUD",
    badge: "Chakra Petch",
    description: "Ángulos cortados de aviación, exoesqueleto y hardware táctico militar.",
    sample: "ARMOR // BENCH PRESS 120",
  },
];

export interface AtmosphereOption {
  id: Atmosphere;
  name: string;
  badge: string;
  description: string;
}

export const ATMOSPHERE_OPTIONS: AtmosphereOption[] = [
  {
    id: "clean",
    name: "Limpio & Plano",
    badge: "Minimal",
    description: "Superficie minimalista sin reflejos ni tramas de fondo",
  },
  {
    id: "grain",
    name: "Grano Riso / Papel",
    badge: "Oktavo Riso",
    description: "Textura analógica táctil de papel risográfico de imprenta artesanal",
  },
  {
    id: "grid",
    name: "Rejilla Blueprint",
    badge: "Técnico",
    description: "Trama técnica sutil estilo planos de ingeniería deportiva",
  },
  {
    id: "dots",
    name: "Matriz de Puntos",
    badge: "Halftone",
    description: "Patrón discreto de micropuntos halftone para textura tecnológica moderna",
  },
  {
    id: "scanlines",
    name: "Scanlines CRT",
    badge: "Retro CRT",
    description: "Líneas de barrido horizontales estilo monitor retro de terminal",
  },
  {
    id: "glow",
    name: "Resplandor Ambiental",
    badge: "Halo",
    description: "Halo de luz superior suave proyectado según tu color de acento",
  },
  {
    id: "aurora",
    name: "Aurora Boreal",
    badge: "Cosmos",
    description: "Gradientes cromáticos orgánicos profundos que iluminan la pantalla",
  },
];

export interface InkPairOption {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  tag: string;
}

export const OKTAVO_INK_PAIRS: InkPairOption[] = [
  { id: "fluo", name: "Fluo Pink + Teal", primary: "#ff48b0", secondary: "#00857c", tag: "Firma Oktavo" },
  { id: "tangerine", name: "Tangerine + Cobalt", primary: "#ff6c2f", secondary: "#2d5bb9", tag: "Editorial" },
  { id: "sunflower", name: "Sunflower + Raspberry", primary: "#ffc82e", secondary: "#d6336c", tag: "Calor Riso" },
  { id: "mint", name: "Mint + Grape", primary: "#3fd39a", secondary: "#7a3cc2", tag: "Fresco" },
  { id: "scarlet", name: "Scarlet + Lagoon", primary: "#ff3b3b", secondary: "#1d6a72", tag: "Volcánico" },
  { id: "lagoon", name: "Lagoon + Coral", primary: "#14b8b0", secondary: "#ff5a7a", tag: "Marítimo" },
  { id: "lilac", name: "Lilac + Orange", primary: "#b18cff", secondary: "#e8590c", tag: "Sintetizador" },
  { id: "lemon", name: "Lemon + Indigo", primary: "#e8f000", secondary: "#3d4ad6", tag: "Alto Voltaje" },
  { id: "coral", name: "Coral + Forest", primary: "#ff7a6b", secondary: "#3b7d3f", tag: "Botánico" },
  { id: "grape", name: "Grape + Gold", primary: "#8a4cf0", secondary: "#f2a20c", tag: "Real" },
  { id: "forest", name: "Forest + Pink", primary: "#2f9e5b", secondary: "#ff4f9a", tag: "Naturaleza" },
  { id: "mono", name: "Ink + Slate", primary: "#1f1b24", secondary: "#8a8590", tag: "Monocromo" },
];

export interface ComprehensivePreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: "brutalist" | "cyber" | "editorial" | "sport" | "luxury" | "minimal";
  theme: BaseTheme;
  accent: AccentColor;
  customAccentHex?: string;
  secondInk?: string;
  radius: RadiusStyle;
  cardStyle: CardStyle;
  atmosphere: Atmosphere;
  fontStyle: FontStyle;
  preview: {
    bgHex: string;
    cardHex: string;
    borderHex: string;
    accentHex: string;
    badge: string;
    borderWidth: string;
    hasOffsetShadow?: boolean;
    hasGlow?: boolean;
  };
}

export const COMPREHENSIVE_PRESETS: ComprehensivePreset[] = [
  {
    id: "classic-hevy",
    name: "ByteHevy Clásico",
    tagline: "El Estilo Original de la App",
    description: "Fondo neutro zinc oscuro con acento cobalto vibrante, esquinas redondeadas de 16px y superficie sobria para el día a día.",
    category: "sport",
    theme: "zinc",
    accent: "blue",
    radius: "round",
    cardStyle: "default",
    atmosphere: "clean",
    fontStyle: "sans",
    preview: {
      bgHex: "#09090b",
      cardHex: "#18181b",
      borderHex: "#27272a",
      accentHex: "#3b82f6",
      badge: "Original",
      borderWidth: "1px",
    },
  },
  {
    id: "oktavo-brutalist",
    name: "Oktavo Neo-Brutalist",
    tagline: "Cartel Editorial & Sombra Dura",
    description: "Papel crema cálido con bordes de 2px de tinta, esquinas vivas en 0px, sombras duras desplazadas (4px 4px 0px) y acento Fluo Pink risográfico.",
    category: "brutalist",
    theme: "paper",
    accent: "pink",
    customAccentHex: "#ff48b0",
    secondInk: "#00857c",
    radius: "sharp",
    cardStyle: "brutalist",
    atmosphere: "grain",
    fontStyle: "editorial",
    preview: {
      bgHex: "#f3eee3",
      cardHex: "#fbf8f1",
      borderHex: "#1f1b24",
      accentHex: "#ff48b0",
      badge: "Neo-Brutal",
      borderWidth: "2px",
      hasOffsetShadow: true,
    },
  },
  {
    id: "teenage-engineering",
    name: "Teenage Engineering OP-1",
    tagline: "Chasis de Hardware & Botones Clicky",
    description: "Aluminio anodizado mate CNC, pulsadores mecánicos táctiles 3D, marcas de ingeniería de precisión, acento Safety Orange y tipografía monospace quirúrgica.",
    category: "cyber",
    theme: "teenage",
    accent: "orange",
    customAccentHex: "#ff5500",
    secondInk: "#ff5500",
    radius: "soft",
    cardStyle: "teenage",
    atmosphere: "grid",
    fontStyle: "mono",
    preview: {
      bgHex: "#1c1e22",
      cardHex: "#262930",
      borderHex: "#3e434f",
      accentHex: "#ff5500",
      badge: "OP-1 Hardware",
      borderWidth: "1.5px",
      hasOffsetShadow: true,
    },
  },
  {
    id: "vaporwave-sunset",
    name: "Vaporwave Sunset 1989",
    tagline: "Horizonte Neón & Gradiente VHS",
    description: "Noche violeta de Miami con acento Neón Magenta & Cyan eléctrico, resplandor perimetral de sintetizador y tipografía display retrofuturista.",
    category: "cyber",
    theme: "vaporwave",
    accent: "pink",
    customAccentHex: "#ff71ce",
    secondInk: "#01cdfe",
    radius: "round",
    cardStyle: "vaporwave",
    atmosphere: "aurora",
    fontStyle: "display",
    preview: {
      bgHex: "#120c1f",
      cardHex: "#1c1330",
      borderHex: "#ff71ce",
      accentHex: "#ff71ce",
      badge: "Vaporwave",
      borderWidth: "1.5px",
      hasGlow: true,
    },
  },
  {
    id: "luxury-editorial",
    name: "Luxury Broadsheet Atelier",
    tagline: "Elegancia Alta Costura & Serif Itálica",
    description: "Lienzo espresso profundo con líneas capilares doradas, cero sombras, textura analógica de papel de lujo y tipografía Instrument Serif itálica.",
    category: "luxury",
    theme: "luxury",
    accent: "gold",
    customAccentHex: "#d4af37",
    secondInk: "#d4af37",
    radius: "soft",
    cardStyle: "luxury",
    atmosphere: "grain",
    fontStyle: "serif",
    preview: {
      bgHex: "#0e0d0c",
      cardHex: "#171513",
      borderHex: "#36302a",
      accentHex: "#d4af37",
      badge: "Haute Couture",
      borderWidth: "1px",
    },
  },
  {
    id: "cyber-hud",
    name: "Cyber HUD Terminal",
    tagline: "Telemetría Aeroespacial & CRT",
    description: "Negro OLED puro con acento Cian Eléctrico, esquinas técnicas de 0px, líneas scanline CRT y tipografía monospace completa.",
    category: "cyber",
    theme: "oled",
    accent: "cyan",
    radius: "sharp",
    cardStyle: "hud",
    atmosphere: "scanlines",
    fontStyle: "mono",
    preview: {
      bgHex: "#000000",
      cardHex: "#0a0a0c",
      borderHex: "#06b6d4",
      accentHex: "#06b6d4",
      badge: "Cyberpunk",
      borderWidth: "1px",
      hasGlow: true,
    },
  },
  {
    id: "neo-sport",
    name: "ByteHevy Neo-Sport",
    tagline: "Alto Rendimiento Neón",
    description: "Contraste atlético OLED con Lima Neón hiper-saturado, esquinas ultra-redondeadas en cápsula/pill (24px) y halo de resplandor deportivo.",
    category: "sport",
    theme: "oled",
    accent: "lime",
    radius: "pill",
    cardStyle: "neon",
    atmosphere: "glow",
    fontStyle: "sans",
    preview: {
      bgHex: "#000000",
      cardHex: "#0d0d10",
      borderHex: "#84cc16",
      accentHex: "#84cc16",
      badge: "Atlético",
      borderWidth: "1px",
      hasGlow: true,
    },
  },
  {
    id: "warm-riso",
    name: "Warm Editorial Riso",
    tagline: "Revista Risográfica Táctil",
    description: "Lienzo de papel editorial con esquinas suaves (8px), micropuntos halftone y acento Tangerine & Coral de imprenta artesanal.",
    category: "editorial",
    theme: "paper",
    accent: "coral",
    customAccentHex: "#f43f5e",
    radius: "soft",
    cardStyle: "default",
    atmosphere: "dots",
    fontStyle: "editorial",
    preview: {
      bgHex: "#f3eee3",
      cardHex: "#fbf8f1",
      borderHex: "#dfd7c5",
      accentHex: "#f43f5e",
      badge: "Editorial",
      borderWidth: "1px",
    },
  },
  {
    id: "obsidian-gold",
    name: "Obsidian & Gold Atelier",
    tagline: "Elegancia Sigilosa & Alta Joyería",
    description: "Carbón obsidiana profundo con acento Oro Olímpico refinado, bordes milimétricos suaves y acabado minimalista de alta gama.",
    category: "luxury",
    theme: "carbon",
    accent: "gold",
    radius: "round",
    cardStyle: "minimal",
    atmosphere: "clean",
    fontStyle: "sans",
    preview: {
      bgHex: "#121214",
      cardHex: "#1a1a1d",
      borderHex: "#2e2e33",
      accentHex: "#eab308",
      badge: "Lujo",
      borderWidth: "1px",
    },
  },
  {
    id: "kinfolk-serif",
    name: "Kinfolk Editorial Serif",
    tagline: "Elegancia Clásica de Publicación",
    description: "Atmósfera café espresso cálida con acento dorado suave, tipografía Instrument Serif itálica y textura analógica de papel.",
    category: "luxury",
    theme: "espresso",
    accent: "gold",
    radius: "soft",
    cardStyle: "minimal",
    atmosphere: "grain",
    fontStyle: "serif",
    preview: {
      bgHex: "#0c0908",
      cardHex: "#171210",
      borderHex: "#423631",
      accentHex: "#facc15",
      badge: "Editorial Serif",
      borderWidth: "1px",
    },
  },
  {
    id: "tactical-mech",
    name: "Tactical Mech HUD",
    tagline: "Exoesqueleto & Telemetría Militar",
    description: "Grafito de combate con acento Ámbar de advertencia, cuadrícula técnica táctica y tipografía angular Chakra Petch.",
    category: "cyber",
    theme: "carbon",
    accent: "amber",
    radius: "sharp",
    cardStyle: "hud",
    atmosphere: "grid",
    fontStyle: "tech",
    preview: {
      bgHex: "#121214",
      cardHex: "#1a1a1d",
      borderHex: "#f59e0b",
      accentHex: "#f59e0b",
      badge: "Tactical Mech",
      borderWidth: "1px",
      hasGlow: true,
    },
  },
  {
    id: "matrix-terminal",
    name: "Matrix Phosphor Terminal",
    tagline: "Consola Fósforo CRT Hacker",
    description: "Negro fósforo con acento verde hacker hiper-reactivo, scanlines CRT horizontales y monoespaciado puro JetBrains Mono.",
    category: "cyber",
    theme: "matrix",
    accent: "emerald",
    radius: "sharp",
    cardStyle: "hud",
    atmosphere: "scanlines",
    fontStyle: "mono",
    preview: {
      bgHex: "#020803",
      cardHex: "#06140a",
      borderHex: "#16401f",
      accentHex: "#10b981",
      badge: "Matrix CRT",
      borderWidth: "1px",
      hasGlow: true,
    },
  },
  {
    id: "synthwave-84",
    name: "Synthwave 1984",
    tagline: "Noche Retrofuturista",
    description: "Noche violeta synth con acento Ultra Violeta & Magenta, bordes neón con resplandor perimetral y atmósfera de aurora boreal.",
    category: "cyber",
    theme: "cyberpunk",
    accent: "violet",
    radius: "round",
    cardStyle: "neon",
    atmosphere: "aurora",
    fontStyle: "display",
    preview: {
      bgHex: "#0b0914",
      cardHex: "#141024",
      borderHex: "#8b5cf6",
      accentHex: "#8b5cf6",
      badge: "Synthwave",
      borderWidth: "1px",
      hasGlow: true,
    },
  },
  {
    id: "studio-minimal",
    name: "Swiss Studio Minimal",
    tagline: "Pureza Gráfica Monocroma",
    description: "Blanco studio impoluto con tinta platino oscura de máximo contraste, esquinas afiladas de 0px y pureza tipográfica suiza.",
    category: "minimal",
    theme: "light",
    accent: "platinum",
    radius: "sharp",
    cardStyle: "minimal",
    atmosphere: "clean",
    fontStyle: "sans",
    preview: {
      bgHex: "#f8fafc",
      cardHex: "#ffffff",
      borderHex: "#cbd5e1",
      accentHex: "#0f172a",
      badge: "Swiss Clean",
      borderWidth: "1px",
    },
  },
];

// Backward-compatibility export
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: BaseTheme;
  accent: AccentColor;
  atmosphere?: Atmosphere;
  tag?: string;
}

export const THEME_PRESETS: ThemePreset[] = COMPREHENSIVE_PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  theme: p.theme,
  accent: p.accent,
  atmosphere: p.atmosphere,
  tag: p.preview.badge,
}));

export interface BaseThemeOption {
  id: BaseTheme;
  name: string;
  category: "clasico" | "editorial" | "elemental" | "especial";
  description: string;
  bgHex: string;
  cardHex: string;
  subtleHex: string;
  hoverHex: string;
  borderHex: string;
  borderSubtleHex: string;
  foreground: string;
  textMutedHex: string;
  textFaintHex: string;
  headerBg: string;
  isLight?: boolean;
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
    subtleHex: "#0d0d10",
    hoverHex: "#27272a",
    borderHex: "#3f3f46",
    borderSubtleHex: "#27272a",
    foreground: "#fafafa",
    textMutedHex: "#a1a1aa",
    textFaintHex: "#71717a",
    headerBg: "rgba(9, 9, 11, 0.85)",
  },
  {
    id: "oled",
    name: "OLED Pitch Black",
    category: "clasico",
    description: "Negro puro (#000000) de máximo contraste y ahorro energético",
    bgHex: "#000000",
    cardHex: "#0a0a0c",
    subtleHex: "#050506",
    hoverHex: "#18181e",
    borderHex: "#27272a",
    borderSubtleHex: "#18181b",
    foreground: "#ffffff",
    textMutedHex: "#a1a1aa",
    textFaintHex: "#71717a",
    headerBg: "rgba(0, 0, 0, 0.9)",
  },
  {
    id: "carbon",
    name: "Carbon Matrix",
    category: "clasico",
    description: "Grafito cálido con textura de fibra de carbono",
    bgHex: "#121214",
    cardHex: "#1a1a1d",
    subtleHex: "#0f0f10",
    hoverHex: "#2b2b31",
    borderHex: "#3f3f46",
    borderSubtleHex: "#27272a",
    foreground: "#f4f4f5",
    textMutedHex: "#a1a1aa",
    textFaintHex: "#71717a",
    headerBg: "rgba(18, 18, 20, 0.85)",
  },
  {
    id: "midnight",
    name: "Midnight Slate",
    category: "clasico",
    description: "Azul noche espacial y analítico",
    bgHex: "#070a12",
    cardHex: "#0e1526",
    subtleHex: "#050810",
    hoverHex: "#192644",
    borderHex: "#23355e",
    borderSubtleHex: "#152038",
    foreground: "#f1f5f9",
    textMutedHex: "#94a3b8",
    textFaintHex: "#64748b",
    headerBg: "rgba(7, 10, 18, 0.85)",
  },
  {
    id: "cyberpunk",
    name: "Cyber Dusk",
    category: "clasico",
    description: "Atmósfera nocturna con matiz violeta profundo y sintetizador",
    bgHex: "#0b0914",
    cardHex: "#141024",
    subtleHex: "#08060f",
    hoverHex: "#241d40",
    borderHex: "#3b2d66",
    borderSubtleHex: "#241c42",
    foreground: "#f5f3ff",
    textMutedHex: "#a78bfa",
    textFaintHex: "#7c3aed",
    headerBg: "rgba(11, 9, 20, 0.85)",
  },

  // 2. Editoriales & Claros
  {
    id: "paper",
    name: "Papel Crema (Editorial)",
    category: "editorial",
    description: "Lienzo cálido crema (#f3eee3) con tinta oscura y estética risográfica, estilo Oktavo",
    bgHex: "#f3eee3",
    cardHex: "#fbf8f1",
    subtleHex: "#ebe4d4",
    hoverHex: "#ede6d6",
    borderHex: "#dfd7c5",
    borderSubtleHex: "rgba(31, 27, 36, 0.14)",
    foreground: "#1f1b24",
    textMutedHex: "#5c5564",
    textFaintHex: "#80778a",
    headerBg: "rgba(243, 238, 227, 0.94)",
    isLight: true,
  },
  {
    id: "light",
    name: "Studio Minimal",
    category: "editorial",
    description: "Modo claro minimalista en blanco puro para entrenos bajo el sol",
    bgHex: "#f8fafc",
    cardHex: "#ffffff",
    subtleHex: "#f1f5f9",
    hoverHex: "#e2e8f0",
    borderHex: "#cbd5e1",
    borderSubtleHex: "#e2e8f0",
    foreground: "#0f172a",
    textMutedHex: "#64748b",
    textFaintHex: "#94a3b8",
    headerBg: "rgba(248, 250, 252, 0.92)",
    isLight: true,
  },

  // 3. Atmósferas Elementales
  {
    id: "abyss",
    name: "Abyssal Ocean",
    category: "elemental",
    description: "Azul marino abisal profundo y misterioso",
    bgHex: "#030712",
    cardHex: "#081026",
    subtleHex: "#02040b",
    hoverHex: "#132454",
    borderHex: "#1f387d",
    borderSubtleHex: "#111e42",
    foreground: "#f1f5f9",
    textMutedHex: "#94a3b8",
    textFaintHex: "#60a5fa",
    headerBg: "rgba(3, 7, 18, 0.88)",
  },
  {
    id: "forest",
    name: "Nordic Moss",
    category: "elemental",
    description: "Verde bosque esmeralda y musgo nórdico sereno",
    bgHex: "#040a06",
    cardHex: "#0a140e",
    subtleHex: "#020603",
    hoverHex: "#152a1d",
    borderHex: "#1e3d2a",
    borderSubtleHex: "#112418",
    foreground: "#f0fdf4",
    textMutedHex: "#86efac",
    textFaintHex: "#22c55e",
    headerBg: "rgba(4, 10, 6, 0.88)",
  },
  {
    id: "espresso",
    name: "Warm Espresso",
    category: "elemental",
    description: "Tonos café moca oscuro y madera tostada elegante",
    bgHex: "#0c0908",
    cardHex: "#171210",
    subtleHex: "#080605",
    hoverHex: "#2a221f",
    borderHex: "#423631",
    borderSubtleHex: "#261f1c",
    foreground: "#faf5f0",
    textMutedHex: "#cbb5a1",
    textFaintHex: "#927e6d",
    headerBg: "rgba(12, 9, 8, 0.88)",
  },
  {
    id: "crimson",
    name: "Iron & Forge",
    category: "elemental",
    description: "Hierro forjado y carmesí volcánico de máxima intensidad",
    bgHex: "#0b0507",
    cardHex: "#170b10",
    subtleHex: "#070304",
    hoverHex: "#2d1621",
    borderHex: "#4a2337",
    borderSubtleHex: "#2b141f",
    foreground: "#fff1f2",
    textMutedHex: "#fda4af",
    textFaintHex: "#e11d48",
    headerBg: "rgba(11, 5, 7, 0.88)",
  },

  // 4. Especiales
  {
    id: "matrix",
    name: "Terminal CRT",
    category: "especial",
    description: "Negro puro con matiz fósforo hacker y vibe retro de terminal",
    bgHex: "#020803",
    cardHex: "#061208",
    subtleHex: "#030b05",
    hoverHex: "#0f2d16",
    borderHex: "#16401f",
    borderSubtleHex: "#0c2412",
    foreground: "#86efac",
    textMutedHex: "#4ade80",
    textFaintHex: "#15803d",
    headerBg: "rgba(2, 8, 3, 0.88)",
  },
  {
    id: "solar",
    name: "Solar Bronze",
    category: "especial",
    description: "Bronce cósmico cálido y resplandor de llamarada solar",
    bgHex: "#0d0a07",
    cardHex: "#17130e",
    subtleHex: "#080604",
    hoverHex: "#2b231a",
    borderHex: "#453729",
    borderSubtleHex: "#282018",
    foreground: "#fef3c7",
    textMutedHex: "#fcd34d",
    textFaintHex: "#d97706",
    headerBg: "rgba(13, 10, 7, 0.88)",
  },
  {
    id: "teenage",
    name: "Teenage Anodized",
    category: "especial",
    description: "Chasis de aluminio anodizado mate CNC (#1c1e22) con acento Safety Orange",
    bgHex: "#1c1e22",
    cardHex: "#262930",
    subtleHex: "#16181b",
    hoverHex: "#323640",
    borderHex: "#3e434f",
    borderSubtleHex: "#2a2d36",
    foreground: "#f3f4f6",
    textMutedHex: "#9ca3af",
    textFaintHex: "#717682",
    headerBg: "rgba(28, 30, 34, 0.92)",
  },
  {
    id: "vaporwave",
    name: "Vaporwave Dusk",
    category: "especial",
    description: "Atardecer digital violeta nocturno con acento Neón Magenta & Cyan eléctrico",
    bgHex: "#120c1f",
    cardHex: "#1c1330",
    subtleHex: "#0c0817",
    hoverHex: "#2a1c47",
    borderHex: "#7b3fe4",
    borderSubtleHex: "#3e2468",
    foreground: "#fff5fa",
    textMutedHex: "#c4a3e8",
    textFaintHex: "#ff71ce",
    headerBg: "rgba(18, 12, 31, 0.90)",
  },
  {
    id: "luxury",
    name: "Noir Espresso Atelier",
    category: "editorial",
    description: "Lino negro profundo y madera espresso (#0e0d0c) con reflejos dorados de alta costura",
    bgHex: "#0e0d0c",
    cardHex: "#171513",
    subtleHex: "#090807",
    hoverHex: "#24201d",
    borderHex: "#36302a",
    borderSubtleHex: "#221e1a",
    foreground: "#faf6f0",
    textMutedHex: "#b5a899",
    textFaintHex: "#d4af37",
    headerBg: "rgba(14, 13, 12, 0.92)",
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
  rgb: string;
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
    rgb: "245, 158, 11",
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
    rgb: "234, 179, 8",
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
    rgb: "132, 204, 22",
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
    rgb: "16, 185, 129",
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
    rgb: "20, 184, 166",
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
    rgb: "6, 182, 212",
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
    rgb: "59, 130, 246",
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
    rgb: "99, 102, 241",
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
    rgb: "139, 92, 246",
  },
  {
    id: "pink",
    name: "Fluo Pink (Oktavo)",
    hex: "#ff48b0",
    lightHex: "#ff6ec0",
    lighterHex: "#ffa3d7",
    darkHex: "#e02693",
    glow: "rgba(255, 72, 176, 0.28)",
    subtle: "rgba(255, 72, 176, 0.12)",
    border: "rgba(255, 72, 176, 0.4)",
    rgb: "255, 72, 176",
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
    rgb: "251, 113, 133",
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
    rgb: "244, 63, 94",
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
    rgb: "225, 29, 72",
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
    rgb: "249, 115, 22",
  },
  {
    id: "platinum",
    name: "Platino / Tinta",
    hex: "#e4e4e7",
    lightHex: "#ffffff",
    lighterHex: "#ffffff",
    darkHex: "#a1a1aa",
    glow: "rgba(255, 255, 255, 0.25)",
    subtle: "rgba(255, 255, 255, 0.1)",
    border: "rgba(255, 255, 255, 0.35)",
    rgb: "228, 228, 231",
  },
];

// Helper functions for dynamic custom colors
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 245, g: 158, b: 11 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 + percent / 100;
  const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
  const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
  const newB = Math.min(255, Math.max(0, Math.round(b * factor)));
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

export function computeAccentDetails(hex: string): AccentColorOption {
  const { r, g, b } = hexToRgb(hex);
  return {
    id: "custom",
    name: `Personalizado (${hex.toUpperCase()})`,
    hex,
    lightHex: adjustBrightness(hex, 18),
    lighterHex: adjustBrightness(hex, 35),
    darkHex: adjustBrightness(hex, -20),
    glow: hexToRgba(hex, 0.28),
    subtle: hexToRgba(hex, 0.12),
    border: hexToRgba(hex, 0.38),
    rgb: `${r}, ${g}, ${b}`,
  };
}

export function applyThemeToDOM(
  themeId: BaseTheme,
  accentId: AccentColor,
  atmosphereId: Atmosphere = "clean",
  radiusId: RadiusStyle = "round",
  cardStyleId: CardStyle = "default",
  fontStyleId: FontStyle = "sans",
  customHex?: string | null
) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;

  let currentAccent: AccentColorOption;
  if (accentId === "custom" && customHex) {
    currentAccent = computeAccentDetails(customHex);
  } else {
    currentAccent = ACCENT_COLORS.find((a) => a.id === accentId) || ACCENT_COLORS[0];
  }

  const currentTheme = BASE_THEMES.find((t) => t.id === themeId) || BASE_THEMES[0];

  // Set data attributes for global styling
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-accent", accentId);
  root.setAttribute("data-atmosphere", atmosphereId);
  root.setAttribute("data-radius", radiusId);
  root.setAttribute("data-card-style", cardStyleId);
  root.setAttribute("data-font-style", fontStyleId);

  if (body) {
    body.setAttribute("data-theme", themeId);
    body.setAttribute("data-accent", accentId);
    body.setAttribute("data-atmosphere", atmosphereId);
    body.setAttribute("data-radius", radiusId);
    body.setAttribute("data-card-style", cardStyleId);
    body.setAttribute("data-font-style", fontStyleId);
  }

  // Synchronize dark class for Tailwind v4
  root.classList.toggle("dark", !currentTheme.isLight);

  // Set CSS Variables
  root.style.setProperty("--accent", currentAccent.hex);
  root.style.setProperty("--accent-light", currentAccent.lightHex);
  root.style.setProperty("--accent-lighter", currentAccent.lighterHex);
  root.style.setProperty("--accent-dark", currentAccent.darkHex);
  root.style.setProperty("--accent-glow", currentAccent.glow);
  root.style.setProperty("--accent-subtle", currentAccent.subtle);
  root.style.setProperty("--accent-border", currentAccent.border);
  root.style.setProperty("--accent-rgb", currentAccent.rgb);

  root.style.setProperty("--background", currentTheme.bgHex);
  root.style.setProperty("--foreground", currentTheme.foreground);
  root.style.setProperty("--surface", currentTheme.cardHex);
  root.style.setProperty("--surface-card", currentTheme.cardHex);
  root.style.setProperty("--surface-subtle", currentTheme.subtleHex);
  root.style.setProperty("--surface-hover", currentTheme.hoverHex);
  root.style.setProperty("--header-bg", currentTheme.headerBg);
  root.style.setProperty("--border-color", currentTheme.borderHex);
  root.style.setProperty("--border-subtle", currentTheme.borderSubtleHex);
  root.style.setProperty("--text-primary", currentTheme.foreground);
  root.style.setProperty("--text-muted", currentTheme.textMutedHex);
  root.style.setProperty("--text-faint", currentTheme.textFaintHex);

  // Set shadow color for brutalist mode
  const shadowColor = currentTheme.isLight ? "#1f1b24" : "#000000";
  root.style.setProperty("--shadow-ink", shadowColor);
}

interface ThemeContextType {
  theme: BaseTheme;
  setTheme: (theme: BaseTheme) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  customAccentHex: string | null;
  setCustomAccent: (hex: string) => void;
  selectedInkPairId: string | null;
  setInkPair: (pair: InkPairOption) => void;
  secondInk: string;
  setSecondInk: (hex: string) => void;
  atmosphere: Atmosphere;
  setAtmosphere: (atmosphere: Atmosphere) => void;
  radius: RadiusStyle;
  setRadius: (radius: RadiusStyle) => void;
  cardStyle: CardStyle;
  setCardStyle: (style: CardStyle) => void;
  fontStyle: FontStyle;
  setFontStyle: (font: FontStyle) => void;
  activePresetId: string | null;
  accentHex: string;
  accentLightHex: string;
  accentLighterHex: string;
  currentThemeConfig: BaseThemeOption;
  applyPreset: (preset: ThemePreset) => void;
  applyComprehensivePreset: (preset: ComprehensivePreset) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BaseTheme>("zinc");
  const [accent, setAccentState] = useState<AccentColor>("blue");
  const [customAccentHex, setCustomAccentHexState] = useState<string | null>(null);
  const [selectedInkPairId, setSelectedInkPairId] = useState<string | null>(null);
  const [secondInk, setSecondInkState] = useState<string>("#ff5500");
  const [atmosphere, setAtmosphereState] = useState<Atmosphere>("clean");
  const [radius, setRadiusState] = useState<RadiusStyle>("round");
  const [cardStyle, setCardStyleState] = useState<CardStyle>("default");
  const [fontStyle, setFontStyleState] = useState<FontStyle>("sans");
  const [activePresetId, setActivePresetIdState] = useState<string | null>("classic-hevy");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("bytehevy_theme") as BaseTheme | null;
      const savedAccent = localStorage.getItem("bytehevy_accent") as AccentColor | null;
      const savedCustom = localStorage.getItem("bytehevy_custom_accent");
      const savedInkPair = localStorage.getItem("bytehevy_ink_pair");
      const savedSecondInk = localStorage.getItem("bytehevy_second_ink");
      const savedAtmo = localStorage.getItem("bytehevy_atmosphere") as Atmosphere | null;
      const savedRadius = localStorage.getItem("bytehevy_radius") as RadiusStyle | null;
      const savedCardStyle = localStorage.getItem("bytehevy_card_style") as CardStyle | null;
      const savedFontStyle = localStorage.getItem("bytehevy_font_style") as FontStyle | null;
      const savedPreset = localStorage.getItem("bytehevy_preset");

      const targetTheme = savedTheme && BASE_THEMES.some((t) => t.id === savedTheme) ? savedTheme : "zinc";
      const targetAccent = savedAccent && (savedAccent === "custom" || ACCENT_COLORS.some((a) => a.id === savedAccent)) ? savedAccent : "blue";
      const targetAtmo = savedAtmo && ATMOSPHERE_OPTIONS.some((o) => o.id === savedAtmo) ? savedAtmo : "clean";
      const targetRadius = savedRadius && RADIUS_OPTIONS.some((r) => r.id === savedRadius) ? savedRadius : "round";
      const targetCardStyle = savedCardStyle && CARD_STYLE_OPTIONS.some((c) => c.id === savedCardStyle) ? savedCardStyle : "default";
      const targetFontStyle = savedFontStyle && FONT_STYLE_OPTIONS.some((f) => f.id === savedFontStyle) ? savedFontStyle : "sans";
      const initialSecond = savedSecondInk || (targetTheme === "teenage" ? "#ff5500" : "#00857c");

      setThemeState(targetTheme);
      setAccentState(targetAccent);
      setCustomAccentHexState(savedCustom);
      setSelectedInkPairId(savedInkPair);
      setSecondInkState(initialSecond);
      setAtmosphereState(targetAtmo);
      setRadiusState(targetRadius);
      setCardStyleState(targetCardStyle);
      setFontStyleState(targetFontStyle);
      setActivePresetIdState(savedPreset);

      applyThemeToDOM(targetTheme, targetAccent, targetAtmo, targetRadius, targetCardStyle, targetFontStyle, savedCustom);
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--second", initialSecond);
      }
    } catch {}
  }, []);

  const setTheme = (newTheme: BaseTheme) => {
    setThemeState(newTheme);
    setActivePresetIdState(null);
    applyThemeToDOM(newTheme, accent, atmosphere, radius, cardStyle, fontStyle, customAccentHex);
    try {
      localStorage.setItem("bytehevy_theme", newTheme);
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    setSelectedInkPairId(null);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, newAccent, atmosphere, radius, cardStyle, fontStyle, customAccentHex);
    try {
      localStorage.setItem("bytehevy_accent", newAccent);
      localStorage.removeItem("bytehevy_preset");
      localStorage.removeItem("bytehevy_ink_pair");
    } catch {}
  };

  const setCustomAccent = (hex: string) => {
    setCustomAccentHexState(hex);
    setAccentState("custom");
    setSelectedInkPairId(null);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, "custom", atmosphere, radius, cardStyle, fontStyle, hex);
    try {
      localStorage.setItem("bytehevy_accent", "custom");
      localStorage.setItem("bytehevy_custom_accent", hex);
      localStorage.removeItem("bytehevy_preset");
      localStorage.removeItem("bytehevy_ink_pair");
    } catch {}
  };

  const setSecondInk = (hex: string) => {
    setSecondInkState(hex);
    setSelectedInkPairId(null);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--second", hex);
    }
    try {
      localStorage.setItem("bytehevy_second_ink", hex);
      localStorage.removeItem("bytehevy_ink_pair");
    } catch {}
  };

  const setInkPair = (pair: InkPairOption) => {
    setSelectedInkPairId(pair.id);
    setCustomAccentHexState(pair.primary);
    setAccentState("custom");
    setSecondInkState(pair.secondary);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, "custom", atmosphere, radius, cardStyle, fontStyle, pair.primary);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--second", pair.secondary);
    }
    try {
      localStorage.setItem("bytehevy_accent", "custom");
      localStorage.setItem("bytehevy_custom_accent", pair.primary);
      localStorage.setItem("bytehevy_second_ink", pair.secondary);
      localStorage.setItem("bytehevy_ink_pair", pair.id);
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const setAtmosphere = (newAtmo: Atmosphere) => {
    setAtmosphereState(newAtmo);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, accent, newAtmo, radius, cardStyle, fontStyle, customAccentHex);
    try {
      localStorage.setItem("bytehevy_atmosphere", newAtmo);
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const setRadius = (newRadius: RadiusStyle) => {
    setRadiusState(newRadius);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, accent, atmosphere, newRadius, cardStyle, fontStyle, customAccentHex);
    try {
      localStorage.setItem("bytehevy_radius", newRadius);
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const setCardStyle = (newStyle: CardStyle) => {
    setCardStyleState(newStyle);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, accent, atmosphere, radius, newStyle, fontStyle, customAccentHex);
    try {
      localStorage.setItem("bytehevy_card_style", newStyle);
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const setFontStyle = (newFont: FontStyle) => {
    setFontStyleState(newFont);
    setActivePresetIdState(null);
    applyThemeToDOM(theme, accent, atmosphere, radius, cardStyle, newFont, customAccentHex);
    try {
      localStorage.setItem("bytehevy_font_style", newFont);
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const applyComprehensivePreset = (preset: ComprehensivePreset) => {
    setThemeState(preset.theme);
    setAccentState(preset.accent);
    setCustomAccentHexState(preset.customAccentHex || null);
    setAtmosphereState(preset.atmosphere);
    setRadiusState(preset.radius);
    setCardStyleState(preset.cardStyle);
    setFontStyleState(preset.fontStyle);
    setActivePresetIdState(preset.id);

    if (preset.secondInk) {
      setSecondInkState(preset.secondInk);
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--second", preset.secondInk);
      }
      try {
        localStorage.setItem("bytehevy_second_ink", preset.secondInk);
      } catch {}
    }

    applyThemeToDOM(
      preset.theme,
      preset.accent,
      preset.atmosphere,
      preset.radius,
      preset.cardStyle,
      preset.fontStyle,
      preset.customAccentHex
    );

    try {
      localStorage.setItem("bytehevy_theme", preset.theme);
      localStorage.setItem("bytehevy_accent", preset.accent);
      if (preset.customAccentHex) {
        localStorage.setItem("bytehevy_custom_accent", preset.customAccentHex);
      } else {
        localStorage.removeItem("bytehevy_custom_accent");
      }
      localStorage.setItem("bytehevy_atmosphere", preset.atmosphere);
      localStorage.setItem("bytehevy_radius", preset.radius);
      localStorage.setItem("bytehevy_card_style", preset.cardStyle);
      localStorage.setItem("bytehevy_font_style", preset.fontStyle);
      localStorage.setItem("bytehevy_preset", preset.id);
    } catch {}
  };

  const applyPreset = (legacyPreset: ThemePreset) => {
    const compMatch = COMPREHENSIVE_PRESETS.find((p) => p.id === legacyPreset.id);
    if (compMatch) {
      applyComprehensivePreset(compMatch);
      return;
    }
    const atmo = legacyPreset.atmosphere || "clean";
    setThemeState(legacyPreset.theme);
    setAccentState(legacyPreset.accent);
    setAtmosphereState(atmo);
    setActivePresetIdState(legacyPreset.id);
    applyThemeToDOM(legacyPreset.theme, legacyPreset.accent, atmo, radius, cardStyle, fontStyle, customAccentHex);
  };

  const resetToDefault = () => {
    const defaultPreset = COMPREHENSIVE_PRESETS.find((p) => p.id === "classic-hevy") || COMPREHENSIVE_PRESETS[0];
    applyComprehensivePreset(defaultPreset);
    setSecondInkState("#00857c");
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--second", "#00857c");
    }
    try {
      localStorage.removeItem("bytehevy_theme");
      localStorage.removeItem("bytehevy_accent");
      localStorage.removeItem("bytehevy_custom_accent");
      localStorage.removeItem("bytehevy_second_ink");
      localStorage.removeItem("bytehevy_ink_pair");
      localStorage.removeItem("bytehevy_atmosphere");
      localStorage.removeItem("bytehevy_radius");
      localStorage.removeItem("bytehevy_card_style");
      localStorage.removeItem("bytehevy_font_style");
      localStorage.removeItem("bytehevy_preset");
    } catch {}
  };

  const currentThemeConfig = BASE_THEMES.find((t) => t.id === theme) || BASE_THEMES[0];
  let currentAccentConfig: AccentColorOption;
  if (accent === "custom" && customAccentHex) {
    currentAccentConfig = computeAccentDetails(customAccentHex);
  } else {
    currentAccentConfig = ACCENT_COLORS.find((a) => a.id === accent) || ACCENT_COLORS[0];
  }

  return (
    <ThemeContext.Provider
      value={{
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
        accentHex: currentAccentConfig.hex,
        accentLightHex: currentAccentConfig.lightHex,
        accentLighterHex: currentAccentConfig.lighterHex,
        currentThemeConfig,
        applyPreset,
        applyComprehensivePreset,
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
