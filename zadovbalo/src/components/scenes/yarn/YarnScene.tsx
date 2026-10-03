"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import { contactShadow } from "@/lib/scene/sprite";
import type { SceneProps } from "../types";

interface Meta {
  size: [number, number];
  tangle: { x: number; y: number; w: number; h: number; exit: [number, number] };
  ball: { x: number; y: number; w: number; h: number; cx: number; cy: number; r: number };
  strand: { w: number; h: number; thickness: number };
}

/** Хвіст нитки точно як на фото (від маси до кінчика). */
const TAIL: [number, number][] = [
  [978, 796], [930, 830], [870, 850], [840, 870], [835, 895], [860, 915], [900, 928], [980, 930],
  [1040, 928], [1100, 945], [1145, 980], [1160, 1020], [1140, 1065], [1100, 1100], [1080, 1130],
];
const WORLD = { x0: 0, y0: 60, x1: 1520, y1: 1460 };
const BALL_MAX_R = 215;
const BALL_MIN_R = 26;
const THICK = 22;
const SEG = 14; // довжина ланки нитки (світові px)
/** Скільки прогресу дає один радіан кругового руху: повний клубок ≈ 20 обертів. */
const PER_RAD = 1 / (20 * Math.PI * 2);

interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
}

async function loadYarn() {
  const meta = await loadJson<Meta>("/scenes/yarn/yarn.json");
  const [tangle, ball, strand] = await Promise.all([
    loadImage("/scenes/yarn/tangle.webp"),
    loadImage("/scenes/yarn/ball.webp"),
    loadImage("/scenes/yarn/strand.webp"),
  ]);
  return { meta, tangle, ball, strand };
}

export default function YarnScene(props: SceneProps) {
  const assets = useSceneAssets(loadYarn);
  if (assets.status === "loading") return <div role="status" className="grid h-full place-items-center text-sm text-mist">Готую пряжу…</div>;
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити пряжу.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <Yarn {...props} data={assets.data} />;
}

function Yarn({ reducedMotion, onSettled, setHint, onInteract, data }: SceneProps & { data: Awaited<ReturnType<typeof loadYarn>> }) {
  const { meta, tangle, ball, strand } = data;
  const { canvasRef, ctx, size } = useCanvas2D();
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"free" | "wind" | "done">("free");
  const phaseRef = useRef<"free" | "wind" | "done">("free");
  const [pct, setPct] = useState(0);

  // Нитка: ланцюжок точок (Верле). Перша — біля маси, остання — кінчик / точка на клубку.
  const rope = useRef<Pt[]>([]);
  if (rope.current.length === 0) rope.current = sampleTail();
  const st = useRef({
    progress: 0,
    pulled: 0,
    ballX: 0,
    ballY: 0,
    spin: 0,
    spinV: 0,
    tug: 0,
    massDX: 0,
    massDY: 0,
    tipDrag: null as null | { id: number; x: number; y: number },
    wind: null as null | { id: number; a: number },
    wraps: [] as { tilt: number; start: number; len: number; age: number }[],
    tailTarget: null as null | { x: number; y: number }[],
    tailT: 0,
    settled: false,
  });

  const view = useMemo(() => {
    const W = size.width;
    const H = size.height;
    const s = Math.min(W / (WORLD.x1 - WORLD.x0), H / (WORLD.y1 - WORLD.y0));
    return { s, ox: (W - (WORLD.x1 - WORLD.x0) * s) / 2 - WORLD.x0 * s, oy: (H - (WORLD.y1 - WORLD.y0) * s) / 2 - WORLD.y0 * s };
  }, [size]);
  const toWorld = useCallback((x: number, y: number) => ({ x: (x - view.ox) / view.s, y: (y - view.oy) / view.s }), [view]);

  /** Маса зменшується з прогресом; точка виходу нитки рухається разом із нею. */
  const massTransform = () => {
    const s = st.current;
    const left = 1 - s.progress;
    const k = Math.max(0, 0.22 + 0.78 * Math.sqrt(left) - Math.min(0.08, s.pulled / 6000));
    const pivot = { x: 560, y: 520 };
    return { k, pivot, dx: s.massDX, dy: s.massDY, rot: s.progress * 0.5 };
  };
  const exitPoint = () => {
    const m = massTransform();
    const [ex, ey] = meta.tangle.exit;
    const cos = Math.cos(m.rot);
    const sin = Math.sin(m.rot);
    const lx = (ex - m.pivot.x) * m.k;
    const ly = (ey - m.pivot.y) * m.k;
    return { x: m.pivot.x + m.dx + lx * cos - ly * sin, y: m.pivot.y + m.dy + lx * sin + ly * cos };
  };
  const ballR = () => BALL_MIN_R + (BALL_MAX_R - BALL_MIN_R) * Math.cbrt(st.current.progress);

  const step = (dt: number) => {
    const pts = rope.current;
    const s = st.current;
    if (phaseRef.current === "done") {
      // Змотано: хвостик плавно лягає на місце, без фізики натягу.
      const tgt = s.tailTarget;
      if (!tgt) return;
      const k = Math.min(1, dt * 5);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        const q = tgt[Math.min(i, tgt.length - 1)]!;
        p.x += (q.x - p.x) * k;
        p.y += (q.y - p.y) * k;
        p.px = p.x;
        p.py = p.y;
      }
      return;
    }
    const damp = 0.86;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i]!;
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy;
    }
    // Кінці: нитка виходить із маси.
    const e = exitPoint();
    pts[0]!.x = pts[0]!.px = e.x;
    pts[0]!.y = pts[0]!.py = e.y;
    const last = pts[pts.length - 1]!;
    if (phaseRef.current === "free") {
      if (s.tipDrag) {
        last.px = last.x;
        last.py = last.y;
        last.x += (s.tipDrag.x - last.x) * Math.min(1, dt * 30);
        last.y += (s.tipDrag.y - last.y) * Math.min(1, dt * 30);
      }
    } else {
      // Нитка йде на клубок: точка кріплення обертається разом із ним.
      const r = ballR();
      last.x = last.px = s.ballX + Math.cos(s.spin * 1.7 + 2.2) * r * 0.92;
      last.y = last.py = s.ballY + Math.sin(s.spin * 1.7 + 2.2) * r * 0.55;
    }
    // Обмеження довжини. Перша точка (маса) й кінець (палець/клубок) закріплені.
    const pinLast = phaseRef.current !== "free" || Boolean(s.tipDrag);
    for (let it = 0; it < 14; it++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const pa = i === 0;
        const pb = i + 1 === pts.length - 1 && pinLast;
        if (pa && pb) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-3;
        const diff = (d - SEG) / d;
        const wa = pa ? 0 : pb ? 1 : 0.5;
        const wb = pb ? 0 : pa ? 1 : 0.5;
        a.x += dx * diff * wa;
        a.y += dy * diff * wa;
        b.x -= dx * diff * wb;
        b.y -= dy * diff * wb;
      }
    }
    // Натяг: нитка розтягнута довше, ніж є, — розмотуємо з маси (нові ланки біля неї).
    const tail = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2]!;
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    let extra = total - (pts.length - 1) * SEG;
    while (extra > SEG * 0.5 && pts.length < 260) {
      const head = pts[0]!;
      const next = pts[1]!;
      pts.splice(1, 0, { x: (head.x + next.x) / 2, y: (head.y + next.y) / 2, px: (head.x + next.x) / 2, py: (head.y + next.y) / 2 });
      s.pulled += SEG;
      extra -= SEG;
      s.tug = Math.min(1, s.tug + 0.25);
      if (Math.random() < 0.25) sound.play("paper", 0.15);
    }
    // Змотування: зайва слабина зникає з боку маси (нитку тягне клубок), без «вузлів».
    if (phaseRef.current === "wind" && pts.length > 8) {
      const straight = Math.hypot(tail.x - pts[0]!.x, tail.y - pts[0]!.y);
      const length = (pts.length - 1) * SEG;
      if (length > straight * 1.05 + SEG * 2) pts.splice(1, 1);
    }

    // Маса трохи смикається за ниткою.
    s.tug *= 1 - Math.min(1, dt * 4);
    const dir = { x: prev.x - pts[0]!.x, y: prev.y - pts[0]!.y };
    const dl = Math.hypot(dir.x, dir.y) || 1;
    s.massDX += ((dir.x / dl) * s.tug * 10 - s.massDX) * Math.min(1, dt * 6);
    s.massDY += ((dir.y / dl) * s.tug * 10 - s.massDY) * Math.min(1, dt * 6);
  };

  const draw = useCallback(() => {
    const g = ctx;
    if (!g) return;
    const s = st.current;
    const { s: sc, ox, oy } = view;
    const dpr = size.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    // Стіл — той самий графітовий тон, що на фото, з мʼяким світлом.
    const bg = g.createRadialGradient(700, 650, 80, 700, 700, 1100);
    bg.addColorStop(0, "rgba(70,70,72,0.55)");
    bg.addColorStop(1, "rgba(30,31,33,0)");
    g.fillStyle = bg;
    g.fillRect(-400, -200, 2400, 2000);

    // Маса.
    const m = massTransform();
    if (s.progress < 0.995) {
      g.save();
      g.translate(m.pivot.x + m.dx, m.pivot.y + m.dy);
      g.rotate(m.rot);
      g.scale(m.k, m.k);
      g.translate(-m.pivot.x, -m.pivot.y);
      contactShadow(g, 580, 640, 540, 200, 0.5);
      g.globalAlpha = Math.min(1, (1 - s.progress) * 8);
      g.drawImage(tangle, meta.tangle.x, meta.tangle.y);
      g.restore();
    }

    // Нитка: тінь, потім текстура.
    const pts = rope.current;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "rgba(0,0,0,0.38)";
    g.lineWidth = THICK * 0.9;
    g.beginPath();
    g.moveTo(pts[0]!.x + 7, pts[0]!.y + 9);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x + 7, pts[i]!.y + 9);
    g.stroke();
    g.restore();
    drawRope(g, pts, strand, meta.strand);

    // Клубок.
    if (phaseRef.current !== "free") {
      const r = ballR();
      contactShadow(g, s.ballX + r * 0.25, s.ballY + r * 0.78, r * 1.05, r * 0.35, 0.6);
      g.save();
      g.translate(s.ballX, s.ballY);
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.clip();
      g.rotate(s.spin);
      const k = (r * 2) / Math.min(meta.ball.w, meta.ball.h);
      g.drawImage(ball, (-meta.ball.w / 2) * k, (-meta.ball.h / 2) * k, meta.ball.w * k, meta.ball.h * k);
      g.restore();
      // Свіжі витки поверх клубка — нитка лягає з тією ж фактурою.
      for (const w of s.wraps) drawWrap(g, s.ballX, s.ballY, r, w, strand, meta.strand);
      // Обʼєм: тінь знизу справа, світло зліва вгорі (як на фото).
      const sh = g.createRadialGradient(s.ballX - r * 0.35, s.ballY - r * 0.4, r * 0.2, s.ballX, s.ballY, r * 1.02);
      sh.addColorStop(0, "rgba(255,255,255,0.06)");
      sh.addColorStop(0.65, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(0,0,0,0.38)");
      g.fillStyle = sh;
      g.beginPath();
      g.arc(s.ballX, s.ballY, r, 0, Math.PI * 2);
      g.fill();
    }
  }, [ctx, view, size.dpr, tangle, ball, strand, meta]);

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    step(dt);
    step(dt); // два кроки — стабільніша нитка
    s.spin += s.spinV * dt;
    s.spinV *= 1 - Math.min(1, dt * 5);
    for (const w of s.wraps) w.age += dt;
    s.wraps = s.wraps.filter((w) => w.age < 6);
    draw();
    // Нитка заспокоїлась і ніхто не тягне — сплячий режим.
    const moving = rope.current.some((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py) > 0.05);
    return moving || Boolean(s.tipDrag || s.wind) || Math.abs(s.spinV) > 0.01 || s.tug > 0.01 || (phaseRef.current === "done" && st.current.tailT < 1.5 && ((st.current.tailT += 1 / 60), true));
  });

  useEffect(() => {
    draw();
    wake();
  }, [draw, wake]);

  const startWinding = useCallback(
    (x: number, y: number) => {
      const s = st.current;
      // Повний клубок має вміститися в кадр.
      s.ballX = Math.max(WORLD.x0 + BALL_MAX_R + 260, Math.min(WORLD.x1 - BALL_MAX_R - 30, x));
      s.ballY = Math.max(WORLD.y0 + BALL_MAX_R + 30, Math.min(WORLD.y1 - BALL_MAX_R - 150, y));
      phaseRef.current = "wind";
      setPhase("wind");
      setHint("Тепер води пальцем по колу — нитка змотуватиметься.");
      sound.play("soft", 0.4);
    },
    [setHint],
  );

  const addProgress = useCallback(
    (rad: number) => {
      const s = st.current;
      if (phaseRef.current !== "wind") return;
      s.progress = Math.min(1, s.progress + Math.abs(rad) * PER_RAD);
      if (s.progress > 0.999) s.progress = 1;
      s.spinV += rad * 2.2;
      s.tug = Math.min(1, s.tug + Math.abs(rad) * 0.6);
      // Новий виток щочверть оберту.
      const last = s.wraps[s.wraps.length - 1];
      if (!last || last.age > 0.35) s.wraps.push({ tilt: Math.random() * Math.PI, start: Math.random() * Math.PI * 2, len: 1.2 + Math.random() * 1.4, age: 0 });
      setPct(Math.round(s.progress * 100));
      if (Math.random() < 0.2) sound.play("paper", 0.12);
      if (s.progress >= 1 && !s.settled) {
        s.settled = true;
        // Короткий хвостик: від клубка вниз-ліворуч мʼякою S-кривою.
        const r = ballR();
        const n = 16;
        // Нитка сходить з нижнього лівого боку клубка й лягає на стіл назовні.
        const ax = s.ballX - r * 0.62;
        const ay = s.ballY + r * 0.62;
        const tail: { x: number; y: number }[] = [];
        for (let i = 0; i < n; i++) {
          const t = 1 - i / (n - 1); // 0 — біля клубка
          tail.push({ x: ax - t * 210 + Math.sin(t * Math.PI * 1.5) * 34, y: ay + t * 120 - Math.sin(t * Math.PI) * 46 });
        }
        const cur = rope.current;
        rope.current = cur.slice(cur.length - n);
        s.tailTarget = tail;
        phaseRef.current = "done";
        setPhase("done");
        onSettled();
        haptic(12);
        setHint("Клубок змотано. Можна побути тут скільки треба.");
      }
    },
    [onSettled, setHint],
  );

  usePointer(rootRef, {
    down: (p) => {
      const w = toWorld(p.x, p.y);
      const s = st.current;
      onInteract();
      if (phaseRef.current === "free") {
        const tip = rope.current[rope.current.length - 1]!;
        // Кінчик легко вхопити: щедра зона.
        if (Math.hypot(w.x - tip.x, w.y - tip.y) > 110) return false;
        s.tipDrag = { id: p.id, x: w.x, y: w.y };
        sound.play("paper", 0.25);
        wake();
        return;
      }
      if (phaseRef.current === "wind") {
        s.wind = { id: p.id, a: Math.atan2(w.y - s.ballY, w.x - s.ballX) };
        wake();
      }
    },
    move: (p) => {
      const w = toWorld(p.x, p.y);
      const s = st.current;
      if (s.tipDrag && s.tipDrag.id === p.id) {
        s.tipDrag.x = w.x;
        s.tipDrag.y = w.y;
        wake();
        return;
      }
      if (s.wind && s.wind.id === p.id) {
        const dist = Math.hypot(w.x - s.ballX, w.y - s.ballY);
        const a = Math.atan2(w.y - s.ballY, w.x - s.ballX);
        if (dist > ballR() * 0.45) {
          let d = a - s.wind.a;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          // Різкий ривок не карається, але й не «перестрибує» — обмежуємо крок.
          addProgress(Math.max(-0.6, Math.min(0.6, d)));
        }
        s.wind.a = a;
        wake();
      }
    },
    up: (p, cancelled) => {
      const s = st.current;
      if (s.tipDrag && s.tipDrag.id === p.id) {
        s.tipDrag = null;
        const tip = rope.current[rope.current.length - 1]!;
        // Витягнули достатньо — тут починається новий клубок.
        if (!cancelled && s.pulled > 140) startWinding(tip.x, tip.y);
        else if (!cancelled) setHint("Тягни сміливіше — нитка подасться.");
        wake();
        return;
      }
      if (s.wind && s.wind.id === p.id) s.wind = null;
    },
  });

  /** Кнопкова альтернатива. */
  const pullByButton = () => {
    onInteract();
    const s = st.current;
    const tip = rope.current[rope.current.length - 1]!;
    s.tipDrag = { id: -1, x: tip.x + 140, y: tip.y + 60 };
    wake();
    window.setTimeout(() => {
      s.tipDrag = null;
      const t = rope.current[rope.current.length - 1]!;
      startWinding(t.x, t.y);
      wake();
    }, 450);
  };
  const windByButton = () => {
    onInteract();
    for (let i = 0; i < 6; i++) addProgress(Math.PI / 3);
    wake();
  };

  return (
    <div ref={rootRef} className="scene-surface relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-2 px-2">
        {phase === "free" && (
          <button type="button" onClick={pullByButton} className="scene-btn border border-steel/50 bg-night/70 text-sm">
            Потягнути нитку
          </button>
        )}
        {phase === "wind" && (
          <button type="button" onClick={windByButton} className="scene-btn border border-steel/50 bg-night/70 text-sm">
            Змотати оберт
          </button>
        )}
        <span className="sr-only" aria-live="polite">
          {phase === "free" ? "Кінець нитки лежить праворуч унизу." : `Змотано приблизно ${pct}%`}
        </span>
      </div>
    </div>
  );
}

function sampleTail(): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < TAIL.length - 1; i++) {
    const [x0, y0] = TAIL[i]!;
    const [x1, y1] = TAIL[i + 1]!;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / SEG));
    for (let k = 0; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      out.push({ x, y, px: x, py: y });
    }
  }
  const [lx, ly] = TAIL[TAIL.length - 1]!;
  out.push({ x: lx, y: ly, px: lx, py: ly });
  return out;
}

/** Нитка з реальною фактурою: смуга зі знімка кладеться вздовж кожної ланки. */
function drawRope(g: CanvasRenderingContext2D, pts: Pt[], strand: HTMLImageElement, m: { w: number; h: number }) {
  let u = 0;
  const k = m.h / THICK; // пікселів смуги на світовий px
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.01) continue;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.save();
    g.translate(a.x, a.y);
    g.rotate(ang);
    let rest = len + 1.2;
    let x = -0.6;
    while (rest > 0) {
      const su = (u * k) % m.w;
      const take = Math.min(rest, (m.w - su) / k);
      g.drawImage(strand, su, 0, Math.max(1, take * k), m.h, x, -THICK / 2, take, THICK);
      x += take;
      rest -= take;
      u += take;
    }
    g.restore();
  }
}

/** Виток на клубку: дуга-«меридіан» під нахилом, тією ж ниткою. */
function drawWrap(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, w: { tilt: number; start: number; len: number; age: number }, strand: HTMLImageElement, m: { w: number; h: number }) {
  const alpha = Math.max(0, 1 - w.age / 6);
  if (alpha <= 0) return;
  const steps = 18;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = w.start + (w.len * i) / steps;
    // Велике коло на сфері, повернуте на tilt, в ортографічній проєкції.
    const x = Math.cos(t) * r * 0.97;
    const yz = Math.sin(t) * r * 0.97;
    const y = yz * Math.cos(w.tilt);
    const z = yz * Math.sin(w.tilt);
    if (z < -r * 0.15) continue; // задня частина — не видно
    pts.push({ x: cx + x, y: cy + y, px: 0, py: 0 });
  }
  if (pts.length < 2) return;
  g.save();
  g.globalAlpha = alpha * 0.9;
  g.save();
  g.scale(1, 1);
  drawRopeThin(g, pts, strand, m, Math.max(6, r * 0.09));
  g.restore();
  g.restore();
}

function drawRopeThin(g: CanvasRenderingContext2D, pts: Pt[], strand: HTMLImageElement, m: { w: number; h: number }, th: number) {
  let u = 0;
  const k = m.h / th;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.save();
    g.translate(a.x, a.y);
    g.rotate(ang);
    const su = (u * k) % (m.w - len * k - 1 > 0 ? m.w - len * k - 1 : 1);
    g.drawImage(strand, su, 0, Math.max(1, len * k), m.h, 0, -th / 2, len + 0.8, th);
    g.restore();
    u += len;
  }
}
