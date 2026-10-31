"use client";

import React from "react";
import { DumbbellIcon, TargetIcon, BookOpenIcon, RefreshCwIcon, ByteHevyLogo } from "./Icons";

export type TabId = "explorer" | "goals" | "journal" | "sync";

interface HeaderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  stats?: {
    workoutsCount: number;
    exercisesCount: number;
  };
  loadingStats?: boolean;
}

export function Header({ activeTab, setActiveTab, stats, loadingStats = false }: HeaderProps) {
  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "explorer", label: "Explorador", icon: DumbbellIcon },
    { id: "goals", label: "Objetivos", icon: TargetIcon },
    { id: "journal", label: "Diario", icon: BookOpenIcon },
    { id: "sync", label: "Actualizar", icon: RefreshCwIcon },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-[var(--header-bg)] backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center shadow-md">
            <ByteHevyLogo className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight leading-none">
              <span className="text-zinc-100">byte</span>
              <span className="text-accent-light">Hevy</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-normal mt-0.5 tracking-normal">
              Visualizador de Entrenamientos
            </span>
          </div>
        </div>

        {/* Center: Tabs Centered */}
        <nav className="flex items-center bg-zinc-900/90 border border-zinc-800/80 p-1.5 rounded-full shadow-lg backdrop-blur-md">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-accent-light" : "text-zinc-400"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Overview / Stats */}
        <div className="flex items-center gap-2 shrink-0">
          {loadingStats ? (
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs shadow-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              <div className="h-3 w-5 rounded bg-zinc-800" />
              <div className="h-3 w-14 rounded bg-zinc-800/60" />
              <span className="text-zinc-700">•</span>
              <div className="h-3 w-5 rounded bg-zinc-800" />
              <div className="h-3 w-14 rounded bg-zinc-800/60" />
            </div>
          ) : stats && stats.workoutsCount > 0 ? (
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 shadow-sm animate-in fade-in duration-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium text-zinc-300">{stats.exercisesCount}</span>
              <span>ejercicios</span>
              <span className="text-zinc-600">•</span>
              <span className="font-medium text-zinc-300">{stats.workoutsCount}</span>
              <span>sesiones</span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
