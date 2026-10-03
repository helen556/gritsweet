"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { hash2 } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

const SEG = 7;
const TOTAL_SEGMENTS = 170;
const FAST = 950; // px/с — різкий ривок

interface P {
  x: number;
  y: number;
  px: number;
  py: number;
}

export default function YarnScene({ reducedMotion, setHint, onSettled }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [easy, setEasy] = useState(false);
  const [failed, setFailed] = useState(false);
  const easyRef = useRef(easy);
  useEffect(() => {
    easyRef.current = easy;
  });

  const st = useRef({
    w: 1,
    h: 1,
    dpr: 1,
    ball: { x: 0, y: 0, r0: 60, jx: 0, jy: 0 },
    pts: [] as P[],
    remaining: TOTAL_SEGMENTS,
    spin: 0,
    held: null as null | { pointer: number; x: number; y: number; speed: number; lastT: number },
    tension: 0,
    help: 0,
    strands: [] as { a: number; b: number; c: number }[],
    winding: -1,
    coil: [] as { x: number; y: number }[],
    done: false,
    t: 0,
    lastSound: 0,
    /** До коли пульсує кінчик після останньої дії (щоб цикл засинав). */
    awakeUntil: 8,
  });

  const ballR = () => {
    const s = st.current;
    return Math.max(0, s.ball.r0 * Math.cbrt(s.remaining / TOTAL_SEGMENTS));
  };

  const anchor = () => {
    const s = st.current;
    const r = ballR();
    const first = s.pts[1] ?? s.pts[0];
    const bx = s.ball.x + s.ball.jx;
    const by = s.ball.y + s.ball.jy;
    if (!first) return { x: bx + r, y: by };
    const a = Math.atan2(first.y - by, first.x - bx);
    return { x: bx + Math.cos(a) * r * 0.92, y: by + Math.sin(a) * r * 0.92 };
  };

  const init = () => {
    const s = st.current;
    const root = rootRef.current!;
    s.w = root.clientWidth;
    s.h = root.clientHeight;
    const r0 = Math.min(s.w, s.h) * 0.16;
    s.ball = { x: s.w * 0.36, y: s.h * 0.46, r0, jx: 0, jy: 0 };
    s.remaining = TOTAL_SEGMENTS - 6;
    s.pts = [];
    for (let i = 0; i < 7; i++) {
      const x = s.ball.x + r0 * 0.9 + i * SEG * 0.9;
      const y = s.ball.y + r0 * 0.4 + Math.sin(i) * 3;
      s.pts.push({ x, y, px: x, py: y });
    }
    s.strands = Array.from({ length: 46 }, (_, i) => ({ a: hash2(i, 1) * Math.PI, b: hash2(i, 2) * Math.PI * 2, c: hash2(i, 3) }));
  };

  const draw = () => {
    const s = st.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    // Стіл.
    const g = ctx.createRadialGradient(s.w * 0.5, s.h * 0.45, 20, s.w * 0.5, s.h * 0.5, Math.max(s.w, s.h) * 0.7);
    g.addColorStop(0, "rgba(86,116,135,0.2)");
    g.addColorStop(1, "rgba(8,19,28,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.w, s.h);

    drawRope(ctx);
    const r = ballR();
    if (r > 2) drawBall(ctx, s.ball.x + s.ball.jx, s.ball.y + s.ball.jy, r);
    if (s.winding >= 0) drawSkeinShine(ctx);
    // Підсвічений кінчик.
    const tip = s.pts[s.pts.length - 1];
    if (tip && !s.done) {
      const pulse = reducedMotion ? 0.6 : 0.5 + 0.3 * Math.sin(s.t * 3);
      const glowR = 18 + 14 * s.help;
      const tg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, glowR);
      tg.addColorStop(0, `rgba(216,192,165,${0.55 * pulse + 0.35 * s.help})`);
      tg.addColorStop(1, "rgba(216,192,165,0)");
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawRope = (ctx: CanvasRenderingContext2D) => {
    const s = st.current;
    const pts = s.pts;
    if (pts.length < 2) return;
    const a = anchor();
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i]!.x + pts[i + 1]!.x) / 2;
        const my = (pts[i]!.y + pts[i + 1]!.y) / 2;
        ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, mx, my);
      }
      const last = pts[pts.length - 1]!;
      ctx.lineTo(last.x, last.y);
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Тінь нитки на столі.
    ctx.save();
    ctx.translate(2, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.filter = "blur(2px)";
    path();
    ctx.stroke();
    ctx.restore();
    // Трубка: темний контур, основний колір, відблиск, скрутка.
    const taut = Math.min(1, s.tension);
    ctx.strokeStyle = "#22343f";
    ctx.lineWidth = 5.5 - taut * 1;
    path();
    ctx.stroke();
    ctx.strokeStyle = taut > 0.5 ? "#b9c7cc" : "#9fb0ba";
    ctx.lineWidth = 3.8 - taut * 0.8;
    path();
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = "rgba(34,52,63,0.45)";
    ctx.lineWidth = 3.6 - taut;
    ctx.setLineDash([2, 3]);
    path();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(-0.8, -0.9);
    ctx.strokeStyle = "rgba(231,235,237,0.55)";
    ctx.lineWidth = 1;
    path();
    ctx.stroke();
    ctx.restore();
  };

  /** Клубок: сфера з витками нитки спереду й ззаду; обертається, коли нитка розмотується. */
  const drawBall = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    const s = st.current;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 12;
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    body.addColorStop(0, "#a9bac2");
    body.addColorStop(0.7, "#6c8291");
    body.addColorStop(1, "#33495a");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    for (const pass of [0, 1] as const)
      for (const st2 of s.strands) {
        // Великий круг на сфері, повернутий на spin.
        const a = st2.a;
        const b = st2.b + s.spin * (0.6 + st2.c);
        ctx.beginPath();
        let started = false;
        for (let k = 0; k <= 40; k++) {
          const t = (k / 40) * Math.PI * 2;
          const px = Math.cos(t);
          const py = Math.sin(t) * Math.cos(a);
          const pz = Math.sin(t) * Math.sin(a);
          const rx = px * Math.cos(b) - pz * Math.sin(b);
          const rz = px * Math.sin(b) + pz * Math.cos(b);
          const front = rz > 0;
          if ((pass === 1) !== front) {
            started = false;
            continue;
          }
          const sx = x + rx * r * 0.96;
          const sy = y + py * r * 0.96;
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else ctx.lineTo(sx, sy);
        }
        if (pass === 1) {
          // Виток спереду: темний край + світла нитка — як трубочка.
          ctx.strokeStyle = "rgba(20,32,40,0.55)";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.strokeStyle = "rgba(196,210,216,0.75)";
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else {
          ctx.strokeStyle = "rgba(20,32,40,0.45)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    // Обʼєм зверху.
    const shade = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 1.05);
    shade.addColorStop(0, "rgba(255,255,255,0.18)");
    shade.addColorStop(0.6, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(8,19,28,0.55)");
    ctx.fillStyle = shade;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  const drawSkeinShine = (ctx: CanvasRenderingContext2D) => {
    const s = st.current;
    if (s.winding < 1 || !s.coil.length) return;
    const c = s.coil[Math.floor(s.coil.length / 2)]!;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 120);
    g.addColorStop(0, "rgba(159,176,186,0.12)");
    g.addColorStop(1, "rgba(159,176,186,0)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - 130, c.y - 130, 260, 260);
  };

  const finish = () => {
    const s = st.current;
    if (s.winding >= 0) return;
    s.winding = 0;
    s.held = null;
    // Охайний моток: витки еліпса, що лягають один на одного.
    const cx = s.w * 0.62;
    const cy = s.h * 0.5;
    const rx = Math.min(s.w, s.h) * 0.18;
    const ry = rx * 0.42;
    s.coil = s.pts.map((_, i) => {
      const t = (i / s.pts.length) * Math.PI * 2 * 9;
      const drift = (i / s.pts.length - 0.5) * ry * 0.9;
      return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry + drift };
    });
    setHint("Охайний моток. Можна видихнути.");
    onSettled();
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    const pts = s.pts;
    if (pts.length === 0) return false; // ще не ініціалізовано або немає canvas
    s.t += dt;
    s.help = Math.max(0, s.help - dt * 0.4);
    if (s.winding >= 0) {
      s.winding = Math.min(1, s.winding + dt * (reducedMotion ? 3 : 0.45));
      const k = Math.min(1, dt * 3);
      pts.forEach((p, i) => {
        const c = s.coil[i]!;
        p.x += (c.x - p.x) * k;
        p.y += (c.y - p.y) * k;
        p.px = p.x;
        p.py = p.y;
      });
      draw();
      return s.winding < 1 || pts.some((p, i) => Math.hypot(p.x - s.coil[i]!.x, p.y - s.coil[i]!.y) > 0.5);
    }
    // Verlet із сильним тертям (вигляд згори: нитка лягає, де поклали).
    for (const p of pts) {
      const vx = (p.x - p.px) * 0.86;
      const vy = (p.y - p.py) * 0.86;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy;
    }
    const tip = pts[pts.length - 1];
    if (s.held && tip) {
      tip.x = s.held.x;
      tip.y = s.held.y;
    }
    for (let it = 0; it < 14; it++) {
      const a = anchor();
      pts[0]!.x = a.x;
      pts[0]!.y = a.y;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i]!;
        const q = pts[i + 1]!;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const diff = (d - SEG) / d;
        const pinP = i === 0;
        const pinQ = i + 1 === pts.length - 1 && s.held;
        if (pinP && pinQ) continue;
        const wp = pinP ? 0 : pinQ ? 1 : 0.5;
        const wq = pinQ ? 0 : pinP ? 1 : 0.5;
        p.x += dx * diff * wp;
        p.y += dy * diff * wp;
        q.x -= dx * diff * wq;
        q.y -= dy * diff * wq;
      }
    }
    // Натяг: наскільки нитка довша за свою довжину між клубком і пальцем.
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    const stretch = len / ((pts.length - 1) * SEG);
    s.tension += ((s.held ? Math.max(0, (stretch - 1) * 6) : 0) - s.tension) * Math.min(1, dt * 8);
    // Розмотування: повільно — нитка йде легко; різко — підвищений натяг і пауза, без покарання.
    if (s.held && s.remaining > 0 && stretch > 1.01) {
      const fast = !easyRef.current && s.held.speed > FAST;
      const rate = easyRef.current ? 3 : fast ? 0.25 : 1.6;
      const add = Math.min(s.remaining, Math.max(1, Math.round((stretch - 1) * 30 * rate)));
      for (let k = 0; k < add; k++) {
        const a = anchor();
        pts.splice(1, 0, { x: a.x, y: a.y, px: a.x, py: a.y });
        s.remaining--;
      }
      s.spin += add * 0.06;
      if (fast) {
        s.ball.jx += (Math.random() - 0.5) * 3;
        s.ball.jy += (Math.random() - 0.5) * 3;
        if (s.t - s.lastSound > 0.25) {
          s.lastSound = s.t;
          setHint("Різко — затягується. Повільніше, і піде.");
          haptic(6);
        }
      } else if (s.t - s.lastSound > 0.18) {
        s.lastSound = s.t;
        sound.play("soft", 0.15);
      }
    }
    s.ball.jx *= 0.85;
    s.ball.jy *= 0.85;
    if (s.remaining <= 0 && !s.held && s.winding < 0) finish();
    draw();
    return Boolean(s.held) || s.tension > 0.01 || pts.some((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py) > 0.05) || (!reducedMotion && s.t < s.awakeUntil);
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !canvas.getContext("2d")) {
      setFailed(true);
      return;
    }
    const s = st.current;
    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const dpr = detectQuality().dpr;
      if (!s.pts.length) {
        Object.assign(s, { dpr });
        init();
      } else {
        const dx = (w - s.w) / 2;
        const dy = (h - s.h) / 2;
        s.ball.x += dx;
        s.ball.y += dy;
        for (const p of s.pts) {
          p.x += dx;
          p.y += dy;
          p.px += dx;
          p.py += dy;
        }
        s.coil = s.coil.map((c) => ({ x: c.x + dx, y: c.y + dy }));
        Object.assign(s, { w, h, dpr });
      }
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    const unbind = bindPointer(root, {
      down: (p) => {
        const tip = s.pts[s.pts.length - 1];
        if (!tip || s.winding >= 0) return false;
        if (Math.hypot(p.x - tip.x, p.y - tip.y) > 44) {
          s.help = 1;
          s.awakeUntil = s.t + 8;
          setHint("Кінчик світиться біля клубка — візьмись за нього.");
          wake();
          return false;
        }
        s.held = { pointer: p.id, x: p.x, y: p.y, speed: 0, lastT: p.time };
        s.awakeUntil = s.t + 8;
        setHint("Повільно тягни — і клубок піддається.");
        wake();
      },
      move: (p) => {
        const h = s.held;
        if (!h || h.pointer !== p.id) return;
        const dt = Math.max(1, p.time - h.lastT) / 1000;
        const v = Math.hypot(p.x - h.x, p.y - h.y) / dt;
        h.speed = h.speed * 0.7 + v * 0.3;
        h.x = Math.max(8, Math.min(s.w - 8, p.x));
        h.y = Math.max(8, Math.min(s.h - 8, p.y));
        h.lastT = p.time;
        wake();
      },
      up: () => {
        s.held = null;
        s.awakeUntil = s.t + 8;
        wake();
      },
    });
    return () => {
      ro.disconnect();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- привʼязка один раз
  }, []);

  /** Клавіатура: акуратно витягнути трохи нитки. */
  const pullStep = () => {
    const s = st.current;
    if (s.winding >= 0) return;
    const tip = s.pts[s.pts.length - 1]!;
    const steps = Math.min(s.remaining, 18);
    for (let k = 0; k < steps; k++) {
      const a = anchor();
      s.pts.splice(1, 0, { x: a.x, y: a.y, px: a.x, py: a.y });
      s.remaining--;
    }
    s.spin += steps * 0.06;
    const ang = (s.pts.length * 0.11) % (Math.PI * 2);
    tip.x = s.w * 0.62 + Math.cos(ang) * s.w * 0.25;
    tip.y = s.h * 0.5 + Math.sin(ang) * s.h * 0.3;
    if (s.remaining <= 0) finish();
    wake();
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Заплутаний клубок. Візьмись за світлий кінчик нитки й повільно тягни." className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-3 pt-2">
        <button type="button" role="switch" aria-checked={easy} className={cn("scene-btn border", easy ? "border-frost bg-frost text-abyss hover:bg-white hover:text-abyss" : "border-steel/50")} onClick={() => setEasy((v) => !v)}>
          Легкий режим
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={() => {
          st.current.help = 1;
          setHint("Кінчик світиться біля клубка — візьмись за нього й тягни повільно.");
          wake();
        }}>
          Підказка
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={pullStep}>
          Потягнути трохи
        </button>
      </div>
    </div>
  );
}
