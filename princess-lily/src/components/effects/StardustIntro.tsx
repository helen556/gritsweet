"use client";
import { useEffect, useRef, useState } from "react";
import { makeGlow, makeStar, makePuff, PALETTE, prefersReducedMotion, isLowPower } from "./sprites";

const SEEN_KEY = "pl_intro_seen";
const DURATION = 1100; // мс

type P = { x: number; y: number; vx: number; vy: number; size: number; life: number; delay: number; sprite: number; star: boolean; tw: number; depth: number };

/**
 * Одноразовий (за сесію) вступ hero: легка хмаринка зоряного пилу розходиться й відкриває сцену.
 * Прозорий canvas поверх медіа: pointer-events:none, aria-hidden, не блокує кліки й не затримує завантаження.
 */
// Рішення приймається один раз на завантаження сторінки (стійко до подвійного запуску ефектів у StrictMode)
let decided: boolean | null = null;
function shouldPlay(): boolean {
  if (decided !== null) return decided;
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch {}
  decided = !seen && !prefersReducedMotion();
  if (decided) { try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {} }
  return decided;
}

export default function StardustIntro() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (!shouldPlay()) { html.classList.remove("intro-play"); return; }
    html.classList.add("intro-play");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- запуск одноразового ефекту після перевірки sessionStorage
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sprites = [makeGlow(PALETTE.pearl, 48), makeGlow(PALETTE.champagne, 48), makeGlow(PALETTE.gold, 48), makeStar(PALETTE.pearl, 56), makeStar(PALETTE.champagne, 56)];
    // Велика м'яка «хмаринка» — напівпрозорі плями, що розходяться (не суцільний екран)
    const puff = makePuff();
    const low = isLowPower();
    const area = Math.min(1.3, Math.max(0.8, (W * H) / (900 * 506)));
    const cx = W * 0.5, cy = H * 0.5;
    type Cloud = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    const clouds: Cloud[] = [];
    for (let i = 0, n = Math.round((low ? 20 : 30) * area); i < n; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
      const sp = 60 + Math.random() * 120;
      clouds.push({ x, y, vx: (dx / d) * sp, vy: (dy / d) * sp * 0.7, r: (60 + Math.random() * 100) * Math.sqrt(area), a: 0.45 + Math.random() * 0.3 });
    }
    const ps: P[] = [];
    for (let i = 0, n = Math.round((low ? 150 : 300) * area); i < n; i++) {
      // пил щільніший у центрі сцени, з різною глибиною
      const x = cx + (Math.random() - 0.5) * W * 1.05, y = cy + (Math.random() - 0.5) * H * 1.05;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
      const depth = 0.4 + Math.random() * 0.6;
      const star = Math.random() < 0.1;
      const speed = (50 + Math.random() * 140) * depth;
      ps.push({
        x, y, vx: (dx / d) * speed + (Math.random() - 0.5) * 30, vy: (dy / d) * speed * 0.8 - 18 * Math.random(),
        size: star ? 14 + Math.random() * 12 : (4 + Math.random() * 9) * depth, life: 650 + Math.random() * 450, delay: Math.random() * 90,
        sprite: star ? 3 + (Math.random() < 0.5 ? 0 : 1) : Math.random() < 0.35 ? 2 : Math.floor(Math.random() * 2), star, tw: Math.random() * Math.PI * 2, depth,
      });
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      // хмаринка: плями розходяться від центру й тануть за ~0.9 с
      const ck = Math.min(t / 900, 1);
      if (ck < 1) {
        const e = 1 - Math.pow(1 - ck, 2);
        for (const c of clouds) {
          ctx.globalAlpha = c.a * Math.pow(1 - ck, 1.6);
          const r = c.r * (1 + 0.35 * e);
          ctx.drawImage(puff, c.x + c.vx * e - r, c.y + c.vy * e - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "screen"; // світні частинки поверх сцени
      let alive = 0;
      for (const p of ps) {
        const lt = t - p.delay;
        if (lt < 0) { alive++; continue; }
        const k = lt / p.life;
        if (k >= 1) continue;
        alive++;
        const ease = 1 - Math.pow(1 - Math.min(lt / 1000, 1), 2);
        const x = p.x + p.vx * ease, y = p.y + p.vy * ease;
        const twinkle = p.star ? 0.6 + 0.4 * Math.sin(p.tw + lt / 70) : 1;
        ctx.globalAlpha = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * twinkle * (0.55 + 0.45 * p.depth);
        const s = p.size * (p.star ? 1 : 2.4);
        // золоті частинки — звичайне накладання, щоб читалися й на світлих ділянках
        ctx.globalCompositeOperation = p.sprite === 2 ? "source-over" : "screen";
        ctx.drawImage(sprites[p.sprite], x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if ((alive > 0 || ck < 1) && t < DURATION + 400) raf = requestAnimationFrame(frame);
      else finish();
    };
    const finish = () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, W, H);
      setActive(false);
      window.setTimeout(() => document.documentElement.classList.remove("intro-play"), 300);
    };
    const onVis = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, [active]);

  if (!active) return null;
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full" />;
}
