"use client";

/**
 * Звук сцен. Нічого не звучить, доки людина сама не ввімкне звук (перемикач у шапці сцени).
 * - Семпли (`public/sounds`, власні — див. scripts/audio/make_sounds.py) для плівки, посуду, свічки, банки, блискавки, дощу.
 * - Тихий синтез для старих сцен (папір, пісок, карта…).
 * AudioContext відновлюється лише в обробнику жесту; фонова вкладка — пауза; обмеження голосів і лімітер проти перевантаження.
 */
export type SoundName = "paper" | "tear" | "grit" | "crack" | "peel" | "thud" | "water" | "fire" | "rumble" | "zip" | "soft";

export type SampleName =
  | "pop-0"
  | "pop-1"
  | "pop-2"
  | "pop-3"
  | "ceramic-0"
  | "ceramic-1"
  | "glass-0"
  | "glass-1"
  | "ceramic-tink-0"
  | "ceramic-tink-1"
  | "ceramic-tink-2"
  | "glass-tink-0"
  | "glass-tink-1"
  | "glass-tink-2"
  | "crackle-0"
  | "crackle-1"
  | "crackle-2"
  | "zip-loop"
  | "zip-end"
  | "ignite"
  | "snuff"
  | "match"
  | "can-click"
  | "can-hiss"
  | "rain";

const FILE: Partial<Record<SampleName, string>> = {
  "ceramic-0": "mp3",
  "ceramic-1": "mp3",
  "glass-0": "mp3",
  "glass-1": "mp3",
  ignite: "mp3",
  "can-hiss": "mp3",
  rain: "mp3",
};

const PREF_KEY = "vydykhny:sound";
const MAX_VOICES = 14;

export interface LoopHandle {
  /** Гучність 0..1 з мʼяким переходом. */
  gain(v: number, ramp?: number): void;
  rate(v: number): void;
  stop(fade?: number): void;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private raw = new Map<SampleName, Promise<ArrayBuffer | null>>();
  private buffers = new Map<SampleName, AudioBuffer>();
  private decoding = new Map<SampleName, Promise<AudioBuffer | null>>();
  private voices: { src: AudioBufferSourceNode; end: number }[] = [];
  private loops = new Set<{ stop: (f?: number) => void }>();
  private listeners = new Set<(on: boolean) => void>();
  enabled = false;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else if (this.enabled) void this.ctx.resume();
      });
    }
  }

  /** Збережений вибір людини (лише ця налаштувальна перевага, нічого більше). */
  get preferred(): boolean {
    try {
      return localStorage.getItem(PREF_KEY) === "on";
    } catch {
      return false;
    }
  }

  private remember(on: boolean) {
    try {
      localStorage.setItem(PREF_KEY, on ? "on" : "off");
    } catch {
      // приватний режим — просто не памʼятаємо
    }
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Викликати ЛИШЕ з обробника жесту (клік/дотик). */
  enable(remember = true) {
    if (typeof window === "undefined") return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx ??= new Ctor({ latencyHint: "interactive" });
      void this.ctx.resume();
      if (!this.master) {
        // Лімітер: серія ударів не перевантажує вихід.
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.knee.value = 6;
        comp.ratio.value = 12;
        comp.attack.value = 0.002;
        comp.release.value = 0.15;
        comp.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(comp);
      }
      if (!this.noise) {
        const len = this.ctx.sampleRate * 1.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      this.enabled = true;
      if (remember) this.remember(true);
      for (const name of this.raw.keys()) void this.decode(name);
      this.listeners.forEach((f) => f(true));
    } catch {
      // Аудіо недоступне — жести працюють без звуку.
      this.enabled = false;
    }
  }

  disable(remember = true) {
    this.enabled = false;
    for (const l of [...this.loops]) l.stop(0.08);
    void this.ctx?.suspend();
    if (remember) this.remember(false);
    this.listeners.forEach((f) => f(false));
  }

  /** Завантажити семпли сцени заздалегідь (лише байти; декодування — після ввімкнення звуку). */
  preload(names: readonly SampleName[]) {
    for (const n of names) {
      if (this.raw.has(n)) continue;
      this.raw.set(
        n,
        fetch(`/sounds/${n}.${FILE[n] ?? "wav"}`)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null),
      );
      if (this.enabled) void this.decode(n);
    }
  }

  private decode(name: SampleName): Promise<AudioBuffer | null> {
    const ready = this.buffers.get(name);
    if (ready) return Promise.resolve(ready);
    let p = this.decoding.get(name);
    if (!p) {
      const ctx = this.ctx;
      const raw = this.raw.get(name);
      if (!ctx || !raw) return Promise.resolve(null);
      p = raw
        .then((ab) => (ab ? ctx.decodeAudioData(ab.slice(0)) : null))
        .then((b) => {
          if (b) this.buffers.set(name, b);
          return b;
        })
        .catch(() => null);
      this.decoding.set(name, p);
    }
    return p;
  }

  /** Відтворити семпл (якщо звук увімкнено й семпл готовий). Повертає false, якщо не прозвучав. */
  sample(name: SampleName, opts: { gain?: number; rate?: number; pan?: number; at?: number } = {}): boolean {
    const { ctx, master } = this;
    if (!this.enabled || !ctx || !master) return false;
    const buf = this.buffers.get(name);
    if (!buf) {
      void this.decode(name);
      return false;
    }
    const now = ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length >= MAX_VOICES) {
      // найстаріший голос мʼяко прибираємо
      const old = this.voices.shift();
      try {
        old?.src.stop();
      } catch {
        // вже зупинено
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1.2, opts.gain ?? 1));
    let node: AudioNode = src.connect(g);
    if (opts.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      node = node.connect(p);
    }
    node.connect(master);
    const start = now + (opts.at ?? 0);
    src.start(start);
    this.voices.push({ src, end: start + buf.duration / (opts.rate ?? 1) });
    // Перевірка (QA): журнал лише якщо тестова сторінка сама створила масив; у звичайній роботі нічого не пишеться.
    const log = (globalThis as { __soundLog?: unknown[] }).__soundLog;
    if (Array.isArray(log)) log.push({ name, at: performance.now() + (opts.at ?? 0) * 1000, gain: opts.gain ?? 1, rate: opts.rate ?? 1 });
    return true;
  }

  /** Петля (дощ, блискавка): гучність і швидкість керуються ззовні; зупиняється при вимкненні звуку. */
  loop(name: SampleName, initialGain = 0): LoopHandle {
    let src: AudioBufferSourceNode | null = null;
    let g: GainNode | null = null;
    let target = initialGain;
    let rate = 1;
    let stopped = false;
    const start = () => {
      const { ctx, master } = this;
      if (stopped || src || !this.enabled || !ctx || !master) return;
      const buf = this.buffers.get(name);
      if (!buf) {
        void this.decode(name).then(() => start());
        return;
      }
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(target, ctx.currentTime, 0.04);
      src.connect(g).connect(master);
      src.start(ctx.currentTime, Math.random() * buf.duration * 0.9);
      const log = (globalThis as { __soundLog?: unknown[] }).__soundLog;
      if (Array.isArray(log)) log.push({ name, loop: true, at: performance.now(), gain: target, playing: true, started: true });
    };
    const handle = {
      gain: (v: number, ramp = 0.04) => {
        const log = (globalThis as { __soundLog?: unknown[] }).__soundLog;
        if (Array.isArray(log) && Math.abs(v - target) > 0.02) log.push({ name, loop: true, at: performance.now(), gain: v, playing: Boolean(src) });
        target = v;
        if (v > 0.001) start();
        if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, ramp);
      },
      rate: (v: number) => {
        rate = v;
        if (src && this.ctx) src.playbackRate.setTargetAtTime(v, this.ctx.currentTime, 0.03);
      },
      stop: (fade = 0.12) => {
        stopped = true;
        this.loops.delete(entry);
        this.listeners.delete(onToggle);
        const s = src;
        const gg = g;
        src = null;
        g = null;
        if (s && gg && this.ctx) {
          gg.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
          try {
            s.stop(this.ctx.currentTime + fade + 0.05);
          } catch {
            // вже зупинено
          }
        }
      },
    };
    const entry = {
      stop: (f?: number) => {
        // вимкнення звуку: зупинити зараз, але дати знову стартувати, коли звук увімкнуть
        const s = src;
        const gg = g;
        src = null;
        g = null;
        if (s && gg && this.ctx) {
          gg.gain.setTargetAtTime(0, this.ctx.currentTime, (f ?? 0.08) / 3);
          try {
            s.stop(this.ctx.currentTime + (f ?? 0.08) + 0.05);
          } catch {
            // вже зупинено
          }
        }
      },
    };
    const onToggle = (on: boolean) => {
      if (on && !stopped && target > 0.001) start();
    };
    this.loops.add(entry);
    this.listeners.add(onToggle);
    return handle;
  }

  private noiseBurst(dur: number, filter: BiquadFilterType, f0: number, f1: number, gain: number, q = 0.8) {
    const { ctx, noise, master } = this;
    if (!ctx || !noise || !master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(master);
    src.start(t, Math.random() * 0.8, dur + 0.05);
  }

  private tone(dur: number, f0: number, f1: number, gain: number, type: OscillatorType = "sine") {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Тихий синтез для старих сцен. */
  play(name: SoundName, strength = 0.5) {
    if (!this.enabled || !this.ctx) return;
    const s = Math.max(0.15, Math.min(1, strength));
    switch (name) {
      case "paper":
        return this.noiseBurst(0.12 + 0.1 * s, "bandpass", 2500, 4200, 0.05 * s, 1.2);
      case "tear":
        return this.noiseBurst(0.18, "bandpass", 1800, 5200, 0.07 * s, 2);
      case "grit":
        return this.noiseBurst(0.22, "lowpass", 380, 140, 0.12 * s, 1);
      case "crack":
        this.noiseBurst(0.09, "highpass", 2500, 1800, 0.05 * s, 0.7);
        return this.tone(0.12, 1400, 700, 0.02 * s, "triangle");
      case "peel":
        return this.noiseBurst(0.25, "bandpass", 900, 2600, 0.04 * s, 3);
      case "thud":
        this.tone(0.18, 140, 70, 0.08 * s);
        return this.noiseBurst(0.08, "bandpass", 1800, 1200, 0.03 * s);
      case "water":
        return this.tone(0.16, 520 + Math.random() * 300, 900, 0.025 * s);
      case "fire":
        return this.noiseBurst(0.06, "highpass", 3000, 2500, 0.03 * s, 0.5);
      case "rumble":
        // Повільна атака, без гучного удару.
        return this.noiseBurst(1.8, "lowpass", 160, 50, 0.1 * s, 0.7);
      case "zip":
        return this.noiseBurst(0.05, "bandpass", 3200, 3600, 0.03 * s, 4);
      case "soft":
        return this.tone(0.3, 440, 660, 0.02 * s);
    }
  }
}

export const sound = new SoundEngine();

/** Необовʼязкова легка вібрація. На iPhone не працює — на неї не покладаємось. */
export function haptic(ms = 8) {
  if (!sound.enabled) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}

/** Випадковий варіант семпла: «pop-» + 0..n-1 (назви перевірено в SampleName). */
export function variant(prefix: "pop-" | "ceramic-" | "glass-" | "ceramic-tink-" | "glass-tink-" | "crackle-", n: number): SampleName {
  return `${prefix}${Math.floor(Math.random() * n)}` as SampleName;
}
