"use client";

import { useEffect, useRef, useState } from "react";
import { hash2 } from "@/lib/scene/heightfield";
import { peel, roundedRect, type Pt } from "@/lib/scene/geometry";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

type Phase = "stuck" | "loose" | "ball";

interface Sticker {
  id: number;
  text: string;
  lines: string[];
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
  color: [number, number, number];
  poly: Pt[];
  phase: Phase;
  /** Точка захоплення і поточна «витягнута» точка (локальні координати). */
  anchor: Pt | null;
  pull: Pt;
  target: Pt;
  peeled: number;
  /** Вільна наліпка / кулька. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  held: boolean;
  crumple: number;
  crumpling: boolean;
  ballShape: number[];
}

const COLORS: [number, number, number][] = [
  [226, 230, 228],
  [199, 214, 216],
  [214, 222, 211],
  [232, 221, 205],
  [206, 212, 224],
];
const EDGE_GRAB = 30;
const RESIST = 0.62;
const DETACH_AT = 0.9;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export default function StickersScene({ input, reducedMotion, setHint, onSettled }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [list, setList] = useState<{ id: number; text: string; phase: Phase }[]>([]);
  const st = useRef({
    stickers: [] as Sticker[],
    pane: { x: 0, y: 0, w: 1, h: 1 },
    shelfY: 0,
    w: 1,
    h: 1,
    dpr: 1,
    light: 0,
    grab: null as null | { id: number; pointer: number; startX: number; startY: number; moved: number },
    dirty: true,
  });
  const labels = input.labels?.length ? input.labels : ["«Не драматизуй»", "«Тобі здалося»", "«Ти перебільшуєш»"];

  const sync = () => setList(st.current.stickers.map((s) => ({ id: s.id, text: s.text, phase: s.phase })));

  // Розкладка наліпок на склі.
  const layout = (ctx: CanvasRenderingContext2D, first: boolean) => {
    const s = st.current;
    const root = rootRef.current!;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const dpr = detectQuality().dpr;
    const c = canvasRef.current!;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const shelf = Math.min(90, h * 0.16);
    const margin = Math.max(14, w * 0.04);
    const pane = { x: margin, y: 8, w: w - margin * 2, h: h - shelf - 16 };
    const sx = s.w > 1 ? pane.w / s.pane.w : 1;
    const sy = s.h > 1 ? pane.h / s.pane.h : 1;
    if (!first) {
      for (const k of s.stickers) {
        k.cx = pane.x + (k.cx - s.pane.x) * sx;
        k.cy = pane.y + (k.cy - s.pane.y) * sy;
        k.x = pane.x + (k.x - s.pane.x) * sx;
        k.y = Math.min(k.y * sy, h - 10);
      }
    }
    Object.assign(s, { w, h, dpr, pane, shelfY: h - shelf / 2 });
    if (!first) return;
    const fs = Math.max(17, Math.min(22, w / 20));
    ctx.font = `italic 500 ${fs}px ${getComputedStyle(document.body).getPropertyValue("--font-display") || "serif"}`;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    s.stickers = labels.slice(0, 8).map((text, id) => {
      const maxW = Math.min(pane.w * 0.62, 220);
      const lines = wrap(ctx, text, maxW - 36);
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const sw = Math.max(110, tw + 44);
      const sh = lines.length * fs * 1.25 + 40;
      let best = { x: pane.x + pane.w / 2, y: pane.y + pane.h / 2 };
      let bestOverlap = Infinity;
      for (let t = 0; t < 60; t++) {
        const x = pane.x + sw / 2 + 10 + hash2(id * 7 + t, 3) * Math.max(1, pane.w - sw - 20);
        const y = pane.y + sh / 2 + 14 + hash2(id * 13 + t, 9) * Math.max(1, pane.h - sh - 28);
        const ov = placed.reduce((acc, p) => acc + Math.max(0, Math.min(x + sw / 2, p.x + p.w / 2) - Math.max(x - sw / 2, p.x - p.w / 2)) * Math.max(0, Math.min(y + sh / 2, p.y + p.h / 2) - Math.max(y - sh / 2, p.y - p.h / 2)), 0);
        if (ov < bestOverlap) {
          bestOverlap = ov;
          best = { x, y };
          if (ov === 0) break;
        }
      }
      placed.push({ ...best, w: sw, h: sh });
      const poly = roundedRect(sw, sh, 10);
      return {
        id,
        text,
        lines,
        cx: best.x,
        cy: best.y,
        w: sw,
        h: sh,
        rot: (hash2(id, 1) - 0.5) * 0.22,
        color: COLORS[id % COLORS.length]!,
        poly,
        phase: "stuck" as Phase,
        anchor: null,
        pull: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
        peeled: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        spin: 0,
        angle: 0,
        held: false,
        crumple: 0,
        crumpling: false,
        ballShape: Array.from({ length: 13 }, (_, i) => 0.78 + hash2(id, i) * 0.3),
      };
    });
    sync();
  };

  const toLocal = (k: Sticker, x: number, y: number): Pt => {
    const dx = x - k.cx;
    const dy = y - k.cy;
    const c = Math.cos(-k.rot);
    const sn = Math.sin(-k.rot);
    return { x: dx * c - dy * sn, y: dx * sn + dy * c };
  };

  const draw = () => {
    const s = st.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { w, h, pane, dpr } = s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // За склом: світло, що відкривається з кожною знятою наліпкою.
    const glow = 0.12 + 0.75 * s.light;
    const g = ctx.createRadialGradient(pane.x + pane.w * 0.55, pane.y + pane.h * 0.3, 10, pane.x + pane.w * 0.55, pane.y + pane.h * 0.35, Math.max(pane.w, pane.h) * 0.85);
    g.addColorStop(0, `rgba(216, 200, 175, ${glow})`);
    g.addColorStop(0.35, `rgba(150, 175, 185, ${glow * 0.55})`);
    g.addColorStop(1, "rgba(17, 28, 38, 0.95)");
    ctx.fillStyle = "#0d1820";
    ctx.fillRect(pane.x, pane.y, pane.w, pane.h);
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, pane.y, pane.w, pane.h);

    // Скло: легкий холодний тон і відблиски.
    ctx.fillStyle = "rgba(110, 154, 156, 0.07)";
    ctx.fillRect(pane.x, pane.y, pane.w, pane.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.w, pane.h);
    ctx.clip();
    for (const [o, a] of [
      [0.18, 0.06],
      [0.32, 0.035],
      [0.78, 0.04],
    ] as const) {
      const x0 = pane.x + pane.w * o;
      const sg = ctx.createLinearGradient(x0, pane.y, x0 + pane.w * 0.18, pane.y + pane.h);
      sg.addColorStop(0, `rgba(231,235,237,0)`);
      sg.addColorStop(0.5, `rgba(231,235,237,${a})`);
      sg.addColorStop(1, `rgba(231,235,237,0)`);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(x0, pane.y);
      ctx.lineTo(x0 + pane.w * 0.08, pane.y);
      ctx.lineTo(x0 + pane.w * 0.08 - pane.h * 0.5, pane.y + pane.h);
      ctx.lineTo(x0 - pane.h * 0.5, pane.y + pane.h);
      ctx.fill();
    }

    // Наліпки на склі.
    for (const k of s.stickers) {
      if (k.phase !== "stuck") {
        // Чисте скло на місці знятої наліпки — трохи світліше.
        drawPatch(ctx, k);
        continue;
      }
      const res = k.anchor ? peel(k.poly, k.anchor, k.pull) : { stuck: k.poly, flap: [] as Pt[], fold: null, peeledFraction: 0 };
      ctx.save();
      ctx.translate(k.cx, k.cy);
      ctx.rotate(k.rot);
      if (res.flap.length) {
        // Чисте скло, що відкрилося під клапаном.
        ctx.save();
        ctx.fillStyle = `rgba(231,235,237,0.06)`;
        fillPoly(ctx, k.poly);
        ctx.restore();
      }
      // Приклеєна частина.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      const [r, gg, b] = k.color;
      const face = ctx.createLinearGradient(-k.w / 2, -k.h / 2, k.w / 2, k.h / 2);
      face.addColorStop(0, `rgb(${r + 8},${gg + 8},${b + 8})`);
      face.addColorStop(1, `rgb(${r - 18},${gg - 16},${b - 14})`);
      ctx.fillStyle = face;
      fillPoly(ctx, res.stuck);
      ctx.restore();
      ctx.save();
      clipPoly(ctx, res.stuck);
      drawText(ctx, k, false);
      ctx.restore();
      // Клапан: тінь, зворотний бік, відблиск на згині.
      if (res.flap.length && res.fold) {
        const { m, n } = res.fold;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = -n.x * 6 + 2;
        ctx.shadowOffsetY = -n.y * 6 + 6;
        const back = ctx.createLinearGradient(m.x, m.y, m.x - n.x * Math.max(k.w, k.h), m.y - n.y * Math.max(k.w, k.h));
        back.addColorStop(0, "rgb(246,247,246)");
        back.addColorStop(0.12, "rgb(214,219,218)");
        back.addColorStop(1, "rgb(168,176,178)");
        ctx.fillStyle = back;
        fillPoly(ctx, res.flap);
        ctx.restore();
        ctx.save();
        clipPoly(ctx, res.flap);
        // Чорнило з того боку ледь просвічує дзеркально.
        ctx.globalAlpha = 0.09;
        ctx.translate(m.x, m.y);
        const ang = Math.atan2(n.y, n.x);
        ctx.rotate(ang);
        ctx.scale(-1, 1);
        ctx.rotate(-ang);
        ctx.translate(-m.x, -m.y);
        drawText(ctx, k, true);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "rgba(90,105,110,0.5)";
        ctx.lineWidth = 0.8;
        strokePoly(ctx, res.flap);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();

    // Рама.
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1b2b37";
    ctx.strokeRect(pane.x - 3, pane.y - 3, pane.w + 6, pane.h + 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(159,176,186,0.35)";
    ctx.strokeRect(pane.x + 0.5, pane.y + 0.5, pane.w - 1, pane.h - 1);

    // Полиця.
    const sy = s.shelfY;
    const shelf = ctx.createLinearGradient(0, sy + 18, 0, sy + 30);
    shelf.addColorStop(0, "#2b3f4d");
    shelf.addColorStop(1, "#122029");
    ctx.fillStyle = shelf;
    ctx.fillRect(pane.x - 6, sy + 18, pane.w + 12, 10);

    // Зняті наліпки й кульки — поверх.
    for (const k of s.stickers) if (k.phase !== "stuck") drawLoose(ctx, k);
  };

  const drawPatch = (ctx: CanvasRenderingContext2D, k: Sticker) => {
    ctx.save();
    ctx.translate(k.cx, k.cy);
    ctx.rotate(k.rot);
    ctx.fillStyle = "rgba(231,235,237,0.05)";
    fillPoly(ctx, k.poly);
    ctx.restore();
  };

  const drawText = (ctx: CanvasRenderingContext2D, k: Sticker, ghost: boolean) => {
    const fs = Math.max(17, Math.min(22, st.current.w / 20));
    ctx.font = `italic 500 ${fs}px ${getComputedStyle(document.body).getPropertyValue("--font-display") || "serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ghost ? "#1d2a33" : "#1d2a33";
    const lh = fs * 1.25;
    k.lines.forEach((line, i) => ctx.fillText(line, 0, (i - (k.lines.length - 1) / 2) * lh));
  };

  const drawLoose = (ctx: CanvasRenderingContext2D, k: Sticker) => {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.angle);
    const t = k.crumple;
    const scale = 1 - 0.45 * t;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = k.held ? 22 : 8;
    ctx.shadowOffsetY = k.held ? 16 : 4;
    // Від аркуша до кульки: точки контуру зсуваються до нерівного кола.
    const R = Math.max(k.w, k.h) * 0.4;
    const shape = k.poly.map((p, i) => {
      const ang = Math.atan2(p.y, p.x);
      const j = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 13) % 13;
      const rr = R * k.ballShape[j]!;
      return { x: (p.x * (1 - t) + Math.cos(ang) * rr * t) * scale + (t ? Math.sin(i * 1.7) * 2 * t : 0), y: (p.y * (1 - t) + Math.sin(ang) * rr * t) * scale };
    });
    const [r, g, b] = k.color;
    const grad = ctx.createRadialGradient(-R * 0.3 * scale, -R * 0.35 * scale, 2, 0, 0, R * 1.3);
    grad.addColorStop(0, `rgb(${Math.min(255, r + 20)},${Math.min(255, g + 20)},${Math.min(255, b + 20)})`);
    grad.addColorStop(1, `rgb(${r - 60},${g - 55},${b - 50})`);
    ctx.fillStyle = t > 0 ? grad : `rgb(${r},${g},${b})`;
    fillPoly(ctx, shape);
    ctx.shadowColor = "transparent";
    if (t < 0.6) {
      ctx.save();
      clipPoly(ctx, shape);
      ctx.globalAlpha = 1 - t / 0.6;
      ctx.scale(scale, scale);
      drawText(ctx, k, false);
      ctx.restore();
    }
    // Заломи.
    if (t > 0) {
      ctx.save();
      clipPoly(ctx, shape);
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const a = hash2(k.id, i + 20) * Math.PI * 2;
        const l = R * (0.4 + hash2(k.id, i + 40) * 0.8) * scale;
        const ox = (hash2(k.id, i + 60) - 0.5) * R * scale;
        const oy = (hash2(k.id, i + 80) - 0.5) * R * scale;
        ctx.strokeStyle = `rgba(${i % 2 ? "255,255,255" : "20,30,36"},${0.35 * t})`;
        ctx.beginPath();
        ctx.moveTo(ox - Math.cos(a) * l * 0.5, oy - Math.sin(a) * l * 0.5);
        ctx.lineTo(ox + Math.cos(a) * l * 0.5, oy + Math.sin(a) * l * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  const updateLight = () => {
    const s = st.current;
    const gone = s.stickers.filter((k) => k.phase !== "stuck").length;
    const partial = s.stickers.reduce((acc, k) => acc + (k.phase === "stuck" ? k.peeled * 0.5 : 0), 0);
    return (gone + partial) / Math.max(1, s.stickers.length);
  };

  const detach = (k: Sticker, x: number, y: number, held = false) => {
    k.phase = "loose";
    k.held = held;
    k.x = x;
    k.y = y;
    k.angle = k.rot;
    k.vx = k.vy = 0;
    k.anchor = null;
    sound.play("peel", 0.8);
    haptic(12);
    sync();
    const s = st.current;
    if (s.stickers.every((q) => q.phase !== "stuck")) {
      setHint("Скло чисте. Можна змʼяти, що лишилось.");
      onSettled();
    } else setHint("Відклеїлась. Торкнись — і змʼяти.");
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    let busy = false;
    for (const k of s.stickers) {
      if (k.phase === "stuck" && k.anchor) {
        // Опір: клапан наздоганяє палець з обмеженою швидкістю.
        const dx = k.target.x - k.pull.x;
        const dy = k.target.y - k.pull.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.3) {
          const maxStep = (reducedMotion ? 2000 : 700) * dt;
          const stepK = Math.min(1, maxStep / dist, dt * 12);
          k.pull.x += dx * stepK;
          k.pull.y += dy * stepK;
          busy = true;
          const res = peel(k.poly, k.anchor, k.pull);
          if (res.peeledFraction - k.peeled > 0.04) sound.play("peel", 0.3);
          k.peeled = res.peeledFraction;
          if (k.peeled > DETACH_AT && s.grab?.id === k.id) {
            const c = Math.cos(k.rot);
            const sn = Math.sin(k.rot);
            // Палець і далі тримає відірвану наліпку.
            detach(k, k.cx + k.pull.x * c - k.pull.y * sn, k.cy + k.pull.x * sn + k.pull.y * c, s.grab.pointer >= 0);
          }
        }
      } else if (k.phase !== "stuck") {
        if (k.crumpling && k.crumple < 1) {
          k.crumple = Math.min(1, k.crumple + dt * (reducedMotion ? 10 : 2.4));
          if (k.crumple >= 1) {
            k.phase = "ball";
            k.crumpling = false;
            sync();
          }
          busy = true;
        }
        if (!k.held) {
          // Падає на полицю, мʼяко лягає.
          const floor = s.shelfY + 14 - Math.max(k.w, k.h) * (0.5 - 0.32 * k.crumple) * 0.5;
          if (k.y < floor - 0.5 || Math.abs(k.vy) > 1) {
            k.vy += 1600 * dt;
            k.x += k.vx * dt;
            k.y += k.vy * dt;
            k.angle += k.spin * dt;
            k.spin *= 0.98;
            k.vx *= 0.99;
            if (k.y > floor) {
              k.y = floor;
              k.vy = -k.vy * 0.25;
              k.vx *= 0.6;
              k.spin *= 0.5;
              if (Math.abs(k.vy) < 40) k.vy = 0;
              else sound.play("paper", 0.25);
            }
            busy = true;
          }
          const half = (Math.max(k.w, k.h) / 2) * (1 - 0.55 * k.crumple);
          k.x = Math.max(s.pane.x + half, Math.min(s.pane.x + s.pane.w - half, k.x));
        }
      }
    }
    const light = updateLight();
    if (Math.abs(light - s.light) > 0.002) {
      s.light += (light - s.light) * Math.min(1, dt * 1.5);
      busy = true;
    }
    if (busy || s.dirty) {
      draw();
      s.dirty = false;
    }
    return busy || s.grab !== null;
  });

  useEffect(() => {
    const root = rootRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!root) return;
    if (!ctx) {
      setFailed(true);
      return;
    }
    layout(ctx, true);
    draw();
    const ro = new ResizeObserver(() => {
      layout(ctx, false);
      st.current.dirty = true;
      wake();
    });
    ro.observe(root);

    const unbind = bindPointer(root, {
      down: (p) => {
        const s = st.current;
        // Спершу вільні (вони зверху).
        for (const k of [...s.stickers].reverse()) {
          if (k.phase === "stuck") continue;
          const r = Math.max(k.w, k.h) * (0.5 - 0.3 * k.crumple);
          if (Math.hypot(p.x - k.x, p.y - k.y) < r) {
            k.held = true;
            s.grab = { id: k.id, pointer: p.id, startX: p.x, startY: p.y, moved: 0 };
            wake();
            return;
          }
        }
        for (const k of [...s.stickers].reverse()) {
          if (k.phase !== "stuck") continue;
          const l = toLocal(k, p.x, p.y);
          const inside = Math.abs(l.x) <= k.w / 2 + 14 && Math.abs(l.y) <= k.h / 2 + 14;
          if (!inside) continue;
          const nearEdge = Math.min(k.w / 2 - Math.abs(l.x), k.h / 2 - Math.abs(l.y)) < EDGE_GRAB;
          if (!nearEdge && !k.anchor) {
            setHint("Підчепи наліпку за край — так легше.");
            return false;
          }
          if (!k.anchor) {
            // Точка захоплення — на самому краї, найближчому до пальця.
            const ex = Math.abs(l.x) / (k.w / 2);
            const ey = Math.abs(l.y) / (k.h / 2);
            const a = ex > ey ? { x: Math.sign(l.x) * (k.w / 2), y: l.y } : { x: l.x, y: Math.sign(l.y) * (k.h / 2) };
            k.anchor = { x: a.x * 0.999, y: a.y * 0.999 };
            k.pull = { ...k.anchor };
            k.target = { ...k.anchor };
            setHint("Повільно. Вона тягнеться з опором.");
          }
          s.grab = { id: k.id, pointer: p.id, startX: p.x, startY: p.y, moved: 0 };
          sound.play("peel", 0.25);
          wake();
          return;
        }
        return false;
      },
      move: (p) => {
        const s = st.current;
        const g = s.grab;
        if (!g || g.pointer !== p.id) return;
        g.moved = Math.max(g.moved, Math.hypot(p.x - g.startX, p.y - g.startY));
        const k = s.stickers[g.id]!;
        if (k.phase === "stuck" && k.anchor) {
          const l = toLocal(k, p.x, p.y);
          k.target = { x: k.anchor.x + (l.x - k.anchor.x) * RESIST, y: k.anchor.y + (l.y - k.anchor.y) * RESIST };
        } else if (k.held) {
          const nx = p.x;
          const ny = p.y - 10;
          k.vx = (nx - k.x) * 30;
          k.vy = (ny - k.y) * 30;
          k.angle += (nx - k.x) * 0.004;
          k.x = nx;
          k.y = ny;
        }
        wake();
      },
      up: (p) => {
        const s = st.current;
        const g = s.grab;
        if (!g || g.pointer !== p.id) return;
        const k = s.stickers[g.id]!;
        if (k.phase === "stuck") {
          // Відпустили на пів дорозі — клапан трохи повертається, але лишається відгорнутим.
          if (k.anchor) k.target = { x: k.anchor.x + (k.pull.x - k.anchor.x) * 0.8, y: k.anchor.y + (k.pull.y - k.anchor.y) * 0.8 };
        } else {
          k.held = false;
          k.spin = (k.vx / 400) * (reducedMotion ? 0 : 1);
          if (g.moved < 8 && !k.crumpling && k.crumple < 1) {
            k.crumpling = true;
            sound.play("paper", 0.9);
            haptic(16);
          }
        }
        s.grab = null;
        wake();
      },
    });
    return () => {
      ro.disconnect();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- привʼязка один раз
  }, []);

  /** Клавіатурна альтернатива: відклеїти наліпку плавно, без жесту. */
  const peelByButton = (id: number) => {
    const k = st.current.stickers[id];
    if (!k) return;
    if (k.phase === "stuck") {
      k.anchor = { x: -k.w / 2 * 0.999, y: -k.h / 2 * 0.999 };
      k.pull = { ...k.anchor };
      k.target = { x: k.w * 2.2, y: k.h * 2.2 };
      st.current.grab = { id, pointer: -1, startX: 0, startY: 0, moved: 99 };
      const tick = () => {
        if (k.phase !== "stuck") {
          st.current.grab = null;
          return;
        }
        if (k.peeled > DETACH_AT) {
          const c = Math.cos(k.rot);
          const sn = Math.sin(k.rot);
          detach(k, k.cx + k.pull.x * c - k.pull.y * sn, k.cy + k.pull.x * sn + k.pull.y * c);
          st.current.grab = null;
          wake();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else if (k.phase === "loose" && !k.crumpling) {
      k.crumpling = true;
      sound.play("paper", 0.9);
    }
    wake();
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Скло з наліпками. Підчепи край і тягни." className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-3 pt-2">
        <button type="button" className="scene-btn border border-steel/50" disabled={!list.some((k) => k.phase === "stuck")} onClick={() => {
          const next = list.find((k) => k.phase === "stuck");
          if (next) peelByButton(next.id);
        }}>
          Відклеїти наступну
        </button>
        <button type="button" className="scene-btn border border-steel/50 disabled:opacity-40" disabled={!list.some((k) => k.phase === "loose")} onClick={() => {
          for (const k of list) if (k.phase === "loose") peelByButton(k.id);
        }}>
          Змʼяти зняті
        </button>
        <span className="sr-only" aria-live="polite">
          {`На склі: ${list.filter((k) => k.phase === "stuck").length}. Знято: ${list.filter((k) => k.phase !== "stuck").length}.`}
        </span>
      </div>
    </div>
  );
}

function tracePoly(ctx: CanvasRenderingContext2D, poly: Pt[]) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
function fillPoly(ctx: CanvasRenderingContext2D, poly: Pt[]) {
  if (poly.length < 3) return;
  tracePoly(ctx, poly);
  ctx.fill();
}
function strokePoly(ctx: CanvasRenderingContext2D, poly: Pt[]) {
  if (poly.length < 3) return;
  tracePoly(ctx, poly);
  ctx.stroke();
}
function clipPoly(ctx: CanvasRenderingContext2D, poly: Pt[]) {
  if (poly.length < 3) {
    ctx.beginPath();
    ctx.rect(0, 0, 0, 0);
    ctx.clip();
    return;
  }
  tracePoly(ctx, poly);
  ctx.clip();
}
