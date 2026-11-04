import { Suspense } from "react";
import { JournalTab } from "@/components/JournalTab";
import { JournalSkeleton } from "@/components/skeletons/JournalSkeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diario de Entrenamientos",
};

export default function JournalPage() {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <JournalTab />
    </Suspense>
  );
}
