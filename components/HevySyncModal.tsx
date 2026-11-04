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
  CheckIcon,
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
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tutorialMethod, setTutorialMethod] = useState<"network" | "console">("network");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Consultar estado de sesión en SQLite
  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/hevy/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return data;
      }
    } catch (e) {
      console.error("Error al obtener estado de Hevy:", e);
    } finally {
      setLoadingStatus(false);
    }
    return null;
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setFeedback(null);
      setIsUpdatingToken(false);
    }
  }, [isOpen, fetchStatus]);

  // Guardar y verificar token
  const handleSaveToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setFeedback({
        type: "error",
        text: "Por favor, pega el token de sesión de Hevy en el recuadro.",
      });
      return;
    }

    setIsSaving(true);
    setFeedback({
      type: "info",
      text: "Verificando token con la API de Hevy...",
    });

    try {
      const res = await fetch("/api/hevy/auth/save-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: "success",
          text: `¡Cuenta vinculada con éxito${data.username ? ` (@${data.username})` : ""}! Ya puedes sincronizar tus entrenamientos.`,
        });
        setTokenInput("");
        setIsUpdatingToken(false);
        await fetchStatus();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "El token introducido no es válido o ha expirado.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Error de conexión: ${err.message || err}`,
      });
    } finally {
      setIsSaving(false);
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
          text: `¡Sincronización completada! ${
            newCount > 0
              ? `Se han importado ${newCount} nuevos entrenamientos.`
              : "Tu base de datos ya está al día con Hevy."
          }`,
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
    if (
      !confirm(
        "¿Deseas desvincular tu cuenta de Hevy? El token de sesión será eliminado de la base de datos local."
      )
    ) {
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

  const consoleCommand = `copy(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '')`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
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

        {/* Estado de la Conexión */}
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
            <div className="flex flex-col gap-1.5 pt-1 border-t border-zinc-800 text-xs text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Usuario de Hevy:</span>
                <span className="font-semibold text-zinc-200 font-mono">
                  {status.username
                    ? `@${status.username}`
                    : status.user_id?.substring(0, 8) + "..."}
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
              No hay sesión guardada. Sigue el breve tutorial a continuación para extraer tu token de sesión desde tu navegador y pegarlo en el recuadro.
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

        {/* Vista cuando está conectado */}
        {status?.is_connected && !isUpdatingToken ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCwIcon
                  className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
                />
                <span>
                  {isSyncing
                    ? "Sincronizando entrenamientos..."
                    : "Sincronizar Ahora"}
                </span>
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

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setIsUpdatingToken(true)}
                className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
              >
                Actualizar o cambiar token
              </button>
              <span>Descarga directa a SQLite ✅</span>
            </div>
          </div>
        ) : (
          /* Tutorial y Recuadro de Token */
          <div className="flex flex-col gap-4">
            {/* Tutorial */}
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/90 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Cómo obtener tu token de sesión en 1 minuto
                </span>
                <a
                  href="https://hevy.com/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  <span>Abrir hevy.com</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Selector de método */}
              <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTutorialMethod("network")}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    tutorialMethod === "network"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Opción 1: Pestaña Red (F12)
                </button>
                <button
                  type="button"
                  onClick={() => setTutorialMethod("console")}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    tutorialMethod === "console"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Opción 2: Consola (1 comando)
                </button>
              </div>

              {/* Pasos según el método */}
              {tutorialMethod === "network" ? (
                <div className="flex flex-col gap-2.5 text-xs text-zinc-300 pt-1">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700">
                      1
                    </span>
                    <p className="leading-relaxed">
                      Inicia sesión en <a href="https://hevy.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold">hevy.com</a> en tu navegador.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700">
                      2
                    </span>
                    <p className="leading-relaxed">
                      Pulsa <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-[11px]">F12</kbd> (o clic derecho &gt; <em>Inspeccionar</em>) y ve a la pestaña <strong className="text-zinc-100">Red</strong> (o <em>Network</em>).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700">
                      3
                    </span>
                    <p className="leading-relaxed">
                      Recarga la página (<kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-[11px]">F5</kbd>) y en el filtro de búsqueda escribe <code className="text-blue-300 font-mono">workouts</code> o <code className="text-blue-300 font-mono">batch</code>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700">
                      4
                    </span>
                    <p className="leading-relaxed">
                      Haz clic en la petición, abre la sub-pestaña <strong className="text-zinc-100">Encabezados</strong> (<em>Headers</em>), busca en los encabezados de solicitud <strong className="text-blue-300 font-mono">auth-token</strong> o <strong className="text-blue-300 font-mono">authorization</strong> y copia su valor.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 text-xs text-zinc-300 pt-1">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700">
                      1
                    </span>
                    <p className="leading-relaxed">
                      Con tu sesión abierta en <a href="https://hevy.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold">hevy.com</a>, pulsa <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-[11px]">F12</kbd> y entra en la pestaña <strong className="text-zinc-100">Consola</strong> (<em>Console</em>).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700">
                      2
                    </span>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <p className="leading-relaxed">
                        Copia y pega este comando en la consola de hevy.com y presiona <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-[11px]">Enter</kbd>:
                      </p>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-blue-300">
                        <span className="flex-1 select-all overflow-x-auto whitespace-nowrap">
                          {consoleCommand}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(consoleCommand);
                            setCopiedCmd(true);
                            setTimeout(() => setCopiedCmd(false), 2000);
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        >
                          {copiedCmd ? (
                            <>
                              <CheckIcon className="w-3 h-3 text-emerald-400" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <span>Copiar</span>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        ¡El comando copiará automáticamente tu token al portapapeles!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recuadro para pegar y guardar el token */}
            <form onSubmit={handleSaveToken} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Pega aquí tu token de sesión de Hevy:
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Pega el token aquí (ej. 6NTNQDHaO4... o Bearer ...)"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono resize-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!tokenInput.trim() || isSaving}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RefreshCwIcon className="w-4 h-4 animate-spin" />
                      <span>Verificando y guardando token...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Vincular Cuenta y Guardar</span>
                    </>
                  )}
                </button>

                {isUpdatingToken && (
                  <button
                    type="button"
                    onClick={() => setIsUpdatingToken(false)}
                    className="py-3 px-4 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 pt-1">
                <span>Tu contraseña nunca se guarda ni se transmite</span>
                <span>Almacenamiento 100% local en SQLite</span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
