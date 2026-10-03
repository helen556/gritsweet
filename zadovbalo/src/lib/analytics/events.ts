import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/topics/categories";
import { MECHANIC_TYPES } from "@/lib/mechanics/types";

export const ANALYTICS_EVENTS = [
  "hero_started",
  "input_text",
  "input_voice",
  "topic_selected",
  "mechanic_started",
  "mechanic_completed",
  "session_finished",
  "safety_shown",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/**
 * Дозволені лише ідентифікатори з реєстрів. Довільних рядків (а отже й тексту користувача) схема не пропускає.
 */
export const analyticsPayloadSchema = z
  .object({
    event: z.enum(ANALYTICS_EVENTS),
    category: z.enum(CATEGORY_IDS).optional(),
    mechanic: z.enum(MECHANIC_TYPES).optional(),
  })
  .strict();

export type AnalyticsPayload = z.infer<typeof analyticsPayloadSchema>;
