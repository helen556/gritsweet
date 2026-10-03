"use client";

import { useEffect, useRef, useState } from "react";
import { detectQuality, type Quality } from "./quality";

export interface CanvasSize {
  width: number;
  height: number;
  dpr: number;
}

/**
 * Canvas, що стежить за розміром контейнера (resize, поворот, клавіатура) з обмеженим DPR.
 * `ctx === null` — 2D-контекст недоступний: сцена показує спрощений варіант.
 */
export function useCanvas2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null | undefined>(undefined);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, dpr: 1 });
  const [quality] = useState<Quality>(() => detectQuality());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    const apply = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = quality.dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      setSize((s) => (s.width === width && s.height === height && s.dpr === dpr ? s : { width, height, dpr }));
    };
    const ro = new ResizeObserver(apply);
    ro.observe(canvas);
    apply();
    setCtx(context);
    return () => ro.disconnect();
  }, [quality.dpr]);

  return { canvasRef, ctx, size, quality };
}
