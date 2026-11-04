"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  const [origin, setOrigin] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bookmarkletLinkRef = useRef<HTMLAnchorElement>(null);

  // Obtener origen actual en el cliente (ej. http://192.168.1.50:3000)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

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
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsConnecting(false);
    }
  }, [isOpen, fetchStatus]);

  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Escuchar mensajes del Bookmarklet o de la ventana popup de retorno
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // 1. Mensaje directo desde el Bookmarklet ejecutado en hevy.com
      if (event.data?.type === "BYTEHEVY_AUTH" && event.data?.accessToken) {
        const { accessToken, refreshToken, userId, username } = event.data;
        setIsConnecting(true);
        setFeedback({
          type: "info",
          text: "¡Token recibido! Verificando y guardando sesión en SQLite...",
        });

        try {
          const res = await fetch("/api/hevy/auth/save-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken,
              refreshToken,
              userId,
              username,
            }),
          });
          const data = await res.json();

          if (data.success) {
            setFeedback({
              type: "success",
              text: `¡Cuenta vinculada correctamente${data.username ? ` (@${data.username})` : ""}! Ya puedes sincronizar tus entrenamientos.`,
            });
            await fetchStatus();
            setIsConnecting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } else {
            setFeedback({
              type: "error",
              text: data.error || "No se pudo validar el token con Hevy.",
            });
            setIsConnecting(false);
          }
        } catch (err: any) {
          setFeedback({
            type: "error",
            text: `Error al guardar token: ${err.message || err}`,
          });
          setIsConnecting(false);
        }
      }

      // 2. Mensaje enviado tras completar el redirect a /api/hevy/callback
      if (event.data?.type === "BYTEHEVY_AUTH_SUCCESS") {
        setFeedback({
          type: "success",
          text: "¡Cuenta vinculada con éxito! Ya puedes sincronizar tus entrenamientos.",
        });
        await fetchStatus();
        setIsConnecting(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };

    // Escuchar eventos de localStorage (si el popup navegó a /api/hevy/callback en el mismo origen)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "bytehevy_sync_update") {
        fetchStatus().then((newStatus) => {
          if (newStatus?.is_connected) {
            setFeedback({
              type: "success",
              text: "¡Cuenta vinculada con éxito! Ya puedes sincronizar tus entrenamientos.",
            });
            setIsConnecting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        });
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchStatus]);

  // Generar código del Bookmarklet
  const bookmarkletCode = origin
    ? `javascript:(function(){try{var t="${origin}";var tok=null,uId=null,uName=null,rTok=null;function s(st){if(!st)return;for(var i=0;i<st.length;i++){var k=st.key(i);var v=st.getItem(k);if(!v)continue;try{var o=JSON.parse(v);if(o&&typeof o==="object"){if(!tok&&(o.access_token||o.auth_token||o.token))tok=o.access_token||o.auth_token||o.token;if(!rTok&&o.refresh_token)rTok=o.refresh_token;if(!uId&&(o.user_id||o.userId||o.id))uId=o.user_id||o.userId||o.id;if(!uName&&(o.username||o.name))uName=o.username||o.name;}}catch(e){if(!tok&&/token|auth/i.test(k)&&v.length>20)tok=v.replace(/^["\x27]|["\x27]$/g,"");}}}s(window.localStorage);if(!tok)s(window.sessionStorage);if(!tok&&document.cookie){var p=document.cookie.split(";");for(var j=0;j<p.length;j++){var pr=p[j].trim().split("=");if(/token|auth|session/i.test(pr[0])&&pr[1]&&pr[1].length>20){tok=decodeURIComponent(pr[1]);break;}}}if(tok){var d=document.createElement("div");d.style.cssText="position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999999;background:#18181b;color:#10b981;border:2px solid #10b981;border-radius:16px;padding:16px 28px;font-family:sans-serif;font-size:15px;font-weight:bold;box-shadow:0 10px 30px rgba(0,0,0,0.8);text-align:center;";d.innerHTML="✅ ¡Token de Hevy detectado!<br><span style=\\"font-size:12px;color:#a1a1aa;font-weight:normal;\\">Vinculando con ByteHevy...</span>";document.body.appendChild(d);var sent=false;if(window.opener){try{window.opener.postMessage({type:"BYTEHEVY_AUTH",accessToken:tok,refreshToken:rTok,userId:uId,username:uName},"*");sent=true;}catch(e){}}var u=t+"/api/hevy/callback?token="+encodeURIComponent(tok)+(uId?"&user_id="+encodeURIComponent(uId):"")+(uName?"&username="+encodeURIComponent(uName):"");setTimeout(function(){if(window.opener&&sent){window.close();}else{window.location.href=u;}},1000);}else{var m=prompt("No se detectó sesión iniciada en Hevy.\\n\\nSi ya has iniciado sesión, puedes pegar aquí tu token:");if(m&&m.trim()){window.location.href=t+"/api/hevy/callback?token="+encodeURIComponent(m.trim());}}}catch(err){alert("Error: "+err.message);}})();`
    : "";

  // Asignar el href directamente en el DOM para evitar la restricción de seguridad de React con URLs javascript:
  useEffect(() => {
    if (bookmarkletLinkRef.current && bookmarkletCode) {
      bookmarkletLinkRef.current.setAttribute("href", bookmarkletCode);
    }
  }, [bookmarkletCode]);

  // Abrir ventana emergente hacia Hevy
  const handleOpenPopup = () => {
    setIsConnecting(true);
    setFeedback({
      type: "info",
      text: "Ventana de Hevy abierta. Inicia sesión y pulsa tu marcador '⭐ Conectar con ByteHevy' en la barra de marcadores.",
    });

    const popup = window.open(
      "https://hevy.com/login",
      "hevy_login_popup",
      "width=560,height=750,left=200,top=100"
    );
    if (popup) popup.focus();

    // Iniciar sondeo periódico de SQLite por si el callback se completó silenciosamente
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 120) {
        // 4 minutos de tiempo límite
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsConnecting(false);
        return;
      }

      const curStatus = await fetchStatus();
      if (curStatus?.is_connected) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsConnecting(false);
        setFeedback({
          type: "success",
          text: `¡Cuenta vinculada con éxito${curStatus.username ? ` (@${curStatus.username})` : ""}! Ya puedes sincronizar tus entrenamientos.`,
        });
      }
    }, 2000);
  };

  // Guardar token introducido manualmente
  const handleSaveManualToken = async () => {
    if (!manualToken.trim()) return;
    setIsConnecting(true);
    setFeedback({
      type: "info",
      text: "Verificando token con la API de Hevy...",
    });

    try {
      const res = await fetch("/api/hevy/auth/save-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: manualToken.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: "success",
          text: `¡Cuenta vinculada exitosamente${data.username ? ` (@${data.username})` : ""}!`,
        });
        setManualToken("");
        setShowManualInput(false);
        await fetchStatus();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "El token introducido no es válido en Hevy.",
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
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
              No hay sesión guardada. Conéctate abriendo Hevy en una ventana emergente y usando el marcador para capturar tu token con 1 clic.
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

        {/* Instructions & Actions */}
        {!status?.is_connected ? (
          <div className="flex flex-col gap-4">
            {/* Paso 1: Marcador */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] flex items-center justify-center font-bold">
                    1
                  </span>
                  Arrastra este marcador a tus favoritos
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bookmarkletCode);
                    setCopiedBookmarklet(true);
                    setTimeout(() => setCopiedBookmarklet(false), 2000);
                  }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                >
                  {copiedBookmarklet ? "¡Copiado!" : "Copiar código"}
                </button>
              </div>

              <div className="flex items-center justify-center py-2">
                <a
                  ref={bookmarkletLinkRef}
                  href="#"
                  draggable="true"
                  onDragStart={(e) => {
                    if (bookmarkletCode) {
                      e.dataTransfer.setData("text/uri-list", bookmarkletCode);
                      e.dataTransfer.setData("text/plain", bookmarkletCode);
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(
                      "Arrastra este botón a la barra de marcadores de tu navegador (Ctrl+Shift+B si no la ves)."
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border-2 border-dashed border-blue-500/50 text-blue-300 text-xs font-bold flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02] shadow-sm"
                  title="Arrastra este enlace a tu barra de marcadores"
                >
                  <span>⭐ Conectar con ByteHevy</span>
                </a>
              </div>
              <p className="text-[11px] text-zinc-500 text-center">
                Arrastra el recuadro a la barra de marcadores (solo la primera vez)
              </p>
            </div>

            {/* Paso 2: Abrir Hevy */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] flex items-center justify-center font-bold">
                  2
                </span>
                Abre Hevy e inicia sesión
              </span>
              <button
                onClick={handleOpenPopup}
                disabled={isConnecting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCwIcon className="w-4 h-4 animate-spin" />
                    <span>Esperando clic en el marcador...</span>
                  </>
                ) : (
                  <>
                    <ExternalLinkIcon className="w-4 h-4" />
                    <span>Abrir Hevy en ventana emergente ↗</span>
                  </>
                )}
              </button>
            </div>

            {/* Paso 3: Explicación del clic */}
            <div className="px-2 text-xs text-zinc-400 flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                3
              </span>
              <p className="leading-relaxed">
                Una vez iniciada la sesión en la ventana emergente de Hevy, pulsa el marcador <strong className="text-blue-300 font-semibold">⭐ Conectar con ByteHevy</strong> en tu barra de marcadores para vincular tu cuenta automáticamente.
              </p>
            </div>

            {/* Alternativa: Introducir token manualmente */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>{showManualInput ? "▼" : "▶"}</span>
                <span>¿Prefieres introducir el token manualmente?</span>
              </button>

              {showManualInput && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col gap-2.5 animate-in fade-in duration-150">
                  <label className="text-[11px] text-zinc-400">
                    Pega tu token de Hevy (access_token o auth_token):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="eyJhbGciOi... o tu_token_de_hevy..."
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveManualToken}
                      disabled={!manualToken.trim() || isConnecting}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Vincular
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Vista Conectado: Botón de Sincronizar */
          <div className="flex flex-col gap-3">
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

            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
              <span>Descarga directa a SQLite sin intermediarios</span>
              <span>Seguridad & Privacidad ✅</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
