"use client";

import { MotionConfig } from "motion/react";

/** Motion поважає prefers-reduced-motion: transform-анімації вимикаються, opacity лишається. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
