"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ZapIcon,
  ActivityIcon,
  PercentIcon,
  CalendarIcon,
  ClockIcon,
  UploadCloudIcon,
  DownloadCloudIcon,
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  XIcon,
  CheckIcon,
  InfoIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  LinearLineIcon,
  SmoothLineIcon,
  FlowLineIcon,
  UserIcon,
  RefreshCwIcon,
  DatabaseIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  QrCodeIcon,
} from "./Icons";
import { useSeason } from "@/lib/season-context";
import { getSeasonColor, hexToRgba } from "@/lib/season-colors";
import { useUserProfile, getBmiCategory } from "@/lib/user-profile-context";
import { BmiMapModal } from "./BmiMapModal";
import { XiaomiSyncModal } from "./XiaomiSyncModal";
import {
  WeightRecord,
  generateMockWeightRecords,
  parseWeightCsv,
  getSampleCsvContent,
  estimateBodyComposition,
  enrichWithMovingAverages,
  aggregateRecordsByDay,
  aggregateRecordsAdaptive,
  WeightGroupingMode,
  DEFAULT_USER_PROFILE,
} from "@/lib/mock-weight-data";

export type WeightChartMode = "combined" | "weight_only" | "fat_only" | "trend" | "composition";
export type TimeRange = "1M" | "3M" | "6M" | "year" | "all";
export type CurveType = "linear" | "smooth" | "flow";
export type ProjectionHorizon = "none" | "2W" | "1M" | "2M" | "3M" | "6M";

export interface ProjectionData {
  horizon: ProjectionHorizon;
  days: number;
  targetTimestamp: number;
  targetDateLabel: string;
  currentWeight: number;
  projectedWeight: number;
  deltaWeight: number;
  kgPerWeek: number;
  hasFat: boolean;
  currentFatPct: number;
  projectedFatPct: number;
  deltaFatPct: number;
  fatPerWeek: number;
  currentLeanKg: number;
  projectedLeanKg: number;
  currentFatKg: number;
  projectedFatKg: number;
  confidence: "high" | "medium" | "low";
  sampleCount: number;
  windowDays: number;
}

export interface YearSegmentOption {
  id: string; // "1A" | "2026" | "2025" | ...
  label: string;
  shortLabel: string;
  subLabel: string;
  startTimestamp: number;
  endTimestamp: number;
  isLatest: boolean;
  isHistorical: boolean;
}

/**
 * Genera los tramos anuales navegables para iterar por año:
 * - "1A": Los últimos 365 días continuos desde la última toma.
 * - "2026", "2025", ...: Años naturales completos (1 Ene a 31 Dic).
 */
export function buildYearSegments(records: WeightRecord[]): YearSegmentOption[] {
  if (records.length === 0) return [];

  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const minTs = sorted[0].timestamp;
  const maxTs = sorted[sorted.length - 1].timestamp;
  const latestDate = new Date(maxTs);
  const earliestDate = new Date(minTs);
  const latestYear = latestDate.getFullYear();
  const earliestYear = earliestDate.getFullYear();

  const segments: YearSegmentOption[] = [];

  // 1. 1A (Último Año continuo): Los últimos 365 días continuos desde la última toma
  const oneYearAgoTs = new Date(
    latestDate.getFullYear() - 1,
    latestDate.getMonth(),
    latestDate.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  segments.push({
    id: "1A",
    label: "Último año (1A)",
    shortLabel: "1A",
    subLabel: `${new Date(oneYearAgoTs).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })} – ${latestDate.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })}`,
    startTimestamp: oneYearAgoTs,
    endTimestamp: maxTs + 86400000,
    isLatest: true,
    isHistorical: false,
  });

  // 2. Años naturales completos: latestYear (año en curso), latestYear - 1, ..., earliestYear
  for (let y = latestYear; y >= earliestYear; y--) {
    const startTs = new Date(y, 0, 1, 0, 0, 0, 0).getTime();
    const endTs = new Date(y, 11, 31, 23, 59, 59, 999).getTime();
    const isCurrent = y === latestYear;

    segments.push({
      id: String(y),
      label: `Año ${y}`,
      shortLabel: String(y),
      subLabel: `01/01/${y} – 31/12/${y}`,
      startTimestamp: startTs,
      endTimestamp: endTs,
      isLatest: isCurrent,
      isHistorical: !isCurrent,
    });
  }

  return segments;
}

/**
 * Generador de trazados SVG:
 * - "linear": Segmentos rectos directos entre puntos.
 * - "smooth": Monotone Cubic Spline (Fritsch-Carlson) sin sobreoscilación artificial.
 * - "flow": Catmull-Rom ultra-suave continuo y fluido.
 */
function buildPath(
  points: { x: number; y: number }[],
  curveType: CurveType,
  minY = 20,
  maxY = 400
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  if (points.length === 2 || curveType === "linear") {
    return points.reduce((acc, curr, i) => {
      return i === 0
        ? `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
        : `${acc} L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }, "");
  }

  if (curveType === "flow") {
    const n = points.length;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    const tension = 0.4;

    for (let i = 0; i < n - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < n - 2 ? points[i + 2] : p2;

      const spanX = p2.x - p1.x;
      if (spanX <= 0) {
        d += ` L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        continue;
      }

      const cp1x = p1.x + spanX * tension;
      const cp1y = Math.max(minY, Math.min(maxY, p1.y + (p2.y - p0.y) * tension * 0.5));

      const cp2x = p2.x - spanX * tension;
      const cp2y = Math.max(minY, Math.min(maxY, p2.y - (p3.y - p1.y) * tension * 0.5));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  // "smooth" - Monotone cubic spline (Fritsch-Carlson)
  const n = points.length;
  const dxs: number[] = [];
  const dys: number[] = [];
  const ms: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    ms.push(dx === 0 ? 0 : dy / dx);
  }

  const tangents: number[] = [ms[0]];
  for (let i = 1; i < n - 1; i++) {
    const m0 = ms[i - 1];
    const m1 = ms[i];
    if (m0 * m1 <= 0) {
      tangents.push(0);
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      const common = dx0 + dx1;
      tangents.push((3 * common) / ((common + dx1) / m0 + (common + dx0) / m1));
    }
  }
  tangents.push(ms[ms.length - 1]);

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p0.x + dx / 3;
    const cp1y = Math.max(minY, Math.min(maxY, p0.y + (tangents[i] * dx) / 3));
    const cp2x = p1.x - dx / 3;
    const cp2y = Math.max(minY, Math.min(maxY, p1.y - (tangents[i + 1] * dx) / 3));
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return d;
}

export function WeightTab() {
  const { activeSeason, activeSeasonId } = useSeason();
  const seasonColor = getSeasonColor(activeSeason);
  const { profile, calculateBmi, getBmiCategory, calculateFfmi, getIdealWeightRange } = useUserProfile();

  // Estado de registros de peso (cargados desde la base de datos SQLite)
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar registros desde /api/weight
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weight?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRecords(json.data);
      }
    } catch (err) {
      console.error("Error al cargar pesajes desde la base de datos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Estado de integración con Xiaomi Cloud
  const [xiaomiModalOpen, setXiaomiModalOpen] = useState(false);
  const [xiaomiAutoStartQr, setXiaomiAutoStartQr] = useState(false);
  const [xiaomiConnected, setXiaomiConnected] = useState(false);
  const [xiaomiUserId, setXiaomiUserId] = useState<string | null>(null);
  const [xiaomiLastSync, setXiaomiLastSync] = useState<string | null>(null);
  const [xiaomiSyncing, setXiaomiSyncing] = useState(false);
  const [xiaomiToast, setXiaomiToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const fetchXiaomiStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/xiaomi/status");
      if (res.ok) {
        const data = await res.json();
        setXiaomiConnected(!!data.is_connected);
        setXiaomiUserId(data.user_id || null);
        setXiaomiLastSync(data.last_sync || null);
      }
    } catch (e) {
      console.error("Error al obtener estado de Xiaomi Cloud:", e);
    }
  }, []);

  useEffect(() => {
    fetchXiaomiStatus();
  }, [fetchXiaomiStatus]);

  // Sincronización rápida desde el toolbar
  const handleXiaomiQuickSync = async () => {
    if (!xiaomiConnected) {
      setXiaomiAutoStartQr(true);
      setXiaomiModalOpen(true);
      return;
    }

    setXiaomiSyncing(true);
    setXiaomiToast(null);

    try {
      const res = await fetch("/api/xiaomi/sync", { method: "POST" });
      const data = await res.json();

      if (res.status === 401 || data.error === "SESSION_EXPIRED") {
        setXiaomiConnected(false);
        setXiaomiToast({
          type: "error",
          text: "Sesión caducada en Xiaomi Cloud. Pulsa para renovar mediante código QR.",
        });
        setXiaomiAutoStartQr(true);
        setXiaomiModalOpen(true);
      } else if (data.success) {
        const count = data.new_records_count || 0;
        setXiaomiToast({
          type: "success",
          text: count > 0 ? `¡Sincronizado! Se descargaron ${count} nuevos pesajes.` : "Tu historial ya está al día con Xiaomi Cloud.",
        });
        await loadRecords();
        await fetchXiaomiStatus();
        setTimeout(() => setXiaomiToast(null), 5000);
      } else {
        setXiaomiToast({
          type: "error",
          text: data.error || "Error al sincronizar con Xiaomi.",
        });
      }
    } catch (err: any) {
      setXiaomiToast({
        type: "error",
        text: `Error de conexión: ${err.message || err}`,
      });
    } finally {
      setXiaomiSyncing(false);
    }
  };

  // Recalcular BMI y composición cuando cambie el perfil de altura/edad en Configuración
  useEffect(() => {
    setRecords((prev) =>
      enrichWithMovingAverages(
        prev.map((r) => {
          const newBmi = profile.alturaCm > 0 ? calculateBmi(r.peso) : r.bmi;
          // Si el registro ya dispone de un % graso medido (de la báscula, Zepp Life, o manual), preservarlo
          if (typeof r.grasaPct === "number") {
            const ffmiData =
              r.masaMagraKg && profile.alturaCm > 0
                ? calculateFfmi(r.masaMagraKg)
                : null;
            return {
              ...r,
              bmi: newBmi || r.bmi,
              ffmi: ffmiData ? ffmiData.ffmi : r.ffmi,
            };
          }
          const comp = estimateBodyComposition(
            r.peso,
            r.impedancia || 520,
            r.impedanciaLow || 565,
            profile
          );
          return {
            ...r,
            grasaPct: comp.grasaPct,
            masaMagraKg: comp.masaMagraKg,
            masaGrasaKg: comp.masaGrasaKg,
            aguaPct: comp.aguaPct,
            bmi: newBmi || comp.bmi,
            ffmi: comp.ffmi,
          };
        })
      )
    );
  }, [profile.alturaCm, profile.edad, profile.sexo, calculateBmi, calculateFfmi]);

  // Filtros y vistas
  const [showWeight, setShowWeight] = useState<boolean>(true);
  const [showFat, setShowFat] = useState<boolean>(true);
  const [isTrendMode, setIsTrendMode] = useState<boolean>(false);
  const [curveType, setCurveType] = useState<CurveType>("smooth");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [selectedYearId, setSelectedYearId] = useState<string>("1A");
  const [yearDropdownOpen, setYearDropdownOpen] = useState<boolean>(false);
  const [projectionHorizon, setProjectionHorizon] = useState<ProjectionHorizon>("none");
  const [projectionDropdownOpen, setProjectionDropdownOpen] = useState<boolean>(false);
  const [groupingMode, setGroupingMode] = useState<WeightGroupingMode>("auto");
  const [syncWithSeason, setSyncWithSeason] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  // Modo derivado para retrocompatibilidad
  const chartMode: WeightChartMode = isTrendMode
    ? "trend"
    : showWeight && showFat
    ? "combined"
    : showWeight
    ? "weight_only"
    : showFat
    ? "fat_only"
    : "combined";

  // Cargar persistencia de opciones del gráfico desde localStorage
  useEffect(() => {
    try {
      const savedWeight = localStorage.getItem("bytehevy_weight_show_weight");
      if (savedWeight !== null) setShowWeight(savedWeight === "true");

      const savedFat = localStorage.getItem("bytehevy_weight_show_fat");
      if (savedFat !== null) setShowFat(savedFat === "true");

      const savedTrend = localStorage.getItem("bytehevy_weight_is_trend");
      if (savedTrend !== null) setIsTrendMode(savedTrend === "true");

      const savedCurve = localStorage.getItem("bytehevy_weight_curve_type");
      if (savedCurve === "linear" || savedCurve === "smooth" || savedCurve === "flow") {
        setCurveType(savedCurve);
      }

      const savedRange = localStorage.getItem("bytehevy_weight_time_range");
      if (
        savedRange === "1M" ||
        savedRange === "3M" ||
        savedRange === "6M" ||
        savedRange === "all"
      ) {
        setTimeRange(savedRange);
      } else if (savedRange === "1A" || savedRange === "year") {
        setTimeRange("year");
      }

      const savedYear = localStorage.getItem("bytehevy_weight_selected_year");
      if (savedYear && savedYear !== "YTD") {
        setSelectedYearId(savedYear);
      } else {
        setSelectedYearId("1A");
      }

      const savedGrouping = localStorage.getItem("bytehevy_weight_grouping_mode");
      if (savedGrouping === "auto" || savedGrouping === "daily" || savedGrouping === "weekly" || savedGrouping === "monthly") {
        setGroupingMode(savedGrouping);
      }

      const savedSyncSeason = localStorage.getItem("bytehevy_weight_sync_season");
      if (savedSyncSeason !== null) setSyncWithSeason(savedSyncSeason === "true");

      const savedProj = localStorage.getItem("bytehevy_weight_projection_horizon");
      if (
        savedProj === "none" ||
        savedProj === "2W" ||
        savedProj === "1M" ||
        savedProj === "2M" ||
        savedProj === "3M" ||
        savedProj === "6M"
      ) {
        setProjectionHorizon(savedProj);
      }
    } catch {}
  }, []);

  const handleToggleWeight = () => {
    if (isTrendMode) {
      setIsTrendMode(false);
      try {
        localStorage.setItem("bytehevy_weight_is_trend", "false");
      } catch {}
    }
    setShowWeight((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bytehevy_weight_show_weight", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleFat = () => {
    if (isTrendMode) {
      setIsTrendMode(false);
      try {
        localStorage.setItem("bytehevy_weight_is_trend", "false");
      } catch {}
    }
    setShowFat((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bytehevy_weight_show_fat", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleTrend = () => {
    setIsTrendMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bytehevy_weight_is_trend", String(next));
      } catch {}
      return next;
    });
  };

  const handleCurveChange = (c: CurveType) => {
    setCurveType(c);
    try {
      localStorage.setItem("bytehevy_weight_curve_type", c);
    } catch {}
  };

  const handleTimeRangeChange = (r: TimeRange) => {
    setTimeRange(r);
    try {
      localStorage.setItem("bytehevy_weight_time_range", r);
    } catch {}
  };

  const handleSelectYear = (yearId: string) => {
    setTimeRange("year");
    setSelectedYearId(yearId);
    try {
      localStorage.setItem("bytehevy_weight_time_range", "year");
      localStorage.setItem("bytehevy_weight_selected_year", yearId);
    } catch {}
  };

  const handleGroupingModeChange = (m: WeightGroupingMode) => {
    setGroupingMode(m);
    try {
      localStorage.setItem("bytehevy_weight_grouping_mode", m);
    } catch {}
  };

  const handleSyncSeasonChange = (val: boolean) => {
    setSyncWithSeason(val);
    try {
      localStorage.setItem("bytehevy_weight_sync_season", String(val));
    } catch {}
  };

  const handleProjectionChange = (h: ProjectionHorizon) => {
    setProjectionHorizon(h);
    setProjectionDropdownOpen(false);
    try {
      localStorage.setItem("bytehevy_weight_projection_horizon", h);
    } catch {}
  };

  // Modales
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [manualEntryModalOpen, setManualEntryModalOpen] = useState(false);
  const [bmiModalOpen, setBmiModalOpen] = useState(false);
  const [bmiModalWeight, setBmiModalWeight] = useState<number | undefined>(undefined);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<{
    records: WeightRecord[];
    errors: string[];
    validCount: number;
  } | null>(null);

  // Estado para editar / ver detalle de una entrada
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editImp, setEditImp] = useState("");
  const [editImpLow, setEditImpLow] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Formulario de pesaje manual nuevo
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTime, setNewTime] = useState("08:00");
  const [newWeight, setNewWeight] = useState("");
  const [newFat, setNewFat] = useState("");
  const [newImp, setNewImp] = useState("520");
  const [newImpLow, setNewImpLow] = useState("565");

  // Hover interactivo en el gráfico
  const [hoveredPoint, setHoveredPoint] = useState<WeightRecord | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const hoveredPointRef = useRef<WeightRecord | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Días con múltiples medidas: días expandidos en la tabla y modal de detalle del día
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selectedDayModal, setSelectedDayModal] = useState<WeightRecord | null>(null);
  const [tableGroupByDay, setTableGroupByDay] = useState<boolean>(true);

  const toggleExpandDay = useCallback((fecha: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) {
        next.delete(fecha);
      } else {
        next.add(fecha);
      }
      return next;
    });
  }, []);

  // Paginación de tabla
  const [tablePage, setTablePage] = useState(1);
  const pageSize = 15;

  // Abrir modal de edición con los datos del registro seleccionado
  const handleOpenEdit = useCallback((record: WeightRecord) => {
    setEditingRecord(record);
    setEditDate(record.fecha);
    setEditTime(record.hora);
    setEditWeight(String(record.peso));
    setEditFat(record.grasaPct !== null && record.grasaPct !== undefined ? String(record.grasaPct) : "");
    setEditImp(record.impedancia !== null && record.impedancia !== undefined ? String(Math.round(record.impedancia)) : "");
    setEditImpLow(record.impedanciaLow !== null && record.impedanciaLow !== undefined ? String(Math.round(record.impedanciaLow)) : "");
    setDeleteConfirmOpen(false);
  }, []);

  // Guardar cambios del registro editado
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const p = parseFloat(editWeight.replace(",", "."));
    const imp = editImp ? parseFloat(editImp) : null;
    const impLow = editImpLow ? parseFloat(editImpLow) : null;
    const parsedFat = editFat.trim() !== "" ? parseFloat(editFat.replace(",", ".")) : null;

    if (isNaN(p) || p <= 0) {
      alert("Por favor introduce un peso válido en kg");
      return;
    }

    const [y, m, d] = editDate.split("-").map(Number);
    const [hh, mm] = editTime.split(":").map(Number);
    const ts = new Date(y, (m || 1) - 1, d || 1, hh || 8, mm || 0).getTime();

    const newBmi = profile.alturaCm > 0 ? calculateBmi(p) : editingRecord.bmi;

    let finalGrasaPct: number | null = null;
    let finalMasaGrasaKg: number | null = null;
    let finalMasaMagraKg: number | null = null;
    let finalAguaPct: number | null = editingRecord.aguaPct;
    let finalFfmi: number | null = null;

    if (parsedFat !== null && !isNaN(parsedFat)) {
      finalGrasaPct = Math.round(parsedFat * 10) / 10;
      finalMasaGrasaKg = Math.round(p * (finalGrasaPct / 100) * 10) / 10;
      finalMasaMagraKg = Math.max(0, Math.round((p - finalMasaGrasaKg) * 10) / 10);
      if (profile.alturaCm > 0) {
        const ffmiData = calculateFfmi(finalMasaMagraKg);
        finalFfmi = ffmiData ? ffmiData.ffmi : null;
      }
    } else if (typeof editingRecord.grasaPct === "number") {
      finalGrasaPct = editingRecord.grasaPct;
      finalMasaGrasaKg = Math.round(p * (finalGrasaPct / 100) * 10) / 10;
      finalMasaMagraKg = Math.max(0, Math.round((p - finalMasaGrasaKg) * 10) / 10);
      if (profile.alturaCm > 0) {
        const ffmiData = calculateFfmi(finalMasaMagraKg);
        finalFfmi = ffmiData ? ffmiData.ffmi : null;
      }
    } else if (imp !== null && imp > 0) {
      const comp = estimateBodyComposition(p, imp, impLow || imp + 45, profile);
      finalGrasaPct = comp.grasaPct;
      finalMasaGrasaKg = comp.masaGrasaKg;
      finalMasaMagraKg = comp.masaMagraKg;
      finalAguaPct = comp.aguaPct;
      finalFfmi = comp.ffmi;
    } else {
      const comp = estimateBodyComposition(p, 520, 565, profile);
      finalGrasaPct = comp.grasaPct;
      finalMasaGrasaKg = comp.masaGrasaKg;
      finalMasaMagraKg = comp.masaMagraKg;
      finalAguaPct = comp.aguaPct;
      finalFfmi = comp.ffmi;
    }

    const updatedRecord: WeightRecord = {
      ...editingRecord,
      fecha: editDate,
      hora: editTime,
      timestamp: ts,
      peso: Math.round(p * 10) / 10,
      impedancia: imp,
      impedanciaLow: impLow,
      grasaPct: finalGrasaPct,
      masaMagraKg: finalMasaMagraKg,
      masaGrasaKg: finalMasaGrasaKg,
      aguaPct: finalAguaPct,
      bmi: newBmi || 0,
      ffmi: finalFfmi,
    };

    setRecords((prev) => enrichWithMovingAverages(prev.map((r) => (r.id === editingRecord.id ? updatedRecord : r))));
    setEditingRecord(null);

    // Si el modal de medidas del día está abierto, refrescarlo
    if (selectedDayModal) {
      const updatedList = (selectedDayModal.measurements || []).map((m) =>
        m.id === editingRecord.id ? updatedRecord : m
      );
      const agg = aggregateRecordsByDay(updatedList, profile)[0];
      setSelectedDayModal(agg || null);
    }

    try {
      await fetch("/api/weight", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRecord),
      });
    } catch (err) {
      console.error("Error al actualizar pesaje:", err);
    }
  };

  // Eliminar el registro en edición
  const handleDeleteCurrentEditing = async () => {
    if (!editingRecord) return;
    const idToDelete = editingRecord.id;
    setRecords((prev) => enrichWithMovingAverages(prev.filter((r) => r.id !== idToDelete)));
    setEditingRecord(null);
    setDeleteConfirmOpen(false);
    if (hoveredPoint?.id === idToDelete) {
      setHoveredPoint(null);
      setHoverX(null);
    }

    if (selectedDayModal) {
      const remaining = (selectedDayModal.measurements || []).filter((m) => m.id !== idToDelete);
      if (remaining.length === 0) {
        setSelectedDayModal(null);
      } else {
        const agg = aggregateRecordsByDay(remaining, profile)[0];
        setSelectedDayModal(agg || null);
      }
    }

    try {
      await fetch(`/api/weight?id=${encodeURIComponent(idToDelete)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Error al eliminar pesaje:", err);
    }
  };

  // Eliminar directamente desde la tabla o modal
  const handleDeleteRecord = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = records.find((r) => r.id === id);
    const msg = target
      ? `¿Eliminar el pesaje del ${target.fecha} a las ${target.hora} (${target.peso} kg)?`
      : "¿Eliminar este pesaje?";
    if (confirm(msg)) {
      setRecords((prev) => enrichWithMovingAverages(prev.filter((r) => r.id !== id)));
      if (editingRecord?.id === id) setEditingRecord(null);
      if (hoveredPoint?.id === id) {
        setHoveredPoint(null);
        setHoverX(null);
      }

      if (selectedDayModal) {
        const remaining = (selectedDayModal.measurements || []).filter((m) => m.id !== id);
        if (remaining.length === 0) {
          setSelectedDayModal(null);
        } else {
          const agg = aggregateRecordsByDay(remaining, profile)[0];
          setSelectedDayModal(agg || null);
        }
      }

      try {
        await fetch(`/api/weight?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Error al eliminar pesaje:", err);
      }
    }
  };

  // Eliminar todas las medidas de un día completo
  const handleDeleteDayGroup = async (dayRecord: WeightRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const count = dayRecord.measurements?.length || 1;
    if (count > 1) {
      if (confirm(`¿Eliminar las ${count} medidas registradas el día ${dayRecord.fecha}?`)) {
        const ids = (dayRecord.measurements || []).map((m) => m.id);
        setRecords((prev) => enrichWithMovingAverages(prev.filter((r) => !ids.includes(r.id))));
        if (selectedDayModal?.fecha === dayRecord.fecha) setSelectedDayModal(null);
        for (const id of ids) {
          try {
            await fetch(`/api/weight?id=${encodeURIComponent(id)}`, { method: "DELETE" });
          } catch (err) {
            console.error("Error al eliminar pesaje:", err);
          }
        }
      }
    } else {
      const singleId = dayRecord.measurements?.[0]?.id || dayRecord.id;
      handleDeleteRecord(singleId, e);
    }
  };

  // Tramos anuales disponibles según los datos reales
  const yearSegments = useMemo<YearSegmentOption[]>(() => {
    return buildYearSegments(records);
  }, [records]);

  const activeYearSegment = useMemo<YearSegmentOption | null>(() => {
    if (yearSegments.length === 0) return null;
    const found = yearSegments.find((s) => s.id === selectedYearId);
    return found || yearSegments[0];
  }, [yearSegments, selectedYearId]);

  const currentSegment = useMemo<YearSegmentOption | null>(() => {
    if (timeRange !== "year") return null;
    return activeYearSegment;
  }, [timeRange, activeYearSegment]);

  const currentYearIndex = useMemo(() => {
    if (yearSegments.length === 0) return -1;
    const targetId = activeYearSegment?.id || selectedYearId;
    const idx = yearSegments.findIndex((s) => s.id === targetId);
    return idx >= 0 ? idx : 0;
  }, [yearSegments, activeYearSegment, selectedYearId]);

  const canGoPrevYear = currentYearIndex >= 0 && currentYearIndex < yearSegments.length - 1;
  const canGoNextYear = currentYearIndex > 0;

  const prevYearSegment = canGoPrevYear ? yearSegments[currentYearIndex + 1] : null;
  const nextYearSegment = canGoNextYear ? yearSegments[currentYearIndex - 1] : null;

  const handlePrevYear = () => {
    if (timeRange !== "year") {
      // Si el usuario estaba en 1M/3M/6M/all y pulsa <, cambia al modo anual comenzando por el año en curso (o el primero disponible)
      if (yearSegments.length > 1) {
        handleSelectYear(yearSegments[1].id);
      } else if (yearSegments.length > 0) {
        handleSelectYear(yearSegments[0].id);
      }
      return;
    }
    if (canGoPrevYear && prevYearSegment) {
      handleSelectYear(prevYearSegment.id);
    }
  };

  const handleNextYear = () => {
    if (timeRange !== "year") {
      if (yearSegments.length > 0) {
        handleSelectYear(yearSegments[0].id);
      }
      return;
    }
    if (canGoNextYear && nextYearSegment) {
      handleSelectYear(nextYearSegment.id);
    }
  };

  // Filtrado de datos por rango temporal, tramo seleccionado y season (registros brutos)
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (syncWithSeason && activeSeason && activeSeasonId !== "all" && activeSeason.startTimestamp) {
      const seasonStart = activeSeason.startTimestamp * 1000;
      const seasonEnd = activeSeason.endTimestamp ? activeSeason.endTimestamp * 1000 : Infinity;
      result = result.filter((r) => r.timestamp >= seasonStart && r.timestamp <= seasonEnd);
    } else if (timeRange === "all") {
      // Todo el historial completo
    } else if (currentSegment) {
      result = result.filter(
        (r) => r.timestamp >= currentSegment.startTimestamp && r.timestamp <= currentSegment.endTimestamp
      );
    } else {
      const now = records.length > 0 ? records[records.length - 1].timestamp : Date.now();
      let days = 90;
      if (timeRange === "1M") days = 30;
      else if (timeRange === "3M") days = 90;
      else if (timeRange === "6M") days = 180;

      const cutoff = now - days * 24 * 3600 * 1000;
      result = result.filter((r) => r.timestamp >= cutoff);
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }, [records, timeRange, syncWithSeason, activeSeason, activeSeasonId, currentSegment]);

  // Agrupación adaptativa inteligente para la gráfica:
  // Cuando las medidas se amontonan (como en el TODO o en el peso anual "1A"),
  // la fórmula agrupa y calcula la media semanal o mensual para evitar solapamientos.
  const adaptiveResult = useMemo(() => {
    return aggregateRecordsAdaptive(filteredRecords, profile, groupingMode);
  }, [filteredRecords, profile, groupingMode]);

  const chartRecords = adaptiveResult.records;

  // Resumen de Métricas Clave (KPIs) basado en chartRecords
  const stats = useMemo(() => {
    if (chartRecords.length === 0) {
      return {
        latestWeight: 0,
        latestFat: 0,
        latestLean: 0,
        latestFatKg: 0,
        latestImp: 0,
        latestImpLow: 0,
        ma7Weight: 0,
        ma7Fat: 0,
        deltaWeightWeek: 0,
        deltaFatWeek: 0,
        deltaWeightTotal: 0,
        deltaFatTotal: 0,
        minWeight: 0,
        maxWeight: 0,
        count: 0,
        totalMeasurements: 0,
      };
    }

    const latest = chartRecords[chartRecords.length - 1];
    const first = chartRecords[0];

    const weekAgoTarget = latest.timestamp - 7 * 24 * 3600 * 1000;
    const weekAgoRecord =
      [...chartRecords].reverse().find((r) => r.timestamp <= weekAgoTarget) || first;

    const deltaWeightWeek = Math.round((latest.peso - weekAgoRecord.peso) * 100) / 100;
    const deltaWeightTotal = Math.round((latest.peso - first.peso) * 100) / 100;

    const latestFatRecord =
      [...chartRecords].reverse().find((r) => typeof r.grasaPct === "number" && !isNaN(r.grasaPct)) || latest;
    const firstFatRecord =
      chartRecords.find((r) => typeof r.grasaPct === "number" && !isNaN(r.grasaPct)) || first;
    const weekAgoFatRecord =
      [...chartRecords].reverse().find((r) => r.timestamp <= weekAgoTarget && typeof r.grasaPct === "number") || firstFatRecord;

    const deltaFatWeek =
      typeof latestFatRecord.grasaPct === "number" && typeof weekAgoFatRecord.grasaPct === "number"
        ? Math.round((latestFatRecord.grasaPct - weekAgoFatRecord.grasaPct) * 10) / 10
        : 0;
    const deltaFatTotal =
      typeof latestFatRecord.grasaPct === "number" && typeof firstFatRecord.grasaPct === "number"
        ? Math.round((latestFatRecord.grasaPct - firstFatRecord.grasaPct) * 10) / 10
        : 0;

    const weights = chartRecords.map((r) => r.peso);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    return {
      latestWeight: latest.peso,
      latestFat: latestFatRecord.grasaPct ?? 0,
      latestLean: latestFatRecord.masaMagraKg ?? 0,
      latestFatKg: latestFatRecord.masaGrasaKg ?? 0,
      latestImp: latestFatRecord.impedancia ?? 0,
      latestImpLow: latestFatRecord.impedanciaLow ?? 0,
      ma7Weight: latest.ma7Peso || latest.peso,
      ma7Fat: latest.ma7Grasa ?? latestFatRecord.grasaPct ?? 0,
      deltaWeightWeek,
      deltaFatWeek,
      deltaWeightTotal,
      deltaFatTotal,
      minWeight,
      maxWeight,
      count: chartRecords.length,
      totalMeasurements: filteredRecords.length,
    };
  }, [chartRecords, filteredRecords.length]);

  // Filtrado y ordenación de la tabla (agrupada por día o desglose total)
  const tableRecords = useMemo(() => {
    let baseList = tableGroupByDay
      ? aggregateRecordsByDay(records, profile)
      : [...records];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      baseList = baseList.filter((r) => {
        const matchesDate = r.fecha.includes(q);
        const matchesHora = r.hora.includes(q);
        const matchesPeso = String(r.peso).includes(q);
        const matchesGrasa = r.grasaPct !== null && String(r.grasaPct).includes(q);
        const matchesSub = r.measurements?.some(
          (m) =>
            m.fecha.includes(q) ||
            m.hora.includes(q) ||
            String(m.peso).includes(q) ||
            (m.grasaPct !== null && String(m.grasaPct).includes(q))
        );
        return matchesDate || matchesHora || matchesPeso || matchesGrasa || Boolean(matchesSub);
      });
    }

    baseList.sort((a, b) => (sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp));
    return baseList;
  }, [records, profile, tableGroupByDay, searchTerm, sortAsc]);

  const totalPages = Math.ceil(tableRecords.length / pageSize) || 1;
  const paginatedTableRecords = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return tableRecords.slice(start, start + pageSize);
  }, [tableRecords, tablePage]);

  // Manejo de CSV
  const handleParseCsv = (text: string) => {
    setCsvText(text);
    if (!text.trim()) {
      setCsvPreview(null);
      return;
    }
    const res = parseWeightCsv(text, profile);
    setCsvPreview({
      records: res.records,
      errors: res.errors,
      validCount: res.records.length,
    });
  };

  const handleApplyCsv = async () => {
    if (csvPreview && csvPreview.records.length > 0) {
      const toInsert = csvPreview.records;
      setRecords(toInsert);
      setCsvModalOpen(false);
      setCsvText("");
      setCsvPreview(null);

      try {
        await fetch("/api/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bulk", records: toInsert }),
        });
        await loadRecords();
      } catch (err) {
        console.error("Error al importar pesajes:", err);
      }
    }
  };

  const handleLoadSampleCsv = () => {
    const sample = getSampleCsvContent();
    handleParseCsv(sample);
  };

  const handleAddManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(newWeight.replace(",", "."));
    const imp = newImp ? parseFloat(newImp) : null;
    const impLow = newImpLow ? parseFloat(newImpLow) : null;
    const parsedFat = newFat.trim() !== "" ? parseFloat(newFat.replace(",", ".")) : null;

    if (isNaN(p) || p <= 0) {
      alert("Por favor introduce un peso válido en kg");
      return;
    }

    const [y, m, d] = newDate.split("-").map(Number);
    const [hh, mm] = newTime.split(":").map(Number);
    const ts = new Date(y, (m || 1) - 1, d || 1, hh || 8, mm || 0).getTime();

    let comp: {
      grasaPct: number;
      masaMagraKg: number;
      masaGrasaKg: number;
      aguaPct: number;
      bmi: number;
      ffmi: number;
    };

    if (parsedFat !== null && !isNaN(parsedFat)) {
      const fatPct = Math.round(parsedFat * 10) / 10;
      const masaGrasaKg = Math.round(p * (fatPct / 100) * 10) / 10;
      const masaMagraKg = Math.max(0, Math.round((p - masaGrasaKg) * 10) / 10);
      const bmi = profile.alturaCm > 0 ? calculateBmi(p) : 0;
      const ffmiData = masaMagraKg > 0 && profile.alturaCm > 0 ? calculateFfmi(masaMagraKg) : null;
      comp = {
        grasaPct: fatPct,
        masaMagraKg,
        masaGrasaKg,
        aguaPct: 55,
        bmi,
        ffmi: ffmiData ? ffmiData.ffmi : 0,
      };
    } else {
      comp = estimateBodyComposition(p, imp || 520, impLow || 565, profile);
    }

    const newRecord: WeightRecord = {
      id: `w-${Date.now()}`,
      fecha: newDate,
      hora: newTime,
      timestamp: ts,
      peso: Math.round(p * 10) / 10,
      impedancia: imp,
      impedanciaLow: impLow,
      grasaPct: comp.grasaPct,
      masaMagraKg: comp.masaMagraKg,
      masaGrasaKg: comp.masaGrasaKg,
      aguaPct: comp.aguaPct,
      bmi: comp.bmi,
      ffmi: comp.ffmi,
      altura: profile.alturaCm,
      source: "manual",
      esValido: true,
    };

    setRecords((prev) => enrichWithMovingAverages([...prev, newRecord]));
    setManualEntryModalOpen(false);
    setNewWeight("");
    setNewFat("");

    try {
      await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
      await loadRecords();
    } catch (err) {
      console.error("Error al registrar nuevo pesaje:", err);
    }
  };

  const handleReloadFromDb = () => {
    loadRecords();
  };

  // Dimensiones del gráfico SVG
  const svgWidth = 1000;
  const svgHeight = 360;
  const padding = { top: 30, right: 60, bottom: 45, left: 60 };
  const chartInnerWidth = svgWidth - padding.left - padding.right;
  const chartInnerHeight = svgHeight - padding.top - padding.bottom;

  // Análisis de tendencia para el modo "trend" (nube de puntos + línea de tendencia)
  const trendAnalysis = useMemo(() => {
    const rawPoints = filteredRecords.filter((r) => typeof r.peso === "number" && r.peso > 0);
    if (rawPoints.length < 2) return null;

    const n = rawPoints.length;
    const timestamps = rawPoints.map((r) => r.timestamp);
    const weights = rawPoints.map((r) => r.peso);

    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    // Regresión lineal por mínimos cuadrados: y = m*x + b
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = timestamps[i];
      const y = weights[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // Ritmo de cambio semanal en kg/semana (7 días)
    const msInWeek = 7 * 24 * 3600 * 1000;
    const kgPerWeek = Math.round(slope * msInWeek * 100) / 100;

    // Valores estimados en los extremos por la recta de regresión
    const startWeight = slope * minTs + intercept;
    const endWeight = slope * maxTs + intercept;
    const totalTrendDelta = Math.round((endWeight - startWeight) * 10) / 10;

    // Desviación típica de los residuos (amplitud de la nube de dispersión)
    let sumResSq = 0;
    for (let i = 0; i < n; i++) {
      const yHat = slope * timestamps[i] + intercept;
      const res = weights[i] - yHat;
      sumResSq += res * res;
    }
    const stdDev = Math.round(Math.sqrt(sumResSq / Math.max(1, n - 2)) * 100) / 100;

    // Tendencia dinámica exponencialmente suavizada (EMA con alpha = 0.12)
    const alpha = 0.12;
    let currentEma = weights[0];
    const emaSeries = rawPoints.map((r) => {
      currentEma = alpha * r.peso + (1 - alpha) * currentEma;
      return {
        id: r.id,
        timestamp: r.timestamp,
        rawWeight: r.peso,
        trendWeight: Math.round(currentEma * 100) / 100,
      };
    });

    return {
      n,
      slope,
      kgPerWeek,
      startWeight: Math.round(startWeight * 10) / 10,
      endWeight: Math.round(endWeight * 10) / 10,
      totalTrendDelta,
      stdDev,
      minTs,
      maxTs,
      rawPoints,
      emaSeries,
    };
  }, [filteredRecords]);

  // Proyección de peso y grasa según la tendencia del momento
  const projectionData = useMemo<ProjectionData | null>(() => {
    if (projectionHorizon === "none") return null;
    if (currentSegment && currentSegment.isLatest === false) return null;
    if (chartRecords.length < 2) return null;

    let days = 30;
    if (projectionHorizon === "2W") days = 14;
    else if (projectionHorizon === "1M") days = 30;
    else if (projectionHorizon === "2M") days = 60;
    else if (projectionHorizon === "3M") days = 90;
    else if (projectionHorizon === "6M") days = 180;

    // Calculamos la "tendencia del momento" sobre la ventana más reciente (últimos 45 días o 60 días)
    const sortedRaw = [...records].sort((a, b) => a.timestamp - b.timestamp);
    if (sortedRaw.length < 2) return null;

    const maxTs = sortedRaw[sortedRaw.length - 1].timestamp;
    let windowDays = 45;
    let recentRaw = sortedRaw.filter((r) => r.timestamp >= maxTs - windowDays * 86400000);

    if (recentRaw.length < 4) {
      windowDays = 90;
      recentRaw = sortedRaw.filter((r) => r.timestamp >= maxTs - windowDays * 86400000);
    }
    if (recentRaw.length < 2) {
      recentRaw = sortedRaw.slice(-10);
    }

    // Regresión lineal de peso
    const validWeights = recentRaw.filter((r) => typeof r.peso === "number" && r.peso > 0);
    if (validWeights.length < 2) return null;

    const nW = validWeights.length;
    let sumXW = 0, sumYW = 0, sumXYW = 0, sumXXW = 0;
    for (let i = 0; i < nW; i++) {
      const x = validWeights[i].timestamp;
      const y = validWeights[i].peso;
      sumXW += x;
      sumYW += y;
      sumXYW += x * y;
      sumXXW += x * x;
    }
    const denomW = nW * sumXXW - sumXW * sumXW;
    const slopeW = denomW !== 0 ? (nW * sumXYW - sumXW * sumYW) / denomW : 0;
    const kgPerWeek = Math.round(slopeW * (7 * 86400000) * 100) / 100;

    // Punto de partida de peso (MA-7 o último)
    const latestRecord = validWeights[validWeights.length - 1];
    const currentWeight = Math.round((latestRecord.ma7Peso || latestRecord.peso) * 10) / 10;
    const rawProjWeight = currentWeight + (kgPerWeek / 7) * days;
    const projectedWeight = Math.round(Math.max(30, Math.min(250, rawProjWeight)) * 10) / 10;
    const deltaWeight = Math.round((projectedWeight - currentWeight) * 10) / 10;

    // Regresión lineal de grasa
    const validFats = recentRaw.filter((r) => typeof r.grasaPct === "number" && !isNaN(r.grasaPct) && r.grasaPct > 0);
    const hasFat = validFats.length >= 2;
    let currentFatPct = 0;
    let projectedFatPct = 0;
    let deltaFatPct = 0;
    let fatPerWeek = 0;

    if (hasFat) {
      const nF = validFats.length;
      let sumXF = 0, sumYF = 0, sumXYF = 0, sumXXF = 0;
      for (let i = 0; i < nF; i++) {
        const x = validFats[i].timestamp;
        const y = validFats[i].grasaPct!;
        sumXF += x;
        sumYF += y;
        sumXYF += x * y;
        sumXXF += x * x;
      }
      const denomF = nF * sumXXF - sumXF * sumXF;
      const slopeF = denomF !== 0 ? (nF * sumXYF - sumXF * sumYF) / denomF : 0;
      fatPerWeek = Math.round(slopeF * (7 * 86400000) * 100) / 100;

      const latestFat = validFats[validFats.length - 1];
      currentFatPct = Math.round((latestFat.ma7Grasa || latestFat.grasaPct!) * 10) / 10;
      const rawProjFat = currentFatPct + (fatPerWeek / 7) * days;
      projectedFatPct = Math.round(Math.max(3, Math.min(60, rawProjFat)) * 10) / 10;
      deltaFatPct = Math.round((projectedFatPct - currentFatPct) * 10) / 10;
    }

    // Composición corporal proyectada
    const currentFatKg = hasFat ? Math.round(currentWeight * (currentFatPct / 100) * 10) / 10 : 0;
    const currentLeanKg = hasFat ? Math.round((currentWeight - currentFatKg) * 10) / 10 : 0;
    const projectedFatKg = hasFat ? Math.round(projectedWeight * (projectedFatPct / 100) * 10) / 10 : 0;
    const projectedLeanKg = hasFat ? Math.round((projectedWeight - projectedFatKg) * 10) / 10 : 0;

    const targetTimestamp = maxTs + days * 86400000;
    const targetDateLabel = new Date(targetTimestamp).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const confidence: "high" | "medium" | "low" =
      validWeights.length >= 10 ? "high" : validWeights.length >= 4 ? "medium" : "low";

    return {
      horizon: projectionHorizon,
      days,
      targetTimestamp,
      targetDateLabel,
      currentWeight,
      projectedWeight,
      deltaWeight,
      kgPerWeek,
      hasFat,
      currentFatPct,
      projectedFatPct,
      deltaFatPct,
      fatPerWeek,
      currentLeanKg,
      projectedLeanKg,
      currentFatKg,
      projectedFatKg,
      confidence,
      sampleCount: validWeights.length,
      windowDays,
    };
  }, [projectionHorizon, currentSegment, records, chartRecords]);

  // Escalas matemáticas para el gráfico
  const chartScales = useMemo(() => {
    if (chartRecords.length === 0) return null;

    const timestamps = filteredRecords.map((r) => r.timestamp);
    let minTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    let maxTime = timestamps.length > 0 ? Math.max(...timestamps) : 1;

    // Si hay un tramo específico activo (modo año), usar el dominio exacto del tramo
    // para preservar la proporción de año completo en el eje X
    if (currentSegment && timeRange === "year") {
      minTime = currentSegment.startTimestamp;
      maxTime = currentSegment.endTimestamp;
    } else if (timeRange === "1M" || timeRange === "3M" || timeRange === "6M") {
      const now = records.length > 0 ? records[records.length - 1].timestamp : Date.now();
      const days = timeRange === "1M" ? 30 : timeRange === "3M" ? 90 : 180;
      minTime = now - days * 86400000;
      maxTime = now;
    }

    // Si hay proyección activa, expandir maxTime hasta la fecha objetivo
    if (projectionData) {
      maxTime = Math.max(maxTime, projectionData.targetTimestamp);
    }
    const timeSpan = maxTime - minTime || 1;

    // Escala Peso (kg) - En modo trend incluimos los puntos de la nube para ajuste exacto
    const weights = chartMode === "trend" && trendAnalysis
      ? trendAnalysis.rawPoints.map((r) => r.peso)
      : chartRecords.map((r) => r.peso);
    const maWeights = chartRecords.map((r) => r.ma7Peso || r.peso);
    const allWeightVals = [...weights, ...maWeights];
    if (projectionData) {
      allWeightVals.push(projectionData.projectedWeight);
    }
    const rawMinW = Math.min(...allWeightVals);
    const rawMaxW = Math.max(...allWeightVals);
    const minWeight = Math.floor(rawMinW - 1);
    const maxWeight = Math.ceil(rawMaxW + 1);
    const weightSpan = maxWeight - minWeight || 1;

    // Escala % Graso
    const fats = chartRecords
      .map((r) => r.grasaPct)
      .filter((f): f is number => typeof f === "number" && !isNaN(f));
    const maFats = chartRecords
      .map((r) => r.ma7Grasa)
      .filter((f): f is number => typeof f === "number" && !isNaN(f));
    const allFatVals = [...fats, ...maFats];
    if (projectionData && projectionData.hasFat) {
      allFatVals.push(projectionData.projectedFatPct);
    }
    const rawMinF = allFatVals.length > 0 ? Math.min(...allFatVals) : 15;
    const rawMaxF = allFatVals.length > 0 ? Math.max(...allFatVals) : 25;
    const minFat = Math.floor(rawMinF - 1);
    const maxFat = Math.ceil(rawMaxF + 1);
    const fatSpan = maxFat - minFat || 1;

    const getX = (ts: number) => padding.left + ((ts - minTime) / timeSpan) * chartInnerWidth;
    const getYWeight = (w: number) =>
      padding.top + chartInnerHeight - ((w - minWeight) / weightSpan) * chartInnerHeight;
    const getYFat = (f: number) =>
      padding.top + chartInnerHeight - ((f - minFat) / fatSpan) * chartInnerHeight;

    return {
      minTime,
      maxTime,
      minWeight,
      maxWeight,
      minFat,
      maxFat,
      getX,
      getYWeight,
      getYFat,
    };
  }, [chartRecords, filteredRecords, chartInnerWidth, chartInnerHeight, padding, chartMode, trendAnalysis, currentSegment, timeRange, projectionData]);

  // Generador de rutas SVG respetando curveType ("linear" | "smooth" | "flow")
  const chartPaths = useMemo(() => {
    if (!chartScales || chartRecords.length === 0) return null;
    const { getX, getYWeight, getYFat } = chartScales;
    const bottomY = padding.top + chartInnerHeight;
    const firstX = getX(chartRecords[0].timestamp);
    const lastX = getX(chartRecords[chartRecords.length - 1].timestamp);

    // 1. Puntos de Peso Diario (media diaria)
    const weightPoints = chartRecords.map((r) => ({
      x: getX(r.timestamp),
      y: getYWeight(r.peso),
    }));
    const weightLine = buildPath(weightPoints, curveType, padding.top, bottomY);
    const weightArea = `${weightLine} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

    // 2. Puntos de Media Móvil 7D de Peso (suavizada con curveType)
    const maWeightPoints = chartRecords.map((r) => ({
      x: getX(r.timestamp),
      y: getYWeight(r.ma7Peso || r.peso),
    }));
    const maWeightLine = buildPath(maWeightPoints, curveType, padding.top, bottomY);

    // 3. Puntos de % Graso
    const validFatRecords = chartRecords.filter(
      (r) => typeof r.grasaPct === "number" && !isNaN(r.grasaPct!)
    );
    const fatPoints = validFatRecords.map((r) => ({
      x: getX(r.timestamp),
      y: getYFat(r.grasaPct!),
    }));
    const fatLine = buildPath(fatPoints, curveType, padding.top, bottomY);
    const fatFirstX = validFatRecords.length > 0 ? getX(validFatRecords[0].timestamp) : firstX;
    const fatLastX = validFatRecords.length > 0 ? getX(validFatRecords[validFatRecords.length - 1].timestamp) : lastX;
    const fatArea = `${fatLine} L ${fatLastX.toFixed(1)} ${bottomY} L ${fatFirstX.toFixed(1)} ${bottomY} Z`;

    // 4. Puntos de Media Móvil 7D de Grasa
    const validMaFatRecords = chartRecords.filter(
      (r) => typeof (r.ma7Grasa ?? r.grasaPct) === "number"
    );
    const maFatPoints = validMaFatRecords.map((r) => ({
      x: getX(r.timestamp),
      y: getYFat(r.ma7Grasa ?? r.grasaPct!),
    }));
    const maFatLine = buildPath(maFatPoints, curveType, padding.top, bottomY);

    // 5. Modo Composición (Masa Magra y Masa Grasa)
    const validLeanRecords = chartRecords.filter(
      (r) => typeof r.masaMagraKg === "number" && !isNaN(r.masaMagraKg!)
    );
    const leanPoints = validLeanRecords.map((r) => ({
      x: getX(r.timestamp),
      y: getYWeight(r.masaMagraKg!),
    }));
    const leanLine = buildPath(leanPoints, curveType, padding.top, bottomY);

    const validFatKgRecords = chartRecords.filter(
      (r) => typeof r.masaGrasaKg === "number" && !isNaN(r.masaGrasaKg!)
    );
    const fatKgPoints = validFatKgRecords.map((r) => ({
      x: getX(r.timestamp),
      y: getYWeight(r.masaGrasaKg!),
    }));
    const fatKgLine = buildPath(fatKgPoints, curveType, padding.top, bottomY);

    // 6. Modo Tendencia (Línea de tendencia suavizada, canal de dispersión y recta de regresión)
    let trendEmaLine = "";
    let trendRegressionLine = "";
    let trendBandArea = "";

    if (trendAnalysis && trendAnalysis.emaSeries.length > 0) {
      const emaPoints = trendAnalysis.emaSeries.map((p) => ({
        x: getX(p.timestamp),
        y: getYWeight(p.trendWeight),
      }));
      trendEmaLine = buildPath(emaPoints, curveType, padding.top, bottomY);

      // Recta de regresión global (inicio a fin)
      const regStartX = getX(trendAnalysis.minTs);
      const regStartY = getYWeight(trendAnalysis.startWeight);
      const regEndX = getX(trendAnalysis.maxTs);
      const regEndY = getYWeight(trendAnalysis.endWeight);
      trendRegressionLine = `M ${regStartX.toFixed(1)} ${regStartY.toFixed(1)} L ${regEndX.toFixed(1)} ${regEndY.toFixed(1)}`;

      // Banda de dispersión de la nube (± 1 desviación típica)
      const upperPoints = trendAnalysis.emaSeries.map((p) => ({
        x: getX(p.timestamp),
        y: getYWeight(p.trendWeight + trendAnalysis.stdDev),
      }));
      const lowerPoints = trendAnalysis.emaSeries.map((p) => ({
        x: getX(p.timestamp),
        y: getYWeight(p.trendWeight - trendAnalysis.stdDev),
      }));
      const upperPath = buildPath(upperPoints, curveType, padding.top, bottomY);
      const revLower = [...lowerPoints].reverse();
      const revLowerPath = revLower.map((pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
      trendBandArea = `${upperPath} ${revLowerPath} Z`;
    }

    return {
      weightLine,
      maWeightLine,
      weightArea,
      fatLine,
      maFatLine,
      fatArea,
      leanLine,
      fatKgLine,
      trendEmaLine,
      trendRegressionLine,
      trendBandArea,
    };
  }, [chartScales, chartRecords, curveType, padding, chartInnerHeight, trendAnalysis]);

  // Generación inteligente del eje de fechas y separadores de año
  const xAxisData = useMemo(() => {
    if (!chartScales || filteredRecords.length === 0) {
      return { yearSeparators: [], ticks: [], startYear: 0, endYear: 0 };
    }

    const { minTime, maxTime, getX } = chartScales;
    const spanMs = maxTime - minTime;
    const spanDays = spanMs / (1000 * 3600 * 24);

    const startD = new Date(minTime);
    const endD = new Date(maxTime);
    const startYear = startD.getFullYear();
    const endYear = endD.getFullYear();
    const totalYears = endYear - startYear;

    // 1. Líneas verticales separadoras de año (Jan 1st de cada año intermedio)
    const yearSeparators: { year: number; x: number; timestamp: number }[] = [];
    if (totalYears >= 1 || timeRange === "all") {
      for (let y = startYear + 1; y <= endYear; y++) {
        const ts = new Date(y, 0, 1, 0, 0, 0, 0).getTime();
        if (ts >= minTime && ts <= maxTime) {
          const x = getX(ts);
          if (x >= padding.left + 5 && x <= svgWidth - padding.right - 5) {
            yearSeparators.push({ year: y, x, timestamp: ts });
          }
        }
      }
    }

    // 2. Generación de marcas (ticks) y etiquetas del eje X según el rango temporal
    const ticks: {
      x: number;
      label: string;
      isYear?: boolean;
      timestamp: number;
    }[] = [];

    if (spanDays <= 35) {
      // Rango 1M: Ticks limpios cada 5 días basados en el calendario
      const d = new Date(startD);
      d.setHours(0, 0, 0, 0);
      const curDay = d.getDate();
      const nextStepDay = Math.ceil(curDay / 5) * 5 || 1;
      d.setDate(nextStepDay);

      while (d.getTime() <= maxTime) {
        const ts = d.getTime();
        if (ts >= minTime) {
          const x = getX(ts);
          if (x >= padding.left - 5 && x <= svgWidth - padding.right + 5) {
            const label = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
            ticks.push({ x, label, timestamp: ts });
          }
        }
        d.setDate(d.getDate() + 5);
      }
    } else if (spanDays <= 110) {
      // Rango 3M: Ticks en los días 1 y 15 de cada mes
      const d = new Date(startYear, startD.getMonth(), 1);
      while (d.getTime() <= maxTime + 15 * 86400000) {
        for (const day of [1, 15]) {
          d.setDate(day);
          const ts = d.getTime();
          if (ts >= minTime && ts <= maxTime) {
            const x = getX(ts);
            if (x >= padding.left - 5 && x <= svgWidth - padding.right + 5) {
              const label = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
              ticks.push({ x, label, timestamp: ts });
            }
          }
        }
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
      }
    } else if (spanDays <= 380) {
      // Rango 6M a 1A: Ticks en el día 1 de cada mes
      const d = new Date(startYear, startD.getMonth(), 1);
      while (d.getTime() <= maxTime + 32 * 86400000) {
        const ts = d.getTime();
        if (ts >= minTime && ts <= maxTime) {
          const x = getX(ts);
          if (x >= padding.left - 5 && x <= svgWidth - padding.right + 5) {
            const isJan = d.getMonth() === 0;
            const monthName = d.toLocaleDateString("es-ES", { month: "short" });
            const label = isJan ? `${monthName} '${String(d.getFullYear()).slice(2)}` : monthName;
            ticks.push({ x, label, isYear: isJan, timestamp: ts });
          }
        }
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      // Rango "Todo" o multi-año (> 380 días):
      // Si son muchos años (> 4), marcas semi-anuales (Ene y Jul); si son <= 4 años, trimestrales (Ene, Abr, Jul, Oct)
      const months = totalYears > 4 ? [0, 6] : [0, 3, 6, 9];

      for (let y = startYear; y <= endYear; y++) {
        for (const m of months) {
          const d = new Date(y, m, 1);
          const ts = d.getTime();
          if (ts >= minTime && ts <= maxTime) {
            const x = getX(ts);
            if (x >= padding.left + 12 && x <= svgWidth - padding.right - 12) {
              const isJan = m === 0;
              const monthName = d.toLocaleDateString("es-ES", { month: "short" });
              ticks.push({
                x,
                label: isJan ? `${y}` : monthName,
                isYear: isJan,
                timestamp: ts,
              });
            }
          }
        }
      }
    }

    return {
      yearSeparators,
      ticks,
      startYear,
      endYear,
      totalYears,
      spanDays,
    };
  }, [chartScales, filteredRecords, timeRange, padding, svgWidth]);

  // Manejador del cursor sobre el SVG con precisión subpíxel y detección exacta del punto más cercano
  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement | HTMLDivElement>) => {
    if (!chartScales || chartRecords.length === 0) return;

    const svg = svgRef.current;
    let svgX: number;
    let svgY: number;

    if (svg) {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        svgX = (e.clientX - ctm.e) / ctm.a;
        svgY = (e.clientY - ctm.f) / ctm.d;
      } else {
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        svgX = ((e.clientX - rect.left) / rect.width) * svgWidth;
        svgY = ((e.clientY - rect.top) / rect.height) * svgHeight;
      }
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      svgX = ((e.clientX - rect.left) / rect.width) * svgWidth;
      svgY = ((e.clientY - rect.top) / rect.height) * svgHeight;
    }

    // Si el cursor se sale de la zona del gráfico, limpiar hover
    if (
      svgX < padding.left - 25 ||
      svgX > svgWidth - padding.right + 25 ||
      svgY < padding.top - 25 ||
      svgY > padding.top + chartInnerHeight + 35
    ) {
      if (hoveredPointRef.current) {
        hoveredPointRef.current = null;
        setHoveredPoint(null);
        setHoverX(null);
      }
      return;
    }

    const candidateRecords = chartMode === "trend" && trendAnalysis
      ? trendAnalysis.rawPoints
      : chartRecords;

    if (candidateRecords.length === 0) return;

    // 1. Calcular para cada registro la distancia euclidiana 2D real a los puntos en pantalla
    let closest2D: WeightRecord | null = null;
    let minDistance2D = Infinity;

    // Y también la distancia horizontal pura en X
    let closestX: WeightRecord | null = null;
    let minDistanceX = Infinity;

    for (const r of candidateRecords) {
      const px = chartScales.getX(r.timestamp);
      const distX = Math.abs(px - svgX);

      if (distX < minDistanceX) {
        minDistanceX = distX;
        closestX = r;
      }

      // Distancia 2D real a los puntos visibles en pantalla
      let dist2D = Infinity;

      if (chartMode === "fat_only") {
        if (typeof r.grasaPct === "number" && !isNaN(r.grasaPct)) {
          const py = chartScales.getYFat(r.grasaPct);
          dist2D = Math.hypot(px - svgX, py - svgY);
        }
      } else if (chartMode === "combined") {
        const pyWeight = chartScales.getYWeight(r.peso);
        const dWeight = Math.hypot(px - svgX, pyWeight - svgY);
        const dFat = typeof r.grasaPct === "number" && !isNaN(r.grasaPct)
          ? Math.hypot(px - svgX, chartScales.getYFat(r.grasaPct) - svgY)
          : Infinity;
        dist2D = Math.min(dWeight, dFat);
      } else {
        // "weight_only" o "trend" o "composition"
        const py = chartScales.getYWeight(r.peso);
        dist2D = Math.hypot(px - svgX, py - svgY);
      }

      if (dist2D < minDistance2D) {
        minDistance2D = dist2D;
        closest2D = r;
      }
    }

    // Si el cursor está en un radio cercano de interacción (<= 65px de un punto real en 2D),
    // o en modo "trend" (nube de puntos), priorizar SIEMPRE el punto 2D físicamente más cercano al cursor.
    // Si el cursor está en zona neutra lejana (e.g. en el eje de fechas inferior), seleccionar por proximidad temporal X.
    let closest: WeightRecord | null = null;
    if (chartMode === "trend" || minDistance2D <= 65) {
      closest = closest2D || closestX;
    } else {
      closest = closestX || closest2D;
    }

    // Solo actualizar el estado de React si el punto seleccionado REALMENTE ha cambiado
    if (closest && closest.id !== hoveredPointRef.current?.id) {
      hoveredPointRef.current = closest;
      setHoveredPoint(closest);
      setHoverX(chartScales.getX(closest.timestamp));
    }
  }, [chartScales, chartRecords, chartMode, trendAnalysis, padding, chartInnerHeight, svgWidth, svgHeight]);

  const handleSvgMouseLeave = useCallback(() => {
    hoveredPointRef.current = null;
    setHoveredPoint(null);
    setHoverX(null);
  }, []);

  // Cálculo en vivo para el modal de edición
  const liveEditPreview = useMemo(() => {
    if (!editingRecord) return null;
    const p = parseFloat(editWeight.replace(",", "."));
    if (isNaN(p) || p <= 0) return null;

    const parsedFat = editFat.trim() !== "" ? parseFloat(editFat.replace(",", ".")) : null;
    const knownFat = parsedFat !== null && !isNaN(parsedFat)
      ? parsedFat
      : (typeof editingRecord.grasaPct === "number" ? editingRecord.grasaPct : null);

    const bmi = profile.alturaCm > 0 ? calculateBmi(p) : editingRecord.bmi || 0;

    if (knownFat !== null) {
      const masaGrasaKg = Math.round(p * (knownFat / 100) * 10) / 10;
      const masaMagraKg = Math.max(0, Math.round((p - masaGrasaKg) * 10) / 10);
      const ffmiData = masaMagraKg > 0 && profile.alturaCm > 0 ? calculateFfmi(masaMagraKg) : null;
      return {
        bmi,
        grasaPct: Math.round(knownFat * 10) / 10,
        masaGrasaKg,
        masaMagraKg,
        aguaPct: editingRecord.aguaPct || 55,
        ffmi: ffmiData ? ffmiData.ffmi : editingRecord.ffmi || 0,
      };
    }

    const imp = parseFloat(editImp);
    const impLow = parseFloat(editImpLow);
    if (!isNaN(imp) && imp > 0) {
      return estimateBodyComposition(p, imp, !isNaN(impLow) && impLow > 0 ? impLow : imp + 45, profile);
    }

    return estimateBodyComposition(p, 520, 565, profile);
  }, [editingRecord, editWeight, editFat, editImp, editImpLow, profile, calculateBmi, calculateFfmi]);

  // Cálculo en vivo para el modal de nuevo registro
  const liveNewPreview = useMemo(() => {
    if (!manualEntryModalOpen) return null;
    const p = parseFloat(newWeight.replace(",", "."));
    if (isNaN(p) || p <= 0) return null;

    const parsedFat = newFat.trim() !== "" ? parseFloat(newFat.replace(",", ".")) : null;
    const bmi = profile.alturaCm > 0 ? calculateBmi(p) : 0;

    if (parsedFat !== null && !isNaN(parsedFat)) {
      const masaGrasaKg = Math.round(p * (parsedFat / 100) * 10) / 10;
      const masaMagraKg = Math.max(0, Math.round((p - masaGrasaKg) * 10) / 10);
      const ffmiData = masaMagraKg > 0 && profile.alturaCm > 0 ? calculateFfmi(masaMagraKg) : null;
      return {
        bmi,
        grasaPct: Math.round(parsedFat * 10) / 10,
        masaGrasaKg,
        masaMagraKg,
        aguaPct: 55,
        ffmi: ffmiData ? ffmiData.ffmi : 0,
      };
    }

    const imp = parseFloat(newImp) || 520;
    const impLow = parseFloat(newImpLow) || 565;
    return estimateBodyComposition(p, imp, impLow, profile);
  }, [manualEntryModalOpen, newWeight, newFat, newImp, newImpLow, profile, calculateBmi, calculateFfmi]);

  return (
    <div className="py-6 space-y-6">
      {/* 1. Header con Título, Estado y Botones de Acción */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm"
              style={{
                backgroundColor: hexToRgba(seasonColor, 0.15),
                borderColor: hexToRgba(seasonColor, 0.35),
                color: seasonColor,
              }}
            >
              <ScaleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                  Seguimiento de Peso
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <DatabaseIcon className="w-3 h-3 text-emerald-400" />
                  <span>{records.length} pesajes</span>
                </span>
                {/* Badge Xiaomi Cloud */}
                <button
                  type="button"
                  onClick={() => {
                    setXiaomiAutoStartQr(!xiaomiConnected);
                    setXiaomiModalOpen(true);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border flex items-center gap-1.5 transition-all cursor-pointer ${
                    xiaomiConnected
                      ? "bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20"
                      : "bg-zinc-800/80 text-zinc-400 border-zinc-700/80 hover:bg-zinc-700/60 hover:text-zinc-200"
                  }`}
                  title={
                    xiaomiConnected
                      ? `Conectado a Xiaomi Cloud${xiaomiUserId ? ` (${xiaomiUserId})` : ""}. Última sinc: ${xiaomiLastSync || "reciente"}`
                      : "Haz clic para conectar tu báscula Xiaomi mediante QR"
                  }
                >
                  {xiaomiConnected ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      <span>Xiaomi Cloud Conectado</span>
                    </>
                  ) : (
                    <>
                      <QrCodeIcon className="w-3 h-3 text-zinc-400" />
                      <span>Conectar Xiaomi</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Haz clic en cualquier punto de la gráfica o fila para{" "}
                <span className="text-zinc-200 font-semibold">modificar o eliminar</span> la entrada.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Botón Sincronizar Xiaomi */}
          <button
            type="button"
            onClick={handleXiaomiQuickSync}
            disabled={xiaomiSyncing}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm ${
              xiaomiConnected
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300"
                : "bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            } disabled:opacity-50`}
            title={
              xiaomiConnected
                ? "Sincronizar pesajes con Xiaomi Cloud de forma incremental"
                : "Conectar con Xiaomi Cloud mediante código QR"
            }
          >
            {xiaomiSyncing ? (
              <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-orange-400" />
            ) : xiaomiConnected ? (
              <DownloadCloudIcon className="w-3.5 h-3.5 text-orange-400" />
            ) : (
              <QrCodeIcon className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>
              {xiaomiSyncing
                ? "Sincronizando..."
                : xiaomiConnected
                ? "Sincronizar Xiaomi"
                : "Conectar Xiaomi"}
            </span>
          </button>

          <button
            onClick={handleReloadFromDb}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Recargar datos desde la base de datos"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent-light" : "text-zinc-400"}`} />
            <span>{loading ? "Cargando..." : "Recargar"}</span>
          </button>

          <button
            onClick={() => setManualEntryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer text-zinc-950 font-bold"
            style={{
              backgroundColor: seasonColor,
              boxShadow: `0 0 14px ${hexToRgba(seasonColor, 0.3)}`,
            }}
          >
            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
            <span>Nuevo Pesaje</span>
          </button>
        </div>
      </div>

      {/* Banner de notificación de Xiaomi Cloud */}
      {xiaomiToast && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            xiaomiToast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {xiaomiToast.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{xiaomiToast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setXiaomiToast(null)}
            className="text-zinc-400 hover:text-zinc-200 p-1"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Panel de Métricas / KPI Cards (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* KPI 1: Peso Actual (Azul Cobalto) */}
        <div className="col-span-1 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <ScaleIcon className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-zinc-300 font-semibold">
                {currentSegment && !currentSegment.isLatest
                  ? `Peso Cierre (${currentSegment.shortLabel})`
                  : "Peso Actual"}
              </span>
            </span>
            <span className="text-[10px] font-mono text-blue-400 font-medium">kg</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-400 tracking-tight font-mono">
              {stats.latestWeight.toFixed(1)}
            </span>
            <span className="text-xs text-blue-400/80 font-normal">kg</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1 font-semibold">
              {stats.deltaWeightWeek < 0 ? (
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <TrendingDownIcon className="w-3 h-3" />
                  {stats.deltaWeightWeek} kg
                </span>
              ) : stats.deltaWeightWeek > 0 ? (
                <span className="text-amber-400 flex items-center gap-0.5">
                  <TrendingUpIcon className="w-3 h-3" />+{stats.deltaWeightWeek} kg
                </span>
              ) : (
                <span className="text-zinc-400">0.0 kg</span>
              )}
              <span className="text-zinc-500 font-normal">7d</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              MA-7: <span className="text-blue-400 font-semibold">{stats.ma7Weight.toFixed(1)}</span>
            </span>
          </div>
        </div>

        {/* KPI 2: % Graso (Amarillo) */}
        <div className="col-span-1 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <PercentIcon className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-zinc-300 font-semibold">% Grasa Corporal</span>
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              FAT %
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-yellow-300 tracking-tight font-mono">
              {stats.latestFat.toFixed(1)}
            </span>
            <span className="text-xs text-yellow-400/80 font-normal">%</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1 font-semibold">
              {stats.deltaFatWeek < 0 ? (
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <TrendingDownIcon className="w-3 h-3" />
                  {stats.deltaFatWeek}%
                </span>
              ) : (
                <span className="text-zinc-400">{stats.deltaFatWeek}%</span>
              )}
              <span className="text-zinc-500 font-normal">7d</span>
            </div>
            <span className="text-[10px] text-zinc-500">
              Total: {stats.deltaFatTotal > 0 ? `+${stats.deltaFatTotal}` : stats.deltaFatTotal}%
            </span>
          </div>
        </div>

        {/* KPI 3: BMI / IMC (Color actual: Indigo) - Clic abre mapa interactivo */}
        {(() => {
          const currentBmi = stats.latestWeight > 0 ? calculateBmi(stats.latestWeight) : 0;
          const bmiCat = getBmiCategory(currentBmi);
          const currentFfmi = stats.latestLean > 0 ? calculateFfmi(stats.latestLean) : { ffmi: 0, ffmiNormalized: 0, category: "-" };
          const idealRange = getIdealWeightRange();

          return (
            <div
              onClick={() => {
                setBmiModalWeight(stats.latestWeight);
                setBmiModalOpen(true);
              }}
              className="col-span-1 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 shadow-md relative overflow-hidden cursor-pointer hover:border-indigo-500/50 hover:bg-zinc-850/80 transition-all group"
              title="Haz clic para ver el mapa de tipos de peso e IMC"
            >
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-zinc-300 font-semibold group-hover:text-white transition-colors">BMI / IMC</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${bmiCat.bgColor} ${bmiCat.color} ${bmiCat.borderColor}`}
                >
                  {bmiCat.label.split(" ")[0]}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-indigo-300 tracking-tight font-mono group-hover:text-indigo-200 transition-colors">
                    {currentBmi > 0 ? currentBmi.toFixed(1) : "--"}
                  </span>
                  <span className="text-xs text-indigo-400/80 font-normal">kg/m²</span>
                </div>
                <span className="text-[10px] text-indigo-400 opacity-80 group-hover:opacity-100 group-hover:underline flex items-center font-sans font-medium">
                  Ver mapa ↗
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span
                  className="text-zinc-400 truncate"
                  title={`Altura configurada: ${profile.alturaCm} cm · Edad: ${profile.edad} años`}
                >
                  {profile.alturaCm} cm · {profile.edad}a
                </span>
                <span
                  className="text-[10px] text-zinc-500 font-mono"
                  title={`Rango saludable: ${idealRange.min} - ${idealRange.max} kg | FFMI: ${currentFfmi.ffmi}`}
                >
                  Normo: {idealRange.min}-{idealRange.max}kg
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 4. Gráfico Principal Interactivo de Evolución */}
      <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm shadow-xl space-y-4">
        {/* Barra de Controles del Gráfico: Organizada en horizontal, compacta y cuadrada */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/60">
          {/* Selector de Parámetros / Métricas (Toggles independientes para Peso y Grasa, y modo Tendencia aparte) */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-inner overflow-x-auto">
            <button
              type="button"
              onClick={handleToggleWeight}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                !isTrendMode && showWeight
                  ? "bg-blue-500/15 text-blue-200 border border-blue-500/40 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              }`}
              title={
                !isTrendMode && showWeight
                  ? "Desactivar visualización de Peso y Media Móvil"
                  : "Activar visualización de Peso y Media Móvil (azul cobalto)"
              }
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  !isTrendMode && showWeight
                    ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                    : "bg-zinc-600"
                }`}
              />
              <span>Peso</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFat}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                !isTrendMode && showFat
                  ? "bg-yellow-500/15 text-yellow-200 border border-yellow-500/40 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              }`}
              title={
                !isTrendMode && showFat
                  ? "Desactivar visualización de % Grasa"
                  : "Activar visualización de Porcentaje de Grasa (amarillo)"
              }
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  !isTrendMode && showFat
                    ? "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                    : "bg-zinc-600"
                }`}
              />
              <span>% Grasa</span>
            </button>

            <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

            <button
              type="button"
              onClick={handleToggleTrend}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isTrendMode
                  ? "bg-sky-500/20 text-sky-200 border border-sky-500/40 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 border border-transparent"
              }`}
              title="Modo Tendencia: convierte la nube de tomas en una trayectoria suavizada con canal de dispersión"
            >
              <TrendingDownIcon className={`w-3.5 h-3.5 ${isTrendMode ? "text-sky-300" : "text-zinc-400"}`} />
              <span>Tendencia</span>
            </button>
          </div>

          {/* Selector de Curva (solo iconos cuadrados) + Filtros Temporales + Agrupación */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Control segmentado de tipo de trazado (cuadrado solo con iconos) */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => handleCurveChange("linear")}
                className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  curveType === "linear"
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
                title="Líneas rectas directas entre puntos"
                aria-label="Rectas"
              >
                <LinearLineIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleCurveChange("smooth")}
                className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  curveType === "smooth"
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
                title="Curvas naturales (spline cúbico)"
                aria-label="Curvas"
              >
                <SmoothLineIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleCurveChange("flow")}
                className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  curveType === "flow"
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
                title="Completamente suavizadas (línea continua fluida)"
                aria-label="Fluida"
              >
                <FlowLineIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sincronización con Season */}
            {activeSeason && activeSeasonId !== "all" && (
              <button
                onClick={() => handleSyncSeasonChange(!syncWithSeason)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  syncWithSeason
                    ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                    : "bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                }`}
                title="Filtrar por la temporada activa"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: syncWithSeason ? seasonColor : "#71717a" }}
                />
                <span className="truncate max-w-[100px]">Season: {activeSeason.name}</span>
              </button>
            )}

            {/* Filtros de Rango Temporal y Navegación Anual */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-inner">
              {/* Rangos rápidos relativos: 1M, 3M, 6M */}
              {(["1M", "3M", "6M"] as const).map((r) => {
                const isSelected = timeRange === r && !syncWithSeason;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      handleTimeRangeChange(r);
                      if (syncWithSeason) handleSyncSeasonChange(false);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}

              {/* Separador vertical sutil */}
              <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

              {/* Iterador de Años: < [ 1A / Año ▾ ] > */}
              <div className="inline-flex items-center">
                {/* Botón Año Anterior (< hacia el pasado) */}
                <button
                  type="button"
                  onClick={handlePrevYear}
                  disabled={!canGoPrevYear && timeRange === "year"}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                  title={
                    prevYearSegment
                      ? `Año anterior (${prevYearSegment.shortLabel})`
                      : "Ver año anterior"
                  }
                  aria-label="Año anterior"
                >
                  <ChevronLeftIcon className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown del Año/Periodo Activo */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setYearDropdownOpen((prev) => !prev)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      timeRange === "year" && !syncWithSeason
                        ? activeYearSegment?.isHistorical
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold"
                          : "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title={
                      activeYearSegment?.subLabel
                        ? `${activeYearSegment.label} (${activeYearSegment.subLabel})`
                        : "Seleccionar año"
                    }
                  >
                    <span>{timeRange === "year" ? (activeYearSegment?.shortLabel || "Año") : "Año"}</span>
                    <ChevronDownIcon className="w-3 h-3 text-zinc-400" />
                  </button>

                  {/* Menú Dropdown con Último año (1A), Año 2026, Año 2025... */}
                  {yearDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setYearDropdownOpen(false)}
                      />
                      <div className="absolute left-0 mt-1.5 z-50 min-w-[210px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/80">
                          Iterar por Años
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                          {yearSegments.map((s) => {
                            const isSelected =
                              timeRange === "year" && selectedYearId === s.id && !syncWithSeason;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  handleSelectYear(s.id);
                                  setYearDropdownOpen(false);
                                  if (syncWithSeason) handleSyncSeasonChange(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                  isSelected
                                    ? "bg-zinc-800 text-white font-bold"
                                    : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-1.5 font-semibold">
                                    {s.isLatest && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    )}
                                    <span>{s.label}</span>
                                  </span>
                                  {s.subLabel && (
                                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                      {s.subLabel}
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <CheckIcon className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Botón Año Siguiente (> hacia el presente) */}
                <button
                  type="button"
                  onClick={handleNextYear}
                  disabled={!canGoNextYear && timeRange === "year"}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                  title={
                    nextYearSegment
                      ? `Año siguiente (${nextYearSegment.shortLabel})`
                      : "Ver año siguiente"
                  }
                  aria-label="Año siguiente"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Separador vertical sutil */}
              <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

              {/* Botón Historial Completo (Todo) */}
              <button
                type="button"
                onClick={() => {
                  handleTimeRangeChange("all");
                  if (syncWithSeason) handleSyncSeasonChange(false);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  timeRange === "all" && !syncWithSeason
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Todo
              </button>
            </div>

            {/* Selector de Proyección de Tendencia (Plazo estimado) */}
            {(!currentSegment || currentSegment.isLatest) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProjectionDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    projectionHorizon !== "none"
                      ? "bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-xs shadow-purple-500/10 font-bold"
                      : "bg-zinc-950/90 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                  title="Proyectar peso y grasa hacia el futuro según la tendencia del momento"
                >
                  <SparklesIcon
                    className={`w-3.5 h-3.5 ${
                      projectionHorizon !== "none" ? "text-purple-400 animate-pulse" : "text-zinc-500"
                    }`}
                  />
                  <span>
                    {projectionHorizon === "none"
                      ? "Proyección"
                      : projectionHorizon === "2W"
                      ? "Proy: +2 Sem"
                      : projectionHorizon === "1M"
                      ? "Proy: +1 Mes"
                      : projectionHorizon === "2M"
                      ? "Proy: +2 Meses"
                      : projectionHorizon === "3M"
                      ? "Proy: +3 Meses"
                      : "Proy: +6 Meses"}
                  </span>
                  <ChevronDownIcon className="w-3 h-3 text-zinc-500" />
                </button>

                {/* Dropdown Menu de Selección de Plazo */}
                {projectionDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProjectionDropdownOpen(false)}
                    />
                    <div className="absolute right-0 sm:left-0 mt-1.5 z-50 min-w-[240px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/80 flex items-center justify-between">
                        <span>Plazo de Proyección</span>
                        <span className="text-purple-400 font-mono">Tendencia</span>
                      </div>
                      <div className="py-1 space-y-0.5">
                        {(
                          [
                            { id: "none", label: "Desactivada", desc: "Ver únicamente mediciones reales registradas" },
                            { id: "2W", label: "+2 Semanas (14 días)", desc: "Estimación a corto plazo según el ritmo actual" },
                            { id: "1M", label: "+1 Mes (30 días)", desc: "Objetivo mensual de evolución corporal" },
                            { id: "2M", label: "+2 Meses (60 días)", desc: "Proyección bimestral de tendencia" },
                            { id: "3M", label: "+3 Meses (90 días)", desc: "Proyección trimestral (fin de temporada)" },
                            { id: "6M", label: "+6 Meses (180 días)", desc: "Horizonte semestral a largo plazo" },
                          ] as { id: ProjectionHorizon; label: string; desc: string }[]
                        ).map((opt) => {
                          const isSelected = opt.id === projectionHorizon;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleProjectionChange(opt.id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-purple-950/60 text-purple-200 font-bold border border-purple-500/30"
                                  : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold flex items-center gap-1.5">
                                  {opt.id !== "none" && isSelected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                  )}
                                  <span>{opt.label}</span>
                                </span>
                                <span className="text-[10px] text-zinc-500 font-normal leading-tight mt-0.5">
                                  {opt.desc}
                                </span>
                              </div>
                              {isSelected && <CheckIcon className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Control de Agrupación (Fórmula anti-amontonamiento) */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-inner">
              <span className="text-[10px] text-zinc-500 font-medium pl-2 pr-1 hidden sm:inline">
                Agrupar:
              </span>
              {(
                [
                  { id: "auto", label: "Auto", title: "Automático: calcula la media si las medidas están amontonadas" },
                  { id: "daily", label: "Día", title: "Diario: fuerza puntos diarios sin agrupar semanas" },
                  { id: "weekly", label: "Sem", title: "Semanal: calcula la media de cada semana (7 días)" },
                  { id: "monthly", label: "Mes", title: "Mensual: calcula la media de cada mes" },
                ] as { id: WeightGroupingMode; label: string; title: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleGroupingModeChange(m.id)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    groupingMode === m.id
                      ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title={m.title}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Banner de estadísticas de tendencia cuando el modo Tendencia está activo */}
        {chartMode === "trend" && trendAnalysis && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="font-semibold text-blue-200">Ritmo de Tendencia:</span>
                <span
                  className={`font-mono font-bold ${
                    trendAnalysis.kgPerWeek < 0
                      ? "text-emerald-400"
                      : trendAnalysis.kgPerWeek > 0
                      ? "text-amber-400"
                      : "text-zinc-300"
                  }`}
                >
                  {trendAnalysis.kgPerWeek > 0 ? `+${trendAnalysis.kgPerWeek}` : trendAnalysis.kgPerWeek} kg/semana
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span className="text-zinc-400">Variación proyectada:</span>
                <span className="font-mono font-semibold text-blue-300">
                  {trendAnalysis.totalTrendDelta > 0 ? `+${trendAnalysis.totalTrendDelta}` : trendAnalysis.totalTrendDelta} kg
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span className="text-zinc-400">Dispersión de la nube:</span>
                <span className="font-mono text-zinc-400">±{trendAnalysis.stdDev} kg</span>
              </div>
            </div>
            <span className="text-[11px] font-mono text-blue-300/80">
              {trendAnalysis.n} tomas en la nube
            </span>
          </div>
        )}

        {/* Panel Resumen de Proyección Estimada */}
        {projectionData && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/20 to-zinc-900 border border-purple-500/30 shadow-lg space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm">
                  <SparklesIcon className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-zinc-100">
                      Proyección a {projectionData.days} días ({projectionData.horizon === "2W" ? "2 semanas" : projectionData.horizon === "1M" ? "1 mes" : projectionData.horizon === "2M" ? "2 meses" : projectionData.horizon === "3M" ? "3 meses" : "6 meses"})
                    </h3>
                    <span className="text-[10px] font-mono text-purple-300 font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                      🎯 {projectionData.targetDateLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Estimación calculada según la tendencia del momento en los últimos {projectionData.windowDays} días ({projectionData.sampleCount} pesajes)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleProjectionChange("none")}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-700/60"
                >
                  Desactivar Proyección
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* 1. Peso Proyectado */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-blue-500/25 space-y-1">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                  <ScaleIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Peso Estimado</span>
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-mono font-extrabold text-blue-400">
                    {projectionData.projectedWeight.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-blue-400/80 font-normal">kg</span>
                  <span
                    className={`text-[11px] font-mono font-bold ml-1.5 ${
                      projectionData.deltaWeight > 0
                        ? "text-amber-400"
                        : projectionData.deltaWeight < 0
                        ? "text-emerald-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {projectionData.deltaWeight > 0 ? `+${projectionData.deltaWeight}` : projectionData.deltaWeight} kg
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 block font-mono">
                  Ritmo: {projectionData.kgPerWeek > 0 ? `+${projectionData.kgPerWeek}` : projectionData.kgPerWeek} kg/sem
                </span>
              </div>

              {/* 2. Grasa Proyectada */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-yellow-500/25 space-y-1">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                  <PercentIcon className="w-3.5 h-3.5 text-yellow-400" />
                  <span>% Grasa Estimado</span>
                </span>
                {projectionData.hasFat ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-mono font-extrabold text-yellow-400">
                        {projectionData.projectedFatPct.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-yellow-400/80 font-normal">%</span>
                      <span
                        className={`text-[11px] font-mono font-bold ml-1.5 ${
                          projectionData.deltaFatPct > 0
                            ? "text-amber-400"
                            : projectionData.deltaFatPct < 0
                            ? "text-emerald-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {projectionData.deltaFatPct > 0 ? `+${projectionData.deltaFatPct}` : projectionData.deltaFatPct}%
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block font-mono">
                      Ritmo: {projectionData.fatPerWeek > 0 ? `+${projectionData.fatPerWeek}` : projectionData.fatPerWeek}%/sem
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-500 block pt-1">Sin tomas suficientes</span>
                )}
              </div>

              {/* 3. Masa Magra Proyectada */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-emerald-500/25 space-y-1">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                  <ZapIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Masa Magra Estimada</span>
                </span>
                {projectionData.hasFat ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-mono font-extrabold text-emerald-400">
                        {projectionData.projectedLeanKg.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-emerald-400/80 font-normal">kg</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block font-mono">
                      Actual: {projectionData.currentLeanKg.toFixed(1)} kg
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-500 block pt-1">—</span>
                )}
              </div>

              {/* 4. Masa Grasa Proyectada */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-purple-500/25 space-y-1">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                  <ActivityIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Masa Grasa Estimada</span>
                </span>
                {projectionData.hasFat ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-mono font-extrabold text-purple-300">
                        {projectionData.projectedFatKg.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-purple-300/80 font-normal">kg</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block font-mono">
                      Actual: {projectionData.currentFatKg.toFixed(1)} kg
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-500 block pt-1">—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Banner informativo de fórmula de descongestión activa */}
        {chartMode !== "trend" && adaptiveResult.effectiveInterval !== "daily" && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-semibold">
                Fórmula de medias activa:
              </span>
              <span className="text-blue-200">
                {adaptiveResult.effectiveInterval === "weekly"
                  ? `Mostrando media semanal (${adaptiveResult.displayedPoints} semanas de ${adaptiveResult.totalMeasurements} tomas registradas)`
                  : `Mostrando media mensual (${adaptiveResult.displayedPoints} meses de ${adaptiveResult.totalMeasurements} tomas registradas)`}
              </span>
            </div>
            <span className="text-[10px] text-blue-300/80 font-mono">
              Puntos descongestionados sin solapamientos
            </span>
          </div>
        )}

        {/* Canvas SVG Interactivo con mouse tracking suave a nivel contenedor */}
        <div
          className="relative w-full overflow-hidden select-none cursor-pointer"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
          onClick={() => {
            if (hoveredPoint) {
              if (hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1) {
                setSelectedDayModal(hoveredPoint);
              } else {
                handleOpenEdit(hoveredPoint.measurements?.[0] || hoveredPoint);
              }
            }
          }}
        >
          {chartScales && chartPaths && chartRecords.length > 0 ? (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto block overflow-visible"
            >
              <defs>
                {/* Degradado Peso (Azul Cobalto) */}
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>

                {/* Degradado Grasa (Amarillo) */}
                <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eab308" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#eab308" stopOpacity="0.0" />
                </linearGradient>

                {/* Degradado Zona de Proyección Futura */}
                <linearGradient id="futureZoneGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.14" />
                </linearGradient>
              </defs>

              {/* Guías horizontales y Ejes */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const y = padding.top + chartInnerHeight * (1 - frac);
                const weightVal =
                  chartScales.minWeight + (chartScales.maxWeight - chartScales.minWeight) * frac;
                const fatVal = chartScales.minFat + (chartScales.maxFat - chartScales.minFat) * frac;

                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="rgba(63, 63, 70, 0.35)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />

                    {/* Etiquetas eje izquierdo (Peso) */}
                    {(isTrendMode || showWeight) && (
                      <text
                        x={padding.left - 12}
                        y={y + 3.5}
                        textAnchor="end"
                        fontSize="11"
                        fill="#60a5fa"
                        fontFamily="monospace"
                      >
                        {weightVal.toFixed(1)} kg
                      </text>
                    )}

                    {/* Etiquetas eje derecho (% Grasa) */}
                    {!isTrendMode && showFat && (
                      <text
                        x={svgWidth - padding.right + 12}
                        y={y + 3.5}
                        textAnchor="start"
                        fontSize="11"
                        fill="#eab308"
                        fontFamily="monospace"
                      >
                        {fatVal.toFixed(1)}%
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 0. Líneas verticales punteadas y semi-transparentes que separan los años en el gráfico de todo */}
              {xAxisData.yearSeparators.map((sep) => (
                <g key={`year-sep-${sep.year}`} pointerEvents="none">
                  {/* Línea vertical punteada semi-transparente */}
                  <line
                    x1={sep.x}
                    y1={padding.top}
                    x2={sep.x}
                    y2={padding.top + chartInnerHeight}
                    stroke="rgba(148, 163, 184, 0.22)"
                    strokeDasharray="4 4"
                    strokeWidth="1.25"
                  />

                  {/* Badge del año en la cabecera superior del separador */}
                  <g transform={`translate(${sep.x}, ${padding.top - 12})`}>
                    <rect
                      x={-19}
                      y={-9}
                      width={38}
                      height={16}
                      rx={4}
                      fill="#18181b"
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#93c5fd"
                      fontFamily="monospace"
                    >
                      {sep.year}
                    </text>
                  </g>
                </g>
              ))}

              {/* Badge del año inicial si hay separadores de año y espacio a la izquierda */}
              {xAxisData.yearSeparators.length > 0 &&
                xAxisData.yearSeparators[0].x > padding.left + 50 && (
                  <g
                    key="year-sep-start"
                    pointerEvents="none"
                    transform={`translate(${padding.left + 22}, ${padding.top - 12})`}
                  >
                    <rect
                      x={-19}
                      y={-9}
                      width={38}
                      height={16}
                      rx={4}
                      fill="#18181b"
                      stroke="rgba(148, 163, 184, 0.25)"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#64748b"
                      fontFamily="monospace"
                    >
                      {xAxisData.startYear}
                    </text>
                  </g>
                )}

              {/* 1. CURVAS DE PESO (Azul Cobalto) */}
              {!isTrendMode && showWeight && (
                <>
                  {/* Área degradada de peso con el trazado exacto de curveType */}
                  <path d={chartPaths.weightArea} fill="url(#weightGrad)" />

                  {/* Línea de peso diario */}
                  <path
                    d={chartPaths.weightLine}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={!showFat ? "2.2" : "2"}
                    strokeOpacity={!showFat ? "0.9" : "0.95"}
                  />

                  {/* Línea de Media Móvil 7D de Peso (destacada y punteada) */}
                  <path
                    d={chartPaths.maWeightLine}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeDasharray="3 3"
                  />

                  {/* Puntos individuales de pesaje (media diaria cuando hay varias tomas) */}
                  {chartRecords.map((r) => {
                    const cx = chartScales.getX(r.timestamp);
                    const cy = chartScales.getYWeight(r.peso);
                    const isFlow = curveType === "flow";
                    const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);

                    return (
                      <g key={r.id} className="pointer-events-none">
                        {isMulti && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                            className="opacity-75"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isFlow ? (isMulti ? 3 : 1.5) : (isMulti ? 4 : 3)}
                          fill="#2563eb"
                          stroke="#18181b"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {/* 2. CURVAS DE % GRASO (Amarillo) */}
              {!isTrendMode && showFat && (
                <>
                  {/* Área degradada de grasa */}
                  <path d={chartPaths.fatArea} fill="url(#fatGrad)" />

                  {/* Línea de % graso diario */}
                  <path
                    d={chartPaths.fatLine}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth={!showWeight ? "2.2" : "2"}
                    strokeOpacity={!showWeight ? "0.9" : "0.95"}
                  />

                  {/* Línea de Media Móvil 7D de Grasa (punteada) */}
                  <path
                    d={chartPaths.maFatLine}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="2.5"
                    strokeDasharray="3 3"
                  />

                  {chartRecords
                    .filter((r): r is typeof r & { grasaPct: number } => typeof r.grasaPct === "number")
                    .map((r) => {
                      const cx = chartScales.getX(r.timestamp);
                      const cy = chartScales.getYFat(r.grasaPct);
                      const isFlow = curveType === "flow";
                      const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);

                      return (
                        <g key={`f-${r.id}`} className="pointer-events-none">
                          {isMulti && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill="none"
                              stroke="#eab308"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                              className="opacity-75"
                            />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isFlow ? (isMulti ? 3 : 1.5) : (isMulti ? 4 : 3)}
                            fill="#eab308"
                            stroke="#18181b"
                            strokeWidth={1}
                          />
                        </g>
                      );
                    })}
                </>
              )}

              {/* Estado cuando ninguna serie está activa */}
              {!isTrendMode && !showWeight && !showFat && (
                <text
                  x={svgWidth / 2}
                  y={padding.top + chartInnerHeight / 2}
                  textAnchor="middle"
                  fill="#71717a"
                  fontSize="12"
                  fontFamily="sans-serif"
                >
                  Activa Peso o % Grasa arriba para visualizar las líneas
                </text>
              )}

              {/* 3. MODO TENDENCIA: NUBE DE PUNTOS DE PESO CONVERTIDA EN LÍNEA DE TENDENCIA */}
              {isTrendMode && trendAnalysis && (
                <>
                  {/* A. Canal / Banda de dispersión de la nube (±1 desviación estándar) */}
                  {chartPaths.trendBandArea && (
                    <path
                      d={chartPaths.trendBandArea}
                      fill="rgba(56, 189, 248, 0.08)"
                      stroke="none"
                    />
                  )}

                  {/* B. Directriz de Regresión Lineal Global */}
                  {chartPaths.trendRegressionLine && (
                    <path
                      d={chartPaths.trendRegressionLine}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      strokeOpacity="0.65"
                    />
                  )}

                  {/* C. Línea de Tendencia Dinámica Suavizada (Eje Central de la Nube) */}
                  {chartPaths.trendEmaLine && (
                    <path
                      d={chartPaths.trendEmaLine}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-sm"
                    />
                  )}

                  {/* D. Nube de Puntos de Peso Individuales (Scatter Cloud) */}
                  {trendAnalysis.rawPoints.map((r, i) => {
                    const cx = chartScales.getX(r.timestamp);
                    const cy = chartScales.getYWeight(r.peso);
                    return (
                      <circle
                        key={`scatter-${r.id}-${i}`}
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill="#60a5fa"
                        fillOpacity={0.45}
                        stroke="#1e40af"
                        strokeWidth={1}
                        className="pointer-events-none"
                      />
                    );
                  })}
                </>
              )}

              {/* 4. TRAZADO DE PROYECCIÓN FUTURA SEGÚN TENDENCIA ACTUAL */}
              {projectionData && chartScales && chartRecords.length > 0 && (
                <g pointerEvents="none">
                  {/* Zona sombreada de Proyección Futura */}
                  <rect
                    x={chartScales.getX(chartRecords[chartRecords.length - 1].timestamp)}
                    y={padding.top}
                    width={Math.max(
                      0,
                      chartScales.getX(projectionData.targetTimestamp) -
                        chartScales.getX(chartRecords[chartRecords.length - 1].timestamp)
                    )}
                    height={chartInnerHeight}
                    fill="url(#futureZoneGrad)"
                  />

                  {/* Línea vertical divisoria: Ahora / Inicio de Proyección */}
                  <line
                    x1={chartScales.getX(chartRecords[chartRecords.length - 1].timestamp)}
                    y1={padding.top}
                    x2={chartScales.getX(chartRecords[chartRecords.length - 1].timestamp)}
                    y2={padding.top + chartInnerHeight}
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.65}
                  />

                  {/* Línea vertical meta en la fecha proyectada */}
                  <line
                    x1={chartScales.getX(projectionData.targetTimestamp)}
                    y1={padding.top}
                    x2={chartScales.getX(projectionData.targetTimestamp)}
                    y2={padding.top + chartInnerHeight}
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />

                  {/* Etiqueta superior sobre la fecha objetivo */}
                  <text
                    x={chartScales.getX(projectionData.targetTimestamp)}
                    y={padding.top - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#c084fc"
                    fontFamily="monospace"
                  >
                    🎯 +{projectionData.days}d ({projectionData.targetDateLabel})
                  </text>

                  {/* Línea de proyección de PESO (azul cielo con guiones) */}
                  {(showWeight || isTrendMode) && (
                    <>
                      <line
                        x1={chartScales.getX(chartRecords[chartRecords.length - 1].timestamp)}
                        y1={chartScales.getYWeight(projectionData.currentWeight)}
                        x2={chartScales.getX(projectionData.targetTimestamp)}
                        y2={chartScales.getYWeight(projectionData.projectedWeight)}
                        stroke="#60a5fa"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        className="drop-shadow-sm"
                      />
                      {/* Círculo meta proyectado de peso */}
                      <circle
                        cx={chartScales.getX(projectionData.targetTimestamp)}
                        cy={chartScales.getYWeight(projectionData.projectedWeight)}
                        r={7.5}
                        fill="#1e3a8a"
                        stroke="#93c5fd"
                        strokeWidth={2.5}
                        className="animate-pulse"
                      />
                      <circle
                        cx={chartScales.getX(projectionData.targetTimestamp)}
                        cy={chartScales.getYWeight(projectionData.projectedWeight)}
                        r={3}
                        fill="#ffffff"
                      />
                      {/* Badge flotante con el valor proyectado */}
                      <g
                        transform={`translate(${Math.min(
                          svgWidth - padding.right - 72,
                          chartScales.getX(projectionData.targetTimestamp) + 12
                        )}, ${Math.max(
                          padding.top + 14,
                          Math.min(padding.top + chartInnerHeight - 14, chartScales.getYWeight(projectionData.projectedWeight))
                        )})`}
                      >
                        <rect
                          x={-4}
                          y={-11}
                          width={72}
                          height={20}
                          rx={6}
                          fill="#0f172a"
                          stroke="#3b82f6"
                          strokeWidth={1}
                          opacity={0.94}
                        />
                        <text
                          x={32}
                          y={3}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#93c5fd"
                          fontFamily="monospace"
                        >
                          {projectionData.projectedWeight.toFixed(1)} kg
                        </text>
                      </g>
                    </>
                  )}

                  {/* Línea de proyección de GRASA (amarilla con guiones) */}
                  {showFat && !isTrendMode && projectionData.hasFat && (
                    <>
                      <line
                        x1={chartScales.getX(chartRecords[chartRecords.length - 1].timestamp)}
                        y1={chartScales.getYFat(projectionData.currentFatPct)}
                        x2={chartScales.getX(projectionData.targetTimestamp)}
                        y2={chartScales.getYFat(projectionData.projectedFatPct)}
                        stroke="#facc15"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                      />
                      {/* Círculo meta proyectado de grasa */}
                      <circle
                        cx={chartScales.getX(projectionData.targetTimestamp)}
                        cy={chartScales.getYFat(projectionData.projectedFatPct)}
                        r={6.5}
                        fill="#713f12"
                        stroke="#fde047"
                        strokeWidth={2}
                        className="animate-pulse"
                      />
                      <circle
                        cx={chartScales.getX(projectionData.targetTimestamp)}
                        cy={chartScales.getYFat(projectionData.projectedFatPct)}
                        r={2.5}
                        fill="#ffffff"
                      />
                      {/* Badge flotante con el valor proyectado */}
                      <g
                        transform={`translate(${Math.min(
                          svgWidth - padding.right - 62,
                          chartScales.getX(projectionData.targetTimestamp) + 12
                        )}, ${Math.max(
                          padding.top + 14,
                          Math.min(padding.top + chartInnerHeight - 14, chartScales.getYFat(projectionData.projectedFatPct))
                        )})`}
                      >
                        <rect
                          x={-4}
                          y={-11}
                          width={60}
                          height={20}
                          rx={6}
                          fill="#0f172a"
                          stroke="#eab308"
                          strokeWidth={1}
                          opacity={0.94}
                        />
                        <text
                          x={26}
                          y={3}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#fde047"
                          fontFamily="monospace"
                        >
                          {projectionData.projectedFatPct.toFixed(1)}%
                        </text>
                      </g>
                    </>
                  )}
                </g>
              )}

              {/* Guía vertical de cursor (Crosshair) */}
              {hoverX !== null && hoveredPoint && (
                <g pointerEvents="none">
                  <line
                    x1={hoverX}
                    y1={padding.top}
                    x2={hoverX}
                    y2={padding.top + chartInnerHeight}
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                  />
                </g>
              )}

              {/* Indicador de punto activo destacado (SMOOTH & ROCK-STEADY) */}
              {hoveredPoint && (
                <g pointerEvents="none">
                  {/* Modo Tendencia o Peso: Anillo y punto central de Peso */}
                  {(isTrendMode || showWeight) && (
                    <>
                      <circle
                        cx={chartScales.getX(hoveredPoint.timestamp)}
                        cy={chartScales.getYWeight(hoveredPoint.peso)}
                        r={9}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        className="opacity-80"
                      />
                      <circle
                        cx={chartScales.getX(hoveredPoint.timestamp)}
                        cy={chartScales.getYWeight(hoveredPoint.peso)}
                        r={5.5}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                      />
                    </>
                  )}

                  {/* Modo Grasa: Anillo y punto central de Grasa */}
                  {!isTrendMode && showFat &&
                    typeof hoveredPoint.grasaPct === "number" && (
                      <>
                        <circle
                          cx={chartScales.getX(hoveredPoint.timestamp)}
                          cy={chartScales.getYFat(hoveredPoint.grasaPct)}
                          r={8}
                          fill="none"
                          stroke="#fde047"
                          strokeWidth={1.5}
                          className="opacity-80"
                        />
                        <circle
                          cx={chartScales.getX(hoveredPoint.timestamp)}
                          cy={chartScales.getYFat(hoveredPoint.grasaPct)}
                          r={4.5}
                          fill="#ffffff"
                          stroke="#eab308"
                          strokeWidth={2.5}
                        />
                      </>
                    )}
                </g>
              )}

              {/* Eje X: Línea base horizontal y marcas (ticks) de fechas inteligentes */}
              <line
                x1={padding.left}
                y1={padding.top + chartInnerHeight}
                x2={svgWidth - padding.right}
                y2={padding.top + chartInnerHeight}
                stroke="rgba(63, 63, 70, 0.55)"
                strokeWidth="1"
              />

              {/* Marcas de tiempo y etiquetas del Eje X */}
              {xAxisData.ticks.map((tick, idx) => (
                <g key={`x-tick-${idx}-${tick.timestamp}`} pointerEvents="none">
                  {/* Pequeña muesca (tick mark) en el eje */}
                  <line
                    x1={tick.x}
                    y1={padding.top + chartInnerHeight}
                    x2={tick.x}
                    y2={padding.top + chartInnerHeight + (tick.isYear ? 6 : 4)}
                    stroke={tick.isYear ? "#60a5fa" : "rgba(113, 113, 122, 0.45)"}
                    strokeWidth={tick.isYear ? 1.5 : 1}
                  />

                  {/* Texto de la etiqueta de fecha / año */}
                  <text
                    x={tick.x}
                    y={padding.top + chartInnerHeight + 17}
                    textAnchor="middle"
                    fontSize={tick.isYear ? "11" : "10"}
                    fontWeight={tick.isYear ? "700" : "500"}
                    fill={tick.isYear ? "#60a5fa" : "#71717a"}
                    fontFamily="monospace"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="py-20 text-center text-zinc-500 text-sm">
              No hay datos para el rango seleccionado.
            </div>
          )}

          {/* Tooltip flotante informativo sincronizado (pointer-events-none para interacción SMOOTH) */}
          {hoveredPoint && hoverX !== null && (
            <div
              className="absolute top-2 pointer-events-none z-20 bg-zinc-900/95 border border-zinc-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[230px] transition-opacity duration-150"
              style={{
                left: Math.min(Math.max(20, (hoverX / svgWidth) * 100), 75) + "%",
                transform: "translateX(-50%)",
              }}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-zinc-400 font-mono text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-zinc-200">
                  <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                  {hoveredPoint.periodLabel || hoveredPoint.fecha}
                </span>
                {hoveredPoint.measurements && hoveredPoint.measurements.length > 1 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 font-semibold text-[10px] border border-blue-500/30">
                    {hoveredPoint.periodType === "weekly"
                      ? `Media semanal (${hoveredPoint.measurements.length} tomas)`
                      : hoveredPoint.periodType === "monthly"
                      ? `Media mensual (${hoveredPoint.measurements.length} tomas)`
                      : `Media diaria (${hoveredPoint.measurements.length} tomas)`}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3 text-zinc-500" />
                    {hoveredPoint.hora}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div>
                  <span className="text-[10px] text-zinc-400 block">
                    {hoveredPoint.periodType === "weekly"
                      ? "Peso Semanal"
                      : hoveredPoint.periodType === "monthly"
                      ? "Peso Mensual"
                      : hoveredPoint.measurements && hoveredPoint.measurements.length > 1
                      ? "Peso Medio"
                      : "Peso"}
                  </span>
                  <span className="font-extrabold text-sm text-blue-400 font-mono">
                    {hoveredPoint.peso.toFixed(1)} kg
                  </span>
                  {hoveredPoint.deltaPeso !== undefined && (
                    <span
                      className={`text-[10px] ml-1 font-mono ${
                        hoveredPoint.deltaPeso < 0
                          ? "text-emerald-400"
                          : hoveredPoint.deltaPeso > 0
                          ? "text-rose-400"
                          : "text-zinc-500"
                      }`}
                    >
                      ({hoveredPoint.deltaPeso > 0 ? `+${hoveredPoint.deltaPeso}` : hoveredPoint.deltaPeso})
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 block">
                    {hoveredPoint.periodType === "weekly"
                      ? "% Grasa Semanal"
                      : hoveredPoint.periodType === "monthly"
                      ? "% Grasa Mensual"
                      : hoveredPoint.measurements && hoveredPoint.measurements.length > 1
                      ? "% Grasa Media"
                      : "% Graso"}
                  </span>
                  <span className="font-extrabold text-sm text-yellow-400 font-mono">
                    {typeof hoveredPoint.grasaPct === "number" ? `${hoveredPoint.grasaPct.toFixed(1)}%` : "—"}
                  </span>
                </div>

                <div className="p-1 -m-1 rounded-lg">
                  <span className="text-[10px] text-zinc-400 block">
                    BMI / IMC
                  </span>
                  <span className="font-extrabold text-sm text-indigo-300 font-mono">
                    {(hoveredPoint.bmi || calculateBmi(hoveredPoint.peso)).toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span className="text-zinc-500 block">Masa Magra:</span>
                  <span className="font-semibold text-red-400 font-mono">
                    {typeof hoveredPoint.masaMagraKg === "number" ? `${hoveredPoint.masaMagraKg.toFixed(1)} kg` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Masa Grasa:</span>
                  <span className="font-semibold text-yellow-400 font-mono">
                    {typeof hoveredPoint.masaGrasaKg === "number" ? `${hoveredPoint.masaGrasaKg.toFixed(1)} kg` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Estado:</span>
                  {(() => {
                    const bVal = hoveredPoint.bmi || calculateBmi(hoveredPoint.peso);
                    const cat = getBmiCategory(bVal);
                    return (
                      <span className={`font-semibold font-mono ${cat.color}`}>
                        {cat.label.split(" ")[0]}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {(hoveredPoint.muscleRate || hoveredPoint.boneMass || hoveredPoint.metabolism) && (
                <div className="pt-1 border-t border-zinc-800/80 grid grid-cols-3 gap-1.5 text-[9px] text-zinc-400 font-mono">
                  {hoveredPoint.muscleRate && (
                    <div>
                      <span className="text-zinc-500 block text-[8px]">Músculo</span>
                      <span className="text-cyan-400 font-semibold">{hoveredPoint.muscleRate.toFixed(1)} kg</span>
                    </div>
                  )}
                  {hoveredPoint.boneMass && (
                    <div>
                      <span className="text-zinc-500 block text-[8px]">Masa Ósea</span>
                      <span className="text-zinc-300 font-semibold">{hoveredPoint.boneMass.toFixed(2)} kg</span>
                    </div>
                  )}
                  {hoveredPoint.metabolism && (
                    <div>
                      <span className="text-zinc-500 block text-[8px]">BMR</span>
                      <span className="text-amber-400 font-semibold">{Math.round(hoveredPoint.metabolism)} kcal</span>
                    </div>
                  )}
                </div>
              )}

              {hoveredPoint.measurements && hoveredPoint.measurements.length > 1 ? (
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Rango: {hoveredPoint.minPeso?.toFixed(1)} - {hoveredPoint.maxPeso?.toFixed(1)} kg
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-500/30">
                    {hoveredPoint.measurements.length} tomas (clic para ver)
                  </span>
                </div>
              ) : (
                <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-blue-400 font-medium">
                  <span>Haz clic para editar o borrar</span>
                  <EditIcon className="w-3.5 h-3.5 opacity-80" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leyenda del gráfico */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-2 text-xs text-zinc-400 border-t border-zinc-800/60">
          {!isTrendMode && showWeight && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full bg-blue-500" />
              <span className="font-medium text-blue-400">Peso Diario (kg)</span>
            </div>
          )}
          {!isTrendMode && showWeight && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t border-dashed border-blue-400" />
              <span className="text-zinc-400">Media Móvil 7d (Tendencia)</span>
            </div>
          )}
          {!isTrendMode && showFat && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-yellow-400 rounded-full" />
              <span className="font-medium text-yellow-400">% Graso</span>
            </div>
          )}
          {!isTrendMode && showFat && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t border-dashed border-yellow-400" />
              <span className="text-zinc-400">Media Móvil Grasa 7d</span>
            </div>
          )}
          {isTrendMode && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400/50 border border-blue-600" />
                <span className="font-medium text-blue-300">Nube de tomas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-blue-600 rounded-full" />
                <span className="font-medium text-blue-400">Línea de Tendencia</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-t border-dashed border-sky-400" />
                <span className="text-zinc-400">Regresión Global</span>
              </div>
            </>
          )}
          {!isTrendMode && !showWeight && !showFat && (
            <div className="text-zinc-500 italic text-[11px]">
              Ninguna serie seleccionada. Pulsa en Peso o % Grasa arriba para activarlas.
            </div>
          )}

          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-3.5 h-3.5 rounded-full border border-dashed border-blue-400/80 inline-flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            </span>
            <span className="text-[11px] text-zinc-300">
              {adaptiveResult.effectiveInterval !== "daily"
                ? "Períodos agrupados (Media)"
                : "Días con varias tomas (Media)"}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Tabla de Historial de Registros */}
      <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <span>Historial de Pesajes</span>
              <span className="text-xs font-mono font-normal text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                {tableGroupByDay
                  ? `${tableRecords.length} días (${records.length} tomas)`
                  : `${tableRecords.length} tomas`}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {tableGroupByDay
                ? "Días con múltiples tomas muestran la media. Pulsa en el botón de medidas para ver el desglose."
                : "Mostrando todas las tomas individuales en orden cronológico."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle de modo de agrupación */}
            <button
              onClick={() => {
                setTableGroupByDay(!tableGroupByDay);
                setTablePage(1);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
                tableGroupByDay
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25"
                  : "bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:text-white"
              }`}
              title={
                tableGroupByDay
                  ? "Modo: Agrupado por día (medias). Haz clic para ver todas las tomas individuales"
                  : "Modo: Todas las tomas individuales. Haz clic para agrupar por día (medias)"
              }
            >
              <ScaleIcon className="w-3.5 h-3.5" />
              <span>{tableGroupByDay ? "Agrupado por día" : "Todas las tomas"}</span>
            </button>

            {/* Buscador */}
            <div className="relative">
              <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Filtrar por fecha..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setTablePage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-36 sm:w-48"
              />
            </div>

            {/* Ordenar */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-medium cursor-pointer"
              title={sortAsc ? "Más antiguo primero" : "Más reciente primero"}
            >
              {sortAsc ? "▲ Asc" : "▼ Desc"}
            </button>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Peso</th>
                <th className="py-2.5 px-3">Δ Diario</th>
                <th className="py-2.5 px-3">BMI / IMC</th>
                <th className="py-2.5 px-3">% Graso</th>
                <th className="py-2.5 px-3">Masa Magra</th>
                <th className="py-2.5 px-3">Masa Grasa</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {paginatedTableRecords.length > 0 ? (
                paginatedTableRecords.map((r) => {
                  const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);
                  const isExpanded = expandedDays.has(r.fecha);

                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => {
                          if (isMulti) {
                            toggleExpandDay(r.fecha);
                          } else {
                            handleOpenEdit(r.measurements?.[0] || r);
                          }
                        }}
                        className={`hover:bg-zinc-850/70 transition-colors cursor-pointer group ${
                          isExpanded ? "bg-zinc-850/40" : ""
                        }`}
                      >
                        <td className="py-3 px-3 text-zinc-300 font-sans">
                          <div className="flex flex-wrap items-center gap-2 font-medium">
                            <div className="flex items-center gap-1.5 group-hover:text-accent-light transition-colors">
                              <CalendarIcon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-accent-light" />
                              <span>{r.fecha}</span>
                              {!isMulti && (
                                <span className="text-zinc-500 text-[11px] font-mono">· {r.hora}</span>
                              )}
                            </div>

                            {/* BOTÓN: Al pulsar salen las distintas medidas del día */}
                            {isMulti && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandDay(r.fecha);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[11px] font-sans font-semibold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                                title="Pulsar para ver las distintas medidas de este día"
                              >
                                <span>{r.measurements?.length} medidas</span>
                                <ChevronDownIcon
                                  className={`w-3 h-3 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-bold text-blue-400 text-sm">
                          {r.peso.toFixed(1)}{" "}
                          <span className="text-[10px] text-zinc-500 font-normal">kg</span>
                          {isMulti && (
                            <span className="block text-[9px] text-blue-400/80 font-normal font-mono">
                              (media)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {r.deltaPeso !== undefined && r.deltaPeso !== 0 ? (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                                r.deltaPeso < 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {r.deltaPeso < 0 ? "▼" : "▲"}{" "}
                              {r.deltaPeso > 0 ? `+${r.deltaPeso.toFixed(2)}` : r.deltaPeso.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[11px]">-</span>
                          )}
                        </td>

                        <td
                          className="py-3 px-3 cursor-pointer group/bmi hover:bg-zinc-800/40 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBmiModalWeight(r.peso);
                            setBmiModalOpen(true);
                          }}
                          title="Haz clic para ver el mapa de IMC para este pesaje"
                        >
                          {(() => {
                            const bVal = r.bmi || calculateBmi(r.peso);
                            const cat = getBmiCategory(bVal);
                            return (
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="font-bold text-zinc-100 group-hover/bmi:text-indigo-300 transition-colors">{bVal.toFixed(1)}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${cat.bgColor} ${cat.color} ${cat.borderColor} group-hover/bmi:scale-105 transition-transform`}
                                  title={cat.description}
                                >
                                  {cat.label.split(" ")[0]}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-3 font-semibold text-yellow-400">
                          {typeof r.grasaPct === "number" ? `${r.grasaPct.toFixed(1)}%` : <span className="text-zinc-600">—</span>}
                        </td>

                        <td className="py-3 px-3 text-red-400 font-medium">
                          {typeof r.masaMagraKg === "number" ? `${r.masaMagraKg.toFixed(1)} kg` : <span className="text-zinc-600">—</span>}
                        </td>

                        <td className="py-3 px-3 text-yellow-400 font-medium">
                          {typeof r.masaGrasaKg === "number" ? `${r.masaGrasaKg.toFixed(1)} kg` : <span className="text-zinc-600">—</span>}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div
                            className="inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isMulti ? (
                              <>
                                <button
                                  onClick={() => setSelectedDayModal(r)}
                                  className="p-1.5 rounded-lg hover:bg-blue-500/15 text-blue-400 hover:text-blue-200 transition-colors cursor-pointer"
                                  title="Ver desglose en modal"
                                >
                                  <InfoIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteDayGroup(r, e)}
                                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Eliminar todas las medidas de este día"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(r.measurements?.[0] || r)}
                                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                                  title="Modificar pesaje"
                                >
                                  <EditIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteRecord(r.measurements?.[0]?.id || r.id, e)}
                                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Eliminar pesaje"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Desglose desplegado de las medidas individuales de este día */}
                      {isMulti && isExpanded && r.measurements && (
                        <tr className="bg-zinc-950/80 border-b border-zinc-800">
                          <td colSpan={8} className="p-3 pl-6 sm:pl-10">
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-3.5 space-y-2.5 shadow-inner">
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/60 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-200">
                                    Medidas tomadas el {r.fecha}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] font-mono border border-blue-500/20">
                                    Media: {r.peso.toFixed(1)} kg
                                    {typeof r.grasaPct === "number" && ` · ${r.grasaPct.toFixed(1)}%`}
                                  </span>
                                  {r.minPeso !== undefined && r.maxPeso !== undefined && (
                                    <span className="text-zinc-500 text-[11px] font-mono">
                                      (Rango: {r.minPeso.toFixed(1)} - {r.maxPeso.toFixed(1)} kg)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDayModal(r);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Abrir desglose en modal"
                                  >
                                    <InfoIcon className="w-3 h-3 text-blue-400" />
                                    <span>Ver en modal</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNewDate(r.fecha);
                                      setManualEntryModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-light border border-accent/30 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <PlusIcon className="w-3 h-3" />
                                    <span>+ Toma a este día</span>
                                  </button>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs font-mono">
                                  <thead>
                                    <tr className="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/60">
                                      <th className="py-1 px-2">#</th>
                                      <th className="py-1 px-2">Hora</th>
                                      <th className="py-1 px-2">Peso</th>
                                      <th className="py-1 px-2">BMI</th>
                                      <th className="py-1 px-2">% Grasa</th>
                                      <th className="py-1 px-2">Masa Magra</th>
                                      <th className="py-1 px-2">Masa Grasa</th>
                                      <th className="py-1 px-2">Origen</th>
                                      <th className="py-1 px-2 text-right">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/40 text-[11px]">
                                    {r.measurements.map((sub, idx) => (
                                      <tr key={sub.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="py-1.5 px-2 text-zinc-500 font-sans text-[10px]">
                                          Toma {idx + 1}
                                        </td>
                                        <td className="py-1.5 px-2 text-zinc-200 font-semibold flex items-center gap-1">
                                          <ClockIcon className="w-3 h-3 text-zinc-500" />
                                          {sub.hora}
                                        </td>
                                        <td className="py-1.5 px-2 font-bold text-blue-400">
                                          {sub.peso.toFixed(1)}{" "}
                                          <span className="text-[9px] text-zinc-500 font-normal">kg</span>
                                        </td>
                                        <td
                                          className="py-1.5 px-2 text-indigo-300 cursor-pointer hover:underline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setBmiModalWeight(sub.peso);
                                            setBmiModalOpen(true);
                                          }}
                                          title="Haz clic para ver este pesaje en el mapa de IMC"
                                        >
                                          {(sub.bmi || calculateBmi(sub.peso)).toFixed(1)}
                                        </td>
                                        <td className="py-1.5 px-2 text-yellow-400 font-semibold">
                                          {typeof sub.grasaPct === "number" ? `${sub.grasaPct.toFixed(1)}%` : "—"}
                                        </td>
                                        <td className="py-1.5 px-2 text-red-400">
                                          {typeof sub.masaMagraKg === "number" ? `${sub.masaMagraKg.toFixed(1)} kg` : "—"}
                                        </td>
                                        <td className="py-1.5 px-2 text-yellow-400">
                                          {typeof sub.masaGrasaKg === "number" ? `${sub.masaGrasaKg.toFixed(1)} kg` : "—"}
                                        </td>
                                        <td className="py-1.5 px-2 text-[10px] font-sans">
                                          {sub.source === "home_assistant" ? (
                                            <span className="text-cyan-400 font-medium">Home Assistant</span>
                                          ) : sub.source === "xiaomi_mi_home" ? (
                                            <span className="text-orange-400 font-medium">Xiaomi Home</span>
                                          ) : (
                                            <span className="text-zinc-500">{sub.source || "zepp_life"}</span>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-sans">
                                          <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                              onClick={() => handleOpenEdit(sub)}
                                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                                              title="Modificar esta toma"
                                            >
                                              <EditIcon className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={(e) => handleDeleteRecord(sub.id, e)}
                                              className="p-1 rounded hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                              title="Eliminar esta toma"
                                            >
                                              <TrashIcon className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 font-sans">
                    No se encontraron registros de pesaje.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs text-zinc-400">
            <span>
              Página {tablePage} de {totalPages} ({tableRecords.length} {tableGroupByDay ? "días" : "pesajes"})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/80 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-zinc-200"
              >
                Anterior
              </button>
              <button
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                disabled={tablePage === totalPages}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/80 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-zinc-200"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL: Modificar o Eliminar Entrada Seleccionada */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center border"
                  style={{
                    backgroundColor: hexToRgba(seasonColor, 0.15),
                    borderColor: hexToRgba(seasonColor, 0.35),
                    color: seasonColor,
                  }}
                >
                  <EditIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Modificar Pesaje</h3>
                  <p className="text-xs text-zinc-400">
                    ID: {editingRecord.id} · Registrado el {editingRecord.fecha}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingRecord(null);
                  setDeleteConfirmOpen(false);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Hora</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    required
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Peso Corporal (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      required
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base font-mono font-bold text-zinc-100 focus:outline-none focus:border-zinc-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    % Grasa Corporal {editingRecord.source === "zepp_life" ? "(Báscula)" : ""}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={editFat}
                      onChange={(e) => setEditFat(e.target.value)}
                      placeholder={editingRecord.grasaPct !== null && editingRecord.grasaPct !== undefined ? String(editingRecord.grasaPct) : "Opcional"}
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base font-mono font-bold text-yellow-400 focus:outline-none focus:border-zinc-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Vista previa en tiempo real de la recomposición calculada */}
              {liveEditPreview && (
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-300 block">
                    Recálculo biométrico instantáneo:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">BMI / IMC</span>
                      <span className="font-extrabold text-indigo-400 font-mono text-sm">
                        {liveEditPreview.bmi}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">% Graso</span>
                      <span className="font-extrabold text-yellow-400 font-mono text-sm">
                        {liveEditPreview.grasaPct}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Masa Magra</span>
                      <span className="font-extrabold text-red-400 font-mono text-sm">
                        {liveEditPreview.masaMagraKg} kg
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Masa Grasa</span>
                      <span className="font-extrabold text-yellow-400 font-mono text-sm">
                        {liveEditPreview.masaGrasaKg} kg
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerta de confirmación de borrado */}
              {deleteConfirmOpen ? (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 space-y-2">
                  <div className="font-semibold text-xs">
                    ¿Estás seguro de que deseas eliminar este pesaje?
                  </div>
                  <p className="text-[11px] text-rose-300/90">
                    Esta acción eliminará el pesaje del {editingRecord.fecha} ({editingRecord.peso} kg)
                    y recalculará las tendencias de la gráfica.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentEditing}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      Sí, Eliminar Definitivamente
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Botones de acción del modal */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                {!deleteConfirmOpen && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    <span>Eliminar Registro</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-3.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-accent-light text-zinc-950 hover:bg-accent transition-all cursor-pointer shadow-md"
                  >
                    <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Importar CSV */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-accent-light">
                  <UploadCloudIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Importar Archivo CSV de Peso</h3>
                  <p className="text-xs text-zinc-400">Soporta Zepp Life / Mi Fit y Báscula BIA (Peso e Impedancia)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCsvModalOpen(false);
                  setCsvPreview(null);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-200 block mb-1">Formatos compatibles automáticamente:</span>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="text-accent-light">
                    1. Zepp Life / Mi Fit: <code>time, weight, height, bmi, fatRate, bodyWaterRate...</code>
                  </div>
                  <div className="text-emerald-400">
                    2. Báscula BIA Directa: <code>Fecha, hora, Impedancia, Impedancia Low, Peso</code>
                  </div>
                </div>
              </div>

              {/* Zona de Pegar o Soltar */}
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Pega el contenido de tu CSV o arrastra un archivo:</span>
                  <button
                    type="button"
                    onClick={handleLoadSampleCsv}
                    className="text-[11px] text-accent-light hover:underline cursor-pointer"
                  >
                    Cargar datos de ejemplo
                  </button>
                </label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => handleParseCsv(e.target.value)}
                  placeholder="Fecha, hora, Impedancia, Impedancia Low, Peso&#10;2026-10-28, 07:30, 520, 565, 77.8&#10;2026-10-29, 07:45, 522, 568, 77.6"
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 resize-y"
                />
              </div>

              {/* Input file drop */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  id="csv-file-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const content = evt.target?.result as string;
                        handleParseCsv(content || "");
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
                <label
                  htmlFor="csv-file-input"
                  className="px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-750 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <UploadCloudIcon className="w-4 h-4 text-zinc-400" />
                  <span>Seleccionar archivo .csv del equipo</span>
                </label>
              </div>

              {/* Vista previa de validación */}
              {csvPreview && (
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-200">
                      Resultado del análisis:
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {csvPreview.validCount} pesajes válidos encontrados
                    </span>
                  </div>

                  {csvPreview.errors.length > 0 && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] max-h-24 overflow-y-auto">
                      {csvPreview.errors.map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}

                  {csvPreview.records.length > 0 && (
                    <div className="text-[11px] text-zinc-400">
                      Rango de fechas detectado:{" "}
                      <span className="font-mono text-zinc-200">
                        {csvPreview.records[0].fecha} → {csvPreview.records[csvPreview.records.length - 1].fecha}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setCsvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyCsv}
                disabled={!csvPreview || csvPreview.validCount === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent-light text-zinc-950 hover:bg-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
              >
                Cargar en el Visualizador ({csvPreview ? csvPreview.validCount : 0})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: Nuevo Pesaje Manual */}
      {manualEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ScaleIcon className="w-4 h-4 text-accent-light" />
                <h3 className="text-base font-bold text-zinc-100">Registrar Nuevo Pesaje</h3>
              </div>
              <button
                onClick={() => setManualEntryModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualEntry} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Hora</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    required
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Peso Corporal (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="ej. 77.4"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      required
                      autoFocus
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base font-mono font-bold text-zinc-100 focus:outline-none focus:border-zinc-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">% Grasa Corporal (opcional)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="ej. 19.8"
                      value={newFat}
                      onChange={(e) => setNewFat(e.target.value)}
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-base font-mono font-bold text-yellow-400 focus:outline-none focus:border-zinc-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 italic">
                {newFat ? "Composición calculada con el % de grasa indicado y tu altura/edad." : "Si no indicas % graso, se estimará automáticamente según tu perfil biométrico."}
              </p>

              {liveNewPreview && (
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-300 block">
                    Recálculo biométrico instantáneo:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">BMI / IMC</span>
                      <span className="font-extrabold text-indigo-400 font-mono text-sm">
                        {liveNewPreview.bmi}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">% Graso</span>
                      <span className="font-extrabold text-yellow-400 font-mono text-sm">
                        {liveNewPreview.grasaPct}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Masa Magra</span>
                      <span className="font-extrabold text-red-400 font-mono text-sm">
                        {liveNewPreview.masaMagraKg} kg
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Masa Grasa</span>
                      <span className="font-extrabold text-yellow-400 font-mono text-sm">
                        {liveNewPreview.masaGrasaKg} kg
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setManualEntryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-accent-light text-zinc-950 hover:bg-accent transition-all cursor-pointer shadow-md"
                >
                  Guardar Pesaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: Detalle de Medidas del Día (cuando hay varias tomas) */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-blue-400">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <span>
                      {selectedDayModal.periodType === "weekly"
                        ? `Semana: ${selectedDayModal.periodLabel || selectedDayModal.fecha}`
                        : selectedDayModal.periodType === "monthly"
                        ? `Mes: ${selectedDayModal.periodLabel || selectedDayModal.fecha}`
                        : `Medidas del ${selectedDayModal.fecha}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {selectedDayModal.measurements?.length || 1} tomas
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedDayModal.periodType === "weekly"
                      ? "En la gráfica se muestra la media semanal calculada para este período."
                      : selectedDayModal.periodType === "monthly"
                      ? "En la gráfica se muestra la media mensual calculada para este período."
                      : "En la gráfica general se muestra la media diaria de este conjunto de medidas."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayModal(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjetas resumen de la media diaria o de período */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-center font-mono">
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block font-sans">
                  {selectedDayModal.periodType === "weekly"
                    ? "Media Semanal"
                    : selectedDayModal.periodType === "monthly"
                    ? "Media Mensual"
                    : "Peso Medio"}
                </span>
                <span className="text-base font-extrabold text-blue-400">{selectedDayModal.peso.toFixed(1)} kg</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block font-sans">Grasa Media</span>
                <span className="text-base font-extrabold text-yellow-400">
                  {typeof selectedDayModal.grasaPct === "number" ? `${selectedDayModal.grasaPct.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block font-sans">Masa Magra</span>
                <span className="text-base font-extrabold text-red-400">
                  {typeof selectedDayModal.masaMagraKg === "number" ? `${selectedDayModal.masaMagraKg.toFixed(1)} kg` : "—"}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block font-sans">Rango Peso</span>
                <span className="text-xs font-semibold text-zinc-300">
                  {selectedDayModal.minPeso?.toFixed(1)} - {selectedDayModal.maxPeso?.toFixed(1)} kg
                </span>
              </div>
            </div>

            {/* Listado de todas las tomas individuales */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>Desglose de tomas registradas ({selectedDayModal.measurements?.length || 1})</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewDate(selectedDayModal.fecha);
                    setManualEntryModalOpen(true);
                  }}
                  className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-sans cursor-pointer normal-case font-medium"
                >
                  <PlusIcon className="w-3 h-3" />
                  <span>Añadir otra toma</span>
                </button>
              </h4>

              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {selectedDayModal.measurements?.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-400 text-sm font-mono">{m.peso.toFixed(1)} kg</span>
                          <span className="text-zinc-500 font-mono text-[11px] flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {m.hora}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans ${
                            m.source === "home_assistant"
                              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                              : m.source === "xiaomi_mi_home"
                              ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                              : "bg-zinc-800 text-zinc-400"
                          }`}>
                            {m.source === "home_assistant"
                              ? "Home Assistant"
                              : m.source === "xiaomi_mi_home"
                              ? "Xiaomi Mi Home"
                              : m.source === "scale_bia"
                              ? "Báscula BIA"
                              : m.source === "manual"
                              ? "Manual"
                              : "Zepp Life"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-zinc-400 font-mono">
                          {typeof m.grasaPct === "number" && (
                            <span className="text-yellow-400 font-semibold">Grasa: {m.grasaPct.toFixed(1)}%</span>
                          )}
                          {typeof m.masaMagraKg === "number" && (
                            <span className="text-red-400 font-semibold">Magra: {m.masaMagraKg.toFixed(1)} kg</span>
                          )}
                          {typeof m.masaGrasaKg === "number" && (
                            <span className="text-yellow-400 font-semibold">M. Grasa: {m.masaGrasaKg.toFixed(1)} kg</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                        title="Modificar esta toma"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async (e) => {
                          await handleDeleteRecord(m.id, e);
                          const remaining = (selectedDayModal.measurements || []).filter((sub) => sub.id !== m.id);
                          if (remaining.length === 0) {
                            setSelectedDayModal(null);
                          } else {
                            const updatedDay = aggregateRecordsByDay(remaining, profile)[0];
                            setSelectedDayModal(updatedDay || null);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors"
                        title="Eliminar esta toma"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setNewDate(selectedDayModal.fecha);
                  setManualEntryModalOpen(true);
                  setSelectedDayModal(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Añadir otra toma a este día</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: Mapa de Tipos de Peso e IMC (OMS) */}
      <BmiMapModal
        isOpen={bmiModalOpen}
        onClose={() => setBmiModalOpen(false)}
        weight={bmiModalWeight ?? (stats.latestWeight > 0 ? stats.latestWeight : undefined)}
      />

      {/* 10. MODAL: Sincronización Xiaomi Cloud (Mi Home / Yunmai) */}
      <XiaomiSyncModal
        isOpen={xiaomiModalOpen}
        onClose={() => {
          setXiaomiModalOpen(false);
          setXiaomiAutoStartQr(false);
        }}
        autoStartQr={xiaomiAutoStartQr}
        onSyncSuccess={() => {
          loadRecords();
          fetchXiaomiStatus();
        }}
      />
    </div>
  );
}
