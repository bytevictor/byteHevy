"use client";

import React from "react";

export function JournalSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm p-5 flex flex-col gap-4 animate-pulse"
        >
          {/* Workout Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="h-6 w-28 rounded-lg bg-accent/10 border border-accent/20" />
              <div className="h-5 w-48 rounded bg-zinc-800" />
            </div>
            <div className="h-4 w-20 rounded bg-zinc-850" />
          </div>

          {/* Quote / Description Box */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-1.5">
            <div className="h-3 w-4/5 rounded bg-zinc-800/60" />
            <div className="h-3 w-2/3 rounded bg-zinc-800/40" />
          </div>

          {/* Exercises Summary Chips */}
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-44 rounded-xl bg-zinc-950 border border-zinc-800" />
            <div className="h-8 w-36 rounded-xl bg-zinc-950 border border-zinc-800" />
            <div className="h-8 w-52 rounded-xl bg-zinc-950 border border-zinc-800" />
            <div className="h-8 w-40 rounded-xl bg-zinc-950 border border-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

