"use client";

import { loadImage, loadJson } from "@/lib/scene/assets";
import { sound, variant } from "@/lib/scene/sound";

/**
 * Спільна свічка для «Хочу тиші» й «Побудь тут»: живе полумʼя, ґніт із жаринкою, калюжка воску, дим, сірник.
 * Координати — пікселі кадру свічки (630×836); у «Побудь тут» — той самий кадр, вирізаний спрайтом.
 */
export interface CandleMeta {
  size: [number, number];
  wick: { tip: [number, number]; base: [number, number] };
  top: { cx: number; cy: number; rx: number; ry: number };
  matchStrip: [number, number];
  sprite: { x: number; y: number; w: number; h: number };
}

export const CANDLE_SOUNDS = ["match", "ignite", "snuff", "crackle-0", "crackle-1", "crackle-2"] as const;

export async function loadCandle(sprites = false) {
  const meta = await loadJson<CandleMeta>("/scenes/candle/candle.json");
  const [lit, unlit, match] = await Promise.all([
    loadImage(sprites ? "/scenes/candle/lit-sprite.webp" : "/scenes/candle/lit.webp"),
    loadImage(sprites ? "/scenes/candle/unlit-sprite.webp" : "/scenes/candle/unlit.webp"),
    loadImage("/scenes/candle/match.webp"),
  ]);
  return { meta, lit, unlit, match };
}
export type CandleAssets = Awaited<ReturnType<typeof loadCandle>>;

/** Плавний 1D-шум (сума синусів із несумірними частотами) — без різких стрибків. */
function n1(t: number, seed: number) {
  return Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 2.9 + seed * 1.3) * 0.3 + Math.sin(t * 5.3 + seed * 2.1) * 0.2;
}

export class Flame {
  /** Сила полумʼя 0..1 (займання/згасання — плавно). */
  level = 0;
  lit = false;
  /** Скільки секунд горить (калюжка воску росте повільно). */
  melt = 0;
  smoke: { x: number; y: number; vx: number; vy: number; life: number; age: number; w: number }[] = [];
  private nextCrackle = 6;
  private t = Math.random() * 100;
  /** Рідкісне посилення мерехтіння (протяг). */
  private gust = 0;

  ignite() {
    if (this.lit) return;
    this.lit = true;
    sound.sample("ignite", { gain: 0.45 });
  }

  extinguish(tipX: number, tipY: number) {
    if (!this.lit) return;
    this.lit = false;
    sound.sample("snuff", { gain: 0.5 });
    for (let i = 0; i < 46; i++)
      this.smoke.push({ x: tipX, y: tipY - 4, vx: 0, vy: -(18 + Math.random() * 10), life: 2.4 + Math.random() * 1.6, age: -i * 0.035, w: 1 + Math.random() });
  }

  /** true — потрібні ще кадри. */
  update(dt: number) {
    this.t += dt;
    const target = this.lit ? 1 : 0;
    // займається повільніше, ніж гасне
    this.level += (target - this.level) * Math.min(1, dt * (this.lit ? 2.6 : 9));
    if (Math.abs(this.level - target) < 0.002) this.level = target;
    if (this.lit) {
      this.melt += dt;
      if (Math.random() < dt * 0.05) this.gust = 1;
      // тихе нерівне потріскування — рідко
      this.nextCrackle -= dt;
      if (this.nextCrackle <= 0) {
        this.nextCrackle = 5 + Math.random() * 11;
        sound.sample(variant("crackle-", 3), { gain: 0.12 + Math.random() * 0.14, rate: 0.85 + Math.random() * 0.3 });
      }
    } else this.melt = Math.max(0, this.melt - dt * 0.2);
    this.gust = Math.max(0, this.gust - dt * 0.8);
    for (const p of this.smoke) {
      p.age += dt;
      if (p.age < 0) continue;
      p.vx += Math.sin(p.age * 2.2 + p.w * 3) * 6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= Math.exp(-dt * 0.15);
    }
    this.smoke = this.smoke.filter((p) => p.age < p.life);
    return this.lit || this.level > 0 || this.smoke.length > 0;
  }

  /** Мерехтіння світла (≈0.85..1.05) — однакове для полумʼя й освітлення сцени. */
  flicker() {
    return 0.95 + n1(this.t * 3.1, 1) * 0.05 + this.gust * n1(this.t * 9, 4) * 0.08;
  }

  sway() {
    return n1(this.t * 1.3, 7) * 0.6 + this.gust * n1(this.t * 6.5, 9) * 1.6;
  }

  /** Полумʼя: синюватий низ, яскраве жовто-біле серце, теплий край, мʼякий ореол. */
  draw(g: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    if (this.level <= 0.01) return;
    const L = this.level;
    const f = this.flicker();
    const sw = this.sway();
    const h = 112 * scale * (0.35 + 0.65 * L) * (0.94 + 0.08 * f);
    const w = 30 * scale * (0.55 + 0.45 * L);
    const tipX = x + sw * 7 * scale;
    const tipY = y - h;
    g.save();
    g.globalCompositeOperation = "lighter";
    // ореол
    const halo = g.createRadialGradient(x, y - h * 0.45, 0, x, y - h * 0.45, 150 * scale);
    halo.addColorStop(0, `rgba(255,170,80,${0.22 * L * f})`);
    halo.addColorStop(0.4, `rgba(255,120,40,${0.08 * L * f})`);
    halo.addColorStop(1, "rgba(255,100,30,0)");
    g.fillStyle = halo;
    g.fillRect(x - 160 * scale, y - h * 0.45 - 160 * scale, 320 * scale, 320 * scale);

    const shape = (k: number) => {
      // крапля: кругла основа біля ґнота, загострений, трохи асиметричний верх
      const ww = w * k;
      const by = y + 4 * scale;
      g.beginPath();
      g.moveTo(x, by);
      g.bezierCurveTo(x + ww * 0.9, by, x + ww * 0.75, by - h * 0.45, (x + tipX) / 2 + ww * 0.12, by - h * 0.78);
      g.quadraticCurveTo(tipX + ww * 0.05, tipY + h * 0.08, tipX, tipY + h * (1 - k) * 0.4);
      g.quadraticCurveTo(tipX - ww * 0.1, tipY + h * 0.1, (x + tipX) / 2 - ww * 0.25, by - h * 0.72);
      g.bezierCurveTo(x - ww * 0.8, by - h * 0.42, x - ww * 0.95, by, x, by);
      g.closePath();
    };
    // зовнішня тепла оболонка
    shape(1);
    let gr = g.createLinearGradient(0, y, 0, tipY);
    gr.addColorStop(0, `rgba(80,110,255,${0.55 * L})`);
    gr.addColorStop(0.12, `rgba(255,140,40,${0.55 * L})`);
    gr.addColorStop(0.6, `rgba(255,150,50,${0.5 * L})`);
    gr.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = gr;
    g.fill();
    // яскраве серце
    shape(0.62);
    gr = g.createLinearGradient(0, y, 0, tipY);
    gr.addColorStop(0, `rgba(120,140,255,${0.25 * L})`);
    gr.addColorStop(0.15, `rgba(255,236,190,${0.85 * L})`);
    gr.addColorStop(0.55, `rgba(255,248,225,${0.95 * L * f})`);
    gr.addColorStop(1, `rgba(255,210,120,${0.2 * L})`);
    g.fillStyle = gr;
    g.fill();
    g.restore();
    // темніша зона біля ґнота (у справжнього полумʼя тут менше світла)
    g.save();
    g.globalAlpha = 0.35 * L;
    const dz = g.createRadialGradient(x, y - 6 * scale, 0, x, y - 6 * scale, 9 * scale);
    dz.addColorStop(0, "rgba(90,60,60,0.8)");
    dz.addColorStop(1, "rgba(90,60,60,0)");
    g.fillStyle = dz;
    g.fillRect(x - 10 * scale, y - 16 * scale, 20 * scale, 20 * scale);
    g.restore();
  }

  /** Ґніт: темний вигнутий, на кінчику жаринка, що згасає. */
  drawWick(g: CanvasRenderingContext2D, base: [number, number], tip: [number, number], scale: number, ember: number) {
    g.save();
    g.lineCap = "round";
    g.strokeStyle = "#1b120d";
    g.lineWidth = 6 * scale;
    g.beginPath();
    g.moveTo(base[0], base[1]);
    g.quadraticCurveTo(base[0] + 3 * scale, (base[1] + tip[1]) / 2, tip[0], tip[1]);
    g.stroke();
    if (ember > 0.01) {
      g.globalCompositeOperation = "lighter";
      const e = g.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], 7 * scale);
      e.addColorStop(0, `rgba(255,120,40,${0.9 * ember})`);
      e.addColorStop(1, "rgba(255,80,20,0)");
      g.fillStyle = e;
      g.beginPath();
      g.arc(tip[0], tip[1], 7 * scale, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  drawSmoke(g: CanvasRenderingContext2D, scale: number) {
    if (!this.smoke.length) return;
    g.save();
    g.lineCap = "round";
    const pts = this.smoke.filter((p) => p.age >= 0);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const life = 1 - b.age / b.life;
      g.strokeStyle = `rgba(190,185,180,${0.16 * life})`;
      g.lineWidth = (2 + b.age * 5) * scale * b.w;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.restore();
  }

  /** Калюжка розтопленого воску: росте повільно, відбиває полумʼя. */
  drawPool(g: CanvasRenderingContext2D, top: CandleMeta["top"], scale: number, ox = 0, oy = 0) {
    const grow = Math.min(1, this.melt / 150);
    const a = Math.max(this.level, Math.min(1, this.melt / 20)) * (0.25 + 0.75 * grow);
    if (a < 0.02) return;
    const cx = ox + top.cx * scale;
    const cy = oy + top.cy * scale;
    const rx = top.rx * scale * (0.35 + 0.45 * grow);
    const ry = top.ry * scale * (0.35 + 0.45 * grow);
    g.save();
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    gr.addColorStop(0, `rgba(255,214,150,${0.32 * a})`);
    gr.addColorStop(0.8, `rgba(240,190,120,${0.18 * a})`);
    gr.addColorStop(1, "rgba(240,190,120,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    if (this.level > 0.05) {
      g.globalCompositeOperation = "lighter";
      g.fillStyle = `rgba(255,230,180,${0.35 * this.level * this.flicker()})`;
      g.beginPath();
      g.ellipse(cx - rx * 0.25 + this.sway() * 2 * scale, cy + ry * 0.1, rx * 0.12, ry * 0.18, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

/** Сірник: дерев'яна паличка з фактурою зі знімка, обвуглена голівка, власне невелике полумʼя. */
export function drawMatch(
  g: CanvasRenderingContext2D,
  strip: HTMLImageElement,
  headX: number,
  headY: number,
  angle: number,
  scale: number,
  burn: number,
  t: number,
) {
  const len = 210 * scale;
  const th = 9 * scale;
  g.save();
  g.translate(headX, headY);
  g.rotate(angle);
  // паличка тягнеться від голівки назад (вздовж −x)
  g.drawImage(strip, 0, 0, strip.naturalWidth, strip.naturalHeight, -len, -th / 2, len, th);
  // обвуглена ділянка біля голівки
  const ch = g.createLinearGradient(-26 * scale, 0, 0, 0);
  ch.addColorStop(0, "rgba(30,18,10,0)");
  ch.addColorStop(1, `rgba(30,18,10,${0.4 + 0.5 * Math.min(1, burn * 1.5)})`);
  g.fillStyle = ch;
  g.fillRect(-26 * scale, -th / 2, 26 * scale, th);
  // голівка
  g.fillStyle = burn > 0 ? "#2a1a12" : "#6e2418";
  g.beginPath();
  g.ellipse(2 * scale, 0, 9 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (burn > 0.02) {
    // полумʼя сірника піднімається вгору незалежно від нахилу
    const h = 56 * scale * burn * (0.9 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.05);
    const w = 15 * scale * Math.max(0.4, burn);
    const sw = Math.sin(t * 2.3) * 3 * scale;
    g.save();
    g.globalCompositeOperation = "lighter";
    const halo = g.createRadialGradient(headX, headY - h * 0.4, 0, headX, headY - h * 0.4, 70 * scale);
    halo.addColorStop(0, `rgba(255,150,60,${0.25 * burn})`);
    halo.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = halo;
    g.fillRect(headX - 70 * scale, headY - h * 0.4 - 70 * scale, 140 * scale, 140 * scale);
    g.beginPath();
    g.moveTo(headX - w, headY + 3 * scale);
    g.quadraticCurveTo(headX - w * 0.9, headY - h * 0.6, headX + sw, headY - h);
    g.quadraticCurveTo(headX + w * 0.9, headY - h * 0.55, headX + w, headY + 3 * scale);
    g.closePath();
    const gr = g.createLinearGradient(0, headY, 0, headY - h);
    gr.addColorStop(0, `rgba(110,130,255,${0.5 * burn})`);
    gr.addColorStop(0.18, `rgba(255,220,160,${0.9 * burn})`);
    gr.addColorStop(0.7, `rgba(255,150,50,${0.6 * burn})`);
    gr.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = gr;
    g.fill();
    g.restore();
  }
}
