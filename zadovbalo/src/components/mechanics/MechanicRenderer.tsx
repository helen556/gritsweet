"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo } from "react";
import { useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";
import type { ImplementedMechanic } from "@/lib/mechanics/registry";
import { resolveMechanic } from "@/lib/scenarios/resolve";
import type { Scenario } from "@/lib/scenarios/types";
import { track } from "@/lib/analytics/track";
import { sessionLog } from "@/lib/session/session";
import type { MechanicProps } from "./types";

/** Коли власний компонент механіки ще не готовий, текст має описувати те, що людина реально робить. */
const FALLBACK_COPY: Record<ImplementedMechanic, { title: string; hint: string }> = {
  swipe_away: { title: "По одному.", hint: "Тягни геть те, що зараз не треба тримати в голові." },
  dismiss: { title: "Геть.", hint: "Відкидай у будь-який бік." },
  breathe: { title: "Видихни.", hint: "Нічого не треба робити. Просто подихай." },
};

function Loading() {
  return <div className="h-[min(46dvh,22rem)] w-[min(86vw,24rem)] animate-pulse rounded-[var(--radius-edge)] bg-night/50" aria-hidden />;
}

/** Реєстр компонентів. Кожна механіка — окремий чанк, вантажиться лише коли потрібна. */
const COMPONENTS: Record<ImplementedMechanic, React.ComponentType<MechanicProps>> = {
  swipe_away: dynamic(() => import("./SwipeMechanic"), { loading: Loading }),
  dismiss: dynamic(() => import("./SwipeMechanic"), { loading: Loading }),
  breathe: dynamic(() => import("./BreatheMechanic"), { loading: Loading }),
};

export function MechanicRenderer({
  scenario,
  caution,
  topicLabels,
  onComplete,
}: {
  scenario: Scenario;
  caution: boolean;
  topicLabels: string[];
  onComplete: (kept: string[]) => void;
}) {
  const r = useReveal();
  const reduced = Boolean(useReducedMotion());
  const resolved = useMemo(() => resolveMechanic(scenario, { caution, topicLabels }), [scenario, caution, topicLabels]);
  const Component = COMPONENTS[resolved.component];
  const copy = resolved.component === resolved.intended ? scenario.copy : FALLBACK_COPY[resolved.component];

  useEffect(() => {
    track("mechanic_started", { category: scenario.category, mechanic: resolved.intended });
    sessionLog.mechanic(resolved.intended);
  }, [scenario.category, resolved.intended]);

  return (
    <StagePanel label={scenario.label.toLowerCase()} className="gap-6">
      <motion.div {...r.word(0, 1.1)} className="flex flex-col items-center gap-3">
        <StageHeading size={copy.title.length > 14 ? "title" : "giant"}>{copy.title}</StageHeading>
        <p className="text-lede max-w-xl text-balance text-frost/80">{copy.hint}</p>
      </motion.div>
      <motion.div {...r.rise(0.35)} className="w-full">
        <Component
          scenario={scenario}
          items={resolved.items}
          hint={copy.hint}
          keep={scenario.keep ?? 0}
          variant={resolved.component}
          reducedMotion={reduced}
          onComplete={(kept) => {
            track("mechanic_completed", { category: scenario.category, mechanic: resolved.intended });
            sessionLog.completed(scenario.category);
            onComplete(kept);
          }}
        />
      </motion.div>
    </StagePanel>
  );
}
