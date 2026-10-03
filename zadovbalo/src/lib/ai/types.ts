/**
 * Будь-який класифікатор (mock, Anthropic, OpenAI, власна модель) реалізує цей інтерфейс.
 * Повертає «сирі» дані — валідація й нормалізація робляться в service.ts, тож провайдеру не довіряємо.
 */
export interface RantClassifier {
  readonly id: string;
  classify(text: string, options: { signal: AbortSignal }): Promise<unknown>;
}

export type AnalyzeErrorType = "ai_unavailable" | "timeout" | "invalid_response";

export class AnalyzeError extends Error {
  constructor(
    readonly type: AnalyzeErrorType,
    options?: { cause?: unknown },
  ) {
    super(type, options);
    this.name = "AnalyzeError";
  }
}
