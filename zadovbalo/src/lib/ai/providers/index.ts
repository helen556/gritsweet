import "server-only";
import { AnalyzeError, type RantClassifier } from "../types";
import { mockClassifier } from "./mock";

/**
 * Реєстр провайдерів. Справжній AI додається новим записом (наприклад, `anthropic: createAnthropicClassifier`)
 * — ключ читається тут, на сервері, і ніколи не потрапляє в клієнтський бандл.
 */
const PROVIDERS: Record<string, () => RantClassifier> = {
  mock: () => mockClassifier,
};

export function getClassifier(): RantClassifier {
  const id = (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase();
  const factory = PROVIDERS[id];
  if (!factory) throw new AnalyzeError("ai_unavailable", { cause: new Error(`AI provider "${id}" is not configured`) });
  return factory();
}

export function getTimeoutMs(): number {
  const value = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 && value <= 60000 ? value : 12000;
}
