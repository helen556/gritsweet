import { z } from "zod";
import { CATEGORY_IDS, EMOTIONS, TONES } from "@/lib/topics/categories";
import { MECHANIC_TYPES } from "@/lib/mechanics/types";

export const MAX_TOPICS = 6;

/** Те, що має повернути будь-який класифікатор (mock чи справжній AI). */
export const classificationSchema = z.object({
  topics: z
    .array(
      z.object({
        category: z.enum(CATEGORY_IDS),
        label: z.string().trim().min(1).max(40),
        emotion: z.enum(EMOTIONS),
        intensity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(12),
  primary_emotion: z.enum(EMOTIONS),
  recommended_mechanic: z.enum(MECHANIC_TYPES),
  tone: z.enum(TONES),
});

export type Classification = z.infer<typeof classificationSchema>;
export type Topic = Classification["topics"][number];

export const MIN_TEXT_LENGTH = 3;
export const MAX_TEXT_LENGTH = 5000;

export const analyzeRequestSchema = z.object({
  text: z.string().trim().min(MIN_TEXT_LENGTH).max(MAX_TEXT_LENGTH),
});
