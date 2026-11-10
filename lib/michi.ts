/**
 * Michi Easter Egg Utilities: Sonido de maullido y confeti de alto rendimiento
 */

export function playMichiMeow(): void {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/meow.wav");
    audio.volume = 0.7;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        playSynthMeow();
      });
    }
  } catch {
    playSynthMeow();
  }
}

/**
 * Sintetizador Web Audio API de respaldo por si el navegador bloquea la carga de audio
 */
function playSynthMeow(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const duration = 0.55;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc2.type = "sine";

    // Meow glide: 440 -> 820 -> 440 Hz
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(820, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(440, now + duration);

    osc2.frequency.setValueAtTime(445, now);
    osc2.frequency.linearRampToValueAtTime(825, now + 0.16);
    osc2.frequency.exponentialRampToValueAtTime(445, now + duration);

    filter.type = "bandpass";
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.linearRampToValueAtTime(1450, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(700, now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);
  } catch {}
}

/**
 * Explosión de confeti en pantalla completa a 60 FPS sin dependencias externas
 */
export function triggerMichiConfetti(originX?: number, originY?: number): void {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const startX = originX ?? window.innerWidth / 2;
  const startY = originY ?? 80;

  const colors = [
    "#f59e0b", // Amber
    "#fbbf24", // Yellow
    "#f97316", // Orange
    "#ef4444", // Red
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#ffffff", // White
  ];

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    color: string;
    rotation: number;
    vRot: number;
    alpha: number;
    isCircle: boolean;
  }

  const particles: Particle[] = [];
  const count = 75;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const speed = 4 + Math.random() * 8;
    const vyBias = -3;

    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + vyBias,
      width: 6 + Math.random() * 6,
      height: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      alpha: 1,
      isCircle: Math.random() > 0.65,
    });
  }

  const startTime = performance.now();
  const duration = 2400;

  function frame(now: number) {
    const elapsed = now - startTime;
    if (elapsed > duration || particles.length === 0) {
      canvas.remove();
      return;
    }

    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28; // Gravedad
      p.vx *= 0.98; // Resistencia del aire
      p.vy *= 0.98;
      p.rotation += p.vRot;
      p.alpha = Math.max(0, 1 - elapsed / duration);

      ctx!.save();
      ctx!.globalAlpha = p.alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rotation * Math.PI) / 180);
      ctx!.fillStyle = p.color;

      if (p.isCircle) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.width / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      }
      ctx!.restore();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
