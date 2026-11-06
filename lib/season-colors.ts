export interface SeasonColorOption {
  id: string;
  label: string;
  hex: string;
}

export const DEFAULT_SEASON_COLOR = "#f59e0b"; // Ámbar

export const SEASON_COLOR_PALETTE: SeasonColorOption[] = [
  { id: "cobalt", label: "Cobalto", hex: "#3b82f6" },
  { id: "amber", label: "Ámbar", hex: "#f59e0b" },
  { id: "emerald", label: "Esmeralda", hex: "#10b981" },
  { id: "crimson", label: "Rubí", hex: "#f43f5e" },
  { id: "violet", label: "Violeta", hex: "#8b5cf6" },
  { id: "cyan", label: "Cian", hex: "#06b6d4" },
  { id: "orange", label: "Coral", hex: "#f97316" },
  { id: "pink", label: "Fucsia", hex: "#ec4899" },
  { id: "lime", label: "Lima", hex: "#84cc16" },
];

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== "string") return `rgba(245, 158, 11, ${alpha})`;
  const sanitized = hex.replace("#", "").trim();
  let r = 245;
  let g = 158;
  let b = 11;
  if (sanitized.length === 6) {
    r = parseInt(sanitized.substring(0, 2), 16) || 0;
    g = parseInt(sanitized.substring(2, 4), 16) || 0;
    b = parseInt(sanitized.substring(4, 6), 16) || 0;
  } else if (sanitized.length === 3) {
    r = parseInt(sanitized[0] + sanitized[0], 16) || 0;
    g = parseInt(sanitized[1] + sanitized[1], 16) || 0;
    b = parseInt(sanitized[2] + sanitized[2], 16) || 0;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getSeasonColor(season?: { color?: string | null } | null): string {
  return season?.color && season.color.trim() !== "" ? season.color.trim() : DEFAULT_SEASON_COLOR;
}

export type SeasonTailwindColor =
  | "blue"
  | "amber"
  | "emerald"
  | "red"
  | "violet"
  | "cyan"
  | "orange"
  | "pink"
  | "lime";

export interface SeasonThemeClasses {
  container: string;
  headerBorder: string;
  headerText: string;
  icon: string;
  badge: string;
  badgeDot: string;
  row1Dot: string;
  row1Value: string;
  row2Dot: string;
  row2Label: string;
  row2Value: string;
  nonWeightValue: string;
}

export const SEASON_THEMES: Record<SeasonTailwindColor, SeasonThemeClasses> = {
  blue: {
    container: "bg-gradient-to-br from-blue-500/10 via-zinc-900 to-zinc-900 border border-blue-500/25",
    headerBorder: "border-blue-500/20",
    headerText: "text-blue-400",
    icon: "text-blue-400",
    badge: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    badgeDot: "bg-blue-400",
    row1Dot: "bg-blue-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-blue-400",
    row2Label: "text-blue-400",
    row2Value: "text-blue-300",
    nonWeightValue: "text-blue-200",
  },
  amber: {
    container: "bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/25",
    headerBorder: "border-amber-500/20",
    headerText: "text-amber-400",
    icon: "text-amber-400",
    badge: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    badgeDot: "bg-amber-400",
    row1Dot: "bg-amber-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-amber-400",
    row2Label: "text-amber-400",
    row2Value: "text-amber-300",
    nonWeightValue: "text-amber-200",
  },
  emerald: {
    container: "bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-900 border border-emerald-500/25",
    headerBorder: "border-emerald-500/20",
    headerText: "text-emerald-400",
    icon: "text-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    badgeDot: "bg-emerald-400",
    row1Dot: "bg-emerald-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-emerald-400",
    row2Label: "text-emerald-400",
    row2Value: "text-emerald-300",
    nonWeightValue: "text-emerald-200",
  },
  red: {
    container: "bg-gradient-to-br from-red-500/10 via-zinc-900 to-zinc-900 border border-red-500/25",
    headerBorder: "border-red-500/20",
    headerText: "text-red-400",
    icon: "text-red-400",
    badge: "bg-red-500/10 border-red-500/20 text-red-300",
    badgeDot: "bg-red-400",
    row1Dot: "bg-red-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-red-400",
    row2Label: "text-red-400",
    row2Value: "text-red-300",
    nonWeightValue: "text-red-200",
  },
  violet: {
    container: "bg-gradient-to-br from-violet-500/10 via-zinc-900 to-zinc-900 border border-violet-500/25",
    headerBorder: "border-violet-500/20",
    headerText: "text-violet-400",
    icon: "text-violet-400",
    badge: "bg-violet-500/10 border-violet-500/20 text-violet-300",
    badgeDot: "bg-violet-400",
    row1Dot: "bg-violet-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-violet-400",
    row2Label: "text-violet-400",
    row2Value: "text-violet-300",
    nonWeightValue: "text-violet-200",
  },
  cyan: {
    container: "bg-gradient-to-br from-cyan-500/10 via-zinc-900 to-zinc-900 border border-cyan-500/25",
    headerBorder: "border-cyan-500/20",
    headerText: "text-cyan-400",
    icon: "text-cyan-400",
    badge: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300",
    badgeDot: "bg-cyan-400",
    row1Dot: "bg-cyan-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-cyan-400",
    row2Label: "text-cyan-400",
    row2Value: "text-cyan-300",
    nonWeightValue: "text-cyan-200",
  },
  orange: {
    container: "bg-gradient-to-br from-orange-500/10 via-zinc-900 to-zinc-900 border border-orange-500/25",
    headerBorder: "border-orange-500/20",
    headerText: "text-orange-400",
    icon: "text-orange-400",
    badge: "bg-orange-500/10 border-orange-500/20 text-orange-300",
    badgeDot: "bg-orange-400",
    row1Dot: "bg-orange-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-orange-400",
    row2Label: "text-orange-400",
    row2Value: "text-orange-300",
    nonWeightValue: "text-orange-200",
  },
  pink: {
    container: "bg-gradient-to-br from-pink-500/10 via-zinc-900 to-zinc-900 border border-pink-500/25",
    headerBorder: "border-pink-500/20",
    headerText: "text-pink-400",
    icon: "text-pink-400",
    badge: "bg-pink-500/10 border-pink-500/20 text-pink-300",
    badgeDot: "bg-pink-400",
    row1Dot: "bg-pink-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-pink-400",
    row2Label: "text-pink-400",
    row2Value: "text-pink-300",
    nonWeightValue: "text-pink-200",
  },
  lime: {
    container: "bg-gradient-to-br from-lime-500/10 via-zinc-900 to-zinc-900 border border-lime-500/25",
    headerBorder: "border-lime-500/20",
    headerText: "text-lime-400",
    icon: "text-lime-400",
    badge: "bg-lime-500/10 border-lime-500/20 text-lime-300",
    badgeDot: "bg-lime-400",
    row1Dot: "bg-lime-400/80",
    row1Value: "text-zinc-100",
    row2Dot: "bg-lime-400",
    row2Label: "text-lime-400",
    row2Value: "text-lime-300",
    nonWeightValue: "text-lime-200",
  },
};

const PALETTE_MAPPINGS: { hex: string; theme: SeasonTailwindColor }[] = [
  { hex: "#3b82f6", theme: "blue" },
  { hex: "#f59e0b", theme: "amber" },
  { hex: "#10b981", theme: "emerald" },
  { hex: "#f43f5e", theme: "red" },
  { hex: "#ff0000", theme: "red" },
  { hex: "#ef4444", theme: "red" },
  { hex: "#8b5cf6", theme: "violet" },
  { hex: "#06b6d4", theme: "cyan" },
  { hex: "#f97316", theme: "orange" },
  { hex: "#ec4899", theme: "pink" },
  { hex: "#84cc16", theme: "lime" },
];

function hexToRgb(hex: string): [number, number, number] {
  const sanitized = hex.replace("#", "").trim();
  const r = parseInt(sanitized.substring(0, 2), 16) || 0;
  const g = parseInt(sanitized.substring(2, 4), 16) || 0;
  const b = parseInt(sanitized.substring(4, 6), 16) || 0;
  return [r, g, b];
}

export function getSeasonTailwindTheme(hex?: string | null): SeasonThemeClasses {
  if (!hex) return SEASON_THEMES.amber;
  const [r, g, b] = hexToRgb(hex);
  let bestTheme: SeasonTailwindColor = "amber";
  let minDistance = Infinity;

  for (const item of PALETTE_MAPPINGS) {
    const [pr, pg, pb] = hexToRgb(item.hex);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < minDistance) {
      minDistance = dist;
      bestTheme = item.theme;
    }
  }

  return SEASON_THEMES[bestTheme];
}
