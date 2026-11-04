import { Suspense } from "react";
import { ExplorerTab } from "@/components/ExplorerTab";
import { ExplorerSkeleton } from "@/components/skeletons/ExplorerSkeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explorador de Entrenamientos",
};

export default function HomePage() {
  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <ExplorerTab />
    </Suspense>
  );
}
