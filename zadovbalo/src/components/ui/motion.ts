"use client";

import { useReducedMotion, type TargetAndTransition, type Transition, type Variants } from "motion/react";

export interface RevealProps {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}

export const EASE_CINEMA = [0.22, 0.61, 0.36, 1] as const;
export const EASE_RELEASE = [0.16, 1, 0.3, 1] as const;

/**
 * «Проявлення з туману»: blur + opacity (+ невеликий зсув). При reduced-motion — лише fade.
 * blur застосовуємо тільки до великих слів (кілька елементів на екран), не до списків.
 */
export function useReveal() {
  const reduced = useReducedMotion();
  return {
    reduced: Boolean(reduced),
    word: (delay = 0, duration = 1.3): RevealProps =>
      reduced
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.4, delay: delay * 0.3 } }
        : {
            initial: { opacity: 0, filter: "blur(18px)", y: 10 },
            animate: { opacity: 1, filter: "blur(0px)", y: 0 },
            exit: { opacity: 0, filter: "blur(14px)", scale: 1.03, transition: { duration: 0.9, ease: EASE_CINEMA } },
            transition: { duration, delay, ease: EASE_RELEASE },
          },
    rise: (delay = 0): RevealProps =>
      reduced
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.3, delay: delay * 0.3 } }
        : {
            initial: { opacity: 0, y: 14 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -6, transition: { duration: 0.35 } },
            transition: { duration: 0.8, delay, ease: EASE_RELEASE },
          },
  };
}

export const listStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};
