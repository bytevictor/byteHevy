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
