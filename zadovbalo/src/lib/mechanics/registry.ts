import type { MechanicMeta, MechanicType } from "./types";

export const MECHANICS: Record<MechanicType, MechanicMeta> = {
  tear: { type: "tear", name: "Tear", destructive: true },
  burn: { type: "burn", name: "Burn", destructive: true },
  erase: { type: "erase", name: "Erase", destructive: false },
  swipe_away: { type: "swipe_away", name: "Swipe away", destructive: false },
  throw_away: { type: "throw_away", name: "Throw away", destructive: true },
  mute: { type: "mute", name: "Mute", destructive: false },
  cut: { type: "cut", name: "Cut", destructive: true },
  drag_out: { type: "drag_out", name: "Drag out", destructive: false },
  break: { type: "break", name: "Break", destructive: true },
  crush: { type: "crush", name: "Crush", destructive: true },
  sort: { type: "sort", name: "Sort", destructive: false },
  untangle: { type: "untangle", name: "Untangle", destructive: false },
  paint: { type: "paint", name: "Paint", destructive: false },
  reduce: { type: "reduce", name: "Reduce", destructive: false },
  pause: { type: "pause", name: "Pause", destructive: false },
  freeze: { type: "freeze", name: "Freeze", destructive: false },
  breathe: { type: "breathe", name: "Breathe", destructive: false },
  collapse: { type: "collapse", name: "Collapse", destructive: false },
  split: { type: "split", name: "Split", destructive: false },
  dismiss: { type: "dismiss", name: "Dismiss", destructive: false },
};

/** Механіки, для яких уже є окремий компонент. Решта тимчасово грається через fallback сценарію. */
export const IMPLEMENTED_MECHANICS = ["swipe_away", "dismiss", "breathe"] as const satisfies readonly MechanicType[];
export type ImplementedMechanic = (typeof IMPLEMENTED_MECHANICS)[number];

export function isImplemented(type: MechanicType): type is ImplementedMechanic {
  return (IMPLEMENTED_MECHANICS as readonly MechanicType[]).includes(type);
}
