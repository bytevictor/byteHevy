"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  XIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  QrCodeIcon,
  ExternalLinkIcon,
  DatabaseIcon,
  ScaleIcon,
  InfoIcon,
  TrashIcon,
} from "./Icons";

export interface XiaomiSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess?: () => void;
  autoStartQr?: boolean;
}

interface XiaomiStatus {
  is_connected: boolean;
  last_sync: string | null;
  last_sync_timestamp_ms?: number | null;
  user_id: string | null;
  region: string | null;
  scale_model: string | null;
  total_scale_measurements?: number;
}

export function XiaomiSyncModal({
  isOpen,
  onClose,
  onSyncSuccess,
  autoStartQr = false,
}: XiaomiSyncModalProps) {
  const [status, setStatus] = useState<XiaomiStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // QR state
  const [qrData, setQrData] = useState<{ login_url: string; qr_image_url: string } | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isPollingQr, setIsPollingQr] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
    count?: number;
  } | null>(null);

  // Polling ref
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPollingQr(false);
  }, []);

  // Fetch session status
  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/xiaomi/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("Error al obtener estado de Xiaomi:", e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Check QR approval
  const checkQrApproval = useCallback(async () => {
    try {
      const res = await fetch("/api/xiaomi/auth/check");
      const data = await res.json();

      if (data.confirmed) {
        stopPolling();
        setQrData(null);
        setQrMessage("¡Autenticación completada con éxito!");
        setSyncFeedback({
          type: "success",
          text: "¡Sesión conectada correctamente! Ya puedes sincronizar tus pesajes.",
        });
        await fetchStatus();
        return true;
      } else {
        if (data.message) {
          setQrMessage(data.message);
        }
      }
    } catch (e) {
      console.error("Error en polling de QR:", e);
    }
    return false;
  }, [fetchStatus, stopPolling]);

  // Start QR login flow
  const handleStartQr = useCallback(async () => {
    stopPolling();
    setIsGeneratingQr(true);
    setSyncFeedback(null);
    setQrMessage("Generando código QR con los servidores de Xiaomi...");

    try {
      const res = await fetch("/api/xiaomi/auth/start", { method: "POST" });
      const data = await res.json();

      if (data.success && data.qr_image_url) {
        setQrData({
          login_url: data.login_url,
          qr_image_url: data.qr_image_url,
        });
        setQrMessage("Esperando escaneo y aprobación en la app Xiaomi Home...");
        setIsPollingQr(true);

        // Iniciar polling cada 2 segundos
        pollTimerRef.current = setInterval(async () => {
          const approved = await checkQrApproval();
          if (approved) {
            // Polling detenido en checkQrApproval
          }
        }, 2000);
      } else {
        setSyncFeedback({
          type: "error",
          text: data.error || "No se pudo generar el código QR. Inténtalo de nuevo.",
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: "error",
        text: `Error de conexión: ${err.message || err}`,
      });
    } finally {
      setIsGeneratingQr(false);
    }
  }, [checkQrApproval, stopPolling]);

  // Incremental Sync
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const res = await fetch("/api/xiaomi/sync", { method: "POST" });
      const data = await res.json();

      if (res.status === 401 || data.error === "SESSION_EXPIRED") {
        setStatus((prev) => (prev ? { ...prev, is_connected: false } : null));
        setSyncFeedback({
          type: "error",
          text: "Tu sesión de Xiaomi ha caducado. Por favor, pulsa en 'Conectar / Renovar Sesión' para escanear el código QR.",
        });
      } else if (data.success) {
        const count = data.new_records_count || 0;
        setSyncFeedback({
          type: "success",
          count,
          text:
            count > 0
              ? `¡Sincronización completada! Se descargaron e integraron ${count} nuevos pesajes.`
              : "Tu historial ya está al día. No hay nuevos pesajes en Xiaomi Cloud.",
        });
        await fetchStatus();
        onSyncSuccess?.();
      } else {
        setSyncFeedback({
          type: "error",
          text: data.error || "Error durante la sincronización.",
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: "error",
        text: `Error de red al sincronizar: ${err.message || err}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect session
  const handleDisconnect = async () => {
    if (!confirm("¿Seguro que deseas desconectar tu cuenta de Xiaomi?")) return;
    try {
      await fetch("/api/xiaomi/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnect: true }),
      });
      stopPolling();
      setQrData(null);
      setSyncFeedback({
        type: "info",
        text: "Sesión desconectada. Puedes volver a conectar cuando quieras.",
      });
      await fetchStatus();
    } catch (e) {
      console.error("Error al desconectar:", e);
    }
  };

  // On open
  useEffect(() => {
    if (isOpen) {
      setSyncFeedback(null);
      fetchStatus();
      if (autoStartQr) {
        handleStartQr();
      }
    } else {
      stopPolling();
      setQrData(null);
    }
  }, [isOpen, autoStartQr, fetchStatus, handleStartQr, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <ScaleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">
                  Xiaomi Cloud (Mi Home)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/25">
                  S400 / S200
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Sincronización incremental para báscula inteligente <code className="text-zinc-300">yunmai.scales.ms104</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Estado actual de la sesión */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Estado de la Conexión:</span>
            {loadingStatus ? (
              <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                Comprobando...
              </span>
            ) : status?.is_connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Conectado a Xiaomi Cloud
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Desconectado / Requiere QR
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60 text-xs">
            <div>
              <span className="text-zinc-500 block text-[11px]">Última Sincronización</span>
              <span className="text-zinc-200 font-mono font-medium">
                {status?.last_sync || "Sin registros recientes"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[11px]">User ID / Servidor</span>
              <span className="text-zinc-200 font-mono font-medium">
                {status?.user_id ? `${status.user_id} (${status.region || "de"})` : "No autenticado"}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback visual de sincronización / autenticación */}
        {syncFeedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
              syncFeedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : syncFeedback.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
            }`}
          >
            {syncFeedback.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            )}
            <div className="space-y-0.5">
              <p className="font-medium leading-relaxed">{syncFeedback.text}</p>
            </div>
          </div>
        )}

        {/* Panel QR Code Interactivo */}
        {qrData && (
          <div className="p-4 rounded-xl bg-gradient-to-b from-orange-500/10 to-transparent border border-orange-500/20 text-center space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-left">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <QrCodeIcon className="w-4 h-4 text-orange-400" />
                  Escanear Código QR
                </h3>
                <p className="text-xs text-zinc-400">
                  Abre la app <strong>Xiaomi Home</strong> y escanea este código desde la sección Perfil.
                </p>
              </div>
              <button
                onClick={() => {
                  stopPolling();
                  setQrData(null);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 p-1"
                title="Cancelar QR"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Tarjeta de imagen QR de alto contraste */}
            <div className="inline-block p-3.5 bg-white rounded-2xl shadow-xl border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrData.qr_image_url}
                alt="Xiaomi Login QR Code"
                className="w-52 h-52 object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-medium text-orange-400">
              <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
              <span>{qrMessage || "Esperando aprobación en la app móvil..."}</span>
            </div>

            {/* Enlace alternativo */}
            <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
              <span className="text-zinc-500">¿No puedes escanearlo?</span>
              <a
                href={qrData.login_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-2"
              >
                <span>Abrir enlace de inicio de sesión Xiaomi</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Acciones Principales */}
        <div className="space-y-3 pt-2">
          {/* Botón Principal: Sincronizar Nuevos Pesajes */}
          {status?.is_connected ? (
            <div className="space-y-2">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCwIcon className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Sincronizando con Xiaomi Cloud..." : "Sincronizar Nuevos Pesajes"}</span>
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleStartQr}
                  disabled={isGeneratingQr || isPollingQr}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer py-1"
                >
                  <QrCodeIcon className="w-3.5 h-3.5 text-orange-400" />
                  <span>Re-autenticar con QR</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer py-1"
                >
                  <TrashIcon className="w-3 h-3" />
                  <span>Desconectar cuenta</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleStartQr}
                disabled={isGeneratingQr || isPollingQr}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 cursor-pointer"
              >
                <QrCodeIcon className="w-4 h-4" />
                <span>
                  {isGeneratingQr
                    ? "Generando Código QR..."
                    : isPollingQr
                    ? "Esperando escaneo móvil..."
                    : "Conectar con Código QR (Xiaomi Home)"}
                </span>
              </button>
              <p className="text-[11px] text-zinc-500 text-center">
                Autenticación segura sin necesidad de introducir tokens a mano. Los tokens se guardan automáticamente en la base de datos local.
              </p>
            </div>
          )}
        </div>

        {/* Información Técnica del Modelo */}
        <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60 flex items-start gap-2.5 text-xs text-zinc-400">
          <InfoIcon className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-zinc-200 block">Sincronización incremental nativa:</span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              La sincronización utiliza el último registro de la base de datos como punto de corte, descargando únicamente los pesajes nuevos de tu báscula mediante peticiones cifradas RC4-drop1024. Cada medición incluye peso, grasa, masa muscular, agua, masa ósea e IMC.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <DatabaseIcon className="w-3.5 h-3.5 text-zinc-500" />
            <span>SQLite: <code className="text-zinc-400">scale_measurements</code></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
