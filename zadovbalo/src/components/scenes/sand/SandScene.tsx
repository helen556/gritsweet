"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { drawSoftShadow } from "@/lib/scene/bend";
import { useCanvas2D } from "@/lib/scene/canvas";
import {
  createHeightfield,
  dent,
  relax,
  type Heightfield,
} from "@/lib/scene/heightfield";
import { createHeightGL, type HeightGL } from "@/lib/scene/heightgl";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import {
  contactShadow,
  makeSprite,
  opaqueAt,
  type Sprite,
} from "@/lib/scene/sprite";
import type { SceneProps } from "../types";

interface Meta {
  size: [number, number];
  grid: number;
  heightScale: number;
  light: [number, number, number];
  inner: [number, number, number, number];
  free: [number, number, number, number];
  stones: {
    x: number;
    y: number;
    w: number;
    h: number;
    cx: number;
    cy: number;
  }[];
}

type Tool = "stones" | "level";

interface Pebble {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  lift: number;
  /** Де лежить: у піску, на вільному дереві. */
  onWood: boolean;
  /** Ще не виймали з піску (сидить у своїй ямці на фото). */
  original: boolean;
  homeX: number;
  homeY: number;
  dropTo: { x: number; y: number } | null;
  z: number;
}

const TRAY = { x0: 120, y0: 95, x1: 1420, y1: 880 }; // видима частина фото з лотком

async function loadSand() {
  const meta = await loadJson<Meta>("/scenes/sand/sand.json");
  const [tray, height, mask, ...pebbles] = await Promise.all([
    loadImage("/scenes/sand/tray.webp"),
    loadImage("/scenes/sand/height.png"),
    loadImage("/scenes/sand/mask.png"),
    ...meta.stones.map((_, i) =>
      loadImage(`/scenes/sand/pebble-${String(i).padStart(2, "0")}.webp`),
    ),
  ]);
  // Висоти з PNG → світові пікселі.
  const gw = height.naturalWidth;
  const gh = height.naturalHeight;
  const c = document.createElement("canvas");
  c.width = gw;
  c.height = gh;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(height, 0, 0);
  const px = g.getImageData(0, 0, gw, gh).data;
  const hf = createHeightfield(gw, gh);
  for (let i = 0; i < gw * gh; i++)
    hf.data[i] = ((px[i * 4]! - 127.5) / 127.5) * meta.heightScale;
  g.clearRect(0, 0, gw, gh);
  g.drawImage(mask, 0, 0);
  const md = g.getImageData(0, 0, gw, gh).data;
  const sandMask = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) sandMask[i] = md[i * 4]! / 255;
  return { meta, tray, mask, hf, sandMask, sprites: pebbles.map(makeSprite) };
}

export default function SandScene(props: SceneProps) {
  const assets = useSceneAssets(loadSand);
  if (assets.status === "loading")
    return (
      <div
        role="status"
        className="grid h-full place-items-center text-sm text-mist"
      >
        Готую пісок…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити лоток.</p>
        <button
          type="button"
          onClick={assets.retry}
          className="scene-btn border border-steel/60"
        >
          Спробувати ще
        </button>
      </div>
    );
  return <Sand {...props} data={assets.data} />;
}

/** Чаша з мʼякими стінками (косинус) і валиком: обʼєм виймається й лягає довкола. */
function bowl(
  hf: Heightfield,
  gx: number,
  gy: number,
  rx: number,
  ry: number,
  depth: number,
) {
  const x0 = Math.max(1, Math.floor(gx - rx * 1.5));
  const x1 = Math.min(hf.w - 2, Math.ceil(gx + rx * 1.5));
  const y0 = Math.max(1, Math.floor(gy - ry * 1.5));
  const y1 = Math.min(hf.h - 2, Math.ceil(gy + ry * 1.5));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x - gx) / rx, (y - gy) / ry);
      const i = y * hf.w + x;
      if (d < 1) hf.data[i]! -= depth * 0.5 * (1 + Math.cos(Math.PI * d));
      else if (d < 1.45)
        hf.data[i]! += depth * 0.3 * Math.sin((Math.PI * (d - 1)) / 0.45);
    }
}

function Sand({
  reducedMotion,
  onSettled,
  setHint,
  onInteract,
  data,
}: SceneProps & { data: Awaited<ReturnType<typeof loadSand>> }) {
  const { meta, tray, mask, sprites } = data;
  const { canvasRef, size } = useCanvas2D();
  const rootRef = useRef<HTMLDivElement>(null);
  const glCanvas = useRef<HTMLCanvasElement | null>(null);
  const gl = useRef<HeightGL | null>(null);
  const [tool, setTool] = useState<Tool>("stones");
  const toolRef = useRef<Tool>("stones");
  const [glFailed, setGlFailed] = useState(false);
  const [counts, setCounts] = useState({
    inSand: meta.stones.length,
    onWood: 0,
  });
  // Кожен запуск — власна копія висот (Заново = чистий стан).
  // Кожен запуск — власна копія висот (Заново = чистий стан).
  const hfRef = useLazyRef<Heightfield>(() => ({
    w: data.hf.w,
    h: data.hf.h,
    data: data.hf.data.slice(),
    gloss: new Float32Array(data.hf.data.length),
  }));
  const hf = hfRef.current;
  const G = meta.grid;
  const dirty = useLazyRef(() => ({ y0: 0, y1: data.hf.h - 1, any: true }));
  const settling = useLazyRef<
    { x0: number; y0: number; x1: number; y1: number; until: number }[]
  >(() => []);
  const settledOnce = useRef(false);

  const pebbles = useLazyRef<Pebble[]>(() =>
    meta.stones.map((m, i) => ({
      sprite: sprites[i]!,
      x: m.x + m.w / 2,
      y: m.y + m.h / 2,
      vx: 0,
      vy: 0,
      rot: 0,
      lift: 0,
      onWood: false,
      original: true,
      homeX: m.x + m.w / 2,
      homeY: m.y + m.h / 2,
      dropTo: null,
      z: i,
    })),
  );
  const drag = useRef<
    | {
        kind: "pebble";
        i: number;
        id: number;
        ox: number;
        oy: number;
        tx: number;
        ty: number;
      }
    | { kind: "sand"; id: number; lx: number; ly: number }
    | null
  >(null);

  // Вид: на вузькому екрані лоток повертається на 90°, щоб камінці не були дрібними.
  const view = useMemo(() => {
    const W = size.width;
    const H = size.height;
    const tw = TRAY.x1 - TRAY.x0;
    const th = TRAY.y1 - TRAY.y0;
    const rotate = W / Math.max(1, H) < 0.95;
    const s = rotate ? Math.min(W / th, H / tw) : Math.min(W / tw, H / th);
    // світ → екран: x' = a*x + c*y + e; y' = b*x + d*y + f
    const cx = (TRAY.x0 + TRAY.x1) / 2;
    const cy = (TRAY.y0 + TRAY.y1) / 2;
    const m = rotate ? { a: 0, b: s, c: -s, d: 0 } : { a: s, b: 0, c: 0, d: s };
    const e = W / 2 - (m.a * cx + m.c * cy);
    const f = H / 2 - (m.b * cx + m.d * cy);
    return { ...m, e, f, s, rotate };
  }, [size]);
  const toWorld = useCallback(
    (x: number, y: number) => {
      const { a, b, c, d, e, f } = view;
      const det = a * d - b * c;
      const dx = x - e;
      const dy = y - f;
      return { x: (d * dx - c * dy) / det, y: (-b * dx + a * dy) / det };
    },
    [view],
  );

  // WebGL: пісок із попіксельним освітленням. Тло (дерево) — те саме фото, без рельєфу (маска).
  useEffect(() => {
    const c = document.createElement("canvas");
    glCanvas.current = c;
    const r = createHeightGL(c, {
      gw: hf.w,
      gh: hf.h,
      albedo: tray,
      mask,
      light: meta.light,
      relief: 1 / G,
      specular: 0.04,
      shininess: 30,
      solid: false,
    });
    if (!r) {
      // Повідомляємо асинхронно (як подію), без каскаду рендерів в ефекті.
      void Promise.resolve().then(() => setGlFailed(true));
      return;
    }
    gl.current = r;
    r.upload(hf.data);
    dirty.current.any = true;
    const onLost = () => setGlFailed(true);
    c.addEventListener("webglcontextlost", onLost);
    return () => {
      c.removeEventListener("webglcontextlost", onLost);
      r.dispose();
      gl.current = null;
    };
  }, [hf, tray, mask, meta.light, G, dirty]);

  // Розмір GL-полотна — під фактичний розмір на екрані (чітко, але без зайвих пікселів).
  useEffect(() => {
    const r = gl.current;
    if (!r || !size.width) return;
    const k = Math.min(1, view.s * size.dpr);
    r.resize(Math.round(meta.size[0] * k), Math.round(meta.size[1] * k));
    dirty.current.any = true;
  }, [view.s, size, meta.size, dirty]);

  /** Запасний рендер без WebGL: тінь рельєфу поверх фото (м'яке світло). */
  const fallbackShade = useRef<HTMLCanvasElement | null>(null);
  const renderFallback = useCallback(() => {
    let c = fallbackShade.current;
    if (!c) {
      c = document.createElement("canvas");
      c.width = hf.w;
      c.height = hf.h;
      fallbackShade.current = c;
    }
    const g = c.getContext("2d")!;
    const img = g.createImageData(hf.w, hf.h);
    const L = meta.light;
    for (let y = 1; y < hf.h - 1; y++)
      for (let x = 1; x < hf.w - 1; x++) {
        const i = y * hf.w + x;
        const hx = (hf.data[i + 1]! - hf.data[i - 1]!) / (2 * G);
        const hy = (hf.data[i + hf.w]! - hf.data[i - hf.w]!) / (2 * G);
        const sh = 1 - ((L[0] * hx + L[1] * hy) / L[2]) * data.sandMask[i]!;
        const v = Math.max(0, Math.min(255, sh * 128));
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, [hf, G, meta.light, data.sandMask]);

  const draw = useCallback(() => {
    const g = canvasRef.current?.getContext("2d") ?? null;
    if (!g) return;
    const { a, b, c, d, e, f } = view;
    const dpr = size.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * e, dpr * f);
    // Поверхня навколо лотка — у тон краю фото, щоб не було видно меж знімка.
    const table = g.createLinearGradient(0, 0, 0, meta.size[1]);
    table.addColorStop(0, "rgb(86,87,89)");
    table.addColorStop(1, "rgb(71,72,74)");
    g.fillStyle = table;
    g.fillRect(-3000, -3000, meta.size[0] + 6000, meta.size[1] + 6000);
    // Лоток + пісок.
    if (dirty.current.any) {
      if (gl.current && !gl.current.lost()) {
        gl.current.uploadRows(hf.data, dirty.current.y0, dirty.current.y1);
        gl.current.render();
      } else renderFallback();
      dirty.current = { y0: hf.h, y1: -1, any: false };
    }
    if (gl.current && !gl.current.lost() && glCanvas.current)
      g.drawImage(glCanvas.current, 0, 0, meta.size[0], meta.size[1]);
    else {
      g.drawImage(tray, 0, 0);
      if (fallbackShade.current) {
        g.save();
        g.globalCompositeOperation = "soft-light";
        g.drawImage(fallbackShade.current, 0, 0, meta.size[0], meta.size[1]);
        g.restore();
      }
    }
    // Камінці: ті, що лежать, — за порядком; піднятий — останнім.
    const list = [...pebbles.current].sort(
      (p, q) => p.z + p.lift * 100 - (q.z + q.lift * 100),
    );
    const Lx = -meta.light[0];
    const Ly = -meta.light[1];
    for (const p of list) {
      const w = p.sprite.w;
      const h = p.sprite.h;
      if (p.lift > 1)
        drawSoftShadow(
          g,
          p.x + Lx * p.lift * 0.9,
          p.y + Ly * p.lift * 0.9 + 4,
          w * 0.9,
          h * 0.8,
          p.rot,
          10 + p.lift * 0.5,
          Math.max(0.2, 0.5 - p.lift * 0.005),
        );
      else
        contactShadow(
          g,
          p.x + Lx * 7,
          p.y + Ly * 7 + 3,
          w * 0.55,
          h * 0.5,
          p.onWood ? 0.6 : 0.5,
        );
      const sc = 1 + p.lift * 0.003;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(sc, sc);
      g.drawImage(p.sprite.img, -w / 2, -h / 2);
      g.restore();
    }
  }, [
    view,
    size.dpr,
    hf,
    renderFallback,
    tray,
    meta.size,
    meta.light,
    canvasRef,
    dirty,
    pebbles,
  ]);

  const markDirty = (gy0: number, gy1: number) => {
    const dd = dirty.current;
    dd.any = true;
    dd.y0 = Math.min(dd.y0, gy0);
    dd.y1 = Math.max(dd.y1, gy1);
  };

  const wake = useFrameLoop(rootRef, (dt, now) => {
    let busy = false;
    const d = drag.current;
    for (const [i, p] of pebbles.current.entries()) {
      if (d && d.kind === "pebble" && d.i === i) {
        const tx = d.tx - d.ox;
        const ty = d.ty - d.oy;
        const k = reducedMotion ? 140 : 110;
        const c = reducedMotion ? 24 : 17;
        p.vx += ((tx - p.x) * k - p.vx * c) * dt;
        p.vy += ((ty - p.y) * k - p.vy * c) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot +=
          ((reducedMotion ? 0 : Math.max(-0.3, Math.min(0.3, p.vx * 0.0008))) -
            p.rot) *
          Math.min(1, dt * 6);
        p.lift += (34 - p.lift) * Math.min(1, dt * 10);
        busy = true;
      } else if (p.dropTo) {
        p.vx += ((p.dropTo.x - p.x) * 120 - p.vx * 16) * dt;
        p.vy += ((p.dropTo.y - p.y) * 120 - p.vy * 16) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.lift += (0 - p.lift) * Math.min(1, dt * 12);
        p.rot *= 1 - Math.min(1, dt * 3);
        busy = true;
        if (
          Math.hypot(p.dropTo.x - p.x, p.dropTo.y - p.y) < 0.6 &&
          p.lift < 0.6
        ) {
          p.dropTo = null;
          p.lift = 0;
          sound.play(p.onWood ? "thud" : "grit", 0.5);
          haptic(8);
          if (!p.onWood) pressInto(p);
        }
      }
    }
    // Осипання стінок ямок (кут природного укосу), поступово.
    const act = settling.current.filter((r) => r.until > now);
    settling.current = act;
    for (const r of act) {
      for (let k = 0; k < 2; k++)
        if (relax(hf, r.x0, r.y0, r.x1, r.y1, G * 0.45, 0.18))
          markDirty(r.y0, r.y1);
      busy = true;
    }
    draw();
    return busy;
  });

  useEffect(() => {
    draw();
    wake();
  }, [draw, wake]);

  /** Ямка там, де лежав камінець: виймаємо пісок і трохи насипаємо валик; далі стінки осипаються. */
  const liftFromSand = (p: Pebble) => {
    const gx = p.x / G;
    const gy = p.y / G;
    const r = (Math.min(p.sprite.w, p.sprite.h) * 0.48) / G;
    // Ямка-чаша за формою камінця (еліпс), пісок — у мʼякий валик довкола.
    bowl(
      hf,
      gx,
      gy,
      (p.sprite.w * 0.44) / G,
      (p.sprite.h * 0.44) / G,
      Math.min(p.sprite.w, p.sprite.h) * 0.085,
    );
    settling.current.push({
      x0: gx - r * 2.6,
      y0: gy - r * 2.6,
      x1: gx + r * 2.6,
      y1: gy + r * 2.6,
      until: performance.now() + (reducedMotion ? 150 : 900),
    });
    markDirty(gy - r * 3, gy + r * 3);
  };
  /** Покладений на пісок — легко вдавлюється. */
  function pressInto(p: Pebble) {
    const r = (Math.min(p.sprite.w, p.sprite.h) * 0.4) / G;
    dent(hf, p.x / G, p.y / G, r, 2.5);
    markDirty(p.y / G - r * 3, p.y / G + r * 3);
  }

  const inFree = (x: number, y: number) =>
    x > meta.free[0] &&
    x < meta.free[2] &&
    y > meta.free[1] &&
    y < meta.free[3];
  const inSand = (x: number, y: number) => {
    const gx = Math.round(x / G);
    const gy = Math.round(y / G);
    if (gx < 0 || gy < 0 || gx >= hf.w || gy >= hf.h) return false;
    return data.sandMask[gy * hf.w + gx]! > 0.5;
  };

  /** Делікатне вирівнювання в рядок на вільному дереві, без жорсткого «прилипання». */
  const alignOnWood = (p: Pebble, x: number, y: number) => {
    const others = pebbles.current.filter(
      (q) => q !== p && q.onWood && !q.dropTo,
    );
    let nx = x;
    let ny = y;
    if (others.length) {
      const meanX = others.reduce((s, q) => s + q.x, 0) / others.length;
      if (Math.abs(nx - meanX) < 45) nx += (meanX - nx) * 0.6;
    }
    // Не накладатися: відсунути вздовж рядка.
    for (let it = 0; it < 6; it++) {
      const hit = others.find(
        (q) =>
          Math.abs(q.x - nx) < (q.sprite.w + p.sprite.w) * 0.42 &&
          Math.abs(q.y - ny) < (q.sprite.h + p.sprite.h) * 0.5,
      );
      if (!hit) break;
      ny =
        hit.y +
        Math.sign(ny - hit.y || 1) * ((hit.sprite.h + p.sprite.h) * 0.52);
    }
    return {
      x: Math.max(
        meta.free[0] + p.sprite.w / 2,
        Math.min(meta.free[2] - p.sprite.w / 2, nx),
      ),
      y: Math.max(
        meta.free[1] + p.sprite.h / 2,
        Math.min(meta.free[3] - p.sprite.h / 2, ny),
      ),
    };
  };

  const updateCounts = useCallback(() => {
    const onWood = pebbles.current.filter((p) => p.onWood).length;
    const inSandN = pebbles.current.length - onWood;
    setCounts({ inSand: inSandN, onWood });
    if (inSandN === 0 && toolRef.current === "stones")
      setHint("Камінці на своїх місцях. Тепер можна розрівняти пісок.");
  }, [setHint, pebbles]);

  /** Наскільки пісок нерівний (середній модуль лапласіана). */
  const roughness = () => {
    let sum = 0;
    let n = 0;
    for (let y = 2; y < hf.h - 2; y += 2)
      for (let x = 2; x < hf.w - 2; x += 2) {
        const i = y * hf.w + x;
        if (data.sandMask[i]! < 0.9) continue;
        sum += Math.abs(
          hf.data[i - 1]! +
            hf.data[i + 1]! +
            hf.data[i - hf.w]! +
            hf.data[i + hf.w]! -
            4 * hf.data[i]!,
        );
        n++;
      }
    return n ? sum / n : 0;
  };
  const startRough = useRef<number | null>(null);

  /** Розрівнювання: висоти тягнуться до локального середнього й до рівної площини. */
  const level = (wx: number, wy: number) => {
    const gx = wx / G;
    const gy = wy / G;
    const R = 18;
    const x0 = Math.max(2, Math.floor(gx - R));
    const x1 = Math.min(hf.w - 3, Math.ceil(gx + R));
    const y0 = Math.max(2, Math.floor(gy - R));
    const y1 = Math.min(hf.h - 3, Math.ceil(gy + R));
    // Знімок лише потрібної ділянки (а не всього поля) — дешево на кожен крок пальця.
    const sx0 = Math.max(0, x0 - 4);
    const sy0 = Math.max(0, y0 - 4);
    const sw = Math.min(hf.w - 1, x1 + 4) - sx0 + 1;
    const sh = Math.min(hf.h - 1, y1 + 4) - sy0 + 1;
    const src = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) src.set(hf.data.subarray((sy0 + y) * hf.w + sx0, (sy0 + y) * hf.w + sx0 + sw), y * sw);
    const at = (x: number, y: number) => src[(y - sy0) * sw + (x - sx0)]!;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * hf.w + x;
        const m = data.sandMask[i]!;
        if (m < 0.05) continue;
        const dd = Math.hypot(x - gx, y - gy) / R;
        if (dd >= 1) continue;
        let acc = 0;
        let cnt = 0;
        for (let oy = -4; oy <= 4; oy += 2)
          for (let ox = -4; ox <= 4; ox += 2) {
            acc += at(x + ox, y + oy);
            cnt++;
          }
        const w = (1 - dd * dd) * 0.75 * m;
        hf.data[i] = at(x, y) + (acc / cnt - at(x, y)) * w;
        hf.data[i] *= 1 - 0.12 * w; // поступово до рівної площини
      }
    markDirty(y0, y1);
  };

  usePointer(rootRef, {
    down: (p) => {
      if (drag.current) return false;
      const w = toWorld(p.x, p.y);
      onInteract();
      if (toolRef.current === "stones") {
        const order = [...pebbles.current.entries()].sort(
          (a, b) => b[1].z - a[1].z,
        );
        for (const [i, pb] of order) {
          if (pb.dropTo) continue;
          const lx = w.x - pb.x + pb.sprite.w / 2;
          const ly = w.y - pb.y + pb.sprite.h / 2;
          if (
            !opaqueAt(pb.sprite, lx, ly, 60) &&
            Math.hypot(w.x - pb.x, w.y - pb.y) >
              Math.min(pb.sprite.w, pb.sprite.h) * 0.55
          )
            continue;
          const lift = p.type === "touch" ? 26 / view.s : 0;
          drag.current = {
            kind: "pebble",
            i,
            id: p.id,
            ox: w.x - pb.x,
            oy: w.y - pb.y + lift,
            tx: w.x,
            ty: w.y,
          };
          pb.z = 100 + i;
          pb.vx = pb.vy = 0;
          if (!pb.onWood) liftFromSand(pb);
          pb.original = false;
          sound.play("grit", 0.3);
          wake();
          return;
        }
      }
      if (!inSand(w.x, w.y)) return false;
      drag.current = { kind: "sand", id: p.id, lx: w.x, ly: w.y };
      startRough.current ??= roughness();
      wake();
    },
    move: (p) => {
      const d = drag.current;
      if (!d || d.id !== p.id) return;
      const w = toWorld(p.x, p.y);
      if (d.kind === "pebble") {
        d.tx = w.x;
        d.ty = w.y;
      } else {
        // Крокуємо вздовж руху: рівна борозна або рівномірне розрівнювання.
        const dist = Math.hypot(w.x - d.lx, w.y - d.ly);
        const steps = Math.max(1, Math.ceil(dist / (G * 1.5)));
        for (let k = 1; k <= steps; k++) {
          const x = d.lx + ((w.x - d.lx) * k) / steps;
          const y = d.ly + ((w.y - d.ly) * k) / steps;
          if (!inSand(x, y)) continue;
          if (toolRef.current === "level") level(x, y);
          else {
            dent(hf, x / G, y / G, 3.2, 1.6);
            markDirty(y / G - 8, y / G + 8);
          }
        }
        if (toolRef.current === "level" && Math.random() < 0.08)
          sound.play("paper", 0.15);
        d.lx = w.x;
        d.ly = w.y;
      }
      wake();
    },
    up: (p, cancelled) => {
      const d = drag.current;
      if (!d || d.id !== p.id) return;
      drag.current = null;
      if (d.kind === "sand") {
        if (
          toolRef.current === "level" &&
          startRough.current !== null &&
          !settledOnce.current
        ) {
          const r = roughness();
          if (
            r < startRough.current * 0.45 &&
            pebbles.current.every((q) => q.onWood)
          ) {
            settledOnce.current = true;
            onSettled();
            setHint("Рівно. Можна продовжувати скільки хочеш.");
          }
        }
        wake();
        return;
      }
      const pb = pebbles.current[d.i]!;
      const x = pb.x;
      const y = pb.y;
      if (!cancelled && inFree(x, y)) {
        pb.onWood = true;
        pb.dropTo = alignOnWood(pb, x, y);
      } else if (!cancelled && inSand(x, y)) {
        pb.onWood = false;
        pb.dropTo = { x, y };
      } else {
        // Поза лотком чи перерваний жест — назад, де лежав.
        pb.dropTo = { x: pb.homeX, y: pb.homeY };
        if (!pb.onWood) pb.onWood = inFree(pb.homeX, pb.homeY);
      }
      pb.homeX = pb.dropTo.x;
      pb.homeY = pb.dropTo.y;
      pb.z = pb.onWood
        ? 50 + pebbles.current.filter((q) => q.onWood).length
        : d.i;
      updateCounts();
      wake();
    },
  });

  const setToolBoth = (t: Tool) => {
    setTool(t);
    toolRef.current = t;
    setHint(
      t === "level"
        ? "Веди пальцем по піску — він вирівнюється під рукою."
        : "Перенеси камінці на вільну частину дошки.",
    );
  };

  /** Кнопкова альтернатива: наступний камінець — на вільне дерево. */
  const moveNext = () => {
    const pb = pebbles.current.find((q) => !q.onWood && !q.dropTo);
    if (!pb) return;
    onInteract();
    liftFromSand(pb);
    pb.original = false;
    pb.onWood = true;
    const n = pebbles.current.filter((q) => q.onWood).length;
    const fx = (meta.free[0] + meta.free[2]) / 2;
    pb.dropTo = alignOnWood(pb, fx, meta.free[1] + 60 + (n - 1) * 46);
    pb.homeX = pb.dropTo.x;
    pb.homeY = pb.dropTo.y;
    pb.z = 50 + n;
    pb.lift = 30;
    updateCounts();
    wake();
  };
  const levelAll = () => {
    onInteract();
    for (let y = 8; y < hf.h; y += 18)
      for (let x = 8; x < hf.w; x += 18)
        if (inSand(x * G, y * G)) level(x * G, y * G);
    wake();
  };

  return (
    <div
      ref={rootRef}
      className="scene-surface relative h-full w-full overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      {glFailed && (
        <p className="absolute inset-x-0 top-2 text-center text-xs text-mist">
          Спрощене освітлення піску (WebGL недоступний).
        </p>
      )}
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-2 px-2">
        <div
          role="radiogroup"
          aria-label="Що робити"
          className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50 bg-night/70"
        >
          {(
            [
              ["stones", "Камінці"],
              ["level", "Розрівняти"],
            ] as const
          ).map(([t, l]) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tool === t}
              onClick={() => setToolBoth(t)}
              className={cn(
                "min-h-11 px-4 text-sm",
                tool === t
                  ? "bg-frost text-abyss"
                  : "text-frost/85 hover:bg-night",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {tool === "stones" ? (
          <button
            type="button"
            onClick={moveNext}
            disabled={counts.inSand === 0}
            className="scene-btn border border-steel/50 bg-night/70 text-sm disabled:opacity-40"
          >
            Перекласти камінець
          </button>
        ) : (
          <button
            type="button"
            onClick={levelAll}
            className="scene-btn border border-steel/50 bg-night/70 text-sm"
          >
            Пригладити все
          </button>
        )}
        <span className="sr-only" aria-live="polite">
          У піску: {counts.inSand}, на дереві: {counts.onWood}
        </span>
      </div>
    </div>
  );
}
