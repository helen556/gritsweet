"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * requestAnimationFrame, що працює лише поки сцена активна, вкладка видима й елемент на екрані.
 * `tick` повертає true, якщо потрібні ще кадри (інакше цикл засинає до `wake()`).
 */
export function useFrameLoop(
  target: React.RefObject<Element | null>,
  tick: (dt: number, now: number) => boolean,
  active = true,
) {
  const tickRef = useRef(tick);
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    let running = false;
    let visible = true;
    let onScreen = true;

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const more = tickRef.current(dt, now);
      if (more && visible && onScreen) raf = requestAnimationFrame(frame);
      else {
        running = false;
        last = 0;
      }
    };
    const wake = () => {
      if (running || !visible || !onScreen) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        running = false;
        last = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const io = target.current
      ? new IntersectionObserver(([entry]) => {
          onScreen = Boolean(entry?.isIntersecting);
          if (onScreen) wake();
        })
      : null;
    if (target.current) io?.observe(target.current);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      wakeRef.current = () => {};
    };
  }, [active, target]);

  // Стабільна функція: обробники жестів можна привʼязати один раз.
  return useCallback(() => wakeRef.current(), []);
}
