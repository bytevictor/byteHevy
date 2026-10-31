"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Season } from "./actions";

interface SeasonContextType {
  seasons: Season[];
  activeSeasonId: string | null;
  activeSeason: Season | null;
  isLoadingSeasons: boolean;
  setActiveSeasonId: (id: string | null) => void;
  refreshSeasons: () => Promise<void>;
  isHydrated: boolean;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

const STORAGE_KEY = "bytehevy_active_season_id";

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonIdState] = useState<string | null>("all");
  const [isLoadingSeasons, setIsLoadingSeasons] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const refreshSeasons = useCallback(async () => {
    try {
      setIsLoadingSeasons(true);
      const res = await fetch("/api/seasons", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSeasons(json.data);
      }
    } catch (e) {
      console.error("Failed to load seasons:", e);
    } finally {
      setIsLoadingSeasons(false);
    }
  }, []);

  // Hydrate activeSeasonId from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setActiveSeasonIdState(saved === "all" ? "all" : saved);
      }
    } catch (e) {
      // ignore localStorage errors
    }
    setIsHydrated(true);
    refreshSeasons();
  }, [refreshSeasons]);

  const setActiveSeasonId = useCallback((id: string | null) => {
    const val = !id || id === "all" ? "all" : id;
    setActiveSeasonIdState(val);
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch (e) {
      // ignore
    }
  }, []);

  const activeSeason = activeSeasonId && activeSeasonId !== "all"
    ? seasons.find((s) => s.id === activeSeasonId) || null
    : null;

  return (
    <SeasonContext.Provider
      value={{
        seasons,
        activeSeasonId,
        activeSeason,
        isLoadingSeasons,
        setActiveSeasonId,
        refreshSeasons,
        isHydrated,
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error("useSeason must be used within a SeasonProvider");
  }
  return context;
}

