import { Suspense } from "react";
import { SettingsTab } from "@/components/SettingsTab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Configuración y Sincronización",
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500 animate-pulse text-xs">
          Cargando configuración...
        </div>
      }
    >
      <SettingsTab />
    </Suspense>
  );
}
