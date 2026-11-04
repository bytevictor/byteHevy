import { Suspense } from "react";
import { WeightTab } from "@/components/WeightTab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seguimiento de Peso y Composición Corporal",
};

export default function WeightPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500 animate-pulse text-xs">
          Cargando seguimiento de peso...
        </div>
      }
    >
      <WeightTab />
    </Suspense>
  );
}
