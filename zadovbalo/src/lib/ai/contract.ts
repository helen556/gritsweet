import type { AnalyzeOutcome } from "./service";

/** Відповідь /api/analyze. */
export type AnalyzeResponse = AnalyzeOutcome | { status: "invalid_input" };
