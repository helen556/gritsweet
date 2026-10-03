/** Коди збоїв AI. Усі ведуть до ручного вибору теми, доступ до сцен не втрачається. */
export type AiErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "quota"
  | "budget"
  | "limits_unavailable"
  | "timeout"
  | "unavailable"
  | "invalid_response";

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly status?: number,
  ) {
    super(code);
    this.name = "AiError";
  }
}

export interface Classifier {
  readonly id: string;
  /** Повертає сирий (неперевірений) обʼєкт. */
  classify(text: string, signal: AbortSignal): Promise<unknown>;
}
