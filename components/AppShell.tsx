"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { HevySyncModal } from "@/components/HevySyncModal";
import { SeasonProvider, useSeason } from "@/lib/season-context";
import { UserProfileProvider } from "@/lib/user-profile-context";

function AppShellContent({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<{ workoutsCount: number; exercisesCount: number }>({
    workoutsCount: 0,
    exercisesCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [hevyModalOpen, setHevyModalOpen] = useState(false);
  const { activeSeasonId } = useSeason();

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

  return (
    <div className="min-h-screen bg-[var(--background)] text-zinc-100 flex flex-col font-sans transition-colors duration-300 selection:bg-zinc-800 selection:text-accent-light">
      <Header
        stats={stats.workoutsCount > 0 ? stats : undefined}
        loadingStats={loadingStats}
        onOpenHevySync={() => setHevyModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6">
        {children}
      </main>

      <HevySyncModal
        isOpen={hevyModalOpen}
        onClose={() => setHevyModalOpen(false)}
        onSyncSuccess={loadStats}
      />

      <footer className="border-t border-zinc-900/80 py-8 text-center text-xs text-zinc-500 font-normal">
        <span className="font-semibold text-zinc-400">byteHevy</span> · Visualizador de entrenamientos y progresión
      </footer>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <SeasonProvider>
        <AppShellContent>{children}</AppShellContent>
      </SeasonProvider>
    </UserProfileProvider>
  );
}

