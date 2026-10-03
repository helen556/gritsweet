export const SAFETY_LEVELS = ["none", "caution", "crisis"] as const;
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

export type SafetyReason = "self_harm" | "harm_to_others" | "immediate_danger";

export interface SafetyAssessment {
  level: SafetyLevel;
  /** Лише категорії причин — без фрагментів тексту. */
  reasons: SafetyReason[];
}
