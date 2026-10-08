"use client";
import { useEffect, useRef } from "react";
import { makeGlow, makeStar, PALETTE, prefersReducedMotion, isLowPower } from "./sprites";

type P = { x: number; y: number; vx: number; vy: number; born: number; life: number; size: number; sprite: number; star: boolean; tw: number };

/**
 * Тонкий слід зоряного пилу за курсором — лише для миші (fine pointer + hover), не для touch.
 * Один fixed canvas: pointer-events:none, aria-hidden; rAF-цикл зупиняється, коли частинок немає або вкладка прихована.
 * Без React setState на pointermove; пул ≤ 70 частинок, адаптивно менше на слабких пристроях.
 */
export default function CursorTrail() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches || prefersReducedMotion()) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.style.display = "block";
    const sprites = [makeGlow(PALETTE.gold, 24), makeGlow(PALETTE.champagne, 24), makeGlow(PALETTE.pearl, 24), makeStar(PALETTE.gold, 32), makeStar(PALETTE.deepGold, 32)];
    let maxP = isLowPower() ? 36 : 70;
    const pool: P[] = [];
    let dpr = 1, W = 0, H = 0;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let lastX = -1, lastY = -1, px = -1, py = -1, raf = 0, running = false, lastFrame = 0, slow = 0, carry = 0;
    const spawn = (x: number, y: number, now: number) => {
      if (pool.length >= maxP) pool.shift();
      const star = Math.random() < 0.16;
      const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 22;
      pool.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 8, born: now, life: 400 + Math.random() * 400,
        size: star ? 6 + Math.random() * 5 : 4 + Math.random() * 6, sprite: star ? 3 + (Math.random() < 0.5 ? 0 : 1) : Math.floor(Math.random() * 3), star, tw: Math.random() * 6,
      });
    };
    const frame = (now: number) => {
      const dt = lastFrame ? Math.min(now - lastFrame, 50) : 16;
      lastFrame = now;
      // адаптивність: якщо кадри повільні — зменшуємо пул
      if (dt > 24) { if (++slow > 20 && maxP > 24) { maxP = Math.max(24, maxP - 10); slow = 0; } } else slow = Math.max(0, slow - 1);
      if (px >= 0 && (px !== lastX || py !== lastY)) {
        const dist = Math.hypot(px - lastX, py - lastY);
        if (lastX >= 0) {
          carry += Math.min(dist / 9, 4);
          while (carry >= 1) { const k = Math.random(); spawn(lastX + (px - lastX) * k, lastY + (py - lastY) * k, now); carry -= 1; }
        }
        lastX = px; lastY = py;
      }
      ctx.clearRect(0, 0, W, H);
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        const age = now - p.born, k = age / p.life;
        if (k >= 1) { pool.splice(i, 1); continue; }
        const s = dt / 1000;
        p.x += p.vx * s; p.y += p.vy * s; p.vx *= 0.96; p.vy *= 0.96;
        const tw = p.star ? 0.65 + 0.35 * Math.sin(p.tw + age / 60) : 1;
        ctx.globalAlpha = (1 - k) * (1 - k) * 0.85 * tw;
        const size = p.size * (1 - k * 0.4);
        ctx.drawImage(sprites[p.sprite], p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      if (pool.length || px !== lastX) raf = requestAnimationFrame(frame);
      else { running = false; lastFrame = 0; }
    };
    const start = () => { if (!running && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX; py = e.clientY;
      start();
    };
    const onLeave = () => { lastX = lastY = px = py = -1; };
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); running = false; pool.length = 0; ctx.clearRect(0, 0, W, H); } };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ display: "none" }} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
