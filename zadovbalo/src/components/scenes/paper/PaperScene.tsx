"use client";

import { useEffect, useRef, useState } from "react";
import type { Pt } from "@/lib/scene/geometry";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import { pointInPoly } from "@/lib/scene/tear";
import type { SceneProps } from "../types";
import { drawPiece, drawTearInProgress, hitPiece, makePiece, stepPieces, tearPiece, toLocal, toWorld, type Piece } from "./pieces";

type Gesture =
  | { kind: "tear"; pointer: number; path: Pt[]; target: Piece | null; entered: boolean }
  | { kind: "hold"; pointer: number; piece: Piece; start: Pt; time: number; last: Pt; crumpling: boolean; moved: number };

export default function PaperScene({ intensity, setHint, onSettled }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  });
  const st = useRef({ pieces: [] as Piece[], w: 1, h: 1, dpr: 1, gesture: null as Gesture | null, tears: 0, lastTearSound: 0, settled: false, dirty: true });

  const draw = () => {
    const s = st.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    // Стіл: мʼяка пляма світла.
    const g = ctx.createRadialGradient(s.w / 2, s.h * 0.45, 20, s.w / 2, s.h * 0.5, Math.max(s.w, s.h) * 0.7);
    g.addColorStop(0, "rgba(86,116,135,0.22)");
    g.addColorStop(1, "rgba(8,19,28,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.w, s.h);
    for (const p of s.pieces) drawPiece(ctx, p, { base: "#e4e6e2" });
    const gst = s.gesture;
    if (gst?.kind === "tear" && gst.entered && gst.target) {
      // Від точки входу до пальця.
      const local = gst.path.map((q) => toLocal(gst.target!, q));
      const firstIn = local.findIndex((q) => pointInPoly(q, gst.target!.poly));
      if (firstIn > 0) drawTearInProgress(ctx, gst.path.slice(firstIn - 1), gst.target.id);
    }
  };

  const settleCheck = () => {
    const s = st.current;
    if (!s.settled && (s.tears >= 3 || s.pieces.some((p) => p.crumple >= 1))) {
      s.settled = true;
      onSettled();
    }
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    let busy = stepPieces(s.pieces, dt);
    const gst = s.gesture;
    if (gst?.kind === "hold") {
      gst.time += dt;
      if (!gst.crumpling && gst.time > 0.32 && gst.moved < 8) {
        gst.crumpling = true;
        setHint("Тримай — папір мнеться. Відпусти, коли досить.");
      }
      if (gst.crumpling && gst.piece.crumple < 1) {
        const before = gst.piece.crumple;
        gst.piece.crumple = Math.min(1, before + dt * (0.35 + 0.2 * intensityRef.current));
        if (Math.floor(before * 10) !== Math.floor(gst.piece.crumple * 10)) {
          sound.play("paper", 0.5 + 0.2 * intensityRef.current);
          haptic(6);
        }
        busy = true;
      }
      busy = true;
    }
    if (busy || s.dirty) {
      draw();
      s.dirty = false;
    }
    return busy || s.gesture !== null;
  });

  const reset = () => {
    const s = st.current;
    const root = rootRef.current!;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const sw = Math.min(w * 0.72, h * 0.62, 420);
    const sh = sw * 1.32;
    const x0 = (w - sw) / 2;
    const y0 = (h - sh) / 2;
    s.pieces = [
      makePiece([
        { x: x0, y: y0 },
        { x: x0 + sw, y: y0 },
        { x: x0 + sw, y: y0 + sh },
        { x: x0, y: y0 + sh },
      ]),
    ];
    s.pieces[0]!.rot = -0.03;
  };

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) {
      setFailed(true);
      return;
    }
    const s = st.current;
    const resize = () => {
      const dpr = detectQuality().dpr;
      const w = root.clientWidth;
      const h = root.clientHeight;
      // Зберігаємо розкладку відносно центру при повороті/ресайзі.
      if (s.pieces.length) for (const p of s.pieces) {
        p.x += (w - s.w) / 2;
        p.y += (h - s.h) / 2;
      }
      Object.assign(s, { w, h, dpr });
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!s.pieces.length) reset();
      s.dirty = true;
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const unbind = bindPointer(root, {
      down: (p) => {
        if (s.gesture) return false;
        const piece = hitPiece(s.pieces, p);
        // Біля самого краю — теж розрив (так зручно «підчепити»).
        const nearEdge = piece && piece.crumple < 0.3 && edgeDistance(piece, p) < 16;
        if (piece && !nearEdge) {
          piece.held = true;
          s.pieces = [...s.pieces.filter((q) => q !== piece), piece];
          s.gesture = { kind: "hold", pointer: p.id, piece, start: p, time: 0, last: p, crumpling: false, moved: 0 };
        } else {
          s.gesture = { kind: "tear", pointer: p.id, path: [p], target: null, entered: false };
        }
        wake();
      },
      move: (p) => {
        const g = s.gesture;
        if (!g || g.pointer !== p.id) return;
        if (g.kind === "hold") {
          g.moved = Math.max(g.moved, Math.hypot(p.x - g.start.x, p.y - g.start.y));
          if (!g.crumpling) {
            const dx = p.x - g.last.x;
            const dy = p.y - g.last.y;
            g.piece.x += dx;
            g.piece.y += dy;
            g.piece.vx = dx * 50;
            g.piece.vy = dy * 50;
            g.piece.vr = dx * 0.004;
            g.piece.rot += dx * 0.0015;
          }
          g.last = p;
        } else {
          const last = g.path[g.path.length - 1]!;
          if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
          g.path.push(p);
          if (!g.target) {
            const t = s.pieces.slice().reverse().find((q) => q.crumple < 0.3 && pointInPoly(toLocal(q, p), q.poly));
            if (t) {
              g.target = t;
              g.entered = true;
              setHint("Веди далі — до іншого краю.");
            }
          } else if (!pointInPoly(toLocal(g.target, p), g.target.poly)) {
            // Вийшли за край — розриваємо.
            const amp = 0.9 + 0.45 * intensityRef.current;
            const res = tearPiece(g.target, g.path, amp);
            if (res) {
              s.pieces = [...s.pieces.filter((q) => q !== g.target), ...res];
              s.tears++;
              sound.play("tear", 0.7 + 0.15 * intensityRef.current);
              haptic(18);
              setHint(s.tears === 1 ? "Ще. Можна рвати шматки далі або змʼяти." : "Шматки можна відсунути пальцем.");
              settleCheck();
            }
            s.gesture = { kind: "tear", pointer: p.id, path: [p], target: null, entered: false };
          } else if (performance.now() - s.lastTearSound > 90) {
            s.lastTearSound = performance.now();
            sound.play("tear", 0.35);
          }
        }
        s.dirty = true;
        wake();
      },
      up: () => {
        const g = s.gesture;
        if (g?.kind === "hold") {
          g.piece.held = false;
          if (g.crumpling) {
            settleCheck();
            if (g.piece.crumple >= 1) setHint("Змʼято. Можна відкинути пальцем.");
          }
        }
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

  // Кнопки — доступна альтернатива жестам.
  const tearButton = () => {
    const s = st.current;
    const target = [...s.pieces].filter((p) => p.crumple < 0.3).sort((a, b) => area(b) - area(a))[0];
    if (!target) return;
    const c = toWorld(target, target.c);
    const ang = Math.random() * Math.PI;
    const R = 900;
    const path: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24 - 0.5;
      path.push({ x: c.x + Math.cos(ang) * R * t + Math.sin(t * 9) * 8, y: c.y + Math.sin(ang) * R * t + Math.cos(t * 7) * 8 });
    }
    const res = tearPiece(target, path, 0.9 + 0.45 * intensity);
    if (res) {
      s.pieces = [...s.pieces.filter((q) => q !== target), ...res];
      s.tears++;
      sound.play("tear", 0.8);
      settleCheck();
    }
    s.dirty = true;
    wake();
  };
  const crumpleButton = () => {
    const s = st.current;
    const target = s.pieces.find((p) => p.crumple < 1);
    if (!target) return;
    const run = () => {
      target.crumple = Math.min(1, target.crumple + 0.05);
      s.dirty = true;
      wake();
      if (target.crumple < 1) requestAnimationFrame(run);
      else settleCheck();
    };
    sound.play("paper", 0.8);
    run();
  };
  const setAside = () => {
    const s = st.current;
    s.pieces.forEach((p, i) => {
      const c = toWorld(p, p.c);
      p.vx = (s.w * 0.86 - c.x) * 2.4;
      p.vy = (s.h * 0.82 - c.y + i * 4) * 2.4;
      p.vr = 0.3;
    });
    sound.play("paper", 0.5);
    wake();
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Аркуш паперу. Проведи через нього, щоб розірвати; затисни, щоб змʼяти." className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-3 pt-2">
        <button type="button" className="scene-btn border border-steel/50" onClick={tearButton}>
          Розірвати
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={crumpleButton}>
          Змʼяти
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={setAside}>
          Відкласти шматки
        </button>
      </div>
    </div>
  );
}

function area(p: Piece) {
  let a = 0;
  for (let i = 0; i < p.poly.length; i++) {
    const u = p.poly[i]!;
    const v = p.poly[(i + 1) % p.poly.length]!;
    a += u.x * v.y - v.x * u.y;
  }
  return Math.abs(a) / 2;
}

function edgeDistance(p: Piece, w: Pt) {
  const q = toLocal(p, w);
  let best = Infinity;
  for (let i = 0; i < p.poly.length; i++) {
    const a = p.poly[i]!;
    const b = p.poly[(i + 1) % p.poly.length]!;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1)));
    best = Math.min(best, Math.hypot(q.x - (a.x + (b.x - a.x) * t), q.y - (a.y + (b.y - a.y) * t)));
  }
  return best;
}
