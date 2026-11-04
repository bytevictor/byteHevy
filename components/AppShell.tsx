"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { HevySyncModal } from "@/components/HevySyncModal";
import { XiaomiSyncModal } from "@/components/XiaomiSyncModal";
import { SeasonProvider, useSeason } from "@/lib/season-context";
import { UserProfileProvider } from "@/lib/user-profile-context";
import { SyncProvider, useSync } from "@/lib/sync-context";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  XIcon,
} from "@/components/Icons";

function AppShellContent({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<{
    workoutsCount: number;
    exercisesCount: number;
  }>({
    workoutsCount: 0,
    exercisesCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const { activeSeasonId } = useSeason();

  const {
    hevyModalOpen,
    setHevyModalOpen,
    xiaomiModalOpen,
    setXiaomiModalOpen,
    syncToast,
    clearToast,
  } = useSync();

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const query =
        activeSeasonId && activeSeasonId !== "all"
          ? `?seasonId=${encodeURIComponent(activeSeasonId)}`
          : "";
      const [exRes, journalRes] = await Promise.all([
        fetch(`/api/exercises${query}`, { cache: "no-store" }),
        fetch(`/api/journal${query}`, { cache: "no-store" }),
      ]);
      const exJson = await exRes.json();
      const journalJson = await journalRes.json();
      if (exJson.success && journalJson.success) {
        const uniqueExerciseIds = new Set<string>();
        if (Array.isArray(journalJson.data)) {
          for (const w of journalJson.data) {
            if (Array.isArray(w.exercises)) {
              for (const ex of w.exercises) {
                if (ex.id) uniqueExerciseIds.add(String(ex.id));
              }
            }
          }
        }

        setStats({
          exercisesCount: uniqueExerciseIds.size,
          workoutsCount: journalJson.data.length,
        });
      }
    } catch (e) {
      console.error("Error loading app stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }, [activeSeasonId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Escuchar eventos de sincronización completada para actualizar estadísticas en vivo
  useEffect(() => {
    const handleSyncDone = () => {
      loadStats();
    };
    window.addEventListener("bytehevy-sync-complete", handleSyncDone);
    return () => {
      window.removeEventListener("bytehevy-sync-complete", handleSyncDone);
    };
  }, [loadStats]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-zinc-100 flex flex-col font-sans transition-colors duration-300 selection:bg-zinc-800 selection:text-accent-light">
      <Header
        stats={stats.workoutsCount > 0 ? stats : undefined}
        loadingStats={loadingStats}
      />

      <main className="flex-1 max-w-[1330px] w-full mx-auto px-4 sm:px-6">
        {children}
      </main>

      <HevySyncModal
        isOpen={hevyModalOpen}
        onClose={() => setHevyModalOpen(false)}
        onSyncSuccess={loadStats}
      />

      <XiaomiSyncModal
        isOpen={xiaomiModalOpen}
        onClose={() => setXiaomiModalOpen(false)}
        onSyncSuccess={loadStats}
      />

      {/* Floating Global Sync Toast */}
      {syncToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md text-xs font-medium ${
              syncToast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50"
                : syncToast.type === "error"
                ? "bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50"
                : "bg-blue-950/90 border-blue-500/40 text-blue-200 shadow-blue-950/50"
            }`}
          >
            {syncToast.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : syncToast.type === "error" ? (
              <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <InfoIcon className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{syncToast.text}</span>
            <button
              onClick={clearToast}
              className="text-zinc-400 hover:text-white cursor-pointer ml-1"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-900/80 py-8 text-center text-xs text-zinc-500 font-normal">
        <span className="font-semibold text-zinc-400">byteHevy</span> ·
        Visualizador de entrenamientos y progresión
      </footer>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <SeasonProvider>
        <SyncProvider>
          <AppShellContent>{children}</AppShellContent>
        </SyncProvider>
      </SeasonProvider>
    </UserProfileProvider>
  );
}
