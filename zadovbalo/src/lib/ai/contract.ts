import type { AnalysisResult } from "./service";

/** Відповідь /api/analyze. Спільна для сервера й клієнта. */
export type AnalyzeErrorCode = "invalid_input" | "rate_limited" | "ai_unavailable" | "timeout" | "invalid_response";

export type AnalyzeResponse =
  | { status: "ok"; caution: boolean; result: AnalysisResult }
  | { status: "safety" }
  | { status: "error"; error: AnalyzeErrorCode };
