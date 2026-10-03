"use client";

import { useEffect, useRef } from "react";

/**
 * Жива хвиля з мікрофона (Canvas + AnalyserNode). Один canvas замість десятків DOM-вузлів.
 * Звук нікуди не йде — аналізатор лише читає рівень.
 */
export function Waveform({ stream, reduced }: { stream: MediaStream | null; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audio = new AudioCtx();
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const BARS = 48;
    const levels = new Float32Array(BARS);
    let frame = 0;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      // ~30 fps достатньо, батарея скаже дякую.
      if (++frame % 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth: w, clientHeight: h } = canvas;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = ((data[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      const rms = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
      // Зсуваємо історію рівнів — хвиля «пливе» справа наліво.
      levels.copyWithin(0, 1);
      levels[BARS - 1] = rms;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const gap = w / BARS;
      const barW = Math.max(2, gap * 0.42);
      for (let i = 0; i < BARS; i++) {
        const level = reduced ? rms : (levels[i] ?? 0);
        const barH = Math.max(3, level * h * 0.92);
        const alpha = 0.35 + 0.65 * (i / BARS);
        ctx.fillStyle = `rgba(231, 235, 237, ${alpha})`;
        ctx.fillRect(i * gap + (gap - barW) / 2, (h - barH) / 2, barW, barH);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void audio.close();
    };
  }, [stream, reduced]);

  return <canvas ref={canvasRef} aria-hidden className="h-16 w-full max-w-md" />;
}
