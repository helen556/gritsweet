"use client";

import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Чи можна показувати фонове відео: не при reduced-motion і не при «Економії трафіку». */
export function useVideoAllowed(): boolean {
  const reduced = useReducedMotion();
  const saveData = useSyncExternalStore(
    noop,
    () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData),
    () => true, // на сервері відео не рендеримо
  );
  return !reduced && !saveData;
}
