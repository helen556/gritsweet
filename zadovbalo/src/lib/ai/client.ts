import type { AnalyzeResponse } from "./contract";
import type { AiErrorCode } from "./types";

export type ClientReason = AiErrorCode | "offline";
export type ClientResult =
  | Exclude<AnalyzeResponse, { status: "manual" } | { status: "invalid_input" }>
  | (Extract<AnalyzeResponse, { status: "manual" }> & { reason: AiErrorCode })
  | { status: "manual"; reason: ClientReason; keywordSuggestions: []; amount: null; currency: null; caution: false }
  | { status: "invalid_input" }
  | { status: "stale" };

const CLIENT_TIMEOUT_MS = 15_000;

const offline = (reason: ClientReason): ClientResult => ({ status: "manual", reason, keywordSuggestions: [], amount: null, currency: null, caution: false });

/**
 * Один активний запит: новий скасовує попередній, а відповідь, що запізнилась
 * (текст уже змінили / почали заново), повертається як "stale" і ігнорується.
 */
export function createAnalyzer(fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  let seq = 0;
  let controller: AbortController | null = null;

  return {
    async analyze(text: string): Promise<ClientResult> {
      controller?.abort();
      const mine = ++seq;
      const ctrl = new AbortController();
      controller = ctrl;
      const timer = setTimeout(() => ctrl.abort("timeout"), CLIENT_TIMEOUT_MS);
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) return offline("offline");
        const res = await fetchImpl("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          cache: "no-store",
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => null)) as AnalyzeResponse | null;
        if (mine !== seq) return { status: "stale" };
        if (!data || typeof data !== "object" || !("status" in data)) return offline(res.status >= 500 ? "unavailable" : "invalid_response");
        return data as ClientResult;
      } catch {
        if (mine !== seq) return { status: "stale" };
        return offline(ctrl.signal.reason === "timeout" ? "timeout" : "offline");
      } finally {
        clearTimeout(timer);
        if (controller === ctrl) controller = null;
      }
    },
    /** Скидання/вихід: скасувати активний запит і зробити відповіді застарілими. */
    cancel() {
      seq++;
      controller?.abort();
      controller = null;
    },
  };
}
