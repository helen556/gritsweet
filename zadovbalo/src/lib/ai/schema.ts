import { z } from "zod";
import { CATEGORIES, CURRENCIES, EMOTIONS, migrateCategory } from "@/lib/topics";
import { migrateScene, SCENE_IDS } from "@/lib/scenes/registry";

export const MIN_TEXT_LENGTH = 2;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_CATEGORIES = 3;

export const analyzeRequestSchema = z
  .object({ text: z.string().trim().min(MIN_TEXT_LENGTH).max(MAX_TEXT_LENGTH) })
  .strict();

/** Старі назви тем/сцен (hurtful_words, stickers…) → нинішні, до перевірки. Інших змін не робить. */
function migrateLegacy(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(o.categories)) o.categories = o.categories.map(migrateCategory);
  if ("primaryCategory" in o) o.primaryCategory = migrateCategory(o.primaryCategory);
  if (Array.isArray(o.sceneIds)) o.sceneIds = [...new Set(o.sceneIds.map(migrateScene))];
  return o;
}

/** Що мусить повернути модель. Перевіряється на сервері; відповідь моделі не довіряємо. */
const modelOutputObject = z
  .object({
    categories: z.array(z.enum(CATEGORIES)).min(1).max(MAX_CATEGORIES),
    primaryCategory: z.enum(CATEGORIES).nullable(),
    emotion: z.enum(EMOTIONS).nullable(),
    needsClarification: z.boolean(),
    amount: z.number().positive().max(1e12).nullable(),
    currency: z.enum(CURRENCIES).nullable(),
    sceneIds: z.array(z.enum(SCENE_IDS)).max(6),
  })
  .strict();

export const modelOutputSchema = z.preprocess(migrateLegacy, modelOutputObject);

export type ModelOutput = z.infer<typeof modelOutputObject>;

/** Та сама схема у форматі JSON Schema для JSON Mode Workers AI. */
export const modelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] }, minItems: 1, maxItems: MAX_CATEGORIES },
    primaryCategory: { type: ["string", "null"], enum: [...CATEGORIES, null] },
    emotion: { type: ["string", "null"], enum: [...EMOTIONS, null] },
    needsClarification: { type: "boolean" },
    amount: { type: ["number", "null"] },
    currency: { type: ["string", "null"], enum: [...CURRENCIES, null] },
    sceneIds: { type: "array", items: { type: "string", enum: [...SCENE_IDS] }, maxItems: 6 },
  },
  required: ["categories", "primaryCategory", "emotion", "needsClarification", "amount", "currency", "sceneIds"],
} as const;
