import type { Scenario } from "@/lib/scenarios/types";

export interface MechanicProps {
  scenario: Scenario;
  items: string[];
  /** Підказка, яку бачить людина (сценарна або fallback). */
  hint: string;
  /** Скільки залишити (0 — прибрати все). */
  keep: number;
  /** swipe_away — убік; dismiss — у будь-який бік. */
  variant: "swipe_away" | "dismiss" | "breathe";
  reducedMotion: boolean;
  onComplete: (kept: string[]) => void;
}
