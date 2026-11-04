"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DumbbellIcon,
  ScaleIcon,
  TargetIcon,
  BookOpenIcon,
  SettingsIcon,
  ByteHevyLogo,
  TrophyIcon,
  ChevronDownIcon,
  CalendarIcon,
  CheckIcon,
  PlusIcon,
  RefreshCwIcon,
} from "./Icons";
import { useSeason } from "@/lib/season-context";
import { getSeasonColor, hexToRgba } from "@/lib/season-colors";
import { useSync } from "@/lib/sync-context";

export type TabId = "explorer" | "weight" | "goals" | "journal" | "settings" | "sync";

interface HeaderProps {
  activeTab?: TabId;
  setActiveTab?: (tab: TabId) => void;
  stats?: {
    workoutsCount: number;
    exercisesCount: number;
  };
  loadingStats?: boolean;
  onOpenHevySync?: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  stats,
  loadingStats = false,
  onOpenHevySync,
}: HeaderProps) {
  const pathname = usePathname() || "/";
  const { seasons, activeSeasonId, activeSeason, setActiveSeasonId } = useSeason();
  const {
    hevyConnected,
    hevyUsername,
    xiaomiConnected,
    xiaomiUserId,
    isGlobalSyncing,
    triggerGlobalSync,
  } = useSync();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const tabs: { id: TabId; label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "explorer", label: "Explorador", href: "/", icon: DumbbellIcon },
    { id: "weight", label: "Peso", href: "/peso", icon: ScaleIcon },
    { id: "journal", label: "Diario", href: "/diario", icon: BookOpenIcon },
    { id: "goals", label: "Objetivos", href: "/objetivos", icon: TargetIcon },
  ];

  // Normalized tab matching: prefer URL pathname, fallback to activeTab prop
  const currentTab: TabId = activeTab
    ? (activeTab === "sync" ? "settings" : activeTab)
    : pathname.startsWith("/peso")
    ? "weight"
    : pathname.startsWith("/diario")
    ? "journal"
    : pathname.startsWith("/objetivos")
    ? "goals"
    : pathname.startsWith("/ajustes") || pathname.startsWith("/sync")
    ? "settings"
    : "explorer";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-[var(--header-bg)] backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[76px] flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand */}
        <Link
          href="/"
          onClick={() => {
            if (setActiveTab) setActiveTab("explorer");
          }}
          className="flex items-center gap-3 shrink-0 text-left cursor-pointer group rounded-xl p-1 -m-1 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Ir al Explorador de Entrenamientos"
          aria-label="byteHevy - Ir a la pestaña Explorador"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center shadow-md group-hover:border-accent/50 group-hover:shadow-accent/10 transition-all">
            <ByteHevyLogo className="w-6 h-6 sm:w-7 sm:h-7 transition-transform group-hover:scale-105" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-[22px] font-extrabold tracking-tight leading-none">
              <span className="text-zinc-100 group-hover:text-white transition-colors">byte</span>
              <span className="text-accent-light">Hevy</span>
            </span>
            <span className="text-[11px] sm:text-xs text-zinc-500 font-normal mt-0.5 tracking-normal group-hover:text-zinc-400 transition-colors">
              Visualizador de Entrenamientos
            </span>
          </div>
        </Link>

        {/* Center: Season Selector (Prominent, Left of Tabs) + Tabs */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Season Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {(() => {
              const activeColor = activeSeason ? getSeasonColor(activeSeason) : null;
              const isOngoing = Boolean(
                activeSeason &&
                  (!activeSeason.endDate ||
                    !activeSeason.endTimestamp ||
                    activeSeason.endDate.trim() === "" ||
                    activeSeason.endDate.trim().toLowerCase() === "actualidad")
              );
              return (
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={
                    activeColor
                      ? {
                          background: `linear-gradient(to right, ${hexToRgba(activeColor, 0.22)}, ${hexToRgba(activeColor, 0.08)}, rgba(24, 24, 27, 0.95))`,
                          borderColor: hexToRgba(activeColor, 0.45),
                          boxShadow: `0 0 16px ${hexToRgba(activeColor, 0.15)}`,
                        }
                      : undefined
                  }
                  className={`h-11 flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer border shadow-md ${
                    activeSeason
                      ? "ring-1 text-zinc-100 hover:brightness-110"
                      : "bg-zinc-900/90 border-zinc-700/80 text-zinc-200 hover:bg-zinc-850 hover:border-zinc-600"
                  }`}
                  title="Cambiar season de entrenamiento"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-inner border"
                    style={
                      activeColor
                        ? {
                            backgroundColor: hexToRgba(activeColor, 0.22),
                            borderColor: hexToRgba(activeColor, 0.45),
                            color: activeColor,
                          }
                        : {
                            backgroundColor: "rgba(39, 39, 42, 0.8)",
                            borderColor: "rgba(63, 63, 70, 0.6)",
                            color: "#f59e0b",
                          }
                    }
                  >
                    {activeSeason && activeColor ? (
                      <CalendarIcon className="w-4 h-4" style={{ color: activeColor }} />
                    ) : (
                      <TrophyIcon className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 flex items-center gap-1">
                      {activeColor && isOngoing && (
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ backgroundColor: activeColor }}
                        />
                      )}
                      {isOngoing ? "SEASON ACTIVA" : "SEASON"}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-zinc-100 truncate max-w-[110px] sm:max-w-[160px] md:max-w-[200px]">
                      {activeSeason ? activeSeason.name : "Histórico Completo"}
                    </span>
                  </div>

                  <ChevronDownIcon
                    className={`w-3.5 h-3.5 text-zinc-400 ml-0.5 transition-transform duration-200 shrink-0 ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                    style={activeColor && dropdownOpen ? { color: activeColor } : undefined}
                  />
                </button>
              );
            })()}

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl backdrop-blur-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center justify-between">
                  <span>Seleccionar Season</span>
                  {seasons.length > 0 && (
                    <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
                      {seasons.length} {seasons.length === 1 ? "season" : "seasons"}
                    </span>
                  )}
                </div>

                {/* Option 1: All-Time */}
                <button
                  onClick={() => {
                    setActiveSeasonId("all");
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    !activeSeasonId || activeSeasonId === "all"
                      ? "bg-zinc-800/90 text-zinc-100 font-medium border border-zinc-700/70 shadow-sm"
                      : "text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 border border-zinc-700/50">
                      <TrophyIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-100">Histórico Completo</div>
                      <div className="text-[10px] text-zinc-400">Todas las seasons combinadas</div>
                    </div>
                  </div>
                  {(!activeSeasonId || activeSeasonId === "all") && (
                    <CheckIcon className="w-4 h-4 text-accent-light shrink-0" />
                  )}
                </button>

                {/* Season list */}
                {seasons.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-zinc-800/80 max-h-60 overflow-y-auto space-y-1">
                    {seasons.map((s) => {
                      const isCurrent = activeSeasonId === s.id;
                      const sColor = getSeasonColor(s);
                      const isSeasonOngoing = Boolean(
                        !s.endDate ||
                          !s.endTimestamp ||
                          s.endDate.trim() === "" ||
                          s.endDate.trim().toLowerCase() === "actualidad"
                      );
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setActiveSeasonId(s.id);
                            setDropdownOpen(false);
                          }}
                          style={
                            isCurrent
                              ? {
                                  backgroundColor: hexToRgba(sColor, 0.12),
                                  borderColor: hexToRgba(sColor, 0.35),
                                }
                              : undefined
                          }
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer border ${
                            isCurrent
                              ? "font-medium shadow-xs"
                              : "border-transparent text-zinc-300 hover:bg-zinc-800/50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border relative"
                              style={{
                                backgroundColor: isCurrent ? hexToRgba(sColor, 0.2) : "rgba(39, 39, 42, 0.7)",
                                borderColor: isCurrent ? hexToRgba(sColor, 0.45) : "rgba(63, 63, 70, 0.5)",
                              }}
                            >
                              <CalendarIcon className="w-4 h-4" style={{ color: sColor }} />
                              {isSeasonOngoing && (
                                <span
                                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900 animate-pulse"
                                  style={{ backgroundColor: sColor }}
                                  title="Season en curso (hasta la actualidad)"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div
                                className="font-semibold truncate text-zinc-100"
                                style={isCurrent ? { color: sColor } : undefined}
                              >
                                {s.name}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {s.startDate} → {s.endDate ? s.endDate : "Actualidad"}
                                {typeof s.workoutCount === "number" && (
                                  <span className="text-zinc-500"> · {s.workoutCount} entrenos</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isCurrent && (
                            <CheckIcon className="w-4 h-4 shrink-0" style={{ color: sColor }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Footer link to manage seasons */}
                <div className="mt-1.5 pt-1.5 border-t border-zinc-800/80">
                  <Link
                    href="/ajustes?tab=temporadas"
                    onClick={() => {
                      if (setActiveTab) setActiveTab("settings");
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors text-left cursor-pointer font-medium"
                  >
                    <SettingsIcon className="w-4 h-4 text-zinc-400" />
                    <span>Gestionar Seasons...</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Tabs Navigator */}
          <nav className="h-11 flex items-center bg-zinc-900/90 border border-zinc-800/80 p-1 sm:p-1.5 rounded-full shadow-lg backdrop-blur-md">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = currentTab === t.id;
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  onClick={() => {
                    if (setActiveTab) setActiveTab(t.id);
                  }}
                  title={t.label}
                  className={`h-full flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80 font-bold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-accent-light" : "text-zinc-400"}`} />
                  <span className="whitespace-nowrap">{t.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Stats Overview & Settings Button */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {loadingStats ? (
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs shadow-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              <div className="h-3 w-5 rounded bg-zinc-800" />
              <div className="h-3 w-14 rounded bg-zinc-800/60" />
            </div>
          ) : stats && stats.workoutsCount > 0 ? (
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 shadow-sm animate-in fade-in duration-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium text-zinc-300">{stats.exercisesCount}</span>
              <span>{stats.exercisesCount === 1 ? "ejercicio" : "ejercicios"}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-medium text-zinc-300">{stats.workoutsCount}</span>
              <span>{stats.workoutsCount === 1 ? "sesión" : "sesiones"}</span>
            </div>
          ) : null}

          {/* Global Cloud Sync & Connection Monitor Button */}
          <button
            type="button"
            onClick={triggerGlobalSync}
            disabled={isGlobalSyncing}
            className="w-11 h-11 rounded-full flex items-center justify-center border shadow-md bg-zinc-900/90 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700/80 transition-all duration-200 cursor-pointer active:scale-[0.98] group relative shrink-0"
            title={`Sincronización Cloud Global\n• Hevy: ${
              hevyConnected
                ? `Conectado (@${hevyUsername || "usuario"})`
                : "Desconectado"
            }\n• Xiaomi: ${
              xiaomiConnected
                ? `Conectado (${xiaomiUserId || "báscula"})`
                : "Desconectado"
            }\nHaz clic para sincronizar todos los datos`}
            aria-label="Sincronización Cloud Global"
          >
            <RefreshCwIcon
              className={`w-4.5 h-4.5 shrink-0 transition-transform ${
                isGlobalSyncing
                  ? "animate-spin text-blue-400"
                  : "text-zinc-400 group-hover:text-zinc-200"
              }`}
            />

            {/* Bolita Hevy: Esquina superior izquierda */}
            <span
              className={`absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-zinc-950 z-10 transition-all duration-300 pointer-events-none ${
                hevyConnected
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.95),0_0_12px_rgba(255,255,255,0.4)]"
                  : "bg-rose-500 animate-blink-red"
              }`}
              title={`Hevy: ${hevyConnected ? "Conectado" : "Desconectado"}`}
            />

            {/* Bolita Xiaomi: Esquina superior derecha */}
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-zinc-950 z-10 transition-all duration-300 pointer-events-none ${
                xiaomiConnected
                  ? "bg-[#FF6900] shadow-[0_0_8px_rgba(255,105,0,0.95),0_0_12px_rgba(255,105,0,0.4)]"
                  : "bg-rose-500 animate-blink-red"
              }`}
              title={`Xiaomi: ${xiaomiConnected ? "Conectado" : "Desconectado"}`}
            />
          </button>

          {/* Standalone Settings Button (Rightmost) */}
          <Link
            href="/ajustes"
            onClick={() => {
              if (setActiveTab) setActiveTab("settings");
            }}
            title="Configuración"
            aria-label="Configuración"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border shadow-md ${
              currentTab === "settings"
                ? "bg-zinc-800 text-zinc-100 border-zinc-700/80 shadow-md font-bold"
                : "bg-zinc-900/90 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 hover:border-zinc-700/80"
            }`}
          >
            <SettingsIcon
              className={`w-4.5 h-4.5 transition-colors ${
                currentTab === "settings" ? "text-accent-light" : "text-zinc-400"
              }`}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
