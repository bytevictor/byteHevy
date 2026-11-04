"use client";

import React, { useState, useEffect } from "react";
import { Header, TabId } from "@/components/Header";
import { ExplorerTab } from "@/components/ExplorerTab";
import { WeightTab } from "@/components/WeightTab";
import { GoalsTab } from "@/components/GoalsTab";
import { JournalTab } from "@/components/JournalTab";
import { SettingsTab } from "@/components/SettingsTab";
import { HevySyncModal } from "@/components/HevySyncModal";
import { ExerciseSummary } from "@/lib/actions";
import { SeasonProvider, useSeason } from "@/lib/season-context";
import { UserProfileProvider } from "@/lib/user-profile-context";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("explorer");
  const [stats, setStats] = useState<{ workoutsCount: number; exercisesCount: number }>({
    workoutsCount: 0,
    exercisesCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const { activeSeasonId } = useSeason();

  const loadStats = async () => {
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
        setExercises(exJson.data);

        // Contar el número de ejercicios distintos realizados en las sesiones seleccionadas (temporada o histórico)
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
  };

  useEffect(() => {
    loadStats();
  }, [activeSeasonId]);

  const [hevyModalOpen, setHevyModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)] text-zinc-100 flex flex-col font-sans transition-colors duration-300 selection:bg-zinc-800 selection:text-accent-light">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats.workoutsCount > 0 ? stats : undefined}
        loadingStats={loadingStats}
        onOpenHevySync={() => setHevyModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6">
        {activeTab === "explorer" && (
          <ExplorerTab
            initialExercises={exercises}
            onGoToSync={() => setActiveTab("settings")}
          />
        )}

        {activeTab === "weight" && <WeightTab />}

        {activeTab === "goals" && <GoalsTab />}

        {activeTab === "journal" && <JournalTab />}

        {(activeTab === "settings" || activeTab === "sync") && (
          <SettingsTab
            onSyncComplete={() => {
              loadStats();
            }}
          />
        )}
      </main>

      {/* Hevy Cloud Sync Modal accesible desde el Header en cualquier pestaña */}
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

export default function Home() {
  return (
    <UserProfileProvider>
      <SeasonProvider>
        <AppContent />
      </SeasonProvider>
    </UserProfileProvider>
  );
}
