"use client";

import React from "react";

export function ExplorerSidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-[84px] lg:h-[calc(100vh-6rem)] min-h-0">
      {/* Top Controls Skeleton */}
      <div className="shrink-0 flex flex-col gap-2.5">
        {/* Search Input Skeleton */}
        <div className="h-10 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center px-3.5 gap-2.5 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-zinc-800 shrink-0" />
          <div className="h-3 w-28 rounded bg-zinc-800/70" />
        </div>

        {/* Category Pills Skeleton */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <div className="h-7 w-14 rounded-lg bg-accent/15 border border-accent/30 shrink-0 animate-pulse" />
          <div className="h-7 w-20 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 animate-pulse" />
          <div className="h-7 w-16 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 animate-pulse" />
          <div className="h-7 w-16 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 animate-pulse" />
          <div className="h-7 w-20 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 animate-pulse" />
        </div>
      </div>

      {/* Exercises List Cards Skeleton: dynamic flex fill */}
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden pb-4">
        {[
          { rank: "#1", width: "w-36", sub: "w-20", pr: "w-16" },
          { rank: "#2", width: "w-44", sub: "w-24", pr: "w-20" },
          { rank: "#3", width: "w-32", sub: "w-16", pr: "w-14" },
          { rank: "#4", width: "w-40", sub: "w-28", pr: "w-18" },
          { rank: "#5", width: "w-36", sub: "w-20", pr: "w-16" },
          { rank: "#6", width: "w-48", sub: "w-24", pr: "w-20" },
          { rank: "#7", width: "w-28", sub: "w-18", pr: "w-14" },
          { rank: "#8", width: "w-36", sub: "w-22", pr: "w-16" },
        ].map((item, i) => (
          <div
            key={i}
            className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2 ${
              i === 0
                ? "border-accent/40 bg-zinc-900/80 shadow-md"
                : "border-zinc-800/80 bg-zinc-900/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500 border border-zinc-700/60 shrink-0">
                  {item.rank}
                </span>
                <div className={`h-4 ${item.width} rounded bg-zinc-800 animate-pulse`} />
              </div>
              <div className="h-5 w-14 rounded-md bg-zinc-800/80 border border-zinc-700/50 shrink-0 animate-pulse" />
            </div>

            <div className="flex items-center justify-between text-xs gap-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                <div className={`h-3 ${item.sub} rounded bg-zinc-800/60 animate-pulse`} />
              </div>
              <div className={`h-3.5 ${item.pr} rounded-md bg-zinc-800/80 animate-pulse`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExplorerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 lg:gap-4 lg:min-h-[calc(100vh-6rem)] animate-in fade-in duration-150">
      {/* HERO STAGE: 3D Visualizer & Profile Card Skeleton */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row items-stretch gap-4 sm:gap-5 backdrop-blur-md">
        {/* Left: 3D Visualizer Canvas Skeleton */}
        <div className="w-full lg:w-[350px] xl:w-[390px] shrink-0">
          <div className="w-full h-[270px] sm:h-[285px] lg:h-[295px] rounded-xl border border-zinc-800/90 bg-zinc-950 shadow-lg flex flex-col justify-between p-4 relative overflow-hidden">
            {/* Top Bar Badges */}
            <div className="flex items-center justify-between z-10">
              <div className="h-5 w-20 rounded-md bg-zinc-900/90 border border-zinc-800 animate-pulse" />
              <div className="h-5 w-12 rounded-md bg-zinc-900/90 border border-zinc-800 animate-pulse" />
            </div>

            {/* Central Canvas Wireframe & Shimmer */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
              <div className="relative w-36 h-36 rounded-full bg-accent/5 border border-accent/15 flex items-center justify-center animate-pulse">
                <div className="w-24 h-24 rounded-full border border-zinc-800/80 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-md bg-accent/20" />
                  </div>
                </div>
              </div>
              <div className="h-2.5 w-32 rounded bg-zinc-900/80 border border-zinc-850 mt-3 animate-pulse" />
            </div>

            {/* Bottom Controls Pill */}
            <div className="flex items-center justify-center z-10">
              <div className="h-6 w-28 rounded-full bg-zinc-900/90 border border-zinc-800/80 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right: Exercise Profile & Records Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-24 rounded-md bg-accent/10 border border-accent/20 animate-pulse" />
              <div className="h-5 w-16 rounded bg-zinc-800/80 border border-zinc-700/60 animate-pulse" />
            </div>

            <div className="h-7 w-3/4 rounded-lg bg-zinc-800 mt-1 mb-1.5 animate-pulse" />
            <div className="h-3 w-40 rounded bg-zinc-800/60 flex items-center gap-1.5 animate-pulse" />
          </div>

          {/* PR & 1RM Hero Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PR Card */}
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/25 flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 rounded bg-accent/20 animate-pulse" />
                <div className="w-3.5 h-3.5 rounded bg-accent/30" />
              </div>
              <div className="h-6 w-24 rounded bg-accent/30 animate-pulse my-0.5" />
              <div className="h-2.5 w-16 rounded bg-accent/20 animate-pulse" />
            </div>

            {/* 1RM Estimado Card */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 rounded bg-zinc-800 animate-pulse" />
                <div className="w-3.5 h-3.5 rounded bg-zinc-800" />
              </div>
              <div className="h-6 w-20 rounded bg-zinc-800 animate-pulse my-0.5" />
              <div className="h-2.5 w-20 rounded bg-zinc-850 animate-pulse" />
            </div>
          </div>

          {/* Muscle Activation Guide */}
          <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-1.5">
            <div className="h-2.5 w-24 rounded bg-zinc-800/80 animate-pulse" />
            <div className="flex flex-wrap gap-1.5">
              <div className="h-5 w-28 rounded-md bg-red-500/10 border border-red-500/20 animate-pulse" />
              <div className="h-5 w-16 rounded-md bg-zinc-900 border border-zinc-800 animate-pulse" />
              <div className="h-5 w-20 rounded-md bg-zinc-900 border border-zinc-800 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Progression Chart Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="h-4 w-36 rounded bg-zinc-800 animate-pulse" />
            <div className="h-3 w-56 rounded bg-zinc-800/60 mt-1 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-16 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
            <div className="h-6 w-20 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
          </div>
        </div>

        {/* Chart Canvas Simulating Progression Graph */}
        <div className="h-[240px] w-full rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-3.5 flex items-end justify-between gap-2.5 relative overflow-hidden">
          {/* Subtle grid lines background */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
            <div className="border-b border-dashed border-zinc-700 w-full" />
            <div className="border-b border-dashed border-zinc-700 w-full" />
            <div className="border-b border-dashed border-zinc-700 w-full" />
            <div className="border-b border-dashed border-zinc-700 w-full" />
          </div>

          {/* Simulated Progression Data Bars */}
          {[25, 38, 32, 50, 45, 62, 58, 75, 70, 88, 82, 95].map((height, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end z-10">
              <div
                style={{ height: `${height}%` }}
                className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-accent/15 via-accent/30 to-accent-light/50 border-t border-accent/60 animate-pulse"
              />
              <div className="h-2 w-6 rounded bg-zinc-850 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Historical Sessions List Skeleton */}
      <div className="flex flex-col gap-3 pt-6 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-zinc-800 animate-pulse" />
          <div className="h-3 w-56 rounded bg-zinc-850 hidden sm:block animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800/70 bg-zinc-900/30 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-zinc-700" />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-24 rounded bg-zinc-800" />
                    <div className="h-4 w-32 rounded-md bg-zinc-850 border border-zinc-800/60" />
                  </div>
                  <div className="h-3 w-40 rounded bg-zinc-850/80" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-7 w-20 rounded-lg bg-zinc-900 border border-zinc-800/80" />
                <div className="h-7 w-20 rounded-lg bg-zinc-900 border border-zinc-800/80" />
                <div className="h-7 w-20 rounded-lg bg-zinc-900 border border-zinc-800/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExplorerSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-3 lg:py-4">
      {/* Left Sidebar Skeleton */}
      <div className="lg:col-span-4 xl:col-span-4">
        <ExplorerSidebarSkeleton />
      </div>

      {/* Main Right Pane Skeleton */}
      <div className="lg:col-span-8 xl:col-span-8">
        <ExplorerDetailSkeleton />
      </div>
    </div>
  );
}

