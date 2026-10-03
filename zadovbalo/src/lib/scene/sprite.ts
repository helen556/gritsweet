"use client";

/** Спрайт із маскою прозорості для точного «влучання» пальцем (а не по прямокутнику). */
export interface Sprite {
  img: HTMLImageElement;
  w: number;
  h: number;
  /** Альфа зменшеної копії (крок STEP px) для перевірки дотику. */
  alpha: Uint8Array;
  aw: number;
  ah: number;
}

const STEP = 4;

export function makeSprite(img: HTMLImageElement): Sprite {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const aw = Math.max(1, Math.ceil(w / STEP));
  const ah = Math.max(1, Math.ceil(h / STEP));
  const c = document.createElement("canvas");
  c.width = aw;
  c.height = ah;
  const g = c.getContext("2d", { willReadFrequently: true });
  const alpha = new Uint8Array(aw * ah);
  if (g) {
    g.drawImage(img, 0, 0, aw, ah);
    const d = g.getImageData(0, 0, aw, ah).data;
    for (let i = 0; i < aw * ah; i++) alpha[i] = d[i * 4 + 3]!;
  } else alpha.fill(255);
  return { img, w, h, alpha, aw, ah };
}

/** Чи непрозорий спрайт у точці (координати всередині спрайта, px). */
export function opaqueAt(s: Sprite, x: number, y: number, threshold = 96): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const ix = Math.min(s.aw - 1, Math.floor(x / STEP));
  const iy = Math.min(s.ah - 1, Math.floor(y / STEP));
  return s.alpha[iy * s.aw + ix]! >= threshold;
}

/** Мʼяка контактна тінь-еліпс під предметом. */
export function contactShadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  if (rx <= 0 || ry <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
  grad.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.55})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Фото з мʼяко розчиненими краями — зливається з тлом сцени без видимих швів. */
export function featherImage(img: HTMLImageElement, edge = 0.12): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  // destination-out стирає лише там, де малюємо: краї поступово прозорішають.
  g.globalCompositeOperation = "destination-out";
  const w = c.width;
  const h = c.height;
  const ex = w * edge;
  const ey = h * edge;
  const lin = (x0: number, y0: number, x1: number, y1: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    return gr;
  };
  g.fillStyle = lin(0, 0, ex, 0);
  g.fillRect(0, 0, ex, h);
  g.fillStyle = lin(w, 0, w - ex, 0);
  g.fillRect(w - ex, 0, ex, h);
  g.fillStyle = lin(0, 0, 0, ey);
  g.fillRect(0, 0, w, ey);
  g.fillStyle = lin(0, h, 0, h - ey);
  g.fillRect(0, h - ey, w, ey);
  return c;
}
