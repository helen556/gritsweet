"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

type Mode = "default" | "action" | "media" | "text" | "hidden";

const INTERACTIVE = "a, button, summary, [role='button'], label[for]";

/**
 * Restrained desktop cursor: a small dot with a soft ring that eases after it.
 * The ring grows over buttons and links, softens over photos and steps aside for text fields.
 * Disabled on touch devices and when reduced motion is requested.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("hidden");
  const [pressed, setPressed] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 260, damping: 28, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 260, damping: 28, mass: 0.6 });

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !reduce.matches);
    update();
    fine.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.classList.remove("has-cursor");
      return;
    }
    root.classList.add("has-cursor");

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      const el = e.target as Element | null;
      if (!el?.closest) return;
      if (el.closest("input, textarea, select")) setMode("text");
      else if (el.closest(INTERACTIVE)) setMode("action");
      else if (el.closest("[data-cursor='media']")) setMode("media");
      else setMode("default");
    };
    const onLeave = () => setMode("hidden");
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      root.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  const ring = {
    default: { width: 34, height: 34, opacity: 0.9, borderRadius: 999 },
    action: { width: 60, height: 60, opacity: 1, borderRadius: 999 },
    media: { width: 88, height: 88, opacity: 0.8, borderRadius: 999 },
    text: { width: 4, height: 26, opacity: 0, borderRadius: 4 },
    hidden: { width: 34, height: 34, opacity: 0, borderRadius: 999 },
  }[mode];

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] mix-blend-difference">
      <motion.div
        className="absolute top-0 left-0 border border-white/70"
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{ ...ring, scale: pressed ? 0.86 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.7 }}
      />
      <motion.div
        className="absolute top-0 left-0 size-[6px] rounded-full bg-white"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
        animate={{ opacity: mode === "hidden" || mode === "text" ? 0 : 1, scale: mode === "action" ? 0.7 : 1 }}
        transition={{ duration: 0.25 }}
      />
    </div>
  );
}
