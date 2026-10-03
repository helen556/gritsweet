"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MechanicProps } from "./types";

const INHALE = 4;
const EXHALE = 6;
const CYCLES = 3;

/** Нічого не вимагає. Коло повільно дихає, людина може просто бути. */
export default function BreatheMechanic({ reducedMotion, onComplete }: MechanicProps) {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (cycle >= CYCLES) return;
    const id = window.setTimeout(
      () => {
        if (phase === "in") setPhase("out");
        else {
          setPhase("in");
          setCycle((c) => c + 1);
        }
      },
      (phase === "in" ? INHALE : EXHALE) * 1000,
    );
    return () => window.clearTimeout(id);
  }, [phase, cycle]);

  const finished = cycle >= CYCLES;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative grid size-56 place-items-center sm:size-64" aria-hidden>
        <motion.span
          className="absolute inset-0 rounded-full border border-frost/35 bg-[radial-gradient(circle,rgb(159_176_186/0.18),transparent_70%)]"
          animate={
            reducedMotion
              ? { opacity: phase === "in" ? 1 : 0.5 }
              : { scale: finished ? 0.8 : phase === "in" ? 1 : 0.62, opacity: phase === "in" ? 1 : 0.7 }
          }
          transition={{ duration: phase === "in" ? INHALE : EXHALE, ease: "easeInOut" }}
        />
      </div>
      <p className="text-lede text-frost/85" aria-live="polite">
        {finished ? "Ось так." : phase === "in" ? "Вдих…" : "Видих…"}
      </p>
      <Button size="lg" variant={finished ? "primary" : "ghost"} onClick={() => onComplete([])}>
        {finished ? "Далі" : "Досить"}
      </Button>
    </div>
  );
}
