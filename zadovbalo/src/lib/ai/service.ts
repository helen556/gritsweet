import { assessSafety } from "@/lib/safety/classifier";
import type { SafetyAssessment } from "@/lib/safety/types";
import { SCENARIOS } from "@/lib/scenarios/registry";
import type { CategoryId, Emotion, Tone } from "@/lib/topics/categories";
import type { MechanicType } from "@/lib/mechanics/types";
import { classificationSchema, MAX_TOPICS, type Classification } from "./schema";
import { AnalyzeError, type RantClassifier } from "./types";

export interface AnalyzedTopic {
  category: CategoryId;
  /** Підпис чипа з реєстру — не те, що придумав провайдер. */
  label: string;
  emotion: Emotion;
  intensity: number;
}

export interface AnalysisResult {
  topics: AnalyzedTopic[];
  primaryEmotion: Emotion;
  recommendedMechanic: MechanicType;
  tone: Tone;
}

export type AnalyzeOutcome =
  | { status: "safety"; safety: SafetyAssessment }
  | { status: "ok"; safety: SafetyAssessment; result: AnalysisResult; provider: string };

/** Дублікати категорій зливаються, найсильніше — першим, не більше MAX_TOPICS. */
export function normalizeClassification(data: Classification): AnalysisResult {
  const byCategory = new Map<CategoryId, AnalyzedTopic>();
  for (const topic of data.topics) {
    const existing = byCategory.get(topic.category);
    if (!existing || topic.intensity > existing.intensity) {
      byCategory.set(topic.category, {
        category: topic.category,
        label: SCENARIOS[topic.category].label,
        emotion: topic.emotion,
        intensity: topic.intensity,
      });
    }
  }
  // «unknown» має сенс лише сам по собі.
  if (byCategory.size > 1) byCategory.delete("unknown");

  const topics = [...byCategory.values()].sort((a, b) => b.intensity - a.intensity).slice(0, MAX_TOPICS);
  return {
    topics,
    primaryEmotion: data.primary_emotion,
    recommendedMechanic: data.recommended_mechanic,
    tone: data.tone,
  };
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new AnalyzeError("timeout"));
      reject(new AnalyzeError("timeout"));
    }, timeoutMs);
  });
  // Promise.race — на випадок, якщо провайдер ігнорує signal.
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export async function analyzeRant(
  text: string,
  { classifier, timeoutMs }: { classifier: RantClassifier; timeoutMs: number },
): Promise<AnalyzeOutcome> {
  // 1. Безпека — до будь-якого AI.
  const safety = assessSafety(text);
  if (safety.level === "crisis") return { status: "safety", safety };

  // 2. Класифікація.
  let raw: unknown;
  try {
    raw = await withTimeout((signal) => classifier.classify(text, { signal }), timeoutMs);
  } catch (error) {
    if (error instanceof AnalyzeError) throw error;
    throw new AnalyzeError("ai_unavailable", { cause: error });
  }

  // 3. Провайдеру не довіряємо: схема + нормалізація.
  const parsed = classificationSchema.safeParse(raw);
  if (!parsed.success) throw new AnalyzeError("invalid_response", { cause: parsed.error });

  return { status: "ok", safety, result: normalizeClassification(parsed.data), provider: classifier.id };
}
