import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";

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
    <html lang="es" className="h-full antialiased dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('bytehevy_theme');
                var a = localStorage.getItem('bytehevy_accent');
                var root = document.documentElement;
                if (t) root.setAttribute('data-theme', t);
                if (a) root.setAttribute('data-accent', a);
                var colors = {
                  amber: ['#f59e0b', '#fbbf24', '#fcd34d'],
                  lime: ['#84cc16', '#a3e635', '#bef264'],
                  emerald: ['#10b981', '#34d399', '#6ee7b7'],
                  cyan: ['#06b6d4', '#22d3ee', '#67e8f9'],
                  blue: ['#3b82f6', '#60a5fa', '#93c5fd'],
                  violet: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
                  pink: ['#ec4899', '#f472b6', '#f9a8d4'],
                  rose: ['#f43f5e', '#fb7185', '#fda4af'],
                  orange: ['#f97316', '#fb923c', '#fdba74'],
                  platinum: ['#e4e4e7', '#ffffff', '#ffffff']
                };
                if (a && colors[a]) {
                  root.style.setProperty('--accent', colors[a][0]);
                  root.style.setProperty('--accent-light', colors[a][1]);
                  root.style.setProperty('--accent-lighter', colors[a][2]);
                }
                var themes = {
                  zinc: ['#09090b', 'rgba(9, 9, 11, 0.85)'],
                  oled: ['#000000', 'rgba(0, 0, 0, 0.9)'],
                  midnight: ['#070a12', 'rgba(7, 10, 18, 0.85)'],
                  carbon: ['#121214', 'rgba(18, 18, 20, 0.85)'],
                  cyberpunk: ['#0b0914', 'rgba(11, 9, 20, 0.85)']
                };
                if (t && themes[t]) {
                  root.style.setProperty('--background', themes[t][0]);
                  root.style.setProperty('--header-bg', themes[t][1]);
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans transition-colors duration-200" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
