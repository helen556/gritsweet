"use client";
import { useEffect, useRef, useState } from "react";
import { makeGlow, makeStar, PALETTE, prefersReducedMotion, isLowPower } from "./sprites";

const SEEN_KEY = "pl_intro_seen";
const DURATION = 1100; // мс

type P = { x: number; y: number; vx: number; vy: number; size: number; life: number; delay: number; sprite: number; star: boolean; tw: number; depth: number };

/**
 * Одноразовий (за сесію) вступ hero: легка хмаринка зоряного пилу розходиться й відкриває сцену.
 * Прозорий canvas поверх медіа: pointer-events:none, aria-hidden, не блокує кліки й не затримує завантаження.
 */
export default function StardustIntro() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch {}
    if (seen || prefersReducedMotion()) { html.classList.remove("intro-play"); return; }
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
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

    const sprites = [makeGlow(PALETTE.pearl), makeGlow(PALETTE.champagne), makeGlow(PALETTE.gold), makeStar(PALETTE.pearl), makeStar(PALETTE.champagne)];
    const count = Math.round((isLowPower() ? 110 : 220) * Math.min(1, (W * H) / (1280 * 640) + 0.35));
    const cx = W * 0.62, cy = H * 0.5;
    const ps: P[] = [];
    for (let i = 0; i < count; i++) {
      // хмаринка: щільніша в центрі сцени, з різною глибиною
      const a = Math.random() * Math.PI * 2;
      const rr = Math.pow(Math.random(), 0.7) * Math.max(W, H) * 0.55;
      const x = cx + Math.cos(a) * rr * 1.2, y = cy + Math.sin(a) * rr * 0.75;
      const depth = 0.4 + Math.random() * 0.6;
      const star = Math.random() < 0.13;
      const speed = (40 + Math.random() * 110) * depth;
      ps.push({
        x, y, vx: Math.cos(a) * speed + (Math.random() - 0.5) * 20, vy: Math.sin(a) * speed * 0.8 - 12 * Math.random(),
        size: star ? 7 + Math.random() * 7 : (2 + Math.random() * 7) * depth, life: 650 + Math.random() * 450, delay: Math.random() * 180,
        sprite: star ? 3 + (Math.random() < 0.5 ? 0 : 1) : Math.floor(Math.random() * 3), star, tw: Math.random() * Math.PI * 2, depth,
      });
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      // м'яке тепле серпанкове світло, що розсіюється (без суцільного білого екрана)
      const haze = Math.max(0, 1 - t / 700);
      if (haze > 0) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
        g.addColorStop(0, `rgba(255, 248, 232, ${0.42 * haze})`);
        g.addColorStop(1, `rgba(250, 242, 225, ${0.12 * haze})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
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
        const s = p.size * (p.star ? 1 : 2.6);
        ctx.drawImage(sprites[p.sprite], x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (alive > 0 && t < DURATION + 400) raf = requestAnimationFrame(frame);
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
