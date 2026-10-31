"use client";

import React from "react";

export function GoalsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-150">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm flex flex-col justify-between gap-5 animate-pulse"
        >
          {/* Top: 3D Thumbnail + Exercise Title & Metric */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex-shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-2.5 w-16 rounded bg-accent/20" />
                <div className="h-4 w-40 rounded bg-zinc-800" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-850" />
              <div className="w-7 h-7 rounded-lg bg-zinc-850" />
            </div>
          </div>

          {/* Comparative Stats (Actual vs Ideal) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-1.5">
              <div className="h-2.5 w-16 rounded bg-zinc-800" />
              <div className="h-5 w-24 rounded bg-zinc-700/80 mt-0.5" />
              <div className="h-2 w-14 rounded bg-zinc-800" />
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-1.5">
              <div className="h-2.5 w-16 rounded bg-accent/30" />
              <div className="h-5 w-24 rounded bg-accent/40 mt-0.5" />
              <div className="h-2 w-14 rounded bg-zinc-800" />
            </div>
          </div>

          {/* Progress Bar Skeleton */}
          <div className="flex flex-col gap-2">
            <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full w-2/5 rounded-full bg-accent/30" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="h-3 w-28 rounded bg-zinc-800/80" />
              <div className="h-3 w-10 rounded bg-accent/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
