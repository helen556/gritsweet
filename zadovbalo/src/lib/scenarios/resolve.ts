import { isImplemented, MECHANICS, type ImplementedMechanic } from "@/lib/mechanics/registry";
import type { MechanicType } from "@/lib/mechanics/types";
import type { Scenario } from "./types";

export interface ResolvedMechanic {
  /** Що передбачає сценарій з урахуванням safety. */
  intended: MechanicType;
  /** Чим реально граємо зараз. */
  component: ImplementedMechanic;
  items: string[];
}

/**
 * Вибір механіки для теми:
 * 1) при caution руйнівна механіка замінюється на cautionMechanic (або dismiss);
 * 2) якщо компонента ще немає — сценарний fallback (або swipe_away).
 */
export function resolveMechanic(scenario: Scenario, opts: { caution: boolean; topicLabels?: string[] }): ResolvedMechanic {
  const intended =
    opts.caution && MECHANICS[scenario.mechanic].destructive ? (scenario.cautionMechanic ?? "dismiss") : scenario.mechanic;

  let component: ImplementedMechanic = isImplemented(intended) ? intended : (scenario.fallback ?? "swipe_away");
  // Fallback-механіка теж має бути безпечною.
  if (opts.caution && MECHANICS[component].destructive) component = "dismiss";

  const fromTopics = scenario.itemsFrom === "topics" ? (opts.topicLabels ?? []).filter(Boolean) : [];
  const items = fromTopics.length >= 2 ? fromTopics : [...scenario.items];
  return { intended, component, items };
}
