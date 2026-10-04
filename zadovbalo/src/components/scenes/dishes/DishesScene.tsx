"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound, variant } from "@/lib/scene/sound";
import type { SceneProps } from "../types";
import { fractureBottle, fracturePlate, type Pt, type ShardShape } from "./fracture";

interface Meta {
  size: [number, number];
  seamY: number;
  horizonY: number;
  plate: { box: [number, number, number, number]; cx: number; cy: number; r: number };
  bottle: { box: [number, number, number, number]; axis: [Pt, Pt] };
}

type Kind = "plate" | "bottle";

/* Перспектива в координатах фото (px). Камера на висоті H над підлогою, стіна на глибині ZW. */
const F = 900;
const ZW = 1.25;
const H = 0.52;
const Z0 = 0.87; // де предмет «у руці»
const G = 9.8;
const PX_PER_M: Record<Kind, number> = { plate: 1020, bottle: 1400 };
const MAX_SHARDS = 150;
const SOUNDS = ["ceramic-0", "ceramic-1", "glass-0", "glass-1", "ceramic-tink-0", "ceramic-tink-1", "ceramic-tink-2", "glass-tink-0", "glass-tink-1", "glass-tink-2"] as const;

async function loadDishes() {
  const meta = await loadJson<Meta>("/scenes/dishes/dishes.json");
  const [wall, plate, bottle] = await Promise.all([
    loadImage("/scenes/dishes/wall.webp"),
    loadImage("/scenes/dishes/plate.webp"),
    loadImage("/scenes/dishes/bottle.webp"),
  ]);
  // Профіль ширини пляшки вздовж осі — з альфа-каналу (шматки скла не виходять за силует).
  const c = document.createElement("canvas");
  c.width = bottle.naturalWidth;
  c.height = bottle.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bottle, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const [bx, by] = meta.bottle.box;
  const axis: [Pt, Pt] = [
    [meta.bottle.axis[0][0] - bx, meta.bottle.axis[0][1] - by],
    [meta.bottle.axis[1][0] - bx, meta.bottle.axis[1][1] - by],
  ];
  const L = Math.hypot(axis[1][0] - axis[0][0], axis[1][1] - axis[0][1]);
  const ux = (axis[1][0] - axis[0][0]) / L;
  const uy = (axis[1][1] - axis[0][1]) / L;
  const profile: { u: number; v0: number; v1: number }[] = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    let v0 = 0;
    let v1 = 0;
    for (let v = -120; v <= 120; v++) {
      const x = Math.round(axis[0][0] + ux * u * L - uy * v);
      const y = Math.round(axis[0][1] + uy * u * L + ux * v);
      if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
      if (data[(y * c.width + x) * 4 + 3]! > 90) {
        if (v < v0) v0 = v;
        if (v > v1) v1 = v;
      }
    }
    profile.push({ u, v0: v0 + 1, v1: v1 - 1 });
  }
  return { meta, wall, plate, bottle, axis, profile };
}

export default function DishesScene(props: SceneProps) {
  const assets = useSceneAssets(loadDishes);
  useEffect(() => sound.preload(SOUNDS), []);
  if (assets.status === "loading")
    return (
      <div role="status" className="grid h-full place-items-center text-sm text-mist">
        Готую стіну…
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
  return <Dishes {...props} {...assets.data} />;
}

interface Shard {
  kind: Kind;
  shape: ShardShape;
  tex: CanvasImageSource;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  th: number;
  w: number;
  /** Нахил (обертання навколо власної осі): видно товщину краю. */
  ph: number;
  wph: number;
  rest: boolean;
  bounces: number;
  fade: number;
  born: number;
}

interface Held {
  kind: Kind;
  /** Світові координати центру. */
  x: number;
  y: number;
  z: number;
  th: number;
  phase: "ready" | "drag" | "back" | "flight";
  /** Політ */
  t: number;
  T: number;
  from: [number, number, number];
  to: [number, number, number];
  lob: number;
  spin: number;
  grab: { id: number; dx: number; dy: number } | null;
  hist: { t: number; x: number; y: number }[];
}

function Dishes({
  meta,
  wall,
  plate,
  bottle,
  axis,
  profile,
  reducedMotion,
  setHint,
  onInteract,
  onSwitch,
}: SceneProps & Awaited<ReturnType<typeof loadDishes>>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const { canvasRef, size } = useCanvas2D();
  const [kind, setKind] = useState<Kind>("plate");
  const [phase, setPhase] = useState<"ready" | "flying" | "broken">("ready");
  const [label, setLabel] = useState("");
  const [writing, setWriting] = useState(false);
  const [breaks, setBreaks] = useState(0);

  const W = meta.size[0];
  const CX = W / 2;
  const CY = meta.horizonY;
  const REST: Record<Kind, [number, number]> = { plate: [CX, 690], bottle: [CX, 620] };
  /** Поворот, що ставить пляшку зі знімка вертикально. */
  const bottleUpright = Math.atan2(axis[1][0] - axis[0][0], axis[1][1] - axis[0][1]);

  const sim = useLazyRef(() => ({
    shards: [] as Shard[],
    dust: [] as { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; c: string }[],
    // предмет одразу «в руці»: тарілка за замовчуванням
    held: null as Held | null,
    initialized: false,
    shake: 0,
    lastTink: 0,
    now: 0,
  }));
  const marks = useLazyRef(() => {
    const c = document.createElement("canvas");
    c.width = meta.size[0];
    c.height = meta.size[1];
    return c;
  });
  /** Тарілка з написом (якщо людина щось написала) — уламки успадковують текстуру. */
  const plateTex = useLazyRef<{ canvas: HTMLCanvasElement | null; text: string }>(() => ({ canvas: null, text: "" }));

  const view = useCallback(() => {
    const [w, h] = meta.size;
    const portrait = size.width / size.height < (w / h) * 1.3;
    const s = portrait ? Math.max(size.width / w, size.height / h) : size.height / h;
    return { s, ox: (size.width - w * s) / 2, oy: (size.height - h * s) / 2 };
  }, [size, meta.size]);

  const project = (x: number, y: number, z: number) => ({ sx: CX + (F * x) / z, sy: CY - (F * y) / z, k: F / z });
  const unproject = (sx: number, sy: number, z: number) => ({ x: ((sx - CX) * z) / F, y: ((CY - sy) * z) / F });

  const texFor = useCallback(
    (k: Kind): CanvasImageSource => {
      if (k === "bottle") return bottle;
      const t = plateTex.current;
      if (!label.trim()) return plate;
      if (t.canvas && t.text === label) return t.canvas;
      const c = document.createElement("canvas");
      c.width = plate.naturalWidth;
      c.height = plate.naturalHeight;
      const g = c.getContext("2d")!;
      g.drawImage(plate, 0, 0);
      const pcx = meta.plate.cx - meta.plate.box[0];
      const pcy = meta.plate.cy - meta.plate.box[1];
      g.save();
      g.translate(pcx, pcy);
      g.rotate(-0.08);
      g.fillStyle = "rgba(58,36,28,0.82)";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const words = label.trim().split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (next.length > 14 && cur) {
          lines.push(cur);
          cur = w;
        } else cur = next;
      }
      if (cur) lines.push(cur);
      const shown = lines.slice(0, 3);
      const fs = shown.length > 2 ? 26 : 32;
      g.font = `italic 600 ${fs}px "Playfair Display", Georgia, serif`;
      shown.forEach((ln, i) => g.fillText(ln, 0, (i - (shown.length - 1) / 2) * fs * 1.15, 200));
      g.restore();
      plateTex.current = { canvas: c, text: label };
      return c;
    },
    [bottle, plate, label, meta.plate, plateTex],
  );

  const spawn = useCallback(
    (k: Kind) => {
      const [rx, ry] = REST[k];
      const w = unproject(rx, ry, Z0);
      sim.current.held = { kind: k, x: w.x, y: w.y, z: Z0, th: 0, phase: "ready", t: 0, T: 0, from: [0, 0, 0], to: [0, 0, 0], lob: 0, spin: 0, grab: null, hist: [] };
      setPhase("ready");
    },
    // REST — константа з розмірів кадру
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim],
  );


  /** Тріщини й пил на стіні в місці удару (лишаються). */
  const markWall = useCallback(
    (sx: number, sy: number, k: Kind, energy: number) => {
      const g = marks.current.getContext("2d")!;
      const n = 7 + Math.floor(Math.random() * 5);
      g.save();
      g.lineCap = "round";
      for (let i = 0; i < n; i++) {
        let a = Math.random() * Math.PI * 2;
        let x = sx;
        let y = sy;
        const len = (26 + Math.random() * 60) * energy;
        g.beginPath();
        g.moveTo(x, y);
        for (let d = 0; d < len; d += 4) {
          a += (Math.random() - 0.5) * 0.7;
          x += Math.cos(a) * 4;
          y += Math.sin(a) * 4;
          g.lineTo(x, y);
        }
        g.strokeStyle = `rgba(14,11,9,${0.6 + Math.random() * 0.3})`;
        g.lineWidth = 1.2 + Math.random() * 1.2;
        g.stroke();
      }
      // вибоїна й пил
      const dent = g.createRadialGradient(sx, sy, 0, sx, sy, 16 * energy);
      dent.addColorStop(0, "rgba(15,12,10,0.45)");
      dent.addColorStop(1, "rgba(15,12,10,0)");
      g.fillStyle = dent;
      g.beginPath();
      g.arc(sx, sy, 16 * energy, 0, Math.PI * 2);
      g.fill();
      if (k === "plate") {
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() ** 1.6 * 34 * energy;
          g.fillStyle = `rgba(222,210,188,${0.25 + Math.random() * 0.4})`;
          g.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
        }
      }
      g.restore();
    },
    [marks],
  );

  const shatter = useCallback(
    (h: Held, vIn: [number, number, number]) => {
      const s = sim.current;
      const tex = texFor(h.kind);
      const pxm = PX_PER_M[h.kind];
      const seed = (Math.random() * 1e9) | 0;
      let shapes: ShardShape[];
      let pivot: Pt;
      if (h.kind === "plate") {
        const pcx = meta.plate.cx - meta.plate.box[0];
        const pcy = meta.plate.cy - meta.plate.box[1];
        const ix = pcx + (Math.random() - 0.5) * 40;
        const iy = pcy + (Math.random() - 0.5) * 40;
        shapes = fracturePlate(pcx, pcy, meta.plate.r + 1.5, meta.plate.r - 1.5, ix, iy, seed);
        pivot = [pcx, pcy];
      } else {
        shapes = fractureBottle(axis, profile, seed);
        pivot = [(axis[0][0] + axis[1][0]) / 2, (axis[0][1] + axis[1][1]) / 2];
      }
      const speed = Math.hypot(...vIn);
      const energy = Math.min(1.4, 0.6 + speed / 6);
      const rot = h.kind === "bottle" ? h.th + bottleUpright : h.th;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      for (const sh of shapes) {
        // положення шматка у світі: поворот предмета + масштаб спрайта
        const lx = (sh.c[0] - pivot[0]) / pxm;
        const ly = (sh.c[1] - pivot[1]) / pxm;
        const wx = h.x + lx * cos - ly * sin;
        const wy = h.y - (lx * sin + ly * cos);
        const dx = wx - h.x;
        const dy = wy - h.y;
        const dl = Math.hypot(dx, dy) || 1;
        const small = 1 / Math.sqrt(Math.max(30, sh.area) / 600);
        // більшість шматків лишається біля стіни й падає; лише частина відлітає далі
        const out = (0.15 + Math.random() ** 2 * 1.3) * energy * Math.min(1.6, small);
        s.shards.push({
          kind: h.kind,
          shape: sh,
          tex,
          x: wx,
          y: wy,
          z: ZW - 0.012,
          vx: (dx / dl) * out + vIn[0] * 0.15 + (Math.random() - 0.5) * 0.3,
          vy: (dy / dl) * out * 0.8 + 0.4 * Math.random(),
          vz: -(0.1 + Math.random() ** 1.5 * 0.8) * energy,
          th: rot,
          w: (Math.random() - 0.5) * 14 * Math.min(2, small),
          ph: 0,
          wph: (Math.random() - 0.5) * 16,
          rest: false,
          bounces: 0,
          fade: 0,
          born: s.now,
        });
      }
      // пил кераміки / дрібні скляні іскорки
      for (let i = 0; i < (h.kind === "plate" ? 46 : 30); i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * 1.6 * energy;
        s.dust.push({
          x: h.x,
          y: h.y,
          z: ZW - 0.01,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v + 0.3,
          vz: -Math.random() * 0.5,
          life: 0.5 + Math.random() * 0.7,
          c: h.kind === "plate" ? "232,220,198" : "205,230,170",
        });
      }
      // ліміт тіл: найстаріші мʼяко зникають
      const alive = s.shards.filter((x) => x.fade === 0);
      for (let i = 0; i < alive.length - MAX_SHARDS; i++) alive[i]!.fade = 0.001;
      const p = project(h.x, h.y, ZW);
      markWall(p.sx, p.sy, h.kind, energy);
      if (!reducedMotion) s.shake = 0.18;
      sound.sample(h.kind === "plate" ? variant("ceramic-", 2) : variant("glass-", 2), { gain: Math.min(1, 0.55 + speed / 14), rate: 0.94 + Math.random() * 0.12 });
      haptic(18);
      s.held = null;
      setPhase("broken");
      setBreaks((n) => n + 1);
      setHint(h.kind === "plate" ? "Тарілка розлетілась. Ще одну?" : "Пляшка розбилась. Ще одну?");
    },
    // project — чиста функція констант
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, texFor, meta.plate, axis, profile, markWall, reducedMotion, setHint, bottleUpright],
  );

  /** Кидок: напрям і сила з жесту (обмежені), ціль — точка на стіні. */
  const launch = useCallback(
    (dirX: number, dirY: number, strength: number) => {
      const h = sim.current.held;
      if (!h) return;
      const st = Math.max(0.25, Math.min(1, strength));
      const start = project(h.x, h.y, h.z);
      const steep = Math.max(0.35, -dirY / (Math.hypot(dirX, dirY) || 1));
      const tx = Math.max(70, Math.min(W - 70, start.sx + (dirX / (Math.abs(dirY) + 1e-3)) * 260 * steep));
      const ty = Math.max(170, Math.min(560, 520 - 300 * st * steep));
      const target = unproject(tx, ty, ZW);
      h.phase = "flight";
      h.grab = null;
      h.t = 0;
      h.T = 0.62 - 0.28 * st;
      h.from = [h.x, h.y, h.z];
      h.to = [target.x, target.y, ZW];
      h.lob = 0.12 * (1 - st * 0.6);
      h.spin = h.kind === "bottle" ? (dirX >= 0 ? 1 : -1) * (7 + 7 * st) : dirX * 0.004 + (Math.random() - 0.5) * 3;
      setPhase("flying");
      wake();
    },
    // project/unproject — чисті функції констант
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, W],
  );

  const wake = useFrameLoop(rootRef, (dt, now) => {
    const s = sim.current;
    s.now = now / 1000;
    if (!s.initialized) {
      s.initialized = true;
      const w = unproject(...REST.plate, Z0);
      s.held = { kind: "plate", x: w.x, y: w.y, z: Z0, th: 0, phase: "ready", t: 0, T: 0, from: [0, 0, 0], to: [0, 0, 0], lob: 0, spin: 0, grab: null, hist: [] };
    }
    const g = canvasRef.current?.getContext("2d");
    if (!g || !size.width) return false;
    let busy = false;

    // --- предмет ---
    const h = s.held;
    if (h) {
      if (h.phase === "flight") {
        busy = true;
        h.t += dt;
        const u = Math.min(1, h.t / h.T);
        const e = u ** 0.85;
        const px = h.x;
        const py = h.y;
        const pz = h.z;
        h.x = h.from[0] + (h.to[0] - h.from[0]) * e;
        h.y = h.from[1] + (h.to[1] - h.from[1]) * e + h.lob * Math.sin(Math.PI * u);
        h.z = h.from[2] + (h.to[2] - h.from[2]) * e;
        h.th += h.spin * dt;
        if (u >= 1) shatter(h, [(h.x - px) / dt, (h.y - py) / dt, (h.z - pz) / dt]);
      } else if (h.phase === "back") {
        // недокинув — мʼяко повертається в руку
        busy = true;
        const w = unproject(...REST[h.kind], Z0);
        h.x += (w.x - h.x) * Math.min(1, dt * 9);
        h.y += (w.y - h.y) * Math.min(1, dt * 9);
        h.th *= Math.exp(-dt * 8);
        if (Math.hypot(w.x - h.x, w.y - h.y) < 0.001) h.phase = "ready";
      }
    }

    // --- уламки ---
    const floorY = -H;
    for (const sh of s.shards) {
      if (sh.fade > 0) {
        sh.fade += dt / 0.7;
        busy = true;
      }
      if (sh.rest) continue;
      busy = true;
      sh.vy -= G * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.z += sh.vz * dt;
      sh.th += sh.w * dt;
      sh.ph += sh.wph * dt;
      if (sh.z > ZW - 0.01) {
        sh.z = ZW - 0.01;
        sh.vz = -Math.abs(sh.vz) * 0.3;
      }
      if (sh.z < 0.86) {
        sh.z = 0.86;
        sh.vz = Math.abs(sh.vz) * 0.2;
      }
      if (sh.y < floorY) {
        sh.y = floorY;
        const impact = -sh.vy;
        if (impact > 0.5 && sh.bounces < 3) {
          sh.vy = impact * 0.26;
          sh.vx *= 0.55;
          sh.vz *= 0.55;
          sh.w *= 0.5;
          sh.wph *= 0.4;
          sh.bounces++;
          if (s.now - s.lastTink > 0.035 && sh.shape.area > 40) {
            s.lastTink = s.now;
            sound.sample(sh.kind === "plate" ? variant("ceramic-tink-", 3) : variant("glass-tink-", 3), {
              gain: Math.min(0.5, impact * 0.12) * (sh.bounces === 1 ? 1 : 0.5),
              rate: 0.9 + Math.random() * 0.3,
              pan: Math.max(-0.8, Math.min(0.8, sh.x * 1.5)),
            });
          }
        } else {
          // ковзання й зупинка
          sh.vy = 0;
          sh.vx *= Math.exp(-dt * 9);
          sh.vz *= Math.exp(-dt * 9);
          sh.w *= Math.exp(-dt * 10);
          // лягає пласко
          const flat = Math.round(sh.ph / Math.PI) * Math.PI;
          sh.ph += (flat - sh.ph) * Math.min(1, dt * 12);
          sh.wph = 0;
          if (Math.hypot(sh.vx, sh.vz) < 0.02) {
            sh.rest = true;
            sh.ph = flat;
          }
        }
      }
    }
    s.shards = s.shards.filter((x) => x.fade < 1);
    for (const d of s.dust) {
      d.vy -= G * 0.35 * dt;
      d.vx *= Math.exp(-dt * 2.5);
      d.vy *= Math.exp(-dt * 1.5);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.life -= dt;
    }
    s.dust = s.dust.filter((d) => d.life > 0 && d.y > floorY);
    if (s.dust.length) busy = true;
    if (s.shake > 0) {
      s.shake = Math.max(0, s.shake - dt);
      busy = true;
    }

    // --- кадр ---
    const { s: sc, ox, oy } = view();
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.fillStyle = "#1b1714";
    g.fillRect(0, 0, size.width, size.height);
    const shake = s.shake > 0 ? Math.sin(s.now * 90) * s.shake * 10 : 0;
    g.save();
    g.translate(ox + shake, oy);
    g.scale(sc, sc);
    const [iw, ih] = meta.size;
    g.drawImage(wall, 0, 0, iw, ih);
    // широкий екран: стіна дзеркально продовжується в бік і тоне в тіні
    if (ox > 0) {
      for (const side of [-1, 1]) {
        g.save();
        g.translate(side < 0 ? 0 : iw * 2, 0);
        g.scale(-1, 1);
        g.drawImage(wall, 0, 0, iw, ih);
        g.restore();
        const gr = g.createLinearGradient(side < 0 ? 0 : iw, 0, side < 0 ? -iw * 0.5 : iw * 1.5, 0);
        gr.addColorStop(0, "rgba(20,17,15,0.35)");
        gr.addColorStop(1, "rgba(20,17,15,0.96)");
        g.fillStyle = gr;
        g.fillRect(side < 0 ? -iw : iw, 0, iw, ih);
      }
    }
    g.drawImage(marks.current, 0, 0);

    // уламки й пил — від дальніх до ближніх
    const list = [...s.shards].sort((a, b) => b.z - a.z);
    for (const sh of list) drawShard(g, sh);
    for (const d of s.dust) {
      const p = project(d.x, d.y, d.z);
      g.fillStyle = `rgba(${d.c},${Math.min(1, d.life * 1.6) * 0.8})`;
      const r = Math.max(0.6, p.k * 0.0012);
      g.fillRect(p.sx - r / 2, p.sy - r / 2, r, r);
    }

    // предмет у руці / у польоті
    if (h) {
      const p = project(h.x, h.y, h.z);
      const tex = texFor(h.kind);
      const pxm = PX_PER_M[h.kind];
      // тінь на підлозі під предметом (опора для відчуття глибини)
      const fp = project(h.x, floorY, h.z);
      const lift = Math.max(0, h.y - floorY);
      const sw = (h.kind === "plate" ? 0.32 : 0.14) * fp.k;
      g.save();
      g.globalAlpha = Math.max(0, 0.42 - lift * 0.35);
      const sg = g.createRadialGradient(fp.sx, fp.sy, 0, fp.sx, fp.sy, sw);
      sg.addColorStop(0, "rgba(0,0,0,0.75)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg;
      g.beginPath();
      g.ellipse(fp.sx, fp.sy, sw, sw * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();

      g.save();
      g.translate(p.sx, p.sy);
      g.rotate(h.kind === "bottle" ? h.th + bottleUpright : h.th);
      const k = p.k / pxm;
      g.scale(k, k);
      if (h.kind === "plate") {
        const pcx = meta.plate.cx - meta.plate.box[0];
        const pcy = meta.plate.cy - meta.plate.box[1];
        g.shadowColor = "rgba(0,0,0,0.45)";
        g.shadowBlur = 24;
        g.shadowOffsetY = 10;
        g.drawImage(tex, -pcx, -pcy);
      } else {
        const mx = (axis[0][0] + axis[1][0]) / 2;
        const my = (axis[0][1] + axis[1][1]) / 2;
        g.drawImage(tex, -mx, -my);
      }
      g.restore();
    }
    g.restore();
    return busy;
  });

  function drawShard(g: CanvasRenderingContext2D, sh: Shard) {
    const p = project(sh.x, sh.y, sh.z);
    const k = p.k / PX_PER_M[sh.kind];
    const alpha = sh.fade > 0 ? Math.max(0, 1 - sh.fade) : 1;
    const elev = Math.atan2(H, sh.z);
    const cph = Math.cos(sh.ph);
    const thick = sh.kind === "plate" ? 6 : 3.5;
    const poly = sh.shape.poly;
    const path = () => {
      g.beginPath();
      g.moveTo(poly[0]![0], poly[0]![1]);
      for (let i = 1; i < poly.length; i++) g.lineTo(poly[i]![0], poly[i]![1]);
      g.closePath();
    };
    g.save();
    g.globalAlpha = alpha * (sh.kind === "bottle" ? 0.92 : 1);
    g.translate(p.sx, p.sy);
    if (sh.rest || sh.y <= -H + 0.002) {
      // лежить на підлозі: обличчя вкорочене перспективою
      g.scale(1, Math.sin(elev) * 1.15);
      // контактна тінь
      g.save();
      g.rotate(sh.th);
      g.scale(k, k);
      g.translate(2, 5);
      path();
      g.fillStyle = "rgba(0,0,0,0.38)";
      g.fill();
      g.restore();
    }
    g.rotate(sh.th);
    g.scale(k * (Math.abs(cph) < 0.12 ? 0.12 * Math.sign(cph || 1) : cph), k);
    // товщина: зсунутий край (тіло кераміки / зелене скло)
    g.save();
    g.translate(thick * Math.sin(sh.ph) * 1.4, thick * 0.9);
    path();
    g.fillStyle = sh.kind === "plate" ? "rgb(196,182,158)" : "rgba(64,74,22,0.85)";
    g.fill();
    g.restore();
    path();
    g.save();
    g.clip();
    g.translate(-sh.shape.c[0], -sh.shape.c[1]);
    g.drawImage(sh.tex, 0, 0);
    g.restore();
    // світло на гранях: глазур / гострі грані скла
    const lit = 0.25 * (1 - Math.abs(cph));
    if (lit > 0.02) {
      path();
      g.fillStyle = `rgba(0,0,0,${lit})`;
      g.fill();
    }
    path();
    g.lineWidth = (sh.kind === "plate" ? 1.1 : 1.3) / Math.max(0.3, k);
    g.strokeStyle = sh.kind === "plate" ? "rgba(235,226,206,0.55)" : "rgba(235,255,205,0.55)";
    g.stroke();
    g.restore();
  }

  useEffect(() => {
    wake();
  }, [size, wake, kind, label]);

  const toScene = (px: number, py: number) => {
    const { s, ox, oy } = view();
    return [(px - ox) / s, (py - oy) / s] as const;
  };

  usePointer(rootRef, {
    down: (p) => {
      const h = sim.current.held;
      if (!h || (h.phase !== "ready" && h.phase !== "back")) return false;
      const [x, y] = toScene(p.x, p.y);
      const c = project(h.x, h.y, h.z);
      const reach = h.kind === "plate" ? 200 : 210;
      if (Math.hypot(x - c.sx, y - c.sy) > reach) return false;
      onInteract();
      h.phase = "drag";
      h.grab = { id: p.id, dx: c.sx - x, dy: c.sy - y };
      h.hist = [{ t: p.time, x, y }];
      wake();
    },
    move: (p) => {
      const h = sim.current.held;
      if (!h || h.phase !== "drag" || h.grab?.id !== p.id) return;
      const [x, y] = toScene(p.x, p.y);
      const tx = Math.max(40, Math.min(W - 40, x + h.grab.dx));
      const ty = Math.max(380, Math.min(meta.size[1] - 40, y + h.grab.dy));
      const w = unproject(tx, ty, Z0);
      const prevX = h.x;
      h.x = w.x;
      h.y = w.y;
      // легкий нахил за рухом
      h.th = Math.max(-0.5, Math.min(0.5, h.th * 0.85 + (h.x - prevX) * 6));
      h.hist.push({ t: p.time, x, y });
      if (h.hist.length > 12) h.hist.shift();
      wake();
    },
    up: (p, cancelled) => {
      const h = sim.current.held;
      if (!h || h.phase !== "drag" || h.grab?.id !== p.id) return;
      h.grab = null;
      // позиція відпускання — останній відомий рух (у pointerup координати бувають застарілими)
      const last = h.hist[h.hist.length - 1]!;
      const { x, y } = last;
      const recent = h.hist.filter((e) => last.t - e.t < 110);
      const first = recent[0] ?? last;
      // палець зупинився перед відпусканням — кидка немає
      const idle = p.time - last.t > 140;
      const dtv = Math.max(16, last.t - first.t) / 1000;
      const vx = (x - first.x) / dtv;
      const vy = (y - first.y) / dtv;
      const [rx, ry] = REST[h.kind];
      const pullX = x - rx;
      const pullY = y - ry;
      if (!cancelled && !idle && vy < -320) {
        // кидок рухом угору: сила — зі швидкості
        launch(vx, vy, Math.hypot(vx, vy) / 2600);
      } else if (!cancelled && pullY > 50) {
        // рогатка: відтягнув униз — летить у протилежний бік
        launch(-pullX, -pullY, Math.hypot(pullX, pullY) / 240);
      } else {
        h.phase = "back";
        setHint("Тягни вгору й відпускай — або відтягни вниз, як рогатку.");
      }
      wake();
    },
  });

  const throwByButton = () => {
    onInteract();
    const h = sim.current.held;
    if (!h || h.phase === "flight") return;
    launch((Math.random() - 0.5) * 300, -1000, 0.6);
  };

  const another = () => {
    spawn(kind);
    setHint(kind === "plate" ? "Відтягни тарілку й відпусти." : "Відтягни пляшку й відпусти.");
    wake();
  };

  const clearShards = () => {
    for (const sh of sim.current.shards) if (sh.fade === 0) sh.fade = 0.001;
    wake();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (phase === "ready") throwByButton();
      else if (phase === "broken") another();
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label="Стіна. Enter — кинути предмет."
      className="scene-surface relative h-full w-full overflow-hidden outline-none"
      style={{ touchAction: "none", background: "#1b1714" }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 top-2 z-10 flex justify-center px-2">
        <div role="radiogroup" aria-label="Що розбити" className="flex rounded-[var(--radius-hair)] border border-steel/50 bg-night/75 p-0.5 text-sm">
          {(["plate", "bottle"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              disabled={phase === "flying"}
              onClick={() => {
                setKind(k);
                spawn(k);
                setHint(k === "plate" ? "Відтягни тарілку й відпусти — вона полетить у стіну." : "Відтягни пляшку й відпусти — вона полетить у стіну.");
              }}
              className={`min-h-10 rounded-[calc(var(--radius-hair)-2px)] px-4 ${kind === k ? "bg-frost text-abyss" : "text-frost/85"}`}
            >
              {k === "plate" ? "Тарілка" : "Пляшка"}
            </button>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-2 px-2">
        {phase === "ready" && (
          <>
            <button type="button" onClick={throwByButton} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
              Кинути
            </button>
            {kind === "plate" && !writing && (
              <button type="button" onClick={() => setWriting(true)} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
                {label ? "Змінити напис" : "Написати, що бісить"}
              </button>
            )}
            {kind === "plate" && writing && (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWriting(false);
                }}
              >
                <label htmlFor={inputId} className="sr-only">
                  Що бісить (лишається тільки на цьому екрані)
                </label>
                <input
                  id={inputId}
                  autoFocus
                  maxLength={40}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Напиши на тарілці"
                  className="min-h-11 w-44 rounded-[var(--radius-hair)] border border-steel/55 bg-abyss/85 px-3 text-sm text-frost"
                />
                <button type="submit" className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
                  Готово
                </button>
              </form>
            )}
          </>
        )}
        {phase === "broken" && (
          <>
            <button type="button" onClick={another} className="scene-btn border border-frost bg-frost text-sm text-abyss">
              Ще одну
            </button>
            <button type="button" onClick={clearShards} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
              Прибрати уламки
            </button>
            {breaks >= 1 && onSwitch && (
              <button type="button" onClick={() => onSwitch("candle")} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
                Хочу тихішу сцену
              </button>
            )}
          </>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {phase === "broken" ? "Розбито." : ""}
      </span>
    </div>
  );
}
