"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { drawSoftShadow } from "@/lib/scene/bend";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound, type LoopHandle } from "@/lib/scene/sound";
import {
  contactShadow,
  featherImage,
  makeSprite,
  opaqueAt,
  type Sprite,
} from "@/lib/scene/sprite";
import type { SceneProps } from "../types";

interface Meta {
  size: [number, number];
  order: string[];
  supports: Record<string, Record<string, number>>;
  stones: Record<
    string,
    { x: number; y: number; w: number; h: number; cx: number; cy: number }
  >;
  flap: { x: number; y: number; w: number; h: number };
  flapEdge: [number, number][];
  zipper: [number, number][];
  zip_slider: { x: number; y: number; w: number; h: number };
  zip_pull: { x: number; y: number; w: number; h: number };
}

/** Рівномірна ламана: N точок за довжиною дуги. */
function resample(pts: [number, number][], n: number): [number, number][] {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = d[d.length - 1]!;
  const out: [number, number][] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const t = (total * k) / (n - 1);
    while (j < pts.length - 1 && d[j]! < t) j++;
    const a = pts[j - 1]!;
    const b = pts[j]!;
    const u = (t - d[j - 1]!) / Math.max(1e-6, d[j]! - d[j - 1]!);
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

const ZN = 120;
/** Ширина зони, де краї тканини ще сходяться за бігунком (частка довжини). */
const ZIP_W = 0.15;
const ZIP_SOUNDS = ["zip-loop", "zip-end"] as const;

const TAGS = [
  "Відкласти",
  "Попросити допомоги",
  "Це не моя відповідальність",
] as const;
type Tag = (typeof TAGS)[number];
/** Кому дістаються підписи: спершу найбільші й найдоступніші камені. */
const LABEL_ORDER = ["B", "C", "D", "E", "A", "F"];
const FLOOR_Y = 1030; // лінія підлоги на фото (поруч із рюкзаком)
const BAG_BOTTOM = 1060;

interface Stone {
  key: string;
  sprite: Sprite;
  /** Центр у світових координатах (пікселі фото). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  scale: number;
  restX: number;
  restY: number;
  /** Осідання, коли зникла опора (ціль і показане з пружиною). */
  settle: number;
  shownSettle: number;
  sv: number;
  inBag: boolean;
  /** Камінь піднято над клапаном (малюється поверх тканини). */
  above: boolean;
  lift: number;
  label: string | null;
  tag: Tag | null;
  order: number;
  /** Куди падає після відпускання. */
  dropTo: { x: number; y: number } | null;
}

async function loadBackpack() {
  const meta = await loadJson<Meta>("/scenes/backpack/backpack.json");
  const [base, flap, slider, pull, fabric, ...stones] = await Promise.all([
    loadImage("/scenes/backpack/base.webp"),
    loadImage("/scenes/backpack/flap.webp"),
    loadImage("/scenes/backpack/zip-slider.webp"),
    loadImage("/scenes/backpack/zip-pull.webp"),
    loadImage("/scenes/backpack/fabric.webp"),
    ...meta.order.map((k) => loadImage(`/scenes/backpack/stone-${k}.webp`)),
  ]);
  return {
    meta,
    base: featherImage(base, 0.1),
    flap,
    slider,
    pull,
    fabric,
    zipB: resample(meta.zipper, ZN),
    zipF: resample(meta.flapEdge, ZN),
    sprites: Object.fromEntries(
      meta.order.map((k, i) => [k, makeSprite(stones[i]!)]),
    ) as Record<string, Sprite>,
  };
}

export default function BackpackScene(props: SceneProps) {
  const assets = useSceneAssets(loadBackpack);
  if (assets.status === "loading")
    return (
      <div
        role="status"
        className="grid h-full place-items-center text-sm text-mist"
      >
        Готую рюкзак…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити рюкзак.</p>
        <button
          type="button"
          onClick={assets.retry}
          className="scene-btn border border-steel/60"
        >
          Спробувати ще
        </button>
      </div>
    );
  return <Backpack {...props} data={assets.data} />;
}

function Backpack({
  input,
  reducedMotion,
  onSettled,
  setHint,
  onInteract,
  data,
}: SceneProps & { data: Awaited<ReturnType<typeof loadBackpack>> }) {
  const { meta, base, flap, sprites, slider, pull, fabric, zipB, zipF } = data;
  const { canvasRef, ctx, size } = useCanvas2D();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{
    key: string;
    x: number;
    y: number;
    tag: Tag | null;
  } | null>(null);
  const [outCount, setOutCount] = useState(0);
  const [, force] = useState(0);

  const labels = useMemo(
    () => (input.labels ?? []).slice(0, 6),
    [input.labels],
  );
  const stones = useLazyRef<Stone[]>(() =>
    meta.order.map((k, i) => {
      const m = meta.stones[k]!;
      const li = LABEL_ORDER.indexOf(k);
      return {
        key: k,
        sprite: sprites[k]!,
        x: m.x + m.w / 2,
        y: m.y + m.h / 2,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 0,
        scale: 1,
        restX: m.x + m.w / 2,
        restY: m.y + m.h / 2,
        settle: 0,
        shownSettle: 0,
        sv: 0,
        inBag: true,
        above: false,
        lift: 0,
        label: li >= 0 && li < labels.length ? labels[li]! : null,
        tag: null,
        order: i,
        dropTo: null,
      };
    }),
  );
  /** Для інтерфейсу (кнопки, меню) — копія в стані, не читаємо ref під час рендеру. */
  const [inBagKeys, setInBagKeys] = useState<string[]>(meta.order);
  const syncUi = useCallback(() => {
    setInBagKeys(stones.current.filter((s) => s.inBag).map((s) => s.key));
    setOutCount(stones.current.filter((s) => !s.inBag).length);
  }, [stones]);
  const drag = useRef<{
    key: string;
    id: number;
    ox: number;
    oy: number;
    tx: number;
    ty: number;
    sx: number;
    sy: number;
    moved: number;
  } | null>(null);
  const bagLoad = useRef(1);
  /** Блискавка: 0 — відкрито, 1 — застебнуто. Частковий стан зберігається. */
  const zip = useLazyRef(() => ({
    t: 0,
    shown: 0,
    grab: null as null | { id: number },
    auto: null as null | { to: number },
    swing: 0,
    swingV: 0,
    /** Згладжена швидкість бігунка — для рівної гучності «з-з-з». */
    speed: 0,
    lastT: 0,
    ended: false,
    covered: null as Path2D | null,
    pattern: null as CanvasPattern | null,
  }));
  const zipLoop = useRef<LoopHandle | null>(null);
  const [zipT, setZipT] = useState(0);
  useEffect(() => {
    sound.preload(ZIP_SOUNDS);
    zipLoop.current = sound.loop("zip-loop", 0);
    return () => zipLoop.current?.stop(0.05);
  }, []);

  // Вид: рюкзак у центрі, довкола — підлога, куди можна класти камені.
  const view = useMemo(() => {
    const W = size.width;
    const H = size.height;
    const worldW = 1254;
    const worldH = 1380;
    const s = Math.min(W / worldW, H / worldH);
    return { s, ox: (W - worldW * s) / 2, oy: (H - worldH * s) / 2 - 40 * s };
  }, [size]);
  const toWorld = useCallback(
    (x: number, y: number) => ({
      x: (x - view.ox) / view.s,
      y: (y - view.oy) / view.s,
    }),
    [view],
  );

  const flapEdgeY = useCallback(
    (x: number) => {
      const e = meta.flapEdge;
      if (x <= e[0]![0]) return e[0]![1];
      for (let i = 1; i < e.length; i++) {
        const [x1, y1] = e[i]!;
        const [x0, y0] = e[i - 1]!;
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
      return e[e.length - 1]![1];
    },
    [meta.flapEdge],
  );

  /**
   * Осідання: кожен камінь у рюкзаку падає, доки не ляже на камінь під ним або на дно.
   * Рахуємо знизу вгору; базовий стан (повний рюкзак) віднімаємо, щоб на старті нічого не рухалось.
   */
  const stackBottoms = useCallback(
    (present: (st: Stone) => boolean) => {
      const list = stones.current
        .filter(present)
        .sort((a, b) => b.restY + b.sprite.h / 2 - (a.restY + a.sprite.h / 2));
      const placed: {
        key: string;
        x0: number;
        x1: number;
        top: number;
        depth: number;
      }[] = [];
      const out = new Map<string, number>();
      for (const st of list) {
        const depth = meta.order.indexOf(st.key);
        const x0 = st.restX - st.sprite.w * 0.36;
        const x1 = st.restX + st.sprite.w * 0.36;
        // Дно рюкзака в перспективі: що далі від нас, то вище на екрані.
        let floor = 850 - (meta.order.length - 1 - depth) * 42;
        // Опора — камені позаду або ті, на яких він лежить на фото; ближчі — ні: камінь ковзає вниз позаду них.
        const own = meta.supports[st.key] ?? {};
        for (const q of placed)
          if (
            (q.depth <= depth || q.key in own) &&
            Math.min(x1, q.x1) - Math.max(x0, q.x0) > 20
          )
            floor = Math.min(floor, q.top);
        // Нижня точка не нижче опори, але й не вище, ніж лежить зараз (камені не злітають).
        const restBottom = st.restY + st.sprite.h * 0.42;
        const bottom = Math.max(restBottom, floor);
        out.set(st.key, bottom - restBottom);
        placed.push({
          key: st.key,
          x0,
          x1,
          top: bottom - st.sprite.h * 0.58,
          depth,
        });
      }
      return out;
    },
    [meta.order, meta.supports, stones],
  );
  const baseline = useRef<Map<string, number> | null>(null);

  const recomputeSettle = useCallback(() => {
    baseline.current ??= stackBottoms(() => true);
    const now = stackBottoms((st) => st.inBag);
    for (const s of stones.current)
      s.settle = Math.max(
        0,
        (now.get(s.key) ?? 0) - (baseline.current.get(s.key) ?? 0),
      );
    const total = stones.current.reduce(
      (a, s) => a + s.sprite.w * s.sprite.h,
      0,
    );
    const left = stones.current
      .filter((s) => s.inBag)
      .reduce((a, s) => a + s.sprite.w * s.sprite.h, 0);
    bagLoad.current = left / total;
  }, [stackBottoms, stones]);

  const relax = useRef(1); // плавне «розправляння» тканини (1 — повний рюкзак)

  const draw = useCallback(() => {
    const g = canvasRef.current?.getContext("2d") ?? null;
    if (!g) return;
    const { s, ox, oy } = view;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const dpr = size.dpr;
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    // Тло-підлога в тон краю фото — без видимих швів, потім рюкзак.
    const floor = g.createLinearGradient(0, 0, 0, 1254);
    floor.addColorStop(0, "rgb(30,30,31)");
    floor.addColorStop(1, "rgb(57,57,58)");
    g.fillStyle = floor;
    g.fillRect(-3000, -3000, 7254, 7254);
    const load = relax.current;
    const cx = 660;
    // Повний рюкзак трохи роздутий; з кожним каменем тканина розправляється.
    g.save();
    g.translate(cx, BAG_BOTTOM);
    g.scale(1 + 0.018 * load, 1 - 0.008 * load);
    g.translate(-cx, -BAG_BOTTOM);
    g.drawImage(base, 0, 0);
    g.restore();

    const list = stones.current;
    const d = drag.current;
    const inside = list
      .filter((st) => st.inBag || !st.above)
      .sort((a, b) => a.order - b.order);
    for (const st of inside) drawStone(g, st);

    // Передній клапан: під вагою провисає нижче; без каменів піднімається.
    g.save();
    g.translate(cx, BAG_BOTTOM);
    g.scale(1 + 0.012 * load, 1 - 0.035 * (1 - load));
    g.translate(-cx, -BAG_BOTTOM);
    g.drawImage(flap, meta.flap.x, meta.flap.y);
    g.restore();

    drawZipper(g);

    const outside = list
      .filter((st) => !st.inBag && st.above)
      .sort((a, b) =>
        d && a.key === d.key ? 1 : d && b.key === d.key ? -1 : a.y - b.y,
      );
    for (const st of outside) {
      const floorScale = st.scale;
      const rx = st.sprite.w * 0.46 * floorScale;
      const ry = st.sprite.h * 0.16 * floorScale;
      if (st.lift > 2)
        drawSoftShadow(
          g,
          st.x + st.lift * 0.5,
          st.y + st.sprite.h * 0.32 * floorScale + st.lift * 0.9,
          rx * 1.6,
          ry * 1.6,
          0,
          16 + st.lift * 0.6,
          Math.max(0.18, 0.5 - st.lift * 0.004),
        );
      else
        contactShadow(
          g,
          st.x + 6,
          st.y + st.sprite.h * 0.36 * floorScale,
          rx * 1.05,
          ry * 1.1,
          0.62,
        );
      drawStone(g, st);
    }
    // Підписи — шар сайту, не частина фото. Камені під застебнутою тканиною — без підписів.
    for (const st of list) if ((st.label || st.tag) && !(st.inBag && !st.above && covers(st.x, st.y + st.shownSettle))) drawLabel(g, st, s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, size.dpr, base, flap, meta.flap, canvasRef, stones]);

  /** Чи закрита точка (світові координати) застебнутою тканиною. */
  const covers = (wx: number, wy: number) => {
    const cov = zip.current.covered;
    const g = canvasRef.current?.getContext("2d");
    if (!cov || !g) return false;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const r = g.isPointInPath(cov, wx, wy);
    g.restore();
    return r;
  };

  /** Частка закриття для точки i траєкторії: позаду бігунка — краї зійшлися, біля нього — сходяться. */
  const closureAt = (i: number, t: number) => {
    const sPos = i / (ZN - 1);
    if (sPos <= t - ZIP_W) return 1;
    if (sPos >= t) return 0;
    const u = (t - sPos) / ZIP_W;
    return u * u * (3 - 2 * u);
  };

  function teeth(g: CanvasRenderingContext2D, pts: [number, number][], from: number, to: number, both: boolean) {
    let acc = 0;
    let n = 0;
    for (let i = Math.max(1, from); i <= to && i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      const seg = Math.hypot(x1 - x0, y1 - y0);
      acc += seg;
      while (acc >= 7) {
        acc -= 7;
        const u = 1 - acc / Math.max(1e-6, seg);
        const x = x0 + (x1 - x0) * u;
        const y = y0 + (y1 - y0) * u;
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const side = both ? (n % 2 ? 1 : -1) : 1;
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.fillStyle = "#23221e";
        g.fillRect(-2.6, side * 2.6 - 5, 5.2, 10);
        g.fillStyle = "rgba(190,185,170,0.6)";
        g.fillRect(-2.6, side * 2.6 - 5, 5.2, 1.8);
        g.restore();
        n++;
      }
    }
  }

  function drawZipper(g: CanvasRenderingContext2D) {
    const z = zip.current;
    const t = z.shown;
    if (t > 0.002) {
      const c = zipB.map((_, i) => closureAt(i, t));
      const P = zipF.map(([fx, fy], i) => [fx + (zipB[i]![0] - fx) * c[i]!, fy + (zipB[i]![1] - fy) * c[i]!] as [number, number]);
      const path = new Path2D();
      P.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      for (let i = ZN - 1; i >= 0; i--) path.lineTo(zipF[i]![0], zipF[i]![1] + 18 * c[i]!);
      path.closePath();
      z.covered = path;
      z.pattern ??= g.createPattern(fabric, "repeat");
      g.save();
      g.clip(path);
      g.fillStyle = z.pattern ?? "#4a4a3a";
      g.fillRect(250, 150, 820, 760);
      // світло: опукла передня стінка — світліше зліва-згори, до країв і низу темніше (як на фото)
      const lg = g.createRadialGradient(560, 380, 40, 640, 500, 520);
      lg.addColorStop(0, "rgba(255,255,235,0.10)");
      lg.addColorStop(0.55, "rgba(0,0,0,0.06)");
      lg.addColorStop(1, "rgba(0,0,0,0.42)");
      g.fillStyle = lg;
      g.fillRect(250, 150, 820, 760);
      // горбики від каменів, що лишились усередині
      for (const st of stones.current) {
        if (!st.inBag || st.above) continue;
        const sy = st.y + st.shownSettle;
        const r = Math.max(st.sprite.w, st.sprite.h) * 0.42;
        const hl = g.createRadialGradient(st.x - r * 0.3, sy - r * 0.35, 0, st.x, sy, r);
        hl.addColorStop(0, "rgba(255,255,235,0.10)");
        hl.addColorStop(0.7, "rgba(0,0,0,0)");
        hl.addColorStop(1, "rgba(0,0,0,0.16)");
        g.fillStyle = hl;
        g.beginPath();
        g.ellipse(st.x, sy, r, r * 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
      // шов уздовж блискавки: тонка тінь під зубцями (лише вздовж краю тканини)
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 10;
      g.beginPath();
      P.forEach(([x, y], i) => (i ? g.lineTo(x, y + 7) : g.moveTo(x, y + 7)));
      g.stroke();
      g.restore();
      // зубці: застебнута частина — два ряди вперемішку; край, що підходить, — один ряд
      const zipped = Math.max(0, Math.floor((t - ZIP_W) * (ZN - 1)));
      teeth(g, zipB, 1, zipped, true);
      teeth(g, P, zipped, Math.ceil(t * (ZN - 1)), false);
    } else z.covered = null;

    // бігунок і язичок — на траєкторії
    const fi = Math.min(ZN - 2, Math.max(0, t * (ZN - 1)));
    const i0 = Math.floor(fi);
    const u = fi - i0;
    const a = zipB[i0]!;
    const b = zipB[i0 + 1]!;
    const px = a[0] + (b[0] - a[0]) * u;
    const py = a[1] + (b[1] - a[1]) * u;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const ang0 = Math.atan2(zipB[1]![1] - zipB[0]![1], zipB[1]![0] - zipB[0]![0]);
    const sl = meta.zip_slider;
    const pl = meta.zip_pull;
    // язичок висить донизу й гойдається від руху
    g.save();
    g.translate(px, py + 16);
    g.rotate(z.swing);
    g.drawImage(pull, -(344 - pl.x), -(718 - pl.y - 16) - 16);
    g.restore();
    g.save();
    g.translate(px, py);
    g.rotate(ang - ang0);
    g.drawImage(slider, -(347 - sl.x), -(703 - sl.y));
    g.restore();
  }

  function drawStone(g: CanvasRenderingContext2D, st: Stone) {
    const sc = st.scale * (1 + st.lift * 0.0016);
    g.save();
    g.translate(st.x, st.y + (st.inBag && !st.above ? st.shownSettle : 0));
    g.rotate(st.rot);
    g.scale(sc, sc);
    g.drawImage(st.sprite.img, -st.sprite.w / 2, -st.sprite.h / 2);
    g.restore();
  }

  function drawLabel(g: CanvasRenderingContext2D, st: Stone, s: number) {
    const text = st.label ?? "";
    const sub = st.tag ? st.tag.toLowerCase() : "";
    const fs = 13 / s; // однаковий розмір тексту на екрані
    g.save();
    g.font = `600 ${fs}px system-ui, -apple-system, sans-serif`;
    const tw = Math.max(
      g.measureText(text).width,
      sub ? g.measureText(sub).width * 0.8 : 0,
    );
    const padX = 9 / s;
    const h = (sub && text ? 36 : 23) / s;
    const y = st.y + (st.inBag && !st.above ? st.shownSettle : 0) - h / 2;
    g.fillStyle = "rgba(14,16,18,0.78)";
    g.beginPath();
    g.roundRect(st.x - tw / 2 - padX, y, tw + padX * 2, h, 8 / s);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#eceeee";
    if (text) g.fillText(text, st.x, y + (sub ? 12 / s : h / 2));
    if (sub) {
      g.font = `500 ${fs * 0.78}px system-ui, -apple-system, sans-serif`;
      g.fillStyle = "#aab3b8";
      g.fillText(sub, st.x, y + (text ? 26 / s : h / 2));
    }
    g.restore();
  }

  const wake = useFrameLoop(rootRef, (dt) => {
    let busy = false;
    const d = drag.current;
    for (const st of stones.current) {
      if (d && d.key === st.key) {
        // Тягнемо: пружина за пальцем, нахил від швидкості (вага, інерція).
        let tx = d.tx - d.ox;
        const ty = d.ty - d.oy;
        if (st.inBag && !st.above) {
          // Ще в рюкзаку: виходить лише через отвір — угору.
          tx = Math.max(
            400 + st.sprite.w * 0.25,
            Math.min(950 - st.sprite.w * 0.25, tx),
          );
          const bottom = ty + st.sprite.h * 0.42;
          // Підняли над краєм клапана — або просто рішуче потягли: камінь виходить через отвір.
          const pulled = Math.hypot(d.tx - d.sx, d.ty - d.sy);
          if (bottom < flapEdgeY(tx) - 40 || pulled > 120) st.above = true;
        }
        const k = reducedMotion ? 120 : 75; // камінь важкий — відстає більше за купюру
        const c = reducedMotion ? 22 : 14;
        st.vx += ((tx - st.x) * k - st.vx * c) * dt;
        st.vy += ((ty - st.y) * k - st.vy * c) * dt;
        st.x += st.vx * dt;
        st.y += st.vy * dt;
        const targetRot = reducedMotion
          ? 0
          : Math.max(-0.35, Math.min(0.35, st.vx * 0.0006));
        st.vr += ((targetRot - st.rot) * 50 - st.vr * 9) * dt;
        st.rot += st.vr * dt;
        st.lift += (40 - st.lift) * Math.min(1, dt * 8);
        busy = true;
        continue;
      }
      if (st.dropTo) {
        // Падає на підлогу або повертається в рюкзак.
        const k = 90;
        const c = 13;
        st.vx += ((st.dropTo.x - st.x) * k - st.vx * c) * dt;
        st.vy += ((st.dropTo.y - st.y) * k - st.vy * c) * dt;
        st.x += st.vx * dt;
        st.y += st.vy * dt;
        st.lift += (0 - st.lift) * Math.min(1, dt * 10);
        st.rot += (st.rot > 0 ? -1 : 1) * Math.min(Math.abs(st.rot), dt * 0.4);
        const targetScale = st.inBag ? 1 : floorScale(st.dropTo.y);
        st.scale += (targetScale - st.scale) * Math.min(1, dt * 8);
        busy = true;
        if (
          Math.hypot(st.dropTo.x - st.x, st.dropTo.y - st.y) < 0.8 &&
          Math.hypot(st.vx, st.vy) < 8 &&
          st.lift < 0.5
        ) {
          if (!st.inBag) {
            sound.play("thud", 0.7);
            haptic(10);
          }
          if (st.inBag) {
            st.above = false;
            st.y = st.restY;
            st.x = st.restX;
            st.shownSettle = st.settle;
            st.sv = 0;
          }
          st.dropTo = null;
          st.lift = 0;
        }
      }
    }
    // Осідання тих, що лишились (з легким пружинним відскоком).
    const target = bagLoad.current;
    if (Math.abs(relax.current - target) > 0.002) {
      relax.current += (target - relax.current) * Math.min(1, dt * 3);
      busy = true;
    }
    for (const st of stones.current) {
      if (!st.inBag || st.above) continue;
      if (Math.abs(st.shownSettle - st.settle) > 0.2 || Math.abs(st.sv) > 1) {
        st.sv +=
          ((st.settle - st.shownSettle) * 160 -
            st.sv * (reducedMotion ? 40 : 15)) *
          dt;
        st.shownSettle += st.sv * dt;
        busy = true;
      }
    }
    // блискавка: показаний стан догоняє жест; звук — лише поки бігунок рухається
    {
      const z = zip.current;
      if (z.auto) {
        const dir = Math.sign(z.auto.to - z.t);
        z.t = Math.max(0, Math.min(1, z.t + dir * dt * 0.45));
        if ((dir > 0 && z.t >= z.auto.to) || (dir < 0 && z.t <= z.auto.to)) z.auto = null;
      }
      const prev = z.shown;
      z.shown += (z.t - z.shown) * Math.min(1, dt * 18);
      if (Math.abs(z.t - z.shown) < 0.0005) z.shown = z.t;
      const raw = Math.abs(z.shown - prev) / Math.max(dt, 1e-3);
      z.speed += (raw - z.speed) * Math.min(1, dt * 14);
      const speed = raw < 1e-4 && z.speed < 0.02 ? 0 : z.speed;
      zipLoop.current?.gain(Math.min(0.5, speed * 1.6), 0.03);
      zipLoop.current?.rate(0.75 + Math.min(1, speed * 1.5) * 0.6);
      // язичок гойдається від прискорення бігунка
      z.swingV += (-z.swing * 40 - z.swingV * 4 + (z.shown - prev) * (reducedMotion ? 0 : 900)) * dt;
      z.swing += z.swingV * dt;
      if (speed > 0.001 || Math.abs(z.swingV) > 0.01 || z.auto) busy = true;
      if (z.shown >= 0.995 && !z.ended) {
        z.ended = true;
        sound.sample("zip-end", { gain: 0.6 });
        haptic(10);
        setHint("Не все потрібно нести зараз.");
        onSettled();
      } else if (z.shown < 0.97) z.ended = false;
      if (Math.round(z.shown * 100) !== Math.round(z.lastT * 100)) {
        z.lastT = z.shown;
        setZipT(z.shown);
      }
    }
    draw();
    return busy;
  });

  useEffect(() => {
    draw();
    wake();
  }, [draw, wake]);

  const takeOut = useCallback(
    (st: Stone, at?: { x: number; y: number }) => {
      st.inBag = false;
      st.above = true;
      st.order = 100 + stones.current.filter((s) => !s.inBag).length;
      st.dropTo = at ?? freeSpot(stones.current, st);
      recomputeSettle();
      const out = stones.current.filter((s) => !s.inBag).length;
      syncUi();
      if (out === stones.current.length) {
        setHint("Тепер можна закрити рюкзак.");
      } else if (out === 1)
        setHint(
          "Решта осіла. Можна торкнутися вийнятого каменя — і вирішити, що з ним.",
        );
      else setHint("Не обовʼязково виймати все. Рюкзак можна закрити будь-коли.");
    },
    [recomputeSettle, setHint, stones, syncUi],
  );

  {
    const pick = (wx: number, wy: number) => {
      const list = [...stones.current].sort((a, b) => {
        const za = a.inBag && !a.above ? a.order : 1000 + a.y;
        const zb = b.inBag && !b.above ? b.order : 1000 + b.y;
        return zb - za;
      });
      for (const st of list) {
        if (st.dropTo) continue;
        const sc = st.scale;
        const lx = (wx - st.x) / sc + st.sprite.w / 2;
        const ly =
          (wy - st.y - (st.inBag && !st.above ? st.shownSettle : 0)) / sc +
          st.sprite.h / 2;
        if (!opaqueAt(st.sprite, lx, ly)) continue;
        // У рюкзаку: місце, закрите клапаном, не вхопити (видно лише відкриту частину).
        if (st.inBag && !st.above && wy > flapEdgeY(wx) + 4) continue;
        // Крізь застебнуту тканину камінь не витягти.
        if (st.inBag && !st.above && covers(wx, wy)) continue;
        return st;
      }
      return null;
    };
    usePointer(rootRef, {
      down: (p) => {
        if (drag.current || zip.current.grab) return false;
        const w = toWorld(p.x, p.y);
        // бігунок блискавки: щедра зона навколо нього й язичка
        {
          const z = zip.current;
          const fi = z.shown * (ZN - 1);
          const q = zipB[Math.round(fi)]!;
          if (Math.hypot(w.x - q[0], w.y - q[1]) < 70 || Math.hypot(w.x - q[0], w.y - (q[1] + 70)) < 55) {
            onInteract();
            setMenu(null);
            z.grab = { id: p.id };
            z.auto = null;
            wake();
            return;
          }
        }
        const st = pick(w.x, w.y);
        if (!st) return false;
        onInteract();
        setMenu(null);
        const lift = p.type === "touch" ? 30 / view.s : 0;
        drag.current = {
          key: st.key,
          id: p.id,
          ox: w.x - st.x,
          oy: w.y - st.y + lift,
          tx: w.x,
          ty: w.y,
          sx: w.x,
          sy: w.y,
          moved: 0,
        };
        if (st.inBag) {
          st.order = 50; // піднятий — поверх інших каменів у рюкзаку
          st.y += st.shownSettle;
          st.shownSettle = 0;
          drag.current.oy = w.y - st.y + lift;
        }
        st.vx = st.vy = 0;
        sound.play("grit", 0.4);
        wake();
      },
      move: (p) => {
        const z = zip.current;
        if (z.grab?.id === p.id) {
          // палець веде бігунок уздовж траєкторії (найближча точка поруч із поточною — без стрибків через отвір)
          const w = toWorld(p.x, p.y);
          const cur = Math.round(z.t * (ZN - 1));
          let best = cur;
          let bd = Infinity;
          for (let i = Math.max(0, cur - 14); i <= Math.min(ZN - 1, cur + 14); i++) {
            const d2 = (zipB[i]![0] - w.x) ** 2 + (zipB[i]![1] - w.y) ** 2;
            if (d2 < bd) {
              bd = d2;
              best = i;
            }
          }
          z.t = best / (ZN - 1);
          wake();
          return;
        }
        const d = drag.current;
        if (!d || d.id !== p.id) return;
        const w = toWorld(p.x, p.y);
        d.moved += Math.hypot(w.x - d.tx, w.y - d.ty);
        d.tx = w.x;
        d.ty = w.y;
        wake();
      },
      up: (p, cancelled) => {
        if (zip.current.grab?.id === p.id) {
          // відпустив посередині — стан лишається, можна продовжити
          zip.current.grab = null;
          wake();
          return;
        }
        const d = drag.current;
        if (!d || d.id !== p.id) return;
        drag.current = null;
        const st = stones.current.find((s) => s.key === d.key)!;
        if (cancelled) {
          // Перерваний дотик: повертаємо туди, де камінь був.
          st.dropTo = st.inBag
            ? { x: st.restX, y: st.restY + st.settle }
            : { x: st.x, y: Math.max(st.y, FLOOR_Y - 120) };
          if (st.inBag) {
            st.above = false;
            st.shownSettle = 0;
          }
          if (st.inBag) st.order = meta.order.indexOf(st.key);
          wake();
          return;
        }
        // Тап по вийнятому каменю — необовʼязкове «що з ним».
        if (!st.inBag && d.moved < 6 / view.s) {
          setMenu({
            key: st.key,
            x: st.x * view.s + view.ox,
            y: (st.y - st.sprite.h * 0.5) * view.s + view.oy,
            tag: st.tag,
          });
          st.dropTo = { x: st.x, y: st.y };
          wake();
          return;
        }
        const inOpening =
          st.x > 420 && st.x < 940 && st.y > 260 && st.y < flapEdgeY(st.x);
        if (st.inBag && (!st.above || inOpening)) {
          // Не витягнули — камінь лягає назад.
          st.above = false;
          st.order = meta.order.indexOf(st.key);
          st.dropTo = { x: st.restX, y: st.restY + st.settle };
          st.shownSettle = 0;
        } else if (!st.inBag && inOpening) {
          // Повернули в рюкзак.
          st.inBag = true;
          st.above = false;
          st.order = meta.order.indexOf(st.key);
          recomputeSettle();
          st.dropTo = { x: st.restX, y: st.restY + st.settle };
          st.shownSettle = 0;
          syncUi();
        } else if (st.inBag) {
          takeOut(st, {
            x: clampX(st.x, view, size.width),
            y: Math.max(FLOOR_Y - 60, Math.min(1330, st.y + 40)),
          });
        } else {
          st.dropTo = {
            x: clampX(st.x, view, size.width),
            y: Math.max(FLOOR_Y - 60, Math.min(1330, st.y + 30)),
          };
        }
        force((n) => n + 1);
        wake();
      },
    });
  }

  const keyboardOut = (key: string) => {
    const st = stones.current.find((s) => s.key === key);
    if (!st || !st.inBag) return;
    onInteract();
    takeOut(st);
    wake();
  };

  const labelOf = (key: string) => labels[LABEL_ORDER.indexOf(key)] ?? null;
  const inBagList = inBagKeys.map((key) => ({
    key,
    label: LABEL_ORDER.indexOf(key) < labels.length ? labelOf(key) : null,
  }));
  const menuStone = menu
    ? {
        label:
          LABEL_ORDER.indexOf(menu.key) < labels.length
            ? labelOf(menu.key)
            : null,
        tag: menu.tag,
      }
    : null;

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
      {ctx === null && (
        <p className="absolute inset-x-0 top-1/3 text-center text-sm text-mist">
          Анімація недоступна — скористайся кнопками нижче.
        </p>
      )}

      {menu && menuStone && (
        <div
          role="dialog"
          aria-label={
            menuStone.label ? `Камінь «${menuStone.label}»` : "Камінь"
          }
          className="absolute z-20 flex w-60 -translate-x-1/2 -translate-y-full flex-col gap-1 rounded-[8px] border border-steel/60 bg-night/95 p-2 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)]"
          style={{
            left: Math.max(130, Math.min(size.width - 130, menu.x)),
            top: Math.max(170, menu.y),
          }}
        >
          <p className="px-1 pb-1 text-xs text-mist">
            Що з цим каменем? (необовʼязково)
          </p>
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={menuStone.tag === t}
              onClick={() => {
                const stone = stones.current.find((x) => x.key === menu.key);
                if (stone) stone.tag = stone.tag === t ? null : t;
                setMenu(null);
                draw();
              }}
              className={`min-h-10 rounded-[4px] px-2 text-left text-sm ${menuStone.tag === t ? "bg-frost text-abyss" : "text-frost hover:bg-slate"}`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMenu(null)}
            className="min-h-9 text-xs text-mist hover:text-frost"
          >
            Закрити
          </button>
        </div>
      )}

      {/* Альтернатива перетягуванню (клавіатура, скрінрідер). */}
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-1.5 px-2">
        {inBagList.length > 0 ? (
          <details className="group">
            <summary className="scene-btn cursor-pointer list-none border border-steel/50 text-sm">
              Витягнути камінь кнопкою
            </summary>
            <div className="absolute inset-x-2 bottom-12 flex flex-wrap justify-center gap-1.5 rounded-[6px] bg-night/95 p-2">
              {inBagList.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => keyboardOut(s.key)}
                  className="scene-btn border border-steel/50 text-sm"
                >
                  {s.label ?? `Камінь ${i + 1}`}
                </button>
              ))}
            </div>
          </details>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onInteract();
            const z = zip.current;
            z.grab = null;
            z.auto = { to: zipT > 0.98 ? 0 : 1 };
            wake();
          }}
          className="scene-btn border border-steel/50 text-sm"
        >
          {zipT > 0.98 ? "Розстебнути" : "Закрити рюкзак"}
        </button>
        <span className="sr-only" aria-live="polite">
          Вийнято каменів: {outCount} з {meta.order.length}. {zipT > 0.98 ? "Рюкзак застебнуто." : zipT > 0.02 ? `Застебнуто приблизно на ${Math.round(zipT * 100)}%.` : ""}
        </span>
      </div>
    </div>
  );
}

/** Ближче до глядача (нижче) — трохи більший. */
function floorScale(y: number) {
  return Math.max(0.92, Math.min(1.14, 0.95 + (y - 1000) / 1600));
}

function clampX(x: number, view: { s: number; ox: number }, width: number) {
  const minX = (16 - view.ox) / view.s + 60;
  const maxX = (width - 16 - view.ox) / view.s - 60;
  return Math.max(minX, Math.min(maxX, x));
}

/** Вільне місце на підлозі поруч із рюкзаком (для кнопки). */
function freeSpot(all: Stone[], st: Stone) {
  const spots = [
    { x: 170, y: 1180 },
    { x: 1090, y: 1180 },
    { x: 380, y: 1290 },
    { x: 880, y: 1290 },
    { x: 630, y: 1320 },
    { x: 140, y: 1320 },
  ];
  const taken = all.filter((s) => !s.inBag && s !== st);
  return (
    spots.find((p) =>
      taken.every(
        (t) =>
          Math.hypot((t.dropTo?.x ?? t.x) - p.x, (t.dropTo?.y ?? t.y) - p.y) >
          160,
      ),
    ) ?? spots[0]!
  );
}
