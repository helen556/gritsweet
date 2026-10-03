"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Pt } from "@/lib/scene/geometry";
import { hash2 } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import { pointInPoly } from "@/lib/scene/tear";
import { RUSSIA_RINGS, RUSSIA_VIEW } from "@/lib/scenes/russia-outline";
import type { SceneProps } from "../types";
import { drawPiece, drawTearInProgress, makePiece, stepPieces, tearPiece, toLocal, toWorld, type Piece } from "@/lib/scene/pieces";

type Mode = "tear" | "burn" | "blast";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "tear", label: "Рвати", hint: "Проведи пальцем через карту від краю до краю." },
  { id: "burn", label: "Палити", hint: "Торкнись карти — вогонь піде від цієї точки." },
  { id: "blast", label: "Знищити", hint: "Торкнись карти. Умовний ефект, без людей і цілей." },
];

/** Сітка горіння в координатах аркуша: 0 — ціле, (0,1) — горить, 1 — згоріло. */
interface Burn {
  gw: number;
  gh: number;
  cells: Float32Array;
  /** Обпалено ударною хвилею: темніє, але не горить і не поширюється. */
  scorch: Float32Array;
  mask: HTMLCanvasElement;
  char: HTMLCanvasElement;
  ember: HTMLCanvasElement;
  active: number;
}

export default function WarMapScene({ intensity, reducedMotion, setHint, onSettled }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("tear");
  const [failed, setFailed] = useState(false);
  const modeRef = useRef(mode);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    modeRef.current = mode;
    intensityRef.current = intensity;
  });

  const st = useRef({
    w: 1,
    h: 1,
    dpr: 1,
    sheet: { x: 0, y: 0, w: 1, h: 1 },
    pieces: [] as Piece[],
    burn: null as Burn | null,
    layer: null as HTMLCanvasElement | null,
    gesture: null as null | { pointer: number; path: Pt[]; target: Piece | null },
    blast: null as null | { x: number; y: number; t: number; torn: boolean },
    smoke: [] as { x: number; y: number; vy: number; life: number; r: number }[],
    t: 0,
    dirty: true,
    acts: 0,
  });

  /** Карта всередині аркуша (у координатах аркуша). */
  const paintMap = (ctx: CanvasRenderingContext2D) => {
    const s = st.current;
    const { x, y, w, h } = s.sheet;
    const pad = w * 0.07;
    const k = Math.min((w - pad * 2) / RUSSIA_VIEW.w, (h - pad * 2) / RUSSIA_VIEW.h);
    const ox = x + (w - RUSSIA_VIEW.w * k) / 2;
    const oy = y + (h - RUSSIA_VIEW.h * k) / 2;
    // Сітка паралелей — «паперова» карта.
    ctx.strokeStyle = "rgba(86,116,135,0.22)";
    ctx.lineWidth = 0.7;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x + pad * 0.5, y + (h * i) / 8);
      ctx.quadraticCurveTo(x + w / 2, y + (h * i) / 8 - h * 0.06, x + w - pad * 0.5, y + (h * i) / 8);
      ctx.stroke();
    }
    ctx.beginPath();
    for (const r of RUSSIA_RINGS) {
      ctx.moveTo(ox + r[0]! * k, oy + r[1]! * k);
      for (let i = 2; i < r.length; i += 2) ctx.lineTo(ox + r[i]! * k, oy + r[i + 1]! * k);
      ctx.closePath();
    }
    ctx.fillStyle = "#56697a";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(231,235,237,0.12)";
    ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 7) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#22313c";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = "rgba(34,49,60,0.7)";
    ctx.font = `italic ${Math.max(12, w * 0.035)}px ${getComputedStyle(document.body).getPropertyValue("--font-display") || "serif"}`;
    ctx.fillText("карта рф", x + pad * 0.6, y + h - pad * 0.45);
  };

  const makeBurn = (): Burn => {
    const gw = detectQuality().tier === "low" ? 90 : 130;
    const gh = Math.round(gw * (st.current.sheet.h / st.current.sheet.w));
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = gw;
      c.height = gh;
      return c;
    };
    return { gw, gh, cells: new Float32Array(gw * gh), scorch: new Float32Array(gw * gh), mask: mk(), char: mk(), ember: mk(), active: 0 };
  };

  const ignite = (wx: number, wy: number, radius: number, strength = 0.02) => {
    const s = st.current;
    const b = s.burn;
    if (!b) return;
    // Шматки мають спільну систему координат аркуша — шукаємо, в який влучили.
    const piece = [...s.pieces].reverse().find((p) => p.crumple < 0.5 && pointInPoly(toLocal(p, { x: wx, y: wy }), p.poly));
    if (!piece) return;
    const l = toLocal(piece, { x: wx, y: wy });
    const gx = ((l.x - s.sheet.x) / s.sheet.w) * b.gw;
    const gy = ((l.y - s.sheet.y) / s.sheet.h) * b.gh;
    const r = (radius / s.sheet.w) * b.gw;
    for (let y = Math.max(0, Math.floor(gy - r)); y < Math.min(b.gh, gy + r); y++)
      for (let x = Math.max(0, Math.floor(gx - r)); x < Math.min(b.gw, gx + r); x++) {
        const i = y * b.gw + x;
        if (b.cells[i] === 0 && Math.hypot(x - gx, y - gy) < r) {
          b.cells[i] = strength;
          b.active = Math.max(1, b.active);
        }
      }
  };

  /** Обпалити (для вибуху): темна пляма й діра в центрі, без вогню, що розповзається. */
  const scorchAt = (wx: number, wy: number, radius: number, hole: boolean, strength = 1) => {
    const s = st.current;
    const b = s.burn;
    if (!b) return;
    for (const piece of s.pieces) {
      const l = toLocal(piece, { x: wx, y: wy });
      const gx = ((l.x - s.sheet.x) / s.sheet.w) * b.gw;
      const gy = ((l.y - s.sheet.y) / s.sheet.h) * b.gh;
      const r = (radius / s.sheet.w) * b.gw;
      for (let y = Math.max(0, Math.floor(gy - r)); y < Math.min(b.gh, gy + r); y++)
        for (let x = Math.max(0, Math.floor(gx - r)); x < Math.min(b.gw, gx + r); x++) {
          const d = Math.hypot(x - gx, y - gy) / r;
          if (d >= 1) continue;
          const i = y * b.gw + x;
          b.scorch[i] = Math.max(b.scorch[i]!, Math.pow(1 - d, 1.4) * strength * (0.7 + 0.3 * hash2(i, 3)));
          if (hole && d < 0.28 + 0.12 * hash2(i, 5)) b.cells[i] = 1;
        }
    }
    b.active = Math.max(1, b.active);
  };

  const stepBurn = (dt: number) => {
    const b = st.current.burn;
    if (!b) return false;
    const { gw, gh, cells } = b;
    const speed = (reducedMotion ? 0.5 : 1) * (0.6 + 0.25 * intensityRef.current);
    let active = 0;
    const next = cells.slice();
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const v = cells[i]!;
        if (v > 0 && v < 1) {
          active++;
          next[i] = Math.min(1, v + dt * 0.9 * speed);
          // Вогонь іде до сусідів нерівно — живий край.
          if (v > 0.25)
            for (const j of [i - 1, i + 1, i - gw, i + gw]) {
              if (j < 0 || j >= cells.length || cells[j] !== 0) continue;
              if (Math.random() < dt * 2.4 * speed * (0.6 + hash2(j, 7))) next[j] = 0.01;
            }
        }
      }
    b.cells.set(next);
    b.active = active;
    // Маски: діри (згоріло), обвуглення (край), жар (горить).
    const put = (canvas: HTMLCanvasElement, fn: (v: number, i: number) => [number, number, number, number]) => {
      const c = canvas.getContext("2d")!;
      const img = c.createImageData(gw, gh);
      for (let i = 0; i < cells.length; i++) {
        const [r, g, bl, a] = fn(next[i]!, i);
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = bl;
        img.data[i * 4 + 3] = a;
      }
      c.putImageData(img, 0, 0);
    };
    put(b.mask, (v) => [0, 0, 0, v >= 0.85 ? 255 : 0]);
    const sc = b.scorch;
    put(b.char, (v, i) => [26, 18, 14, Math.min(255, v > 0 ? 120 + v * 150 : 0) || sc[i]! * 210]);
    put(b.ember, (v, i) => {
      // Жар — лише вузький фронт; тліє рівно, без мерехтіння-стробоскопа.
      const glow = v > 0.04 && v < 0.6 ? Math.sin(((v - 0.04) * Math.PI) / 0.56) : 0;
      const flick = reducedMotion ? 1 : 0.9 + 0.1 * hash2(i, Math.floor(st.current.t * 4));
      return [232, 118 + glow * 50, 58, glow * 120 * flick];
    });
    return active > 0;
  };

  const draw = () => {
    const s = st.current;
    const ctx = canvasRef.current?.getContext("2d");
    const layer = s.layer;
    if (!ctx || !layer) return;
    const lctx = layer.getContext("2d")!;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    const g = ctx.createRadialGradient(s.w / 2, s.h * 0.45, 20, s.w / 2, s.h / 2, Math.max(s.w, s.h) * 0.7);
    g.addColorStop(0, "rgba(86,116,135,0.2)");
    g.addColorStop(1, "rgba(8,19,28,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.w, s.h);
    const b = s.burn;
    for (const p of s.pieces) {
      lctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      lctx.clearRect(0, 0, s.w, s.h);
      drawPiece(lctx, p, { base: "#dcdfda", paint: paintMap });
      if (b) {
        // Ті самі маски в системі координат аркуша → застосовуємо з трансформацією шматка.
        lctx.save();
        lctx.translate(p.c.x + p.x, p.c.y + p.y);
        lctx.rotate(p.rot);
        lctx.translate(-p.c.x, -p.c.y);
        lctx.imageSmoothingEnabled = true;
        lctx.globalCompositeOperation = "source-atop";
        lctx.filter = "blur(3px)";
        lctx.drawImage(b.char, s.sheet.x, s.sheet.y, s.sheet.w, s.sheet.h);
        lctx.globalCompositeOperation = "destination-out";
        lctx.filter = "blur(1.5px)";
        lctx.drawImage(b.mask, s.sheet.x, s.sheet.y, s.sheet.w, s.sheet.h);
        lctx.restore();
      }
      ctx.drawImage(layer, 0, 0, s.w, s.h);
      if (b && b.active > 0) {
        ctx.save();
        ctx.translate(p.c.x + p.x, p.c.y + p.y);
        ctx.rotate(p.rot);
        ctx.translate(-p.c.x, -p.c.y);
        ctx.globalCompositeOperation = "lighter";
        ctx.filter = "blur(2px)";
        ctx.drawImage(b.ember, s.sheet.x, s.sheet.y, s.sheet.w, s.sheet.h);
        ctx.restore();
      }
    }
    // Дим — тихий, сірий.
    for (const m of s.smoke) {
      ctx.fillStyle = `rgba(159,176,186,${0.12 * (1 - m.life)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * (1 + m.life), 0, Math.PI * 2);
      ctx.fill();
    }
    // Ударна хвиля: плавне світло (без спалахів) і кільце.
    const bl = s.blast;
    if (bl) {
      const rise = Math.min(1, bl.t / 0.5);
      const fall = Math.max(0, 1 - Math.max(0, bl.t - 0.5) / 1.8);
      const light = 0.32 * rise * fall;
      const lg = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, Math.max(s.w, s.h) * 0.8);
      lg.addColorStop(0, `rgba(231,220,200,${light})`);
      lg.addColorStop(1, "rgba(231,220,200,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, s.w, s.h);
      if (!reducedMotion && bl.t < 1.6) {
        const R = bl.t * Math.max(s.w, s.h) * 0.7;
        ctx.strokeStyle = `rgba(231,235,237,${0.35 * (1 - bl.t / 1.6)})`;
        ctx.lineWidth = 10 * (1 - bl.t / 1.6) + 1;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const gst = s.gesture;
    if (gst?.target) {
      const local = gst.path.map((q) => toLocal(gst.target!, q));
      const firstIn = local.findIndex((q) => pointInPoly(q, gst.target!.poly));
      if (firstIn > 0) drawTearInProgress(ctx, gst.path.slice(firstIn - 1), gst.target.id);
    }
  };

  const settle = () => {
    const s = st.current;
    s.acts++;
    if (s.acts === 3) onSettled();
  };

  const blastAt = (x: number, y: number) => {
    const s = st.current;
    if (s.blast) return;
    s.blast = { x, y, t: 0, torn: false };
    s.burn ??= makeBurn();
    // Епіцентр: діра з обвугленим краєм, мʼяка зона обпалення довкола й кілька тліючих місць.
    scorchAt(x, y, 150, false, 0.75);
    scorchAt(x, y, 60, true);
    for (let k = 0; k < 5; k++) ignite(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 60, 4, 0.2);
    sound.play("rumble", 0.7);
    haptic(30);
    setHint("Карти в такому вигляді більше нема.");
    settle();
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    s.t += dt;
    let busy = stepPieces(s.pieces, dt);
    if (s.burn && (s.burn.active > 0 || s.blast)) {
      busy = stepBurn(dt) || busy;
      if (s.burn.active > 0 && Math.random() < dt * 4 * Math.min(1, s.burn.active / 200)) sound.play("fire", 0.3);
    }
    const bl = s.blast;
    if (bl) {
      bl.t += dt * (reducedMotion ? 3 : 1);
      // Хвиля обпалює карту на своєму шляху.
      const R = bl.t * Math.max(s.w, s.h) * 0.7;
      void R;
      if (!bl.torn && bl.t > 0.35) {
        bl.torn = true;
        // Радіальні розриви від точки удару — карта розлітається на шматки.
        for (let k = 0; k < 4 + intensityRef.current; k++) {
          const a = (k / (4 + intensityRef.current)) * Math.PI * 2 + Math.random() * 0.5;
          const path: Pt[] = [];
          for (let i = 0; i <= 30; i++) {
            const r = (i / 30) * Math.max(s.w, s.h);
            path.push({ x: bl.x + Math.cos(a) * r + Math.sin(i * 0.9) * 6, y: bl.y + Math.sin(a) * r + Math.cos(i * 0.7) * 6 });
          }
          for (const p of [...s.pieces]) {
            const local = path.map((q) => toLocal(p, q));
            if (!pointInPoly(local[0]!, p.poly)) continue;
            // Шлях починається всередині — подовжуємо назад через точку удару, щоб перетнути край двічі.
            const back = path.map((q) => ({ x: 2 * bl.x - q.x, y: 2 * bl.y - q.y })).reverse();
            const res = tearPiece(p, [...back, ...path], 2);
            if (res) s.pieces = [...s.pieces.filter((q) => q !== p), ...res];
          }
        }
        for (const p of s.pieces) {
          const c = toWorld(p, p.c);
          const dx = c.x - bl.x;
          const dy = c.y - bl.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = reducedMotion ? 40 : 260 + Math.random() * 120;
          p.vx = (dx / d) * sp;
          p.vy = (dy / d) * sp;
          p.vr = (Math.random() - 0.5) * (reducedMotion ? 0 : 1.6);
        }
      }
      if (bl.t > 2.6) s.blast = null;
      busy = true;
    }
    // Дим із палаючих місць.
    if (s.burn && s.burn.active > 0 && !reducedMotion && s.smoke.length < 40 && Math.random() < 0.5) {
      const p = s.pieces[Math.floor(Math.random() * s.pieces.length)];
      if (p) {
        const c = toWorld(p, p.c);
        s.smoke.push({ x: c.x + (Math.random() - 0.5) * 80, y: c.y + (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 20, life: 0, r: 6 + Math.random() * 10 });
      }
    }
    for (const m of s.smoke) {
      m.y += m.vy * dt;
      m.life += dt * 0.35;
    }
    s.smoke = s.smoke.filter((m) => m.life < 1);
    if (s.smoke.length) busy = true;
    if (busy || s.dirty) {
      draw();
      s.dirty = false;
    }
    return busy || Boolean(s.gesture);
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !canvas.getContext("2d")) {
      setFailed(true);
      return;
    }
    const s = st.current;
    s.layer = document.createElement("canvas");
    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const dpr = detectQuality().dpr;
      if (!s.pieces.length) {
        const sw = Math.min(w * 0.94, (h * 0.8) / 0.62, 760);
        const sh = sw * 0.62;
        s.sheet = { x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh };
        const { x, y } = s.sheet;
        s.pieces = [makePiece([{ x, y }, { x: x + sw, y }, { x: x + sw, y: y + sh }, { x, y: y + sh }])];
      } else
        for (const p of s.pieces) {
          p.x += (w - s.w) / 2;
          p.y += (h - s.h) / 2;
        }
      Object.assign(s, { w, h, dpr });
      for (const c of [canvas, s.layer!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      s.dirty = true;
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    const unbind = bindPointer(root, {
      down: (p) => {
        const m = modeRef.current;
        if (m === "burn") {
          s.burn ??= makeBurn();
          ignite(p.x, p.y, 10);
          sound.play("fire", 0.6);
          setHint("Горить від точки дотику. Можна підпалити ще.");
          settle();
          wake();
          return false;
        }
        if (m === "blast") {
          blastAt(p.x, p.y);
          wake();
          return false;
        }
        s.gesture = { pointer: p.id, path: [p], target: null };
        wake();
      },
      move: (p) => {
        const g = s.gesture;
        if (!g || g.pointer !== p.id) return;
        const last = g.path[g.path.length - 1]!;
        if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
        g.path.push(p);
        if (!g.target) g.target = [...s.pieces].reverse().find((q) => q.crumple < 0.3 && pointInPoly(toLocal(q, p), q.poly)) ?? null;
        else if (!pointInPoly(toLocal(g.target, p), g.target.poly)) {
          const res = tearPiece(g.target, g.path, 1.6 + 0.4 * intensityRef.current);
          if (res) {
            s.pieces = [...s.pieces.filter((q) => q !== g.target), ...res];
            sound.play("tear", 0.8);
            haptic(18);
            settle();
          }
          s.gesture = { pointer: p.id, path: [p], target: null };
        } else if (Math.random() < 0.3) sound.play("tear", 0.3);
        s.dirty = true;
        wake();
      },
      up: () => {
        s.gesture = null;
        s.dirty = true;
        wake();
      },
    });
    return () => {
      ro.disconnect();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- привʼязка один раз
  }, []);

  const keyboardAct = () => {
    const s = st.current;
    const c = { x: s.sheet.x + s.sheet.w * (0.3 + Math.random() * 0.4), y: s.sheet.y + s.sheet.h * (0.3 + Math.random() * 0.4) };
    if (mode === "burn") {
      s.burn ??= makeBurn();
      ignite(c.x, c.y, 12);
      settle();
    } else if (mode === "blast") blastAt(c.x, c.y);
    else {
      const p = [...s.pieces].sort((a, b) => b.poly.length - a.poly.length)[0];
      if (p) {
        const cc = toWorld(p, p.c);
        const a = Math.random() * Math.PI;
        const path: Pt[] = Array.from({ length: 25 }, (_, i) => ({ x: cc.x + Math.cos(a) * (i - 12) * 70, y: cc.y + Math.sin(a) * (i - 12) * 70 + Math.sin(i) * 6 }));
        const res = tearPiece(p, path, 2);
        if (res) {
          s.pieces = [...s.pieces.filter((q) => q !== p), ...res];
          sound.play("tear", 0.8);
          settle();
        }
      }
    }
    s.dirty = true;
    wake();
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Символічна паперова карта рф. Її можна рвати, палити або знищити." className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-3 pt-2">
        <div role="radiogroup" aria-label="Дія" className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setHint(m.hint);
              }}
              className={cn("min-h-11 px-3 text-sm", mode === m.id ? "bg-frost text-abyss" : "text-frost/80 hover:bg-night")}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="scene-btn border border-steel/50" onClick={keyboardAct}>
          {mode === "tear" ? "Розірвати" : mode === "burn" ? "Підпалити" : "Запустити"}
        </button>
      </div>
    </div>
  );
}
