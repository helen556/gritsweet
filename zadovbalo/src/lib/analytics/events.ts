import { z } from "zod";

/**
 * Лише загальні події без тем, сум, сцен із власними фразами чи будь-якого тексту.
 */
export const ANALYTICS_EVENTS = [
  "hero_started",
  "text_submitted",
  "manual_choice_opened",
  "scene_started",
  "scene_finished",
  "support_shown",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const analyticsPayloadSchema = z.object({ event: z.enum(ANALYTICS_EVENTS) }).strict();
