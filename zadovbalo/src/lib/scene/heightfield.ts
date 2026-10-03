/**
 * Поле висот для «матеріальних» поверхонь (глина, пісок). Чисті функції, без DOM — тестовані.
 * Висота в умовних одиницях; > 0 — є матеріал.
 */
export interface Heightfield {
  w: number;
  h: number;
  data: Float32Array;
  /** Глянець 0..1 (згладжена глина блищить). */
  gloss: Float32Array;
}

export function createHeightfield(w: number, h: number): Heightfield {
  return { w, h, data: new Float32Array(w * h), gloss: new Float32Array(w * h) };
}

/** Детермінований шум для органічної форми без Math.random у рендері. */
export function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number) {
  return smoothNoise(x, y) * 0.6 + smoothNoise(x * 2.1, y * 2.1) * 0.28 + smoothNoise(x * 4.3, y * 4.3) * 0.12;
}

/** Грудка: сплюснутий купол із неідеальним краєм. */
export function fillLump(hf: Heightfield, seed = 1, height = 1) {
  const { w, h, data } = hf;
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (w * 0.4);
      const dy = (y - cy) / (h * 0.34);
      const ang = Math.atan2(dy, dx);
      const wobble = 1 + 0.08 * Math.sin(ang * 3 + seed) + 0.05 * Math.sin(ang * 5 + seed * 2);
      const r = Math.hypot(dx, dy) / wobble;
      const dome = r < 1 ? Math.pow(1 - r * r, 0.55) : 0;
      data[y * w + x] = dome > 0 ? dome * height * (0.97 + 0.05 * fbm(x * 0.04 + seed, y * 0.04)) : 0;
    }
}

export function volume(hf: Heightfield) {
  let v = 0;
  for (let i = 0; i < hf.data.length; i++) v += Math.max(0, hf.data[i]!);
  return v;
}

/** Профіль валика навколо вмʼятини: мʼякий підйом і довгий спад. */
const rim = (d: number) => Math.pow(Math.sin(((d - 1) / 1.4) * Math.PI), 1.5);

const clampI = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

let scratch = new Float32Array(0);
/** Копія лише прямокутника (з запасом), а не всього поля. */
function snapshot(hf: Heightfield, x0: number, y0: number, x1: number, y1: number, pad: number) {
  const { w, h, data } = hf;
  const ax = clampI(x0 - pad, 0, w - 1);
  const ay = clampI(y0 - pad, 0, h - 1);
  const bx = clampI(x1 + pad, 0, w - 1);
  const by = clampI(y1 + pad, 0, h - 1);
  const sw = bx - ax + 1;
  const need = sw * (by - ay + 1);
  if (scratch.length < need) scratch = new Float32Array(need * 2);
  for (let y = ay; y <= by; y++) scratch.set(data.subarray(y * w + ax, y * w + bx + 1), (y - ay) * sw);
  return (x: number, y: number) => {
    const cx = clampI(x, ax, bx);
    const cy = clampI(y, ay, by);
    return scratch[(cy - ay) * sw + (cx - ax)]!;
  };
}

/**
 * Вмʼятина: виймає матеріал під пальцем і видавлює його валиком по краю (обʼєм приблизно зберігається).
 * Працює лише там, де є матеріал.
 */
export function dent(hf: Heightfield, gx: number, gy: number, radius: number, amount: number) {
  const { w, h, data, gloss } = hf;
  const r2 = radius * 2.5;
  const x0 = clampI(Math.floor(gx - r2), 0, w - 1);
  const x1 = clampI(Math.ceil(gx + r2), 0, w - 1);
  const y0 = clampI(Math.floor(gy - r2), 0, h - 1);
  const y1 = clampI(Math.ceil(gy + r2), 0, h - 1);
  let removed = 0;
  let ringWeight = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const d = Math.hypot(x - gx, y - gy) / radius;
      if (d < 1 && data[i]! > 0.02) {
        const take = Math.min(data[i]! - 0.02, amount * (1 - d * d) * (1 - d * d));
        data[i]! -= take;
        removed += take;
        gloss[i] = Math.max(0, gloss[i]! - 0.05);
      } else if (d >= 1 && d < 2.4 && data[i]! > 0.02) ringWeight += rim(d);
    }
  if (ringWeight <= 0) return removed;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const d = Math.hypot(x - gx, y - gy) / radius;
      if (d >= 1 && d < 2.4 && data[i]! > 0.02) data[i]! += (removed * rim(d)) / ringWeight;
    }
  return removed;
}

/** Розмазування: матеріал тягнеться за пальцем (розтягування / стискання). */
export function smudge(hf: Heightfield, gx: number, gy: number, dx: number, dy: number, radius: number, strength: number) {
  const { w, h, data } = hf;
  const reach = radius + Math.hypot(dx, dy) + 2;
  const x0 = clampI(Math.floor(gx - reach), 1, w - 2);
  const x1 = clampI(Math.ceil(gx + reach), 1, w - 2);
  const y0 = clampI(Math.floor(gy - reach), 1, h - 2);
  const y1 = clampI(Math.ceil(gy + reach), 1, h - 2);
  const pad = Math.ceil(Math.hypot(dx, dy)) + 2;
  const at = snapshot(hf, x0, y0, x1, y1, pad);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - gx, y - gy) / radius;
      if (d >= 1) continue;
      const wgt = strength * (1 - d) * (1 - d);
      // Білінійна вибірка з точки «позаду» пальця.
      const sx = clampI(x - dx, 0, w - 1.001);
      const sy = clampI(y - dy, 0, h - 1.001);
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const fx = sx - ix;
      const fy = sy - iy;
      const a = at(ix, iy);
      const b = at(ix + 1, iy);
      const c = at(ix, iy + 1);
      const e = at(ix + 1, iy + 1);
      const sample = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + e * fx * fy;
      const i = y * w + x;
      const cur = at(x, y);
      data[i] = cur + (sample - cur) * wgt;
    }
}

/** Згладжування: розмиття висот + глянець. */
export function smooth(hf: Heightfield, gx: number, gy: number, radius: number, strength: number) {
  const { w, h, data, gloss } = hf;
  const x0 = clampI(Math.floor(gx - radius), 1, w - 2);
  const x1 = clampI(Math.ceil(gx + radius), 1, w - 2);
  const y0 = clampI(Math.floor(gy - radius), 1, h - 2);
  const y1 = clampI(Math.ceil(gy + radius), 1, h - 2);
  const at = snapshot(hf, x0, y0, x1, y1, 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const c = at(x, y);
      if (c <= 0.01) continue;
      const d = Math.hypot(x - gx, y - gy) / radius;
      if (d >= 1) continue;
      const avg = (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) + c * 4) / 8;
      const k = strength * (1 - d);
      data[i] = c + (avg - c) * k;
      gloss[i] = Math.min(1, gloss[i]! + 0.04 * k);
    }
}

/**
 * Стиснути всю грудку вздовж осі: один прохід передискретизації. Стає вужчою й вищою — обʼєм зберігається.
 */
export function squeeze(hf: Heightfield, axis: "x" | "y", amount: number) {
  const { w, h, data } = hf;
  const src = data.slice();
  const k = 1 + amount; // >1 — стиснення
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = axis === "x" ? cx + (x - cx) * k : x;
      const sy = axis === "y" ? cy + (y - cy) * k : y;
      if (sx < 0 || sy < 0 || sx > w - 1.001 || sy > h - 1.001) {
        data[y * w + x] = 0;
        continue;
      }
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const fx = sx - ix;
      const fy = sy - iy;
      const v =
        src[iy * w + ix]! * (1 - fx) * (1 - fy) +
        src[iy * w + ix + 1]! * fx * (1 - fy) +
        src[(iy + 1) * w + ix]! * (1 - fx) * fy +
        src[(iy + 1) * w + ix + 1]! * fx * fy;
      data[y * w + x] = v * k;
    }
}

/**
 * Осипання: де схил крутіший за кут природного укосу, частина матеріалу сповзає вниз.
 * Працює в прямокутнику; повертає true, якщо щось зрушилось.
 */
export function relax(hf: Heightfield, x0: number, y0: number, x1: number, y1: number, talus: number, rate = 0.25) {
  const { w, h, data } = hf;
  let moved = false;
  const ax = clampI(Math.floor(x0), 1, w - 2);
  const bx = clampI(Math.ceil(x1), 1, w - 2);
  const ay = clampI(Math.floor(y0), 1, h - 2);
  const by = clampI(Math.ceil(y1), 1, h - 2);
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const i = y * w + x;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        const diff = data[i]! - data[j]!;
        if (diff > talus) {
          const m = (diff - talus) * rate;
          data[i]! -= m;
          data[j]! += m;
          moved = true;
        }
      }
    }
  return moved;
}

export interface Material {
  /** Базовий колір, 0..255 */
  base: [number, number, number];
  /** Варіація кольору шумом. */
  grain: number;
  specular: number;
  shininess: number;
  /** Масштаб нахилу нормалей. */
  relief: number;
}

function norm3(x: number, y: number, z: number): readonly [number, number, number] {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}
const L = norm3(-0.45, -0.65, 0.62);
const H = norm3(L[0], L[1], L[2] + 1);

/**
 * Освітлення поля висот у RGBA: дифузне + відблиск (сильніший на глянці) + затінення западин.
 * Якщо передано shadow — пише туди силует для мʼякої контактної тіні.
 */
export function shade(hf: Heightfield, out: Uint8ClampedArray, m: Material, shadow?: Uint8ClampedArray, tint?: Float32Array) {
  const { w, h, data, gloss } = hf;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const v = data[i]!;
      if (v <= 0.005) {
        out[o + 3] = 0;
        if (shadow) shadow[o + 3] = 0;
        continue;
      }
      const l = data[i - (x > 0 ? 1 : 0)]!;
      const r = data[i + (x < w - 1 ? 1 : 0)]!;
      const u = data[i - (y > 0 ? w : 0)]!;
      const d = data[i + (y < h - 1 ? w : 0)]!;
      let nx = (l - r) * m.relief;
      let ny = (u - d) * m.relief;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const g = gloss[i]!;
      const spec = Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), m.shininess) * (m.specular + g * 0.45);
      // Западини темніші (опуклість через лапласіан).
      const lap = l + r + u + d - 4 * v;
      const ao = Math.max(0.55, Math.min(1.08, 1 - lap * 1.6));
      const n = 1 + (fbm(x * 0.35, y * 0.35) - 0.5) * m.grain;
      const lightK = (0.42 + 0.7 * diff) * ao * n * (tint ? 1 - 0.38 * Math.min(1, tint[i]!) : 1);
      const edge = Math.min(1, v / 0.12);
      out[o] = m.base[0] * lightK + 255 * spec;
      out[o + 1] = m.base[1] * lightK + 255 * spec;
      out[o + 2] = m.base[2] * lightK + 255 * spec;
      out[o + 3] = 255 * edge;
      if (shadow) {
        shadow[o] = shadow[o + 1] = shadow[o + 2] = 0;
        shadow[o + 3] = 255 * Math.min(1, v * 3) * 0.75;
      }
    }
}
