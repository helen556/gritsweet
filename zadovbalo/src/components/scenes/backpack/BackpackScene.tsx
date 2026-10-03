"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { hash2 } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

type Zone = "today" | "later" | "help";
const ZONES: { id: Zone; label: string }[] = [
  { id: "today", label: "Сьогодні" },
  { id: "later", label: "Може почекати" },
  { id: "help", label: "Потрібна допомога" },
];
const SHAPES = ["book", "box", "ball", "bottle", "folder", "weight"] as const;
type Shape = (typeof SHAPES)[number];

interface Item {
  id: number;
  label: string;
  shape: Shape;
  /** Вага: важчі тягнуться повільніше й сильніше провисають. */
  weight: number;
  where: "bag" | Zone;
}

interface Drag {
  id: number;
  pointer: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  ox: number;
  oy: number;
}

export default function BackpackScene({ input, reducedMotion, setHint, onSettled }: SceneProps) {
  const labels = (input.labels?.length ? input.labels : ["Робота", "Дім", "Рахунки"]).slice(0, 8);
  const [items, setItems] = useState<Item[]>(() =>
    labels.map((label, id) => ({ id, label, shape: SHAPES[id % SHAPES.length]!, weight: 0.7 + hash2(id, 3) * 0.9, where: "bag" })),
  );
  const [open, setOpen] = useState(0);
  const [dragId, setDragId] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bagRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Record<Zone, HTMLDivElement | null>>({ today: null, later: null, help: null });
  const ghostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const zip = useRef<{ pointer: number } | null>(null);
  const itemsRef = useRef(items);
  const openRef = useRef(open);
  useEffect(() => {
    itemsRef.current = items;
    openRef.current = open;
  });

  const inBag = items.filter((i) => i.where === "bag");
  const fullness = inBag.length / Math.max(1, items.length);
  const zipped = open < 0.85;

  useEffect(() => {
    if (items.length && inBag.length === 0) {
      setHint("Що хочеш залишити на сьогодні?");
      onSettled();
    }
  }, [inBag.length, items.length, onSettled, setHint]);

  const moveItem = useCallback(
    (id: number, where: Item["where"]) => {
      setItems((all) => all.map((i) => (i.id === id ? { ...i, where } : i)));
      if (where !== "bag") {
        sound.play("thud", 0.5);
        haptic(10);
      }
    },
    [],
  );

  const zoneAt = (x: number, y: number): Zone | null => {
    for (const z of ZONES) {
      const r = zoneRefs.current[z.id]?.getBoundingClientRect();
      if (r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) return z.id;
    }
    return null;
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const d = drag.current;
    if (!d) return false;
    const el = ghostRef.current;
    if (!el) return true; // предмет ще монтується — наступний кадр
    const item = itemsRef.current.find((i) => i.id === d.id);
    const w = item?.weight ?? 1;
    // Важче — мʼякша пружина й більше запізнення.
    const k = reducedMotion ? 400 : 260 / w;
    const c = reducedMotion ? 40 : 22 / Math.sqrt(w);
    d.vx += ((d.tx - d.x) * k - d.vx * c) * dt;
    d.vy += ((d.ty - d.y) * k - d.vy * c) * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const tilt = reducedMotion ? 0 : Math.max(-25, Math.min(25, d.vx * 0.03 * w));
    el.style.transform = `translate3d(${d.x - d.ox}px, ${d.y - d.oy}px, 0) rotate(${tilt}deg)`;
    return true;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return bindPointer(root, {
      down: (p, e) => {
        const target = e.target as HTMLElement;
        const r = root.getBoundingClientRect();
        // Бігунок блискавки.
        if (target.closest("[data-zip]")) {
          zip.current = { pointer: p.id };
          return;
        }
        const el = target.closest<HTMLElement>("[data-item]");
        if (!el) return false;
        const id = Number(el.dataset.item);
        const item = itemsRef.current.find((i) => i.id === id);
        if (!item || (item.where === "bag" && openRef.current < 0.85)) {
          setHint("Спершу відкрий блискавку.");
          return false;
        }
        const b = el.getBoundingClientRect();
        drag.current = { id, pointer: p.id, x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, tx: p.x, ty: p.y - 30, vx: 0, vy: 0, ox: b.width / 2, oy: b.height / 2 };
        setDragId(id);
        sound.play("soft", 0.4);
        wake();
      },
      move: (p) => {
        if (zip.current?.pointer === p.id) {
          const t = trackRef.current?.getBoundingClientRect();
          if (!t) return;
          const r = root.getBoundingClientRect();
          const v = Math.max(0, Math.min(1, (p.x + r.left - t.left) / t.width));
          if (Math.abs(v - openRef.current) > 0.04) sound.play("zip", 0.5);
          setOpen((o) => Math.max(o, v));
          return;
        }
        const d = drag.current;
        if (!d || d.pointer !== p.id) return;
        d.tx = p.x;
        d.ty = p.y - 30;
        wake();
      },
      up: (p, cancelled) => {
        if (zip.current?.pointer === p.id) {
          zip.current = null;
          if (openRef.current > 0.85) {
            setOpen(1);
            setHint("Витягай справи й розкладай: сьогодні, потім, потрібна допомога.");
          }
          return;
        }
        const d = drag.current;
        if (!d || d.pointer !== p.id) return;
        const r = root.getBoundingClientRect();
        const zone = cancelled ? null : zoneAt(d.x + r.left, d.y + r.top);
        if (zone) moveItem(d.id, zone);
        drag.current = null;
        setDragId(null);
      },
    });
  }, [moveItem, setHint, wake]);

  const nextInBag = inBag[0];
  const dragged = items.find((i) => i.id === dragId);

  return (
    <div ref={rootRef} className="scene-surface relative flex h-full flex-col items-center justify-between gap-3 px-3">
      {/* Рюкзак */}
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div ref={bagRef} className="relative" style={{ width: "min(70vw, 300px)", aspectRatio: "0.9" }}>
          <div aria-hidden className="absolute inset-x-[8%] bottom-[-4%] h-[10%] rounded-[50%] bg-black/60 blur-lg" />
          {/* Шар 1: лямки й темне нутро в отворі */}
          <svg viewBox="0 0 300 330" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <path d="M95 70 C70 40 90 10 120 18 M205 70 C230 40 210 10 180 18" stroke="#1c2f3a" strokeWidth="14" fill="none" strokeLinecap="round" />
            <ellipse cx="150" cy={78 - 10 * fullness} rx={82 * Math.max(0.05, open)} ry={6 + 20 * open} fill="#050b10" />
          </svg>

          {/* Шар 2: справи визирають з отвору (решта — всередині) */}
          <div className={cn("absolute inset-x-[20%] top-[1%] flex h-[25%] items-end justify-center transition-opacity duration-500", zipped ? "pointer-events-none opacity-0" : "opacity-100")}>
            {inBag.slice(0, 4).map((it, i, arr) => (
              <ItemView
                key={it.id}
                item={it}
                hidden={dragId === it.id}
                style={{
                  marginInline: -6,
                  zIndex: arr.length - Math.abs(i - (arr.length - 1) / 2),
                  transform: `translateY(${18 + Math.abs(i - (arr.length - 1) / 2) * 8}px) rotate(${(i - (arr.length - 1) / 2) * 9}deg)`,
                }}
              />
            ))}
          </div>

          {/* Шар 3: передня стінка рюкзака */}
          <svg viewBox="0 0 300 330" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="bp-fabric" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3e5a6b" />
                <stop offset="0.55" stopColor="#2a4352" />
                <stop offset="1" stopColor="#1a2c37" />
              </linearGradient>
              <radialGradient id="bp-light" cx="0.32" cy="0.28" r="0.75">
                <stop offset="0" stopColor="#9fb0ba" stopOpacity="0.35" />
                <stop offset="1" stopColor="#9fb0ba" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g style={{ transform: `scale(${1 + 0.1 * fullness}, ${0.92 + 0.08 * fullness})`, transformOrigin: "150px 320px", transition: "transform 900ms cubic-bezier(.16,1,.3,1)" }}>
              {/* Корпус: що повніший, то опукліший. Верхній край — по блискавці. */}
              <path
                d={`M64 ${86 - 10 * fullness} Q150 ${70 - 10 * fullness} 236 ${86 - 10 * fullness} L${252 + 12 * fullness} 290 C${252 + 12 * fullness} 322 ${48 - 12 * fullness} 322 ${48 - 12 * fullness} 290 Z`}
                fill="url(#bp-fabric)"
              />
              <path
                d={`M64 ${86 - 10 * fullness} Q150 ${70 - 10 * fullness} 236 ${86 - 10 * fullness} L${252 + 12 * fullness} 290 C${252 + 12 * fullness} 322 ${48 - 12 * fullness} 322 ${48 - 12 * fullness} 290 Z`}
                fill="url(#bp-light)"
              />
              {/* Кишеня */}
              <rect x="92" y="190" width="116" height="88" rx="18" fill="#2f4958" stroke="#1a2a33" strokeWidth="1.5" />
              <rect x="98" y="196" width="104" height="76" rx="14" fill="none" stroke="#7a95a3" strokeOpacity="0.35" strokeDasharray="4 4" />
              <path d={`M72 ${98 - 10 * fullness} Q150 ${84 - 10 * fullness} 228 ${98 - 10 * fullness}`} fill="none" stroke="#7a95a3" strokeOpacity="0.35" strokeDasharray="4 4" />
              {/* Кромка отвору й зубці блискавки */}
              <path d={`M64 ${86 - 10 * fullness} Q150 ${70 - 10 * fullness} 236 ${86 - 10 * fullness}`} stroke="#15232c" strokeWidth="5" fill="none" strokeLinecap="round" />
              {Array.from({ length: 26 }, (_, i) => {
                const t = i / 25;
                const x = 66 + 168 * t;
                const yEdge = 86 - 10 * fullness - Math.sin(Math.PI * t) * 8;
                const parted = t < open;
                return <rect key={i} x={x - 2} y={yEdge - 2 - (parted ? 3 : 0)} width="4" height="4" rx="1" fill="#9fb0ba" opacity={parted ? 0.6 : 0.9} />;
              })}
            </g>
          </svg>
          {!zipped && inBag.length > 4 && (
            <span className="absolute left-1/2 top-[34%] -translate-x-1/2 rounded-[var(--radius-hair)] bg-abyss/70 px-2 py-0.5 text-xs text-frost/85">ще {inBag.length - 4} всередині</span>
          )}

          {/* Доріжка й бігунок */}
          <div ref={trackRef} className="absolute left-[23%] right-[23%] top-[11%] h-10">
            <button
              type="button"
              data-zip
              aria-label="Відкрити блискавку"
              onClick={() => {
                setOpen(1);
                sound.play("zip", 0.6);
                setHint("Витягай справи й розкладай: сьогодні, потім, потрібна допомога.");
              }}
              className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center touch-none"
              style={{ left: `${open * 100}%` }}
            >
              <span className="block h-7 w-4 rounded-[3px] bg-gradient-to-b from-frost to-steel shadow-[0_4px_8px_rgb(0_0_0/0.6)] ring-1 ring-black/40" />
            </button>
          </div>

        </div>
      </div>

      {/* Три зони */}
      <div className="grid w-full max-w-2xl grid-cols-3 gap-2">
        {ZONES.map((z) => {
          const here = items.filter((i) => i.where === z.id);
          return (
            <div
              key={z.id}
              ref={(el) => {
                zoneRefs.current[z.id] = el;
              }}
              className={cn(
                "flex min-h-28 flex-col gap-1.5 rounded-[var(--radius-edge)] border p-2 transition-colors",
                "border-steel/45 bg-[linear-gradient(180deg,rgb(8_19_28/0.6),rgb(17_28_38/0.85))] shadow-[inset_0_6px_14px_rgb(0_0_0/0.45)]",
                inBag.length === 0 && z.id === "today" && "border-tide",
              )}
            >
              <span className="text-center text-[0.72rem] uppercase leading-tight tracking-[0.08em] text-frost/80">{z.label}</span>
              <div className="flex flex-wrap justify-center gap-1">
                {here.map((it) => (
                  <ItemView key={it.id} item={it} small hidden={dragId === it.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Клавіатурна альтернатива */}
      <div className="flex min-h-24 w-full flex-wrap content-start items-center justify-center gap-2 pb-1" aria-live="polite">
        {zipped ? (
          <button type="button" className="scene-btn border border-steel/50" onClick={() => setOpen(1)}>
            Відкрити рюкзак
          </button>
        ) : nextInBag ? (
          <>
            <span className="text-sm text-frost/80">«{nextInBag.label}» →</span>
            {ZONES.map((z) => (
              <button key={z.id} type="button" className="scene-btn border border-steel/50 text-xs" onClick={() => moveItem(nextInBag.id, z.id)}>
                {z.label}
              </button>
            ))}
          </>
        ) : null}
      </div>

      {/* Предмет у руці */}
      {dragged && (
        <div ref={ghostRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-30 drop-shadow-[0_18px_18px_rgb(0_0_0/0.6)]" style={{ willChange: "transform" }}>
          <ItemView item={dragged} />
        </div>
      )}
    </div>
  );
}

/** Предмет: форма й обʼєм залежать від типу; підпис — назва справи. */
function ItemView({ item, small, hidden, style }: { item: Item; small?: boolean; hidden?: boolean; style?: React.CSSProperties }) {
  const base = "relative flex select-none items-center justify-center text-center font-medium leading-tight text-abyss";
  const size = small ? "min-h-9 min-w-14 px-2 text-[0.68rem]" : "min-h-14 min-w-20 px-3 text-xs";
  const shapes: Record<Shape, string> = {
    book: "rounded-[3px] bg-[linear-gradient(90deg,#7d8f9a_0_10%,#c9d4d8_10%_100%)] shadow-[inset_-3px_-3px_0_rgb(0_0_0/0.15)]",
    box: "rounded-[2px] bg-[linear-gradient(160deg,#d8c0a5,#a98f72)] shadow-[inset_0_6px_0_rgb(255_255_255/0.25),inset_0_-4px_0_rgb(0_0_0/0.2)]",
    ball: "rounded-full bg-[radial-gradient(circle_at_35%_30%,#e7ebed,#8fa6b0_70%,#5f7581)]",
    bottle: "rounded-[14px_14px_8px_8px] bg-[linear-gradient(90deg,#8fb3b4,#c6dcdc_40%,#6f9a9c)]",
    folder: "rounded-[2px_8px_2px_2px] bg-[linear-gradient(180deg,#b9c7c4,#93a7a5)] shadow-[inset_0_5px_0_rgb(255_255_255/0.3)]",
    weight: "rounded-[4px] bg-[linear-gradient(180deg,#6c8291,#3c5263)] text-frost [clip-path:polygon(12%_0,88%_0,100%_100%,0_100%)]",
  };
  return (
    <div
      data-item={item.id}
      className={cn(base, size, shapes[item.shape], "cursor-grab touch-none shadow-[0_6px_10px_-4px_rgb(0_0_0/0.6)]", hidden && "opacity-0")}
      style={style}
    >
      <span className="max-w-[7rem] break-words">{item.label}</span>
    </div>
  );
}
