"use client";

import React, { useState, useRef, useEffect } from "react";
import { ExerciseMedia } from "@/types/exercise-media";
import { MUSCLE_LABELS } from "@/lib/exercise-media";
import { FilmIcon } from "./Icons";

interface ExerciseAnimationViewProps {
  media: ExerciseMedia;
  compact?: boolean;
  className?: string;
  autoPlayWhenVisible?: boolean;
  onReassignMedia?: () => void;
}

export function ExerciseAnimationView({
  media,
  compact = false,
  className = "",
  autoPlayWhenVisible = true,
  onReassignMedia,
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
              videoRef.current.play().catch(() => {});
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
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    setShowControlsFeedback(true);
    setTimeout(() => setShowControlsFeedback(false), 900);
  };

  const primaryLabel = MUSCLE_LABELS[media.primaryMuscle] || media.primaryMuscle;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 flex flex-col justify-between shadow-xl transition-all ${
        className && className.includes("h-")
          ? ""
          : compact
          ? "h-40"
          : "h-[360px] sm:h-[420px]"
      } ${className}`}
    >
      {/* Media Box: Clean white canvas so GymVisual 3D renders blend seamlessly */}
      <div
        onClick={togglePlay}
        className="relative w-full flex-1 flex items-center justify-center cursor-pointer select-none overflow-hidden bg-white group/canvas"
      >
        {/* Shimmer / Skeleton Loader */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-50 animate-pulse">
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full border-2 border-zinc-300 border-t-accent animate-spin" />
              <span className="text-[11px] font-mono text-zinc-500 font-medium">Cargando animación...</span>
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
            className="w-full h-full object-contain p-2 group-hover/canvas:scale-[1.02] transition-transform duration-300"
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
            className="w-full h-full object-contain p-2 group-hover/canvas:scale-[1.02] transition-transform duration-300"
          />
        ) : media.posterUrl && !hasError ? (
          /* Static Image Fallback */
          <img
            src={media.posterUrl}
            alt={media.name}
            onLoad={() => setIsLoading(false)}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          /* Stylized Anatomical Graphic Placeholder */
          <div className="flex flex-col items-center justify-center p-6 text-center z-0 bg-zinc-950 w-full h-full">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-accent-light mb-2 shadow-inner">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs font-mono font-semibold text-zinc-200 capitalize">{primaryLabel}</span>
            <span className="text-[10px] font-mono text-zinc-500 mt-1">{media.equipment}</span>
          </div>
        )}

        {/* Temporary Play/Pause feedback overlay */}
        {showControlsFeedback && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-black/25 backdrop-blur-[2px] transition-opacity duration-200">
            <div className="px-3.5 py-2 rounded-full bg-zinc-900/95 border border-zinc-700 text-xs font-mono text-zinc-100 flex items-center gap-2 shadow-2xl">
              {isPlaying ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  <span>Bucle Reanudado</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-accent-light" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Pausado</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top Badges Overlay (only in full mode) */}
        {!compact && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            {/* Target muscle chip with active red dot */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/80 border border-zinc-700/80 backdrop-blur-md text-[10px] font-mono text-zinc-200 shadow-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-semibold uppercase tracking-wider">{primaryLabel}</span>
            </span>
          </div>
        )}

        {/* Botón interactivo para Reasignar Imagen / Multimedia */}
        {onReassignMedia && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReassignMedia();
            }}
            className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950/85 hover:bg-zinc-900 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-accent/60 backdrop-blur-md shadow-lg text-[11px] font-semibold transition-all cursor-pointer group/btn active:scale-95"
            title="Reasignar o cambiar la imagen de este ejercicio en el buscador de multimedia"
          >
            <FilmIcon className="w-3.5 h-3.5 text-accent-light group-hover/btn:scale-110 transition-transform" />
            <span>Reasignar imagen</span>
          </button>
        )}
      </div>

      {/* Bottom Muscle & Equipment Bar (only in full mode) */}
      {!compact && (
        <div className="px-3.5 py-2.5 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 z-10 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Active target muscle */}
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-accent/10 border border-accent/30 text-accent-lighter font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {primaryLabel}
            </span>

            {/* Secondary Muscles */}
            {media.secondaryMuscles.map((sec, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400"
              >
                {MUSCLE_LABELS[sec] || sec}
              </span>
            ))}
          </div>

          <span className="text-zinc-400 text-[10px] flex items-center gap-1">
            <span className="text-zinc-600">Equipo:</span>
            <span className="text-zinc-300 font-medium">{media.equipment}</span>
          </span>
        </div>
      )}
    </div>
  );
}
