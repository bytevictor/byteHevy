import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    template: "%s · byteHevy",
    default: "byteHevy | Visualizador de Entrenamientos",
  },
  description: "Visualizador técnico y minimalista de entrenamientos Hevy",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
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
                var atmo = localStorage.getItem('bytehevy_atmosphere');
                var root = document.documentElement;
                if (t) root.setAttribute('data-theme', t);
                if (a) root.setAttribute('data-accent', a);
                if (atmo) root.setAttribute('data-atmosphere', atmo);
                var colors = {
                  amber: ['#f59e0b', '#fbbf24', '#fcd34d'],
                  gold: ['#eab308', '#facc15', '#fde047'],
                  lime: ['#84cc16', '#a3e635', '#bef264'],
                  emerald: ['#10b981', '#34d399', '#6ee7b7'],
                  mint: ['#14b8a6', '#2dd4bf', '#5eead4'],
                  cyan: ['#06b6d4', '#22d3ee', '#67e8f9'],
                  blue: ['#3b82f6', '#60a5fa', '#93c5fd'],
                  indigo: ['#6366f1', '#818cf8', '#a5b4fc'],
                  violet: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
                  pink: ['#ec4899', '#f472b6', '#f9a8d4'],
                  coral: ['#fb7185', '#f43f5e', '#fda4af'],
                  rose: ['#f43f5e', '#fb7185', '#fda4af'],
                  ruby: ['#e11d48', '#f43f5e', '#fb7185'],
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
                  cyberpunk: ['#0b0914', 'rgba(11, 9, 20, 0.85)'],
                  abyss: ['#030712', 'rgba(3, 7, 18, 0.88)'],
                  forest: ['#040a06', 'rgba(4, 10, 6, 0.88)'],
                  espresso: ['#0c0908', 'rgba(12, 9, 8, 0.88)'],
                  crimson: ['#0b0507', 'rgba(11, 5, 7, 0.88)'],
                  matrix: ['#020803', 'rgba(2, 8, 3, 0.88)'],
                  solar: ['#0d0a07', 'rgba(13, 10, 7, 0.88)'],
                  light: ['#f8fafc', 'rgba(248, 250, 252, 0.92)']
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
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
