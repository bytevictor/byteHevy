"use client";

import React, { useState, useRef, useEffect } from "react";
import { ExerciseMedia, MuscleGroup } from "@/types/exercise-media";
import { MUSCLE_LABELS } from "@/lib/exercise-media";

interface ExerciseAnimationViewProps {
  media: ExerciseMedia;
  compact?: boolean;
  className?: string;
  autoPlayWhenVisible?: boolean;
}

export function ExerciseAnimationView({
  media,
  compact = false,
  className = "",
  autoPlayWhenVisible = true,
}: ExerciseAnimationViewProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(Boolean(media.videoUrl || media.gifUrl));
  const [hasError, setHasError] = useState(false);
  const [showControlsFeedback, setShowControlsFeedback] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: auto-pause when out of viewport, resume when visible
  useEffect(() => {
    if (!autoPlayWhenVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!videoRef.current) return;
          if (entry.isIntersecting) {
            if (isPlaying) {
              videoRef.current.play().catch(() => { });
            }
          } else {
            videoRef.current.pause();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoPlayWhenVisible, isPlaying]);

  // Toggle play / pause on tap
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => { });
      setIsPlaying(true);
    }
    setShowControlsFeedback(true);
    setTimeout(() => setShowControlsFeedback(false), 900);
  };

  const primaryLabel = MUSCLE_LABELS[media.primaryMuscle] || media.primaryMuscle;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between ${compact ? "h-36" : "h-64 sm:h-72"
      } ${ className } `}
    >
      {/* Media Box: Clean white canvas so GymVisual 3D renders blend seamlessly */}
      <div
        onClick={togglePlay}
        className="relative w-full h-full flex items-center justify-center cursor-pointer select-none overflow-hidden bg-white"
      >
        {/* Shimmer / Skeleton Loader */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100 animate-pulse">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-amber-500 animate-spin" />
              <span className="text-[10px] font-mono text-zinc-500 font-medium">Cargando GymVisual 3D...</span>
            </div>
          </div>
        )}

        {/* Video Player (Primary Choice) */}
        {media.videoUrl && !hasError ? (
          <video
            ref={videoRef}
            src={media.videoUrl}
            poster={media.posterUrl}
            loop
            muted
            autoPlay
            playsInline
            preload="metadata"
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
            className="w-full h-full object-contain p-1"
          />
        ) : media.gifUrl && !hasError ? (
          /* GymVisual 3D GIF */
          <img
            src={media.gifUrl}
            alt={media.name}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
            className="w-full h-full object-contain p-1"
          />
        ) : media.posterUrl && !hasError ? (
          /* Static Image Fallback */
          <img
            src={media.posterUrl}
            alt={media.name}
            onLoad={() => setIsLoading(false)}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          /* Stylized Anatomical Graphic Placeholder */
          <div className="flex flex-col items-center justify-center p-4 text-center z-0 bg-zinc-950 w-full h-full">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs font-mono font-semibold text-zinc-300 capitalize">{primaryLabel}</span>
            <span className="text-[10px] font-mono text-zinc-500 mt-0.5">{media.equipment}</span>
          </div>
        )}

        {/* Temporary Play/Pause feedback overlay */}
        {showControlsFeedback && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-black/25 backdrop-blur-[2px] transition-opacity duration-200">
            <div className="px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700 text-xs font-mono text-zinc-200 flex items-center gap-1.5 shadow-lg">
              {isPlaying ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  <span>Reanudado</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Pausado</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loop / Active indicator badge */}
        {(media.videoUrl || media.gifUrl) && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/85 border border-zinc-700/80 backdrop-blur-sm text-[9px] font-mono text-zinc-300 shadow-sm">
            <span className={`w - 1.5 h - 1.5 rounded - full ${ isPlaying ? "bg-emerald-400 animate-pulse" : "bg-zinc-500" } `} />
            <span>GYMVISUAL 3D</span>
          </div>
        )}
      </div>

      {/* Bottom Muscle Metadata Badges */}
      <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-1.5 z-10 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Primary Muscle badge */}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {primaryLabel}
          </span>

          {/* Secondary Muscles */}
          {media.secondaryMuscles.slice(0, 2).map((sec, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400"
            >
              {MUSCLE_LABELS[sec] || sec}
            </span>
          ))}
        </div>

        <span className="text-zinc-500 truncate max-w-[120px]">{media.equipment}</span>
      </div>
    </div>
  );
}

