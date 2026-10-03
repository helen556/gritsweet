export const MECHANIC_TYPES = [
  "tear",
  "burn",
  "erase",
  "swipe_away",
  "throw_away",
  "mute",
  "cut",
  "drag_out",
  "break",
  "crush",
  "sort",
  "untangle",
  "paint",
  "reduce",
  "pause",
  "freeze",
  "breathe",
  "collapse",
  "split",
  "dismiss",
] as const;

export type MechanicType = (typeof MECHANIC_TYPES)[number];

export interface MechanicMeta {
  type: MechanicType;
  /** Внутрішня назва для логів/аналітики, не для UI. */
  name: string;
  /**
   * Руйнівні механіки (рвати, палити, ламати…) не запускаються, коли safety-шар
   * бачить агресивні формулювання, і ніколи — у кризовому режимі.
   */
  destructive: boolean;
}
