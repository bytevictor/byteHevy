"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  XIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  TrashIcon,
  InfoIcon,
  ByteHevyLogo,
} from "./Icons";

export interface HevySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess?: () => void;
}

interface HevyStatus {
  is_connected: boolean;
  last_sync: string | null;
  last_sync_timestamp: number;
  last_sync_workouts_count: number;
  user_id: string | null;
  username: string | null;
  email: string | null;
}

export function HevySyncModal({
  isOpen,
  onClose,
  onSyncSuccess,
}: HevySyncModalProps) {
  const [status, setStatus] = useState<HevyStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Consultar estado de sesión
  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/hevy/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("Error al obtener estado de Hevy:", e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setFeedback(null);
      setTokenInput("");
    }
  }, [isOpen, fetchStatus]);

  // Vincular cuenta mediante API Key o Token directamente (recomendado para producción / servidor LXC)
  const handleConnectWithToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean) {
      setFeedback({
        type: "error",
        text: "Por favor, introduce tu API Key o Token de Hevy.",
      });
      return;
    }

    setIsConnecting(true);
    setFeedback({
      type: "info",
      text: "Comprobando credenciales con los servidores de Hevy...",
    });

    try {
      const res = await fetch("/api/hevy/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: clean }),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: "success",
          text: `¡Cuenta vinculada correctamente${data.username ? ` (${data.username})` : ""}! Ya puedes sincronizar tus entrenamientos.`,
        });
        setTokenInput("");
        await fetchStatus();
        if (onSyncSuccess) onSyncSuccess();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo vincular la cuenta. Verifica que la clave sea correcta.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Error de conexión: ${err.message || err}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Iniciar flujo interactivo por navegador Playwright (solo funciona en entorno local de escritorio)
  const handleConnectBrowser = async () => {
    setIsConnecting(true);
    setFeedback({
      type: "info",
      text: "Abriendo navegador para iniciar sesión en Hevy...",
    });

    try {
      const res = await fetch("/api/hevy/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: "success",
          text: `¡Cuenta vinculada correctamente${data.username ? ` (@${data.username})` : ""}! Ya puedes sincronizar tus entrenamientos.`,
        });
        await fetchStatus();
        if (onSyncSuccess) onSyncSuccess();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo completar la vinculación con Hevy.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Error de conexión: ${err.message || err}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Sincronizar entrenamientos
  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/hevy/sync", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        const newCount = data.result?.newWorkouts || 0;
        setFeedback({
          type: "success",
          text: `¡Sincronización completada! ${newCount > 0 ? `Se han importado ${newCount} nuevos entrenamientos.` : "Tu base de datos ya está al día con Hevy."}`,
        });
        await fetchStatus();
        if (onSyncSuccess) onSyncSuccess();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Error al sincronizar con Hevy.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Error de red durante la sincronización: ${err.message || err}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Desconectar cuenta
  const handleDisconnect = async () => {
    if (!confirm("¿Deseas desvincular tu cuenta de Hevy? El token de sesión será eliminado de la base de datos local.")) {
      return;
    }

    try {
      const res = await fetch("/api/hevy/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });

      if (res.ok) {
        setFeedback({
          type: "info",
          text: "Cuenta de Hevy desvinculada.",
        });
        await fetchStatus();
      }
    } catch (e) {
      console.error("Error al desconectar Hevy:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
              <ByteHevyLogo className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Sincronización con Hevy</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Cloud Sync
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Descarga tus entrenamientos directamente a tu SQLite local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Status Card */}
        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Estado de la Conexión
            </span>
            {loadingStatus ? (
              <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                Comprobando...
              </span>
            ) : status?.is_connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-400" />
                Desconectado
              </span>
            )}
          </div>

          {status?.is_connected ? (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-zinc-850 text-xs text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Usuario de Hevy:</span>
                <span className="font-semibold text-zinc-200 font-mono">
                  {status.username ? `@${status.username}` : status.user_id?.substring(0, 8) + "..."}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Última sincronización:</span>
                <span className="text-zinc-300">
                  {status.last_sync || "Sin sincronizaciones previas"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 leading-relaxed">
              Introduce tu <strong>API Key oficial de Hevy</strong> (disponible gratis en la app de Hevy &gt; Ajustes &gt; Developer API) o tu token de sesión web para sincronizar tus entrenamientos en 1 clic.
            </p>
          )}
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : feedback.type === "error" ? (
              <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            ) : (
              <InfoIcon className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            )}
            <span className="leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {status?.is_connected ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCwIcon className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Sincronizando entrenamientos..." : "Sincronizar Ahora"}</span>
              </button>

              <button
                onClick={handleDisconnect}
                disabled={isSyncing}
                title="Desconectar cuenta de Hevy"
                className="py-3 px-3.5 rounded-xl border border-zinc-800 hover:border-rose-500/40 bg-zinc-950/80 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              <form onSubmit={handleConnectWithToken} className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                  <span>API Key Oficial o Token de Hevy:</span>
                  <span className="text-[10px] text-blue-400 font-mono">Recomendado</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="Pega aquí tu API Key de Hevy..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={isConnecting}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isConnecting || !tokenInput.trim()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 shrink-0"
                  >
                    {isConnecting ? (
                      <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Vincular</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Instructions Box */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex flex-col gap-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-blue-300">
                  <InfoIcon className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>¿Cómo obtener tu clave en 3 pasos?</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-300 pl-0.5 text-[11px] leading-relaxed">
                  <li>Abre la app de <strong>Hevy</strong> en tu teléfono.</li>
                  <li>Ve a tu perfil ➔ <strong>Ajustes</strong> (engranaje ⚙️) ➔ <strong>Developer API</strong>.</li>
                  <li>Toca en <strong>Generar API Key</strong> (o cópiala) y pégala arriba.</li>
                </ol>
                <span className="text-[10px] text-zinc-400 italic pt-1 border-t border-blue-500/20">
                  💡 También puedes pegar tu token de sesión web de hevy.com si prefieres.
                </span>
              </div>

              {/* Secondary Option: Local Browser Playwright */}
              <div className="pt-1 border-t border-zinc-800/80 flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleConnectBrowser}
                  disabled={isConnecting}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                  <span>O iniciar sesión abriendo ventana de navegador (solo modo local)</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
            <span>Solo se almacena el token de sesión en SQLite</span>
            <span>Seguridad & Privacidad ✅</span>
          </div>
        </div>
      </div>
    </div>
  );
}

