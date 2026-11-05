"use client";

import React, { useState, useEffect } from "react";
import {
  UserIcon,
  CheckIcon,
  SparklesIcon,
  RefreshCwIcon,
  ScaleIcon,
  ActivityIcon,
  InfoIcon,
} from "./Icons";
import {
  useUserProfile,
  calculateBmi,
  getBmiCategory,
  getIdealWeightRange,
} from "@/lib/user-profile-context";

export function BiometricProfileSettings() {
  const { profile, updateProfile, resetProfile, calculateAge } = useUserProfile();

  const [altura, setAltura] = useState(String(profile.alturaCm));
  const [fechaNacimiento, setFechaNacimiento] = useState(profile.fechaNacimiento || "1999-01-20");
  const [sexo, setSexo] = useState<"male" | "female">(profile.sexo);
  const [sampleWeight, setSampleWeight] = useState("77.4");
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sync state with profile when it loads from storage
  useEffect(() => {
    setAltura(String(profile.alturaCm));
    setFechaNacimiento(profile.fechaNacimiento || "1999-01-20");
    setSexo(profile.sexo);
  }, [profile]);

  const parsedAltura = parseFloat(altura) || 0;
  const computedAge = calculateAge(fechaNacimiento);
  const parsedWeight = parseFloat(sampleWeight) || 0;

  const currentBmi = calculateBmi(parsedWeight, parsedAltura);
  const bmiCategory = getBmiCategory(currentBmi);
  const idealRange = getIdealWeightRange(parsedAltura);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAltura < 100 || parsedAltura > 250) {
      alert("Por favor introduce una altura válida (entre 100 y 250 cm).");
      return;
    }
    if (!fechaNacimiento) {
      alert("Por favor introduce una fecha de nacimiento válida.");
      return;
    }

    updateProfile({
      alturaCm: parsedAltura,
      fechaNacimiento,
      edad: computedAge,
      sexo,
    });

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleReset = () => {
    if (confirm("¿Restaurar valores biométricos por defecto (180 cm, 20/01/1999)?")) {
      resetProfile();
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    }
  };

  return (
    <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col gap-6 shadow-xl animate-fade-in">
      {/* Header and Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent-light">
              <UserIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-zinc-100 tracking-tight">
              Perfil Biométrico & Métricas Corporales
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Define tu altura y edad para el cálculo del Índice de Masa Corporal (BMI / IMC),
            bioimpedancia multifrecuencia (BIA) y rangos saludables.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer self-start sm:self-center border border-transparent hover:border-zinc-700/60"
          title="Restaurar a valores estándar"
        >
          <RefreshCwIcon className="w-3.5 h-3.5" />
          <span>Restaurar por defecto</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Altura */}
          <div className="space-y-1.5 min-w-0">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Altura</span>
              {parsedAltura > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  {(parsedAltura / 100).toFixed(2)} m
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="100"
                max="250"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm font-mono font-bold focus:outline-none focus:border-accent-light transition-colors"
                placeholder="180"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                cm
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Base cuadrática en la fórmula de BMI (h²) y en el índice BIA.
            </p>
          </div>

          {/* Fecha de Nacimiento / Edad */}
          <div className="space-y-1.5 min-w-0">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Nacimiento</span>
              <span className="text-xs font-mono text-accent-light font-bold">
                {computedAge} años
              </span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                required
                className="w-full min-w-0 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-accent-light transition-colors [color-scheme:dark]"
              />
            </div>
            <p className="text-[11px] text-zinc-500 truncate">
              Calcula tu edad automáticamente al vuelo.
            </p>
          </div>

          {/* Sexo Biológico */}
          <div className="space-y-1.5 min-w-0">
            <label className="text-xs font-semibold text-zinc-300">Sexo Biológico (BIA)</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSexo("male")}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sexo === "male"
                    ? "bg-accent/15 border-accent text-accent-light shadow-sm"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>Hombre</span>
                {sexo === "male" && <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />}
              </button>
              <button
                type="button"
                onClick={() => setSexo("female")}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sexo === "female"
                    ? "bg-accent/15 border-accent text-accent-light shadow-sm"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>Mujer</span>
                {sexo === "female" && <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Ajusta las constantes de conductividad bioeléctrica.
            </p>
          </div>
        </div>

        {/* Live Calculation Preview Card */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <ScaleIcon className="w-4 h-4 text-accent-light" />
                Métricas Calculadas para tu Perfil
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${bmiCategory.bgColor} ${bmiCategory.color} ${bmiCategory.borderColor}`}
              >
                {bmiCategory.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
              <div>
                Rango saludable (18.5 - 24.9):{" "}
                <span className="font-mono font-bold text-zinc-200">
                  {idealRange.min} kg - {idealRange.max} kg
                </span>
              </div>
              <span className="text-zinc-600">·</span>
              <div>
                Fórmula IMC:{" "}
                <span className="font-mono text-zinc-300">
                  Peso / ({(parsedAltura / 100 || 1).toFixed(2)})²
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Weight Simulator */}
          <div className="flex items-center gap-3 shrink-0 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
            <div className="text-left">
              <span className="text-[10px] text-zinc-400 block">Ejemplo Peso</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  value={sampleWeight}
                  onChange={(e) => setSampleWeight(e.target.value)}
                  className="w-16 bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-zinc-100 text-center focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 font-mono">kg</span>
              </div>
            </div>

            <div className="w-px h-8 bg-zinc-800" />

            <div className="text-left">
              <span className="text-[10px] text-zinc-400 block">BMI Resultante</span>
              <span className="text-sm font-extrabold font-mono text-zinc-100">
                {currentBmi.toFixed(1)}{" "}
                <span className="text-[10px] font-normal text-zinc-500">kg/m²</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Button & Confirmation */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <InfoIcon className="w-4 h-4 text-zinc-500" />
            <span>
              Los cambios se aplican automáticamente a la pestaña <strong>Peso</strong> y al cálculo
              de composición corporal.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedFeedback && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <CheckIcon className="w-4 h-4" />
                ¡Perfil guardado correctamente!
              </span>
            )}

            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent-light text-zinc-950 hover:bg-accent transition-all cursor-pointer shadow-md hover:brightness-105"
            >
              <CheckIcon className="w-4 h-4 stroke-[2.5]" />
              <span>Guardar Perfil Biométrico</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

