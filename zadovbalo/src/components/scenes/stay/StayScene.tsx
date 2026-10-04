"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { loadImage, useSceneAssets } from "@/lib/scene/assets";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { sound, type LoopHandle } from "@/lib/scene/sound";
import type { SceneProps } from "../types";
import { CANDLE_SOUNDS, Flame, loadCandle } from "../candle/candleKit";

/**
 * «Побудь тут»: теплий куточок. Та сама свічка (спрайт зі свічкової сцени), чашка чаю, дощ на запітнілому вікні.
 * Чашку й вікно намальовано в тому ж освітленні — окремого наданого референсу для них немає.
 * Нічого не потрібно «пройти»: ні балів, ні таймера.
 */
const W = 600;
const H = 1000;
const GLASS = { x: 120, y: 40, w: 420, h: 380 };
const CUP = { cx: 430, by: 752, r: 64, h: 104 };
const CANDLE = { x: 58, by: 766, scale: 0.52 };
const MESSAGE = "Мені сьогодні сумно. Маєш трохи часу побути зі мною на зв’язку?";

async function loadStay() {
  const [candle, plate, wallSrc] = await Promise.all([loadCandle(true), loadImage("/scenes/dishes/plate.webp"), loadImage("/scenes/candle/unlit.webp")]);
  return { candle, plate, wallSrc };
}

export default function StayScene(props: SceneProps) {
  const assets = useSceneAssets(loadStay);
  useEffect(() => sound.preload([...CANDLE_SOUNDS, "rain"]), []);
  if (assets.status === "loading")
    return (
      <div role="status" className="grid h-full place-items-center text-sm text-mist">
        Готую куточок…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити сцену.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <Stay {...props} {...assets.data} />;
}

interface Drop {
  x: number;
  y: number;
  r: number;
  vy: number;
  moving: boolean;
}

function makeOutside(w: number, h: number) {
  // ніч за вікном: темно-синій градієнт і розмиті вогні міста
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "#0d1420");
  gr.addColorStop(0.6, "#172031");
  gr.addColorStop(1, "#211c22");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  // силуети будинків
  g.fillStyle = "#0a0d14";
  let x = 0;
  while (x < w) {
    const bw = 40 + Math.random() * 80;
    const bh = h * (0.25 + Math.random() * 0.35);
    g.fillRect(x, h - bh, bw, bh);
    x += bw + 4;
  }
  for (let i = 0; i < 46; i++) {
    const px = Math.random() * w;
    const py = h * (0.45 + Math.random() * 0.5);
    const r = 3 + Math.random() * 9;
    const warm = Math.random() < 0.7;
    const b = g.createRadialGradient(px, py, 0, px, py, r * 2.2);
    b.addColorStop(0, warm ? "rgba(255,196,120,0.75)" : "rgba(170,200,255,0.6)");
    b.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = b;
    g.fillRect(px - r * 2.2, py - r * 2.2, r * 4.4, r * 4.4);
  }
  const blurred = document.createElement("canvas");
  blurred.width = w;
  blurred.height = h;
  const bg = blurred.getContext("2d")!;
  bg.filter = "blur(10px)";
  bg.drawImage(c, 0, 0);
  bg.filter = "none";
  // запітніле скло: світліше й холодніше
  bg.fillStyle = "rgba(150,160,175,0.35)";
  bg.fillRect(0, 0, w, h);
  // легке зерно конденсату
  const img = bg.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] = img.data[i]! + n;
    img.data[i + 1] = img.data[i + 1]! + n;
    img.data[i + 2] = img.data[i + 2]! + n;
  }
  bg.putImageData(img, 0, 0);
  return { sharp: c, blurred };
}

function Stay({ candle, plate, wallSrc, setHint, onInteract, reducedMotion }: SceneProps & Awaited<ReturnType<typeof loadStay>>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const qId = useId();
  const { canvasRef, size } = useCanvas2D();
  const [isLit, setIsLit] = useState(true);
  const [panel, setPanel] = useState<null | "ask" | "write">(null);
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const flame = useLazyRef(() => {
    const f = new Flame();
    // куточок уже теплий: свічка горить від початку (без звуку займання)
    f.lit = true;
    f.level = 1;
    f.melt = 40;
    return f;
  });
  const glass = useLazyRef(() => {
    const out = makeOutside(GLASS.w, GLASS.h);
    const fog = document.createElement("canvas");
    fog.width = GLASS.w;
    fog.height = GLASS.h;
    const fg = fog.getContext("2d")!;
    fg.fillStyle = "#000";
    fg.fillRect(0, 0, GLASS.w, GLASS.h);
    const tmp = document.createElement("canvas");
    tmp.width = GLASS.w;
    tmp.height = GLASS.h;
    const drops: Drop[] = [];
    for (let i = 0; i < 150; i++) drops.push({ x: Math.random() * GLASS.w, y: Math.random() * GLASS.h, r: 0.8 + Math.random() ** 2 * 3.5, vy: 0, moving: false });
    return { ...out, fog, tmp, drops, regrow: 0 };
  });
  const cup = useLazyRef(() => ({ rot: 0.4, vel: 0, grab: null as null | { id: number; x: number }, slosh: 0 }));
  const wipe = useLazyRef(() => new Map<number, { x: number; y: number }>());
  const steam = useLazyRef(() => [] as { x: number; y: number; age: number; life: number; seed: number }[]);
  const rain = useRef<LoopHandle | null>(null);

  useEffect(() => {
    rain.current = sound.loop("rain", 0.22);
    return () => rain.current?.stop(0.4);
  }, []);

  const view = useCallback(() => {
    const s = Math.min(size.width / W, size.height / H) * (size.width / size.height < W / H ? 1.06 : 1);
    return { s, ox: (size.width - W * s) / 2, oy: (size.height - H * s) / 2 };
  }, [size]);

  /** Скляна поверхня: розмите запітніле поверх чіткого — там, де туман. */
  const drawGlass = useCallback(
    (g: CanvasRenderingContext2D, dt: number) => {
      const gl = glass.current;
      const fg = gl.fog.getContext("2d")!;
      // туман повертається повільно (≈ за 12 с)
      gl.regrow += dt;
      if (gl.regrow > 0.1) {
        fg.globalCompositeOperation = "source-over";
        fg.fillStyle = `rgba(0,0,0,${Math.min(1, gl.regrow * 0.09)})`;
        fg.fillRect(0, 0, GLASS.w, GLASS.h);
        gl.regrow = 0;
      }
      // краплі: частина повільно сповзає, лишаючи чистий слід
      fg.globalCompositeOperation = "destination-out";
      for (const d of gl.drops) {
        if (!d.moving && d.r > 2.6 && Math.random() < dt * 0.06) d.moving = true;
        if (d.moving) {
          d.vy = Math.min(70, d.vy + dt * 60);
          d.y += d.vy * dt * (0.6 + Math.random() * 0.8);
          d.x += (Math.random() - 0.5) * 0.6;
          fg.fillStyle = "rgba(0,0,0,0.5)";
          fg.beginPath();
          fg.arc(d.x, d.y - d.r, d.r * 0.8, 0, Math.PI * 2);
          fg.fill();
          if (d.y > GLASS.h + 8) {
            d.y = -5;
            d.x = Math.random() * GLASS.w;
            d.r = 0.8 + Math.random() ** 2 * 3.5;
            d.vy = 0;
            d.moving = false;
          }
        }
      }
      // нові краплі з дощу
      if (Math.random() < dt * 6) gl.drops[Math.floor(Math.random() * gl.drops.length)]!.r = 0.8 + Math.random() ** 2 * 3.5;
      fg.globalCompositeOperation = "source-over";

      g.drawImage(gl.sharp, GLASS.x, GLASS.y);
      const tg = gl.tmp.getContext("2d")!;
      tg.globalCompositeOperation = "copy";
      tg.drawImage(gl.blurred, 0, 0);
      tg.globalCompositeOperation = "destination-in";
      tg.drawImage(gl.fog, 0, 0);
      tg.globalCompositeOperation = "source-over";
      g.drawImage(gl.tmp, GLASS.x, GLASS.y);
      // краплі: темніший низ, світлий відблиск угорі
      for (const d of gl.drops) {
        const x = GLASS.x + d.x;
        const y = GLASS.y + d.y;
        const gr = g.createRadialGradient(x - d.r * 0.3, y - d.r * 0.4, 0, x, y, d.r * 1.2);
        gr.addColorStop(0, "rgba(230,235,245,0.55)");
        gr.addColorStop(0.5, "rgba(120,130,150,0.18)");
        gr.addColorStop(1, "rgba(10,12,18,0.35)");
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(x, y, d.r, d.r * (d.moving ? 1.3 : 1), 0, 0, Math.PI * 2);
        g.fill();
      }
    },
    [glass],
  );

  /** Чашка: керамічний циліндр із фактурою тієї ж кераміки, що й тарілка; ручка обертається разом. */
  const drawCup = useCallback(
    (g: CanvasRenderingContext2D, light: number, t: number) => {
      const c = cup.current;
      const { cx, by, r, h } = CUP;
      const ry = r * 0.3;
      const top = by - h;
      const lightAng = -1.0; // світло зліва (від свічки)
      // тінь
      const sh = g.createRadialGradient(cx + 14, by + 4, 0, cx + 14, by + 4, r * 1.6);
      sh.addColorStop(0, "rgba(0,0,0,0.55)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sh;
      g.beginPath();
      g.ellipse(cx + 14, by + 4, r * 1.6, ry * 1.4, 0, 0, Math.PI * 2);
      g.fill();
      const handleAng = c.rot + Math.PI / 2;
      const hz = Math.cos(handleAng);
      const drawHandle = () => {
        const hx = cx + Math.sin(handleAng) * (r + 16);
        const hw = 6 + 20 * Math.abs(Math.sin(handleAng));
        const shade = 0.35 + 0.65 * Math.max(0, Math.cos(handleAng - lightAng)) * light;
        g.save();
        g.lineWidth = 11;
        g.strokeStyle = `rgb(${Math.round(205 * shade + 20)},${Math.round(192 * shade + 16)},${Math.round(166 * shade + 12)})`;
        g.beginPath();
        g.ellipse(hx, top + h * 0.45, hw, h * 0.26, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      };
      if (hz < 0) drawHandle();
      // тіло: вертикальні смужки з фактурою й ламбертівським світлом
      const N = 36;
      const texW = plate.naturalWidth * 0.6;
      for (let i = 0; i < N; i++) {
        const a0 = -Math.PI / 2 + (Math.PI * i) / N;
        const a1 = -Math.PI / 2 + (Math.PI * (i + 1)) / N;
        const x0 = cx + Math.sin(a0) * r;
        const x1 = cx + Math.sin(a1) * r;
        const am = (a0 + a1) / 2;
        const u = ((((am + c.rot) / (Math.PI * 2)) % 1) + 1) % 1;
        const sx = 40 + u * (texW - 4);
        g.drawImage(plate, sx, 60, 3, 160, x0, top, Math.max(0.6, x1 - x0 + 0.5), h);
        const lam = Math.max(0, Math.cos(am - lightAng));
        const dark = 1 - (0.18 + 0.72 * lam * light);
        g.fillStyle = `rgba(16,10,8,${Math.max(0, dark) * 0.9})`;
        g.fillRect(x0, top, x1 - x0 + 0.5, h);
      }
      // донце (заокруглення знизу)
      g.save();
      g.beginPath();
      g.ellipse(cx, by, r, ry, 0, 0, Math.PI);
      g.lineTo(cx - r, by - 2);
      g.closePath();
      g.fillStyle = "rgba(20,14,12,0.6)";
      g.fill();
      g.restore();
      // вінце й чай
      g.save();
      g.beginPath();
      g.ellipse(cx, top, r, ry, 0, 0, Math.PI * 2);
      g.fillStyle = `rgb(${Math.round(150 + 80 * light)},${Math.round(138 + 70 * light)},${Math.round(116 + 56 * light)})`;
      g.fill();
      g.beginPath();
      g.ellipse(cx, top + 4, r - 5, ry - 3, 0, 0, Math.PI * 2);
      g.clip();
      const tilt = Math.sin(t * 5) * c.slosh;
      const tea = g.createLinearGradient(cx - r, top, cx + r, top + ry);
      tea.addColorStop(0, `rgba(${Math.round(110 + 60 * light)},${Math.round(56 + 30 * light)},18,1)`);
      tea.addColorStop(1, "rgba(40,18,8,1)");
      g.fillStyle = tea;
      g.fillRect(cx - r, top - ry, r * 2, ry * 3);
      // відбиток полумʼя на поверхні чаю
      g.globalCompositeOperation = "lighter";
      g.fillStyle = `rgba(255,200,130,${0.4 * light * flame.current.flicker()})`;
      g.beginPath();
      g.ellipse(cx - r * 0.35 + tilt * 8, top + 4, r * 0.14, ry * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (hz >= 0) drawHandle();
    },
    [cup, plate, flame],
  );

  const wake = useFrameLoop(rootRef, (dt, now) => {
    const g = canvasRef.current?.getContext("2d");
    if (!g || !size.width) return false;
    const t = now / 1000;
    const f = flame.current;
    f.update(dt);
    const c = cup.current;
    if (!c.grab) {
      c.rot += c.vel * dt;
      c.vel *= Math.exp(-dt * 2.5);
    }
    c.slosh *= Math.exp(-dt * 1.6);
    // пара над чашкою
    const st = steam.current;
    if (!reducedMotion && Math.random() < dt * 9 && st.length < 40) st.push({ x: CUP.cx + (Math.random() - 0.5) * 30, y: CUP.by - CUP.h, age: 0, life: 2.5 + Math.random() * 2, seed: Math.random() * 10 });
    for (const p of st) {
      p.age += dt;
      p.y -= 22 * dt;
      p.x += Math.sin(p.age * 1.7 + p.seed) * 9 * dt;
    }
    steam.current = st.filter((p) => p.age < p.life);

    const light = Math.max(0.15, f.level * f.flicker());
    const { s, ox, oy } = view();
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.fillStyle = "#0c0908";
    g.fillRect(0, 0, size.width, size.height);
    g.save();
    g.translate(ox, oy);
    g.scale(s, s);
    // стіна — та сама тепла темрява, що й у свічки (з гілочкою ліворуч)
    g.drawImage(wallSrc, 0, 0, 630, 300, -20, 0, W + 40, 540);
    g.fillStyle = "rgba(12,9,8,0.35)";
    g.fillRect(0, 0, W, 540);
    // вікно: рама, скло, підвіконня
    g.fillStyle = "#1c130f";
    g.fillRect(GLASS.x - 16, GLASS.y - 16, GLASS.w + 32, GLASS.h + 32);
    drawGlass(g, dt);
    g.strokeStyle = "#1c130f";
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(GLASS.x + GLASS.w / 2, GLASS.y);
    g.lineTo(GLASS.x + GLASS.w / 2, GLASS.y + GLASS.h);
    g.moveTo(GLASS.x, GLASS.y + GLASS.h * 0.42);
    g.lineTo(GLASS.x + GLASS.w, GLASS.y + GLASS.h * 0.42);
    g.stroke();
    g.fillStyle = "#2a1c15";
    g.fillRect(GLASS.x - 30, GLASS.y + GLASS.h + 14, GLASS.w + 60, 18);
    // стіл — мармур зі свічкової сцени
    g.drawImage(wallSrc, 0, 700, 630, 136, -20, 530, W + 40, H - 530);
    const tableShade = g.createLinearGradient(0, 530, 0, H);
    tableShade.addColorStop(0, "rgba(10,8,7,0.7)");
    tableShade.addColorStop(0.3, "rgba(10,8,7,0.1)");
    tableShade.addColorStop(1, "rgba(10,8,7,0.5)");
    g.fillStyle = tableShade;
    g.fillRect(0, 530, W, H - 530);

    // свічка
    const cs = CANDLE.scale;
    const spr = candle.meta.sprite;
    const sx = CANDLE.x;
    const sy = CANDLE.by - spr.h * cs;
    g.drawImage(candle.unlit, sx, sy, spr.w * cs, spr.h * cs);
    g.globalAlpha = Math.min(1, f.level * f.flicker());
    g.drawImage(candle.lit, sx, sy, spr.w * cs, spr.h * cs);
    g.globalAlpha = 1;
    const map = (p: [number, number]): [number, number] => [sx + (p[0] - spr.x) * cs, sy + (p[1] - spr.y) * cs];
    const tip = map(candle.meta.wick.tip);
    f.drawPool(g, candle.meta.top, cs, sx - spr.x * cs, sy - spr.y * cs);
    f.drawWick(g, map(candle.meta.wick.base), tip, cs, f.lit ? 0.7 : 0);

    drawCup(g, light, t);
    // пара
    g.save();
    g.lineCap = "round";
    for (const p of steam.current) {
      const a = Math.sin((p.age / p.life) * Math.PI) * 0.07;
      g.strokeStyle = `rgba(235,230,225,${a})`;
      g.lineWidth = 6 + p.age * 6;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x + Math.sin(p.age * 3 + p.seed) * 3, p.y - 6);
      g.stroke();
    }
    g.restore();

    // тепле світло свічки на кімнаті: темніше далі від полумʼя
    g.save();
    g.globalCompositeOperation = "multiply";
    const lx = tip[0] + f.sway() * 6;
    const lg = g.createRadialGradient(lx, tip[1], 10, lx, tip[1], 700);
    const k = Math.max(0.12, f.level * f.flicker());
    lg.addColorStop(0, `rgb(${Math.round(255)},${Math.round(225 + 20 * (1 - k))},${Math.round(190 + 50 * (1 - k))})`);
    lg.addColorStop(0.35, `rgb(${Math.round(150 + 80 * k)},${Math.round(120 + 70 * k)},${Math.round(110 + 50 * k)})`);
    lg.addColorStop(1, `rgb(${Math.round(70 + 40 * k)},${Math.round(64 + 30 * k)},${Math.round(72 + 20 * k)})`);
    g.fillStyle = lg;
    g.fillRect(-W, -H, W * 3, H * 3);
    g.restore();
    f.draw(g, tip[0], tip[1] + 1, cs * 0.9);
    f.drawSmoke(g, cs);
    g.restore();
    return true;
  });

  useEffect(() => {
    wake();
  }, [size, wake]);

  const toScene = (px: number, py: number) => {
    const { s, ox, oy } = view();
    return [(px - ox) / s, (py - oy) / s] as const;
  };

  usePointer(rootRef, {
    down: (p) => {
      const [x, y] = toScene(p.x, p.y);
      onInteract();
      // чашка: притримати / повернути
      if (Math.abs(x - CUP.cx) < CUP.r + 34 && y > CUP.by - CUP.h - 30 && y < CUP.by + 20) {
        cup.current.grab = { id: p.id, x };
        cup.current.vel = 0;
        return;
      }
      // скло: провести пальцем по туману
      if (x > GLASS.x && x < GLASS.x + GLASS.w && y > GLASS.y && y < GLASS.y + GLASS.h) {
        wipe.current.set(p.id, { x: x - GLASS.x, y: y - GLASS.y });
        rub(x - GLASS.x, y - GLASS.y, x - GLASS.x, y - GLASS.y);
        return;
      }
      return false;
    },
    move: (p) => {
      const [x, y] = toScene(p.x, p.y);
      const c = cup.current;
      if (c.grab?.id === p.id) {
        const dx = x - c.grab.x;
        c.rot += dx / CUP.r;
        c.vel = (dx / CUP.r) * 60;
        c.slosh = Math.min(1, c.slosh + Math.abs(dx) * 0.02);
        c.grab.x = x;
        return;
      }
      const w = wipe.current.get(p.id);
      if (w) {
        const nx = x - GLASS.x;
        const ny = y - GLASS.y;
        rub(w.x, w.y, nx, ny);
        wipe.current.set(p.id, { x: nx, y: ny });
      }
    },
    up: (p) => {
      if (cup.current.grab?.id === p.id) cup.current.grab = null;
      wipe.current.delete(p.id);
    },
  });

  /** Слід пальця на запітнілому склі (поступово затягується знову). */
  const rub = (x0: number, y0: number, x1: number, y1: number) => {
    const fg = glass.current.fog.getContext("2d")!;
    fg.save();
    fg.globalCompositeOperation = "destination-out";
    fg.lineCap = "round";
    fg.lineJoin = "round";
    fg.strokeStyle = "rgba(0,0,0,0.85)";
    fg.lineWidth = 30;
    fg.shadowColor = "rgba(0,0,0,1)";
    fg.shadowBlur = 10;
    fg.beginPath();
    fg.moveTo(x0, y0);
    fg.lineTo(x1 + 0.01, y1);
    fg.stroke();
    fg.restore();
  };

  const toggleCandle = () => {
    onInteract();
    const f = flame.current;
    if (f.lit) {
      const spr = candle.meta.sprite;
      const cs = CANDLE.scale;
      const sy = CANDLE.by - spr.h * cs;
      f.extinguish(CANDLE.x + (candle.meta.wick.tip[0] - spr.x) * cs, sy + (candle.meta.wick.tip[1] - spr.y) * cs);
      setIsLit(false);
    } else {
      f.ignite();
      setIsLit(true);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MESSAGE);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  const share = async () => {
    try {
      await navigator.share?.({ text: MESSAGE });
    } catch {
      // людина закрила меню — нічого не сталося
    }
  };

  useEffect(() => {
    if (panel === "write") setHint("Нічого не надсилається саме: ти обираєш, кому й чи взагалі.");
  }, [panel, setHint]);

  return (
    <div ref={rootRef} className="scene-surface relative h-full w-full overflow-hidden" style={{ touchAction: "none", background: "#0c0908" }}>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {panel && (
        <div className="absolute inset-x-2 bottom-14 z-20 mx-auto max-w-md rounded-[10px] border border-steel/50 bg-night/92 p-4 text-left text-sm text-frost shadow-xl" role="dialog" aria-label={panel === "ask" ? "Чого бракує" : "Написати близькій людині"}>
          {panel === "ask" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={qId} className="text-frost/90">
                Чого тобі зараз найбільше бракує?
              </label>
              <textarea id={qId} rows={2} maxLength={200} value={answer} onChange={(e) => setAnswer(e.target.value)} className="w-full resize-none rounded-[var(--radius-hair)] border border-steel/55 bg-abyss/80 px-3 py-2 text-frost" />
              <p className="text-xs text-mist">Лишається тільки на цьому екрані. Нікуди не надсилається.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className="scene-btn border border-steel/50">
                  {answer.trim() ? "Готово" : "Пропустити"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-frost/90">Можна скопіювати й надіслати, кому захочеш:</p>
              <p className="rounded-[var(--radius-hair)] border border-steel/40 bg-abyss/70 px-3 py-2 select-all">{MESSAGE}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={copy} className="scene-btn border border-steel/50">
                  {copied === "ok" ? "Скопійовано" : "Скопіювати"}
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button type="button" onClick={share} className="scene-btn border border-steel/50">
                    Поділитися…
                  </button>
                )}
                <button type="button" onClick={() => setPanel(null)} className="scene-btn border border-steel/50">
                  Закрити
                </button>
              </div>
              {copied === "fail" && <p className="text-xs text-mist">Не вдалося скопіювати — виділи текст і скопіюй вручну.</p>}
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-2 px-2">
        <button type="button" onClick={toggleCandle} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
          {isLit ? "Загасити свічку" : "Запалити свічку"}
        </button>
        <button type="button" onClick={() => setPanel(panel === "ask" ? null : "ask")} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
          Чого бракує?
        </button>
        <button type="button" onClick={() => setPanel(panel === "write" ? null : "write")} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
          Написати близькій людині
        </button>
      </div>
    </div>
  );
}
