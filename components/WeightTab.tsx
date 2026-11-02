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
} from "./Icons";
import { useSeason } from "@/lib/season-context";
import { getSeasonColor, hexToRgba } from "@/lib/season-colors";
import { useUserProfile, getBmiCategory } from "@/lib/user-profile-context";
import { BmiMapModal } from "./BmiMapModal";
import {
  WeightRecord,
  generateMockWeightRecords,
  parseWeightCsv,
  getSampleCsvContent,
  estimateBodyComposition,
  enrichWithMovingAverages,
  aggregateRecordsByDay,
  DEFAULT_USER_PROFILE,
} from "@/lib/mock-weight-data";

export type WeightChartMode = "combined" | "weight_only" | "fat_only" | "composition";
export type TimeRange = "1M" | "3M" | "6M" | "1A" | "all";
export type CurveType = "linear" | "smooth" | "flow";

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
      const res = await fetch("/api/weight");
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

  // Recalcular BMI y composición cuando cambie el perfil de altura/edad en Configuración
  useEffect(() => {
    setRecords((prev) =>
      enrichWithMovingAverages(
        prev.map((r) => {
          const newBmi = profile.alturaCm > 0 ? calculateBmi(r.peso) : r.bmi;
          if (r.source === "zepp_life" && typeof r.grasaPct === "number") {
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
  }, [profile.alturaCm, profile.edad, profile.sexo]);

  // Filtros y vistas
  const [chartMode, setChartMode] = useState<WeightChartMode>("combined");
  const [curveType, setCurveType] = useState<CurveType>("smooth");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [syncWithSeason, setSyncWithSeason] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

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
  const [editImp, setEditImp] = useState("");
  const [editImpLow, setEditImpLow] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Formulario de pesaje manual nuevo
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTime, setNewTime] = useState("08:00");
  const [newWeight, setNewWeight] = useState("");
  const [newImp, setNewImp] = useState("520");
  const [newImpLow, setNewImpLow] = useState("565");

  // Hover interactivo en el gráfico
  const [hoveredPoint, setHoveredPoint] = useState<WeightRecord | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

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

    if (isNaN(p) || p <= 0) {
      alert("Por favor introduce un peso válido en kg");
      return;
    }

    const [y, m, d] = editDate.split("-").map(Number);
    const [hh, mm] = editTime.split(":").map(Number);
    const ts = new Date(y, (m || 1) - 1, d || 1, hh || 8, mm || 0).getTime();

    let comp = {
      grasaPct: editingRecord.grasaPct,
      masaMagraKg: editingRecord.masaMagraKg,
      masaGrasaKg: editingRecord.masaGrasaKg,
      aguaPct: editingRecord.aguaPct,
      bmi: editingRecord.bmi,
      ffmi: editingRecord.ffmi,
    };

    if (editingRecord.source !== "zepp_life" || comp.grasaPct === null) {
      comp = estimateBodyComposition(p, imp || 520, impLow || 565, profile);
    } else {
      comp.bmi = profile.alturaCm > 0 ? calculateBmi(p) : editingRecord.bmi;
    }

    const updatedRecord: WeightRecord = {
      ...editingRecord,
      fecha: editDate,
      hora: editTime,
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

  // Filtrado de datos por rango temporal y season (registros brutos)
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (syncWithSeason && activeSeason && activeSeasonId !== "all" && activeSeason.startTimestamp) {
      const seasonStart = activeSeason.startTimestamp * 1000;
      const seasonEnd = activeSeason.endTimestamp ? activeSeason.endTimestamp * 1000 : Infinity;
      result = result.filter((r) => r.timestamp >= seasonStart && r.timestamp <= seasonEnd);
    } else if (timeRange !== "all") {
      const now = records.length > 0 ? records[records.length - 1].timestamp : Date.now();
      let days = 90;
      if (timeRange === "1M") days = 30;
      else if (timeRange === "3M") days = 90;
      else if (timeRange === "6M") days = 180;
      else if (timeRange === "1A") days = 365;

      const cutoff = now - days * 24 * 3600 * 1000;
      result = result.filter((r) => r.timestamp >= cutoff);
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }, [records, timeRange, syncWithSeason, activeSeason, activeSeasonId]);

  // Agrupación de pesajes por día para la gráfica:
  // Cuando hay varias medidas el mismo día, el punto que aparece en la gráfica es la media
  const chartRecords = useMemo(() => {
    const aggregated = aggregateRecordsByDay(filteredRecords, profile);
    return enrichWithMovingAverages(aggregated);
  }, [filteredRecords, profile]);

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

    if (isNaN(p) || p <= 0) {
      alert("Por favor introduce un peso válido en kg");
      return;
    }

    const [y, m, d] = newDate.split("-").map(Number);
    const [hh, mm] = newTime.split(":").map(Number);
    const ts = new Date(y, (m || 1) - 1, d || 1, hh || 8, mm || 0).getTime();

    const comp = estimateBodyComposition(p, imp || 520, impLow || 565, profile);

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

  // Escalas matemáticas para el gráfico
  const chartScales = useMemo(() => {
    if (chartRecords.length === 0) return null;

    const timestamps = chartRecords.map((r) => r.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = maxTime - minTime || 1;

    // Escala Peso (kg)
    const weights = chartRecords.map((r) => r.peso);
    const maWeights = chartRecords.map((r) => r.ma7Peso || r.peso);
    const allWeightVals = [...weights, ...maWeights];
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
  }, [chartRecords, chartInnerWidth, chartInnerHeight, padding]);

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

    return {
      weightLine,
      maWeightLine,
      weightArea,
      fatLine,
      maFatLine,
      fatArea,
      leanLine,
      fatKgLine,
    };
  }, [chartScales, chartRecords, curveType, padding, chartInnerHeight]);

  // Manejador del cursor sobre el SVG
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartScales || chartRecords.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * svgWidth;

    let closest: WeightRecord | null = null;
    let closestDist = Infinity;

    for (const r of chartRecords) {
      const px = chartScales.getX(r.timestamp);
      const dist = Math.abs(px - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = r;
      }
    }

    if (closest) {
      setHoveredPoint(closest);
      setHoverX(chartScales.getX(closest.timestamp));
    }
  };

  const handleSvgMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  // Cálculo en vivo para el modal de edición
  const liveEditPreview = useMemo(() => {
    if (!editingRecord) return null;
    const p = parseFloat(editWeight.replace(",", "."));
    const imp = parseFloat(editImp) || 520;
    const impLow = parseFloat(editImpLow) || 565;
    if (isNaN(p) || p <= 0) return null;
    return estimateBodyComposition(p, imp, impLow, profile);
  }, [editingRecord, editWeight, editImp, editImpLow, profile]);

  // Cálculo en vivo para el modal de nuevo registro
  const liveNewPreview = useMemo(() => {
    if (!manualEntryModalOpen) return null;
    const p = parseFloat(newWeight.replace(",", "."));
    const imp = parseFloat(newImp) || 520;
    const impLow = parseFloat(newImpLow) || 565;
    if (isNaN(p) || p <= 0) return null;
    return estimateBodyComposition(p, imp, impLow, profile);
  }, [manualEntryModalOpen, newWeight, newImp, newImpLow, profile]);

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
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                  Seguimiento de Peso
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <DatabaseIcon className="w-3 h-3 text-emerald-400" />
                  <span>SQLite Conectado ({records.length} pesajes)</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Haz clic en cualquier punto de la gráfica o fila para{" "}
                <span className="text-zinc-200 font-semibold">modificar o eliminar</span> la entrada.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            onClick={() => setCsvModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800/90 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-750 hover:text-white transition-all shadow-sm cursor-pointer"
            title="Importar archivo CSV"
          >
            <UploadCloudIcon className="w-4 h-4 text-accent-light" />
            <span>Importar CSV</span>
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

      {/* 2. Banner informativo sobre el Schema y la interacción */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-300">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
            <InfoIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-zinc-200">Base de datos de pesajes sincronizada:</span>{" "}
            Soporta datos directos de báscula (peso e impedancia) o importaciones de Zepp Life.
            Haz clic en cualquier punto o fila para <span className="text-amber-400 font-medium">editar o eliminar</span>.
          </div>
        </div>

        <button
          onClick={handleReloadFromDb}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer whitespace-nowrap ml-auto"
        >
          <RefreshCwIcon className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span>Sincronizar BD</span>
        </button>
      </div>

      {/* 3. Panel de Métricas / KPI Cards (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* KPI 1: Peso Actual (Azul Cobalto) */}
        <div className="col-span-1 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <ScaleIcon className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-zinc-300 font-semibold">Peso Actual</span>
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

        {/* KPI 4: Masa Magra (Rojo) */}
        <div className="col-span-1 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <ActivityIcon className="w-3.5 h-3.5 text-red-500" />
              <span className="text-zinc-300 font-semibold">Masa Magra</span>
            </span>
            <span className="text-[10px] font-mono text-red-400 font-semibold">FFM</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-red-400 tracking-tight font-mono">
              {stats.latestLean.toFixed(1)}
            </span>
            <span className="text-xs text-red-400/80 font-normal">kg</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-red-400/90 font-medium">Musculatura</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {((stats.latestLean / (stats.latestWeight || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* KPI 5: Masa Grasa (Amarillo) */}
        <div className="col-span-1 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <TrendingDownIcon className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-zinc-300 font-semibold">Masa Grasa</span>
            </span>
            <span className="text-[10px] font-mono text-yellow-400 font-semibold">FAT</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-yellow-300 tracking-tight font-mono">
              {stats.latestFatKg.toFixed(1)}
            </span>
            <span className="text-xs text-yellow-400/80 font-normal">kg</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-yellow-400/90 font-medium">Tejido adiposo</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {((stats.latestFatKg / (stats.latestWeight || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Gráfico Principal Interactivo de Evolución */}
      <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm shadow-xl space-y-4">
        {/* Barra de Controles del Gráfico */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
          {/* Selector de Métricas */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setChartMode("combined")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                chartMode === "combined"
                  ? "bg-zinc-800 text-zinc-100 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Combinado (Peso + % Grasa)
            </button>
            <button
              onClick={() => setChartMode("weight_only")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                chartMode === "weight_only"
                  ? "bg-zinc-800 text-zinc-100 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Solo Peso & MA-7
            </button>
            <button
              onClick={() => setChartMode("fat_only")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                chartMode === "fat_only"
                  ? "bg-zinc-800 text-zinc-100 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Solo % Graso
            </button>
            <button
              onClick={() => setChartMode("composition")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                chartMode === "composition"
                  ? "bg-zinc-800 text-zinc-100 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Masa Magra vs Grasa
            </button>
          </div>

          {/* Selector de Curva (Rectas / Curvas / Suavizada) + Filtros Temporales */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Control segmentado de tipo de curva (exactamente como en ProgressionChart) */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => setCurveType("linear")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  curveType === "linear"
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Trazado lineal con picos directos entre puntos"
              >
                <LinearLineIcon className="w-3.5 h-3.5" />
                <span>Rectas</span>
              </button>

              <button
                type="button"
                onClick={() => setCurveType("smooth")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  curveType === "smooth"
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Curvas naturales (spline cúbico monótono)"
              >
                <SmoothLineIcon className="w-3.5 h-3.5" />
                <span>Curvas</span>
              </button>

              <button
                type="button"
                onClick={() => setCurveType("flow")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  curveType === "flow"
                    ? "bg-zinc-800 text-zinc-100 font-bold shadow-xs border border-zinc-700/60"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Completamente suavizadas (línea continua fluida)"
              >
                <FlowLineIcon className="w-3.5 h-3.5" />
                <span>Fluida</span>
              </button>
            </div>

            {/* Sincronización con Season */}
            {activeSeason && activeSeasonId !== "all" && (
              <button
                onClick={() => setSyncWithSeason(!syncWithSeason)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  syncWithSeason
                    ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                    : "bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                }`}
                title="Filtrar por la temporada activa"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: syncWithSeason ? seasonColor : "#71717a" }}
                />
                <span className="truncate max-w-[120px]">Season: {activeSeason.name}</span>
              </button>
            )}

            {/* Filtros de Rango Temporal */}
            <div className="flex items-center gap-0.5 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800">
              {(["1M", "3M", "6M", "1A", "all"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setTimeRange(r);
                    if (syncWithSeason) setSyncWithSeason(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    timeRange === r && !syncWithSeason
                      ? "bg-zinc-800 text-zinc-100 font-bold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {r === "all" ? "Todo" : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas SVG Interactivo */}
        <div className="relative w-full overflow-hidden select-none">
          {chartScales && chartPaths && chartRecords.length > 0 ? (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
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
                    {(chartMode === "combined" ||
                      chartMode === "weight_only" ||
                      chartMode === "composition") && (
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
                    {(chartMode === "combined" || chartMode === "fat_only") && (
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

              {/* 1. CURVAS DE PESO (Azul Cobalto) */}
              {(chartMode === "combined" || chartMode === "weight_only") && (
                <>
                  {/* Área degradada de peso con el trazado exacto de curveType */}
                  <path d={chartPaths.weightArea} fill="url(#weightGrad)" />

                  {/* Línea de peso diario */}
                  <path
                    d={chartPaths.weightLine}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={chartMode === "weight_only" ? "1.75" : "2"}
                    strokeOpacity={chartMode === "weight_only" ? "0.6" : "0.95"}
                  />

                  {/* Línea de Media Móvil 7D de Peso (destacada) */}
                  <path
                    d={chartPaths.maWeightLine}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeDasharray={chartMode === "weight_only" ? undefined : "3 3"}
                  />

                  {/* Puntos individuales de pesaje (media diaria cuando hay varias tomas) */}
                  {chartRecords.map((r) => {
                    const cx = chartScales.getX(r.timestamp);
                    const cy = chartScales.getYWeight(r.peso);
                    const isHovered = hoveredPoint?.id === r.id;
                    const isFlow = curveType === "flow";
                    const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);

                    return (
                      <g key={r.id}>
                        {isMulti && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 9 : 6}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                            className="pointer-events-none opacity-85"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 6 : isFlow ? (isMulti ? 3 : 1.5) : (isMulti ? 4 : 3)}
                          fill={isHovered ? "#ffffff" : "#2563eb"}
                          stroke="#18181b"
                          strokeWidth={isHovered ? 2.5 : 1}
                          className="transition-all cursor-pointer hover:r-[6px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMulti) {
                              setSelectedDayModal(r);
                            } else {
                              handleOpenEdit(r.measurements?.[0] || r);
                            }
                          }}
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {/* 2. CURVAS DE % GRASO (Amarillo) */}
              {(chartMode === "combined" || chartMode === "fat_only") && (
                <>
                  {/* Área degradada de grasa */}
                  <path d={chartPaths.fatArea} fill="url(#fatGrad)" />

                  {/* Línea de % graso diario */}
                  <path
                    d={chartPaths.fatLine}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth={chartMode === "fat_only" ? "1.75" : "2"}
                    strokeOpacity={chartMode === "fat_only" ? "0.6" : "0.95"}
                  />

                  {/* Línea de Media Móvil 7D de Grasa */}
                  <path
                    d={chartPaths.maFatLine}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="2.5"
                    strokeDasharray={chartMode === "fat_only" ? undefined : "3 3"}
                  />

                  {chartRecords
                    .filter((r): r is typeof r & { grasaPct: number } => typeof r.grasaPct === "number")
                    .map((r) => {
                      const cx = chartScales.getX(r.timestamp);
                      const cy = chartScales.getYFat(r.grasaPct);
                      const isHovered = hoveredPoint?.id === r.id;
                      const isFlow = curveType === "flow";
                      const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);

                      return (
                        <g key={`f-${r.id}`}>
                          {isMulti && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isHovered ? 9 : 6}
                              fill="none"
                              stroke="#eab308"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                              className="pointer-events-none opacity-85"
                            />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 6 : isFlow ? (isMulti ? 3 : 1.5) : (isMulti ? 4 : 3)}
                            fill={isHovered ? "#ffffff" : "#eab308"}
                            stroke="#18181b"
                            strokeWidth={isHovered ? 2.5 : 1}
                            className="transition-all cursor-pointer hover:r-[6px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMulti) {
                                setSelectedDayModal(r);
                              } else {
                                handleOpenEdit(r.measurements?.[0] || r);
                              }
                            }}
                          />
                        </g>
                      );
                    })}
                </>
              )}

              {/* 3. MODO COMPOSICIÓN CORPORAL (Masa Magra en Rojo vs Masa Grasa en Amarillo) */}
              {chartMode === "composition" && (
                <>
                  <path d={chartPaths.leanLine} fill="none" stroke="#ef4444" strokeWidth="2.5" />
                  <path d={chartPaths.fatKgLine} fill="none" stroke="#eab308" strokeWidth="2.5" />

                  {chartRecords
                    .filter((r): r is typeof r & { masaMagraKg: number } => typeof r.masaMagraKg === "number")
                    .map((r) => {
                      const cx = chartScales.getX(r.timestamp);
                      const cyLean = chartScales.getYWeight(r.masaMagraKg);
                      const isHovered = hoveredPoint?.id === r.id;
                      const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);
                      return (
                        <circle
                          key={`lean-${r.id}`}
                          cx={cx}
                          cy={cyLean}
                          r={isHovered ? 6 : (isMulti ? 4 : 3)}
                          fill="#ef4444"
                          stroke="#18181b"
                          strokeWidth={1.5}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMulti) {
                              setSelectedDayModal(r);
                            } else {
                              handleOpenEdit(r.measurements?.[0] || r);
                            }
                          }}
                        />
                      );
                    })}

                  {chartRecords
                    .filter((r): r is typeof r & { masaGrasaKg: number } => typeof r.masaGrasaKg === "number")
                    .map((r) => {
                      const cx = chartScales.getX(r.timestamp);
                      const cyFatKg = chartScales.getYWeight(r.masaGrasaKg);
                      const isHovered = hoveredPoint?.id === r.id;
                      const isMulti = Boolean(r.isDailyAverage && r.measurements && r.measurements.length > 1);
                      return (
                        <circle
                          key={`fatkg-${r.id}`}
                          cx={cx}
                          cy={cyFatKg}
                          r={isHovered ? 6 : (isMulti ? 4 : 3)}
                          fill="#eab308"
                          stroke="#18181b"
                          strokeWidth={1.5}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMulti) {
                              setSelectedDayModal(r);
                            } else {
                              handleOpenEdit(r.measurements?.[0] || r);
                            }
                          }}
                        />
                      );
                    })}
                </>
              )}

              {/* Guía vertical de cursor (Crosshair) */}
              {hoverX !== null && hoveredPoint && (
                <g>
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

              {/* Eje X: Fechas destacadas */}
              {(() => {
                const step = Math.max(1, Math.floor(chartRecords.length / 6));
                const samples: WeightRecord[] = [];
                for (let i = 0; i < chartRecords.length; i += step) {
                  samples.push(chartRecords[i]);
                }
                const last = chartRecords[chartRecords.length - 1];
                if (!samples.includes(last)) samples.push(last);

                return samples.map((r, i) => {
                  const x = chartScales.getX(r.timestamp);
                  return (
                    <text
                      key={i}
                      x={x}
                      y={svgHeight - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#71717a"
                      fontFamily="monospace"
                    >
                      {r.fecha.slice(5)}
                    </text>
                  );
                });
              })()}
            </svg>
          ) : (
            <div className="py-20 text-center text-zinc-500 text-sm">
              No hay datos para el rango seleccionado.
            </div>
          )}

          {/* Tooltip flotante interactivo con botón de edición rápida */}
          {hoveredPoint && hoverX !== null && (
            <div
              className="absolute top-2 pointer-events-auto z-20 bg-zinc-900/95 border border-zinc-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[230px] transition-all cursor-pointer hover:border-accent-light"
              style={{
                left: Math.min(Math.max(20, (hoverX / svgWidth) * 100), 75) + "%",
                transform: "translateX(-50%)",
              }}
              onClick={() => {
                if (hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1) {
                  setSelectedDayModal(hoveredPoint);
                } else {
                  handleOpenEdit(hoveredPoint.measurements?.[0] || hoveredPoint);
                }
              }}
              title={
                hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1
                  ? "Haz clic para ver las distintas medidas de este día"
                  : "Haz clic para modificar o eliminar este pesaje"
              }
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-zinc-400 font-mono text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-zinc-200">
                  <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                  {hoveredPoint.fecha}
                </span>
                {hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-semibold text-[10px] border border-cyan-500/30">
                    Media ({hoveredPoint.measurements.length} tomas)
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
                    {hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1 ? "Peso Medio" : "Peso"}
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
                    {hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1 ? "% Grasa Media" : "% Graso"}
                  </span>
                  <span className="font-extrabold text-sm text-yellow-400 font-mono">
                    {typeof hoveredPoint.grasaPct === "number" ? `${hoveredPoint.grasaPct.toFixed(1)}%` : "—"}
                  </span>
                </div>

                <div
                  className="cursor-pointer group/bmi hover:bg-zinc-800/60 p-1 -m-1 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBmiModalWeight(hoveredPoint.peso);
                    setBmiModalOpen(true);
                  }}
                  title="Haz clic para ver el mapa de IMC para este pesaje"
                >
                  <span className="text-[10px] text-zinc-400 block flex items-center justify-between">
                    <span>BMI / IMC</span>
                    <span className="text-[9px] text-indigo-400 font-sans group-hover/bmi:underline">↗ mapa</span>
                  </span>
                  <span className="font-extrabold text-sm text-indigo-300 font-mono group-hover/bmi:text-indigo-200">
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

              {hoveredPoint.isDailyAverage && hoveredPoint.measurements && hoveredPoint.measurements.length > 1 ? (
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Rango: {hoveredPoint.minPeso?.toFixed(1)} - {hoveredPoint.maxPeso?.toFixed(1)} kg
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayModal(hoveredPoint);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-[10px] cursor-pointer transition-colors shadow-sm"
                  >
                    Ver {hoveredPoint.measurements.length} medidas
                  </button>
                </div>
              ) : (
                <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-accent-light font-medium">
                  <span>Clic para editar o borrar</span>
                  <EditIcon className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leyenda del gráfico */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-2 text-xs text-zinc-400 border-t border-zinc-800/60">
          {(chartMode === "combined" || chartMode === "weight_only") && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full bg-blue-500" />
              <span className="font-medium text-blue-400">Peso Diario (kg)</span>
            </div>
          )}
          {(chartMode === "combined" || chartMode === "weight_only") && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t border-dashed border-blue-400" />
              <span className="text-zinc-400">Media Móvil 7d (Tendencia)</span>
            </div>
          )}
          {(chartMode === "combined" || chartMode === "fat_only") && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-yellow-400 rounded-full" />
              <span className="font-medium text-yellow-400">% Graso</span>
            </div>
          )}
          {chartMode === "composition" && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-red-500 rounded-full" />
                <span className="font-medium text-red-400">Masa Magra (kg)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-yellow-400 rounded-full" />
                <span className="font-medium text-yellow-400">Masa Grasa (kg)</span>
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-3.5 h-3.5 rounded-full border border-dashed border-blue-400/80 inline-flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            </span>
            <span className="text-[11px] text-zinc-300">Días con varias tomas (Media)</span>
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
                                        <td className="py-1.5 px-2 text-zinc-500 text-[10px] font-sans">
                                          {sub.source || "zepp_life"}
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

              <div>
                <label className="text-zinc-400 block mb-1">Peso Corporal (kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    required
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-lg font-mono font-bold text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
                    kg
                  </span>
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

              <p className="text-[11px] text-zinc-500 italic">
                El % graso, masa magra y masa grasa se estimarán automáticamente según tu perfil biométrico.
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
                    <span>Medidas del {selectedDayModal.fecha}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {selectedDayModal.measurements?.length || 1} tomas
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    En la gráfica general se muestra la media diaria de este conjunto de medidas.
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

            {/* Tarjetas resumen de la media diaria */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-center font-mono">
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block font-sans">Peso Medio</span>
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
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-sans">
                            {m.source || "zepp_life"}
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
    </div>
  );
}
