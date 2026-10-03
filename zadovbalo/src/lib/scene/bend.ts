/**
 * Аркуш, що гнеться (купюра в руці): картинка ріжеться на вузькі смуги, кожна стає на вигнуту криву.
 * z(u) — прогин від точки захоплення; проєкція з легким нахилом камери дає вкорочення,
 * зсув і світлотінь (смуги, повернуті від світла, темніші).
 */
export interface BendParams {
  /** Центр точки захоплення на екрані. */
  x: number;
  y: number;
  /** Розмір аркуша на екрані. */
  w: number;
  h: number;
  /** Поворот у площині (рад). */
  angle: number;
  /** Де тримають, частка довжини 0..1 (і висоти 0..1). */
  grabU: number;
  grabV: number;
  /** Прогин країв (px на повну довжину): >0 — провисає від пальця. */
  sag: number;
  /** Додатковий асиметричний вигин (від руху): частина, що «відстає». */
  lag: number;
  /** Підйом над столом (px) — для масштабу. */
  lift: number;
}

const STRIPS = 28;

function zAt(u: number, p: BendParams) {
  const d = u - p.grabU;
  return -p.sag * d * d - p.lag * d * Math.abs(d);
}

export function drawBent(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, p: BendParams) {
  const scale = 1 + p.lift * 0.0025;
  const w = p.w * scale;
  const h = p.h * scale;
  // Інтегруємо довжину кривої від точки захоплення в обидва боки (вкорочення).
  const xs: number[] = new Array(STRIPS + 1);
  const zs: number[] = new Array(STRIPS + 1);
  const g = Math.round(p.grabU * STRIPS);
  xs[g] = 0;
  zs[g] = zAt(g / STRIPS, p) * w;
  for (let i = g + 1; i <= STRIPS; i++) {
    const z0 = zs[i - 1]!;
    const z1 = zAt(i / STRIPS, p) * w;
    zs[i] = z1;
    const ds = w / STRIPS;
    xs[i] = xs[i - 1]! + Math.sqrt(Math.max(0, ds * ds - (z1 - z0) * (z1 - z0) * 0.5));
  }
  for (let i = g - 1; i >= 0; i--) {
    const z0 = zs[i + 1]!;
    const z1 = zAt(i / STRIPS, p) * w;
    zs[i] = z1;
    const ds = w / STRIPS;
    xs[i] = xs[i + 1]! - Math.sqrt(Math.max(0, ds * ds - (z1 - z0) * (z1 - z0) * 0.5));
  }
  const base = ctx.getTransform();
  const dpr = base.a || 1;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const top = -p.grabV * h;
  const sw = iw / STRIPS;
  for (let i = 0; i < STRIPS; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const zm = (zs[i]! + zs[i + 1]!) / 2;
    const slope = (zs[i + 1]! - zs[i]!) / Math.max(1e-3, x1 - x0);
    // Камера трохи згори-спереду: опущені краї зсуваються вниз і зменшуються.
    const dy = -zm * 0.38;
    const k = 1 + zm * 0.0012;
    const lx = x0;
    const lw = x1 - x0 + 0.6; // перекриття проти щілин
    const tx = p.x + (lx * cos - (top + dy) * sin);
    const ty = p.y + (lx * sin + (top + dy) * cos);
    ctx.setTransform(dpr * cos * k, dpr * sin * k, -dpr * sin * k, dpr * cos * k, base.e + dpr * tx, base.f + dpr * ty);
    ctx.drawImage(img, i * sw, 0, sw + 0.5, ih, 0, 0, lw / k, h);
    // Світлотінь: світло зверху зліва.
    const shade = Math.max(-0.35, Math.min(0.25, -slope * 0.9));
    if (Math.abs(shade) > 0.01) {
      ctx.fillStyle = shade < 0 ? `rgba(0,0,0,${-shade})` : `rgba(255,255,255,${shade * 0.6})`;
      ctx.fillRect(0, 0, lw / k, h);
    }
  }
  ctx.setTransform(base);
}

/** Мʼяка тінь прямокутника (через shadowBlur — працює й у Safari, на відміну від ctx.filter). */
export function drawSoftShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, blur: number, alpha: number, radius = 3) {
  const base = ctx.getTransform();
  const dpr = base.a || 1;
  const OFF = 20000;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.save();
  // Сам прямокутник — далеко за полотном, на екрані лише його тінь (зсув — у пікселях пристрою).
  ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, base.e + dpr * x - OFF, base.f + dpr * y);
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur * dpr;
  ctx.shadowOffsetX = OFF;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, radius);
  ctx.fill();
  ctx.restore();
}
