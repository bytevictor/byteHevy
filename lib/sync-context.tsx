"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

export interface SyncToast {
  type: "success" | "error" | "info";
  text: string;
}

export interface SyncContextValue {
  hevyConnected: boolean;
  hevyHasRefreshToken: boolean;
  hevyUsername: string | null;
  hevyUserId: string | null;
  lastHevySync: string | null;
  xiaomiConnected: boolean;
  xiaomiUserId: string | null;
  lastXiaomiSync: string | null;
  isGlobalSyncing: boolean;
  isHevySyncing: boolean;
  isXiaomiSyncing: boolean;
  syncToast: SyncToast | null;
  triggerGlobalSync: () => Promise<void>;
  triggerHevySync: () => Promise<void>;
  triggerXiaomiSync: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  clearToast: () => void;
  hevyModalOpen: boolean;
  setHevyModalOpen: (open: boolean) => void;
  xiaomiModalOpen: boolean;
  setXiaomiModalOpen: (open: boolean) => void;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  // Estados de conexión
  const [hevyConnected, setHevyConnected] = useState(false);
  const [hevyHasRefreshToken, setHevyHasRefreshToken] = useState(false);
  const [hevyUsername, setHevyUsername] = useState<string | null>(null);
  const [hevyUserId, setHevyUserId] = useState<string | null>(null);
  const [lastHevySync, setLastHevySync] = useState<string | null>(null);

  const [xiaomiConnected, setXiaomiConnected] = useState(false);
  const [xiaomiUserId, setXiaomiUserId] = useState<string | null>(null);
  const [lastXiaomiSync, setLastXiaomiSync] = useState<string | null>(null);

  // Estados de sincronización
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [isHevySyncing, setIsHevySyncing] = useState(false);
  const [isXiaomiSyncing, setIsXiaomiSyncing] = useState(false);

  // Modales
  const [hevyModalOpen, setHevyModalOpen] = useState(false);
  const [xiaomiModalOpen, setXiaomiModalOpen] = useState(false);

  // Toast global
  const [syncToast, setSyncToast] = useState<SyncToast | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((toast: SyncToast) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSyncToast(toast);
    toastTimeoutRef.current = setTimeout(() => {
      setSyncToast(null);
    }, 4500);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSyncToast(null);
  }, []);

  // Consultar estado de ambas conexiones
  const refreshStatuses = useCallback(async () => {
    try {
      const [hevyRes, xiaomiRes] = await Promise.all([
        fetch("/api/hevy/status", { cache: "no-store" }).catch(() => null),
        fetch("/api/xiaomi/status", { cache: "no-store" }).catch(() => null),
      ]);

      if (hevyRes && hevyRes.ok) {
        const hevyData = await hevyRes.json();
        setHevyConnected(Boolean(hevyData.is_connected));
        setHevyHasRefreshToken(Boolean(hevyData.has_refresh_token));
        setHevyUsername(hevyData.username || null);
        setHevyUserId(hevyData.user_id || null);
        setLastHevySync(hevyData.last_sync || null);
      }

      if (xiaomiRes && xiaomiRes.ok) {
        const xiaomiData = await xiaomiRes.json();
        setXiaomiConnected(Boolean(xiaomiData.is_connected));
        setXiaomiUserId(xiaomiData.user_id || null);
        setLastXiaomiSync(xiaomiData.last_sync || null);
      }
    } catch (e) {
      console.error("Error al refrescar estados de sincronización:", e);
    }
  }, []);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  // Sincronización Global (ambas plataformas)
  const triggerGlobalSync = useCallback(async () => {
    if (isGlobalSyncing || isHevySyncing || isXiaomiSyncing) return;

    if (!hevyConnected && !xiaomiConnected) {
      showToast({
        type: "info",
        text: "No hay cuentas conectadas. Ve a Ajustes para vincular Hevy o Xiaomi.",
      });
      return;
    }

    setIsGlobalSyncing(true);

    const tasks: Promise<{
      service: "hevy" | "xiaomi";
      success: boolean;
      message: string;
    }>[] = [];

    if (hevyConnected) {
      tasks.push(
        fetch("/api/hevy/sync", { method: "POST" })
          .then(async (res) => {
            const data = await res.json();
            if (data.success) {
              const count = data.result?.newWorkouts || 0;
              return {
                service: "hevy" as const,
                success: true,
                message:
                  count > 0 ? `${count} entrenamientos nuevos` : "al día",
              };
            }
            return {
              service: "hevy" as const,
              success: false,
              message: data.error || "error",
            };
          })
          .catch((err) => ({
            service: "hevy" as const,
            success: false,
            message: err.message || "error de conexión",
          }))
      );
    }

    if (xiaomiConnected) {
      tasks.push(
        fetch("/api/xiaomi/sync", { method: "POST" })
          .then(async (res) => {
            const data = await res.json();
            if (data.success) {
              const count = data.imported || 0;
              return {
                service: "xiaomi" as const,
                success: true,
                message: count > 0 ? `${count} pesajes nuevos` : "al día",
              };
            }
            return {
              service: "xiaomi" as const,
              success: false,
              message: data.error || "error",
            };
          })
          .catch((err) => ({
            service: "xiaomi" as const,
            success: false,
            message: err.message || "error de conexión",
          }))
      );
    }

    try {
      const results = await Promise.all(tasks);
      await refreshStatuses();

      // Emitir evento para refrescar componentes en vivo (gráficos, listados, estadísticas)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("bytehevy-sync-complete", { detail: { results } })
        );
      }

      const summary = results
        .map(
          (r) =>
            `${r.service === "hevy" ? "Hevy" : "Xiaomi"}: ${r.message}`
        )
        .join(" | ");

      const anyFailed = results.some((r) => !r.success);

      showToast({
        type: anyFailed ? "error" : "success",
        text: `Sincronización global · ${summary}`,
      });
    } catch (e: any) {
      showToast({
        type: "error",
        text: `Error en sincronización global: ${e.message || e}`,
      });
    } finally {
      setIsGlobalSyncing(false);
    }
  }, [
    isGlobalSyncing,
    isHevySyncing,
    isXiaomiSyncing,
    hevyConnected,
    xiaomiConnected,
    refreshStatuses,
    showToast,
  ]);

  // Sincronización Granular: Solo Hevy
  const triggerHevySync = useCallback(async () => {
    if (isHevySyncing) return;

    if (!hevyConnected) {
      setHevyModalOpen(true);
      return;
    }

    setIsHevySyncing(true);
    try {
      const res = await fetch("/api/hevy/sync", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        const count = data.result?.newWorkouts || 0;
        showToast({
          type: "success",
          text: `Hevy sincronizado: ${
            count > 0
              ? `${count} nuevos entrenamientos importados.`
              : "al día con Hevy."
          }`,
        });
        await refreshStatuses();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("bytehevy-sync-complete", {
              detail: { service: "hevy", count },
            })
          );
        }
      } else {
        showToast({
          type: "error",
          text: data.error || "Error al sincronizar con Hevy.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        text: `Error de red con Hevy: ${err.message || err}`,
      });
    } finally {
      setIsHevySyncing(false);
    }
  }, [isHevySyncing, hevyConnected, refreshStatuses, showToast]);

  // Sincronización Granular: Solo Xiaomi
  const triggerXiaomiSync = useCallback(async () => {
    if (isXiaomiSyncing) return;

    if (!xiaomiConnected) {
      setXiaomiModalOpen(true);
      return;
    }

    setIsXiaomiSyncing(true);
    try {
      const res = await fetch("/api/xiaomi/sync", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        const count = data.imported || 0;
        showToast({
          type: "success",
          text: `Xiaomi sincronizado: ${
            count > 0
              ? `${count} nuevos pesajes importados.`
              : "al día con Xiaomi."
          }`,
        });
        await refreshStatuses();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("bytehevy-sync-complete", {
              detail: { service: "xiaomi", count },
            })
          );
        }
      } else {
        showToast({
          type: "error",
          text: data.error || "Error al sincronizar con Xiaomi.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        text: `Error de red con Xiaomi: ${err.message || err}`,
      });
    } finally {
      setIsXiaomiSyncing(false);
    }
  }, [isXiaomiSyncing, xiaomiConnected, refreshStatuses, showToast]);

  return (
    <SyncContext.Provider
      value={{
        hevyConnected,
        hevyHasRefreshToken,
        hevyUsername,
        hevyUserId,
        lastHevySync,
        xiaomiConnected,
        xiaomiUserId,
        lastXiaomiSync,
        isGlobalSyncing,
        isHevySyncing,
        isXiaomiSyncing,
        syncToast,
        triggerGlobalSync,
        triggerHevySync,
        triggerXiaomiSync,
        refreshStatuses,
        clearToast,
        hevyModalOpen,
        setHevyModalOpen,
        xiaomiModalOpen,
        setXiaomiModalOpen,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
