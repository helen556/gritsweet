import { assessSafety } from "@/lib/safety/classifier";
import { allowedScenes, SCENES, type SceneId } from "@/lib/scenes/registry";
import type { Category, Currency, Emotion } from "@/lib/topics";
import { amountAppearsIn, extractAmounts, pickAmount } from "./amount";
import { keywordCategories } from "./keywords";
import { modelOutputSchema, type ModelOutput } from "./schema";
import { AiError, type AiErrorCode, type Classifier } from "./types";

export interface Analysis {
  categories: Category[];
  primaryCategory: Category | null;
  emotion: Emotion | null;
  needsClarification: boolean;
  amount: number | null;
  currency: Currency | null;
  sceneIds: SceneId[];
}

export type AnalyzeOutcome =
  | { status: "support"; reason: "safety" | "model" }
  | { status: "ok"; source: "ai"; analysis: Analysis; caution: boolean }
  | {
      status: "manual";
      reason: AiErrorCode;
      /** Підказка за ключовими словами — так і підписується в інтерфейсі. */
      keywordSuggestions: Category[];
      amount: number | null;
      currency: Currency | null;
      caution: boolean;
    };

export interface AnalyzeDeps {
  classifier: Classifier | null;
  timeoutMs: number;
  checkLimits: () => Promise<"ok" | "rate_limited" | "budget" | "limits_unavailable">;
}

/** Сума й валюта — лише ті, що явно є в тексті. */
function amountFromText(text: string, modelAmount: number | null) {
  const mentions = extractAmounts(text);
  if (modelAmount !== null && amountAppearsIn(text, modelAmount)) {
    const match = mentions.find((m) => Math.abs(m.amount - modelAmount) < 0.005 * Math.max(1, modelAmount));
    return { amount: modelAmount, currency: match?.currency ?? null };
  }
  const picked = pickAmount(mentions);
  return { amount: picked?.amount ?? null, currency: picked?.currency ?? null };
}

export function postprocess(text: string, raw: ModelOutput, caution: boolean): Analysis {
  const categories = [...new Set(raw.categories)];
  const primaryCategory = raw.primaryCategory && categories.includes(raw.primaryCategory) ? raw.primaryCategory : null;
  const allowed = allowedScenes(categories);
  let sceneIds = raw.sceneIds.filter((s) => allowed.includes(s));
  if (sceneIds.length === 0) sceneIds = allowed;
  if (caution) sceneIds = sceneIds.filter((s) => s !== "war_map");
  const needsDebtAmount = categories.includes("financial_debt");
  const { amount, currency } = needsDebtAmount ? amountFromText(text, raw.amount) : { amount: null, currency: null };
  return {
    categories,
    primaryCategory,
    emotion: raw.emotion,
    // Якщо модель не визначилась із головною темою серед кількох — теж уточнюємо.
    needsClarification: raw.needsClarification || (categories.length > 1 && !primaryCategory && categories.includes("general")),
    amount,
    currency,
    sceneIds: sceneIds.filter((s) => SCENES[s]),
  };
}

function manual(text: string, reason: AiErrorCode, caution: boolean): AnalyzeOutcome {
  const picked = pickAmount(extractAmounts(text));
  return { status: "manual", reason, keywordSuggestions: keywordCategories(text), amount: picked?.amount ?? null, currency: picked?.currency ?? null, caution };
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiError("timeout"));
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export async function analyzeText(text: string, deps: AnalyzeDeps): Promise<AnalyzeOutcome> {
  // 1. Детермінований шар безпеки — до будь-якого AI, не залежить від моделі.
  const safety = assessSafety(text);
  if (safety.level === "crisis") return { status: "support", reason: "safety" };
  const caution = safety.level === "caution";

  // 2. AI не налаштований — одразу ручний вибір.
  if (!deps.classifier) return manual(text, "not_configured", caution);

  // 3. Ліміти й добовий бюджет.
  const verdict = await deps.checkLimits();
  if (verdict !== "ok") return manual(text, verdict, caution);

  // 4. Модель.
  let raw: unknown;
  try {
    raw = await withTimeout((signal) => deps.classifier!.classify(text, signal), deps.timeoutMs);
  } catch (error) {
    return manual(text, error instanceof AiError ? error.code : "unavailable", caution);
  }

  // 5. Сувора перевірка.
  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) return manual(text, "invalid_response", caution);

  if (parsed.data.categories.includes("needs_support")) return { status: "support", reason: "model" };
  return { status: "ok", source: "ai", analysis: postprocess(text, parsed.data, caution), caution };
}
