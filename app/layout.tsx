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
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&family=Chakra+Petch:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('bytehevy_theme');
                var a = localStorage.getItem('bytehevy_accent') || 'blue';
                var custom = localStorage.getItem('bytehevy_custom_accent');
                var second = localStorage.getItem('bytehevy_second_ink');
                var atmo = localStorage.getItem('bytehevy_atmosphere');
                var radius = localStorage.getItem('bytehevy_radius');
                var cardStyle = localStorage.getItem('bytehevy_card_style');
                var fontStyle = localStorage.getItem('bytehevy_font_style');
                var root = document.documentElement;

                if (t === 'paper' || t === 'light') {
                  root.classList.remove('dark');
                } else {
                  root.classList.add('dark');
                }

                if (t) root.setAttribute('data-theme', t);
                root.setAttribute('data-accent', a);
                if (atmo) root.setAttribute('data-atmosphere', atmo);
                if (radius) root.setAttribute('data-radius', radius);
                if (cardStyle) root.setAttribute('data-card-style', cardStyle);
                if (fontStyle) root.setAttribute('data-font-style', fontStyle);

                var colors = {
                  amber: ['#f59e0b', '#fbbf24', '#fcd34d', '#00857c'],
                  gold: ['#eab308', '#facc15', '#fde047', '#2563eb'],
                  lime: ['#84cc16', '#a3e635', '#bef264', '#7c3aed'],
                  emerald: ['#10b981', '#34d399', '#6ee7b7', '#f43f5e'],
                  mint: ['#14b8a6', '#2dd4bf', '#5eead4', '#7a3cc2'],
                  cyan: ['#06b6d4', '#22d3ee', '#67e8f9', '#f97316'],
                  blue: ['#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b'],
                  indigo: ['#6366f1', '#818cf8', '#a5b4fc', '#e8590c'],
                  violet: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ec4899'],
                  pink: ['#ff48b0', '#ff6ec0', '#ffa3d7', '#00857c'],
                  coral: ['#fb7185', '#f43f5e', '#fda4af', '#14b8a6'],
                  rose: ['#f43f5e', '#fb7185', '#fda4af', '#06b6d4'],
                  ruby: ['#e11d48', '#f43f5e', '#fb7185', '#ca8a04'],
                  orange: ['#f97316', '#fb923c', '#fdba74', '#2563eb'],
                  platinum: ['#e4e4e7', '#ffffff', '#ffffff', '#8a8590']
                };

                if (a === 'custom' && custom) {
                  root.style.setProperty('--accent', custom);
                  root.style.setProperty('--accent-light', custom);
                  root.style.setProperty('--accent-lighter', custom);
                } else {
                  var activeKey = a && colors[a] ? a : 'blue';
                  root.style.setProperty('--accent', colors[activeKey][0]);
                  root.style.setProperty('--accent-light', colors[activeKey][1]);
                  root.style.setProperty('--accent-lighter', colors[activeKey][2]);
                  if (colors[activeKey][3]) root.style.setProperty('--second', colors[activeKey][3]);
                }
                if (second) {
                  root.style.setProperty('--second', second);
                } else if (t === 'teenage') {
                  root.style.setProperty('--second', '#ff5500');
                }

                var themeDefs = {
                  zinc: {
                    bg: '#09090b',
                    fg: '#fafafa',
                    card: '#18181b',
                    subtle: '#0d0d10',
                    hover: '#27272a',
                    border: '#3f3f46',
                    borderSubtle: '#27272a',
                    textMuted: '#a1a1aa',
                    textFaint: '#71717a',
                    headerBg: 'rgba(9, 9, 11, 0.85)',
                    shadow: '#000000'
                  },
                  oled: {
                    bg: '#000000',
                    fg: '#ffffff',
                    card: '#0a0a0c',
                    subtle: '#050506',
                    hover: '#18181e',
                    border: '#27272a',
                    borderSubtle: '#18181b',
                    textMuted: '#a1a1aa',
                    textFaint: '#71717a',
                    headerBg: 'rgba(0, 0, 0, 0.9)',
                    shadow: '#000000'
                  },
                  paper: {
                    bg: '#f3eee3',
                    fg: '#1f1b24',
                    card: '#fbf8f1',
                    subtle: '#ebe4d4',
                    hover: '#ede6d6',
                    border: '#dfd7c5',
                    borderSubtle: 'rgba(31, 27, 36, 0.14)',
                    textMuted: '#5c5564',
                    textFaint: '#80778a',
                    headerBg: 'rgba(243, 238, 227, 0.94)',
                    shadow: '#1f1b24'
                  },
                  light: {
                    bg: '#f8fafc',
                    fg: '#0f172a',
                    card: '#ffffff',
                    subtle: '#f1f5f9',
                    hover: '#e2e8f0',
                    border: '#cbd5e1',
                    borderSubtle: '#e2e8f0',
                    textMuted: '#64748b',
                    textFaint: '#94a3b8',
                    headerBg: 'rgba(248, 250, 252, 0.92)',
                    shadow: '#0f172a'
                  },
                  matrix: {
                    bg: '#020803',
                    fg: '#86efac',
                    card: '#06140a',
                    subtle: '#030b05',
                    hover: '#0f2d16',
                    border: '#16401f',
                    borderSubtle: '#0c2412',
                    textMuted: '#4ade80',
                    textFaint: '#15803d',
                    headerBg: 'rgba(2, 8, 3, 0.88)',
                    shadow: '#000000'
                  },
                  midnight: {
                    bg: '#070a12',
                    fg: '#f1f5f9',
                    card: '#0e1526',
                    subtle: '#050810',
                    hover: '#192644',
                    border: '#23355e',
                    borderSubtle: '#152038',
                    textMuted: '#94a3b8',
                    textFaint: '#64748b',
                    headerBg: 'rgba(7, 10, 18, 0.85)',
                    shadow: '#000000'
                  },
                  carbon: {
                    bg: '#121214',
                    fg: '#f4f4f5',
                    card: '#1a1a1d',
                    subtle: '#0f0f10',
                    hover: '#2b2b31',
                    border: '#3f3f46',
                    borderSubtle: '#27272a',
                    textMuted: '#a1a1aa',
                    textFaint: '#71717a',
                    headerBg: 'rgba(18, 18, 20, 0.85)',
                    shadow: '#000000'
                  },
                  cyberpunk: {
                    bg: '#0b0914',
                    fg: '#f5f3ff',
                    card: '#141024',
                    subtle: '#08060f',
                    hover: '#241d40',
                    border: '#3b2d66',
                    borderSubtle: '#241c42',
                    textMuted: '#a78bfa',
                    textFaint: '#7c3aed',
                    headerBg: 'rgba(11, 9, 20, 0.85)',
                    shadow: '#000000'
                  },
                  abyss: {
                    bg: '#030712',
                    fg: '#f1f5f9',
                    card: '#081026',
                    subtle: '#02040b',
                    hover: '#132454',
                    border: '#1f387d',
                    borderSubtle: '#111e42',
                    textMuted: '#94a3b8',
                    textFaint: '#60a5fa',
                    headerBg: 'rgba(3, 7, 18, 0.88)',
                    shadow: '#000000'
                  },
                  forest: {
                    bg: '#040a06',
                    fg: '#f0fdf4',
                    card: '#0a140e',
                    subtle: '#020603',
                    hover: '#152a1d',
                    border: '#1e3d2a',
                    borderSubtle: '#112418',
                    textMuted: '#86efac',
                    textFaint: '#22c55e',
                    headerBg: 'rgba(4, 10, 6, 0.88)',
                    shadow: '#000000'
                  },
                  espresso: {
                    bg: '#0c0908',
                    fg: '#faf5f0',
                    card: '#171210',
                    subtle: '#080605',
                    hover: '#2a221f',
                    border: '#423631',
                    borderSubtle: '#261f1c',
                    textMuted: '#cbb5a1',
                    textFaint: '#927e6d',
                    headerBg: 'rgba(12, 9, 8, 0.88)',
                    shadow: '#000000'
                  },
                  crimson: {
                    bg: '#0b0507',
                    fg: '#fff1f2',
                    card: '#170b10',
                    subtle: '#070304',
                    hover: '#2d1621',
                    border: '#4a2337',
                    borderSubtle: '#2b141f',
                    textMuted: '#fda4af',
                    textFaint: '#e11d48',
                    headerBg: 'rgba(11, 5, 7, 0.88)',
                    shadow: '#000000'
                  },
                  solar: {
                    bg: '#0d0a07',
                    fg: '#fef3c7',
                    card: '#17130e',
                    subtle: '#080604',
                    hover: '#2b231a',
                    border: '#453729',
                    borderSubtle: '#282018',
                    textMuted: '#fcd34d',
                    textFaint: '#d97706',
                    headerBg: 'rgba(13, 10, 7, 0.88)',
                    shadow: '#000000'
                  },
                  teenage: {
                    bg: '#1c1e22',
                    fg: '#f3f4f6',
                    card: '#262930',
                    subtle: '#16181b',
                    hover: '#323640',
                    border: '#3e434f',
                    borderSubtle: '#2a2d36',
                    textMuted: '#9ca3af',
                    textFaint: '#717682',
                    headerBg: 'rgba(28, 30, 34, 0.92)',
                    shadow: '#101215'
                  },
                  vaporwave: {
                    bg: '#120c1f',
                    fg: '#fff5fa',
                    card: '#1c1330',
                    subtle: '#0c0817',
                    hover: '#2a1c47',
                    border: '#7b3fe4',
                    borderSubtle: '#3e2468',
                    textMuted: '#c4a3e8',
                    textFaint: '#ff71ce',
                    headerBg: 'rgba(18, 12, 31, 0.90)',
                    shadow: '#080410'
                  },
                  luxury: {
                    bg: '#0e0d0c',
                    fg: '#faf6f0',
                    card: '#171513',
                    subtle: '#090807',
                    hover: '#24201d',
                    border: '#36302a',
                    borderSubtle: '#221e1a',
                    textMuted: '#b5a899',
                    textFaint: '#d4af37',
                    headerBg: 'rgba(14, 13, 12, 0.92)',
                    shadow: '#000000'
                  }
                };

                var themeKey = t && themeDefs[t] ? t : 'zinc';
                var cur = themeDefs[themeKey];
                root.style.setProperty('--background', cur.bg);
                root.style.setProperty('--foreground', cur.fg);
                root.style.setProperty('--surface', cur.card);
                root.style.setProperty('--surface-card', cur.card);
                root.style.setProperty('--surface-subtle', cur.subtle);
                root.style.setProperty('--surface-hover', cur.hover);
                root.style.setProperty('--border-color', cur.border);
                root.style.setProperty('--border-subtle', cur.borderSubtle);
                root.style.setProperty('--text-primary', cur.fg);
                root.style.setProperty('--text-muted', cur.textMuted);
                root.style.setProperty('--text-faint', cur.textFaint);
                root.style.setProperty('--header-bg', cur.headerBg);
                root.style.setProperty('--shadow-ink', cur.shadow);
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
