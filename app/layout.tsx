import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "byteHevy | Visualizador de Entrenamientos",
  description: "Visualizador técnico y minimalista de entrenamientos Hevy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 selection:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
