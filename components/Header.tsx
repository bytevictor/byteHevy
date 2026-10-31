"use client";

import React from "react";
import { DumbbellIcon, TargetIcon, BookOpenIcon, RefreshCwIcon } from "./Icons";

export type TabId = "explorer" | "goals" | "journal" | "sync";

interface HeaderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  stats?: {
    workoutsCount: number;
    exercisesCount: number;
  };
}

export function Header({ activeTab, setActiveTab, stats }: HeaderProps) {
  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "explorer", label: "Explorador", icon: DumbbellIcon },
    { id: "goals", label: "Objetivos", icon: TargetIcon },
    { id: "journal", label: "Diario", icon: BookOpenIcon },
    { id: "sync", label: "Actualizar", icon: RefreshCwIcon },
  ];

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 font-mono font-bold text-sm shadow-inner">
            ⚡
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-tight text-zinc-100 text-base">BYTEHEVY</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                LXC / SQLite
              </span>
            </div>
            {stats && (
              <span className="text-[10px] font-mono text-zinc-500">
                {stats.workoutsCount} entrenos · {stats.exercisesCount} ejercicios
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-zinc-900/70 p-1 rounded-lg border border-zinc-800/80">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-400" : "text-zinc-400"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

