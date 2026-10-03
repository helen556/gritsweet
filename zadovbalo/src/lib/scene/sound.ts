"use client";

/**
 * Тихий синтезований звук (без файлів). AudioContext створюється лише після жесту
 * (увімкнення звуку), гучність обмежена, без різких атак.
 */
export type SoundName =
  | "paper"
  | "tear"
  | "clay"
  | "crack"
  | "peel"
  | "thud"
  | "water"
  | "fire"
  | "rumble"
  | "zip"
  | "soft";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  enabled = false;

  /** Викликати з обробника жесту. */
  enable() {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    this.ctx ??= new Ctor();
    void this.ctx.resume();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (!this.noise) {
      const len = this.ctx.sampleRate * 1.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    void this.ctx?.suspend();
  }

  private noiseBurst(
    dur: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    gain: number,
    q = 0.8,
  ) {
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

  private tone(
    dur: number,
    f0: number,
    f1: number,
    gain: number,
    type: OscillatorType = "sine",
  ) {
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

  play(name: SoundName, strength = 0.5) {
    if (!this.enabled || !this.ctx) return;
    const s = Math.max(0.15, Math.min(1, strength));
    switch (name) {
      case "paper":
        return this.noiseBurst(
          0.12 + 0.1 * s,
          "bandpass",
          2500,
          4200,
          0.05 * s,
          1.2,
        );
      case "tear":
        return this.noiseBurst(0.18, "bandpass", 1800, 5200, 0.07 * s, 2);
      case "clay":
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
