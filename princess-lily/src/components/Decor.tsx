/**
 * Делікатний мальований декор для країв секцій: зірочки, хмаринки, акварельні плями.
 * Лише декор: aria-hidden, pointer-events:none, без анімації «на місці» (лише одноразова поява з краю).
 * Розміщується в абсолютних «полях» секції, щоб не заходити під текст, товари й кнопки.
 */
type Pos = { top?: string; bottom?: string; left?: string; right?: string };
type Item = { kind: "star" | "cloud" | "wash" | "sparkle"; pos: Pos; size: number; tone?: "gold" | "rose" | "sage" | "milk"; from: "left" | "right" | "up"; delay?: number; mobile?: boolean; rotate?: number };

const TONES = { gold: "#d3a95c", rose: "#d9a3a1", sage: "#9db194", milk: "#fffaf0" };

function Star({ size, color, rotate = 0 }: { size: number; color: string; rotate?: number }) {
  // «мальована» зірочка: нерівні промені, подвійний штрих як олівцем
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M24 4.5c1.4 6.8 3.2 11.2 6 13.6 2.6 2.2 7 3.3 13.4 4.5-6.3 1.5-10.6 2.9-13.2 5.3-2.8 2.6-4.6 7-6.4 14.6-1.5-7.4-3.3-11.9-6-14.4-2.7-2.5-7-3.9-13.3-5.4 6.5-1.3 10.8-2.6 13.4-4.9 2.6-2.4 4.4-6.6 6.1-13.3z"
        fill={color} fillOpacity=".28" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M24.6 9c.9 4.4 2.3 7.6 4.3 9.5" fill="none" stroke={color} strokeOpacity=".55" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M12 2.5c.5 4.3 1.6 6.8 3.3 8 1.6 1.1 3.6 1.4 6.2 1.5-2.7.2-4.7.6-6.2 1.6-1.7 1.2-2.8 3.7-3.3 7.9-.6-4.2-1.7-6.7-3.4-7.9-1.5-1-3.5-1.4-6.1-1.6 2.6-.1 4.6-.4 6.1-1.5 1.7-1.2 2.8-3.7 3.4-8z" fill={color} fillOpacity=".7" />
    </svg>
  );
}
function Cloud({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 160 90" width={size} height={size * 0.56}>
      <defs>
        <radialGradient id="cl-g" cx="45%" cy="40%" r="70%"><stop offset="0" stopColor="#fffdf8" /><stop offset=".7" stopColor="#fbf5ea" /><stop offset="1" stopColor="#f3eadb" /></radialGradient>
      </defs>
      <path d="M28 72c-13 0-21-8-20-18 1-10 10-16 20-15 2-14 14-24 29-22 9 1 15 6 19 13 5-7 13-11 22-10 13 2 21 12 20 24 11 0 19 7 19 15 0 8-7 13-17 13H28z"
        fill="url(#cl-g)" stroke={color} strokeOpacity=".55" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M44 40c2-8 9-13 17-12" fill="none" stroke={color} strokeOpacity=".35" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
function Wash({ size, color }: { size: number; color: string }) {
  // акварельна пляма: кілька напівпрозорих шарів з нерівним краєм
  return (
    <svg viewBox="0 0 200 160" width={size} height={size * 0.8}>
      <path d="M36 92c-12-26 6-58 38-66 22-6 40 4 58 2 26-3 50 14 52 40 2 28-22 46-48 56-24 9-44 2-64 4-20 2-28-12-36-36z" fill={color} fillOpacity=".16" />
      <path d="M52 86c-6-18 8-40 30-44 18-4 30 6 46 6 18 0 34 12 32 30-2 18-18 28-36 32-18 4-32-2-46-2-14 0-20-6-26-22z" fill={color} fillOpacity=".14" />
      <path d="M70 80c0-10 10-18 24-18 12 0 20 6 30 8" fill="none" stroke={color} strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Decor({ items, className = "" }: { items: Item[]; className?: string }) {
  return (
    <div aria-hidden="true" className={`decor pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {items.map((it, i) => {
        const color = TONES[it.tone ?? "gold"];
        return (
          <span key={i} data-reveal={it.from} className={`absolute ${it.mobile ? "" : "hidden md:block"}`}
            style={{ ...it.pos, ["--reveal-delay" as string]: `${it.delay ?? 0}ms` }}>
            {it.kind === "star" && <Star size={it.size} color={color} rotate={it.rotate} />}
            {it.kind === "sparkle" && <Sparkle size={it.size} color={color} />}
            {it.kind === "cloud" && <Cloud size={it.size} color={color} />}
            {it.kind === "wash" && <Wash size={it.size} color={color} />}
          </span>
        );
      })}
    </div>
  );
}

/** Готові композиції для секцій — небагато елементів, лише в полях. */
export const DECOR = {
  catalog: [
    { kind: "cloud", pos: { top: "3%", right: "-30px" }, size: 170, tone: "gold", from: "right" },
    { kind: "star", pos: { top: "14%", left: "2.5%" }, size: 30, tone: "gold", from: "left", delay: 120, rotate: -8 },
    { kind: "sparkle", pos: { top: "8%", left: "6%" }, size: 14, tone: "gold", from: "left", delay: 220, mobile: true },
    { kind: "wash", pos: { bottom: "-40px", left: "-60px" }, size: 260, tone: "rose", from: "up" },
  ],
  books: [
    { kind: "wash", pos: { top: "-30px", left: "-70px" }, size: 300, tone: "sage", from: "left" },
    { kind: "star", pos: { bottom: "12%", left: "4%" }, size: 26, tone: "gold", from: "up", delay: 160, rotate: 12 },
    { kind: "sparkle", pos: { top: "6%", right: "3%" }, size: 16, tone: "gold", from: "right", delay: 200, mobile: true },
  ],
  world: [
    { kind: "cloud", pos: { top: "6%", left: "-40px" }, size: 190, tone: "gold", from: "left" },
    { kind: "star", pos: { top: "10%", right: "4%" }, size: 34, tone: "rose", from: "right", delay: 140, rotate: 6 },
    { kind: "sparkle", pos: { bottom: "16%", right: "8%" }, size: 14, tone: "gold", from: "right", delay: 260 },
    { kind: "wash", pos: { bottom: "-50px", right: "-60px" }, size: 280, tone: "gold", from: "up" },
  ],
  author: [
    { kind: "wash", pos: { top: "10%", right: "-80px" }, size: 300, tone: "rose", from: "right" },
    { kind: "star", pos: { bottom: "10%", left: "3%" }, size: 28, tone: "gold", from: "left", delay: 150, rotate: -14 },
    { kind: "sparkle", pos: { top: "4%", left: "8%" }, size: 14, tone: "gold", from: "left", delay: 240, mobile: true },
  ],
  faq: [
    { kind: "cloud", pos: { top: "2%", right: "-50px" }, size: 160, tone: "sage", from: "right" },
    { kind: "star", pos: { top: "40%", left: "3%" }, size: 24, tone: "gold", from: "left", delay: 120, rotate: 18 },
    { kind: "sparkle", pos: { bottom: "8%", right: "6%" }, size: 14, tone: "rose", from: "up", delay: 200 },
  ],
} satisfies Record<string, Item[]>;
