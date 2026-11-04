import { Suspense } from "react";
import { GoalsTab } from "@/components/GoalsTab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Objetivos de Rendimiento",
};

export default function GoalsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500 animate-pulse text-xs">
          Cargando objetivos...
        </div>
      }
    >
      <GoalsTab />
    </Suspense>
  );
}
