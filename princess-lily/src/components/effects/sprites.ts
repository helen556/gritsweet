/** Спільні спрайти частинок для canvas-ефектів (малюються один раз, далі лише drawImage). */
export type Sprite = HTMLCanvasElement;

export function makeGlow(color: string, size = 32, core = "#fffaf0"): Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  // світле ядро → колір → м'який ореол
  grad.addColorStop(0, core);
  grad.addColorStop(0.16, core);
  grad.addColorStop(0.3, color);
  grad.addColorStop(0.55, withAlpha(color, 0.3));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Маленька чотирипроменева зірочка з м'яким ореолом. */
export function makeStar(color: string, size = 48): Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const halo = g.createRadialGradient(r, r, 0, r, r, r * 0.55);
  halo.addColorStop(0, withAlpha(color, 0.55));
  halo.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  g.fillStyle = color;
  g.beginPath();
  const arm = r * 0.95, waist = r * 0.12;
  g.moveTo(r, r - arm);
  g.quadraticCurveTo(r + waist, r - waist, r + arm, r);
  g.quadraticCurveTo(r + waist, r + waist, r, r + arm);
  g.quadraticCurveTo(r - waist, r + waist, r - arm, r);
  g.quadraticCurveTo(r - waist, r - waist, r, r - arm);
  g.fill();
  return c;
}

function withAlpha(hexOrRgb: string, a: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hexOrRgb);
  if (!m) return hexOrRgb;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** М'яка пляма теплого перламутрового світла для «хмаринки». */
export function makePuff(size = 128): Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255, 249, 236, 1)");
  grad.addColorStop(0.45, "rgba(250, 238, 214, 0.55)");
  grad.addColorStop(1, "rgba(246, 232, 205, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export const PALETTE = { champagne: "#f1dfb8", pearl: "#fffaf0", gold: "#d6ad5f", deepGold: "#bf8f3c" };

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
/** Груба оцінка слабкого пристрою для зменшення кількості частинок. */
export function isLowPower() {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4 || !!n.connection?.saveData;
}
