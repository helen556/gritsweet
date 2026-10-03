import { getClassifier, getTimeoutMs } from "@/lib/ai/providers";
import type { AnalyzeErrorCode, AnalyzeResponse } from "@/lib/ai/contract";
import { analyzeRequestSchema } from "@/lib/ai/schema";
import { analyzeRant } from "@/lib/ai/service";
import { AnalyzeError } from "@/lib/ai/types";
import { logEvent } from "@/lib/server/log";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { clientKey, newRequestId, noStoreHeaders } from "@/lib/server/request";

const ROUTE = "/api/analyze";
const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

const STATUS: Record<AnalyzeErrorCode, number> = {
  invalid_input: 400,
  rate_limited: 429,
  ai_unavailable: 503,
  timeout: 504,
  invalid_response: 502,
};

function reply(body: AnalyzeResponse, requestId: string, status = 200) {
  return Response.json(body, { status, headers: { ...noStoreHeaders, "X-Request-Id": requestId } });
}

function fail(error: AnalyzeErrorCode, requestId: string, started: number, cause?: unknown) {
  const status = STATUS[error];
  logEvent(status >= 500 ? "error" : "warn", {
    requestId,
    route: ROUTE,
    status,
    type: error,
    durationMs: Date.now() - started,
    // Лише назва класу причини — повідомлення можуть містити фрагменти даних.
    ...(cause instanceof Error ? { meta: { cause: cause.name } } : {}),
  });
  return reply({ status: "error", error }, requestId, status);
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  const started = Date.now();

  if (!allow(clientKey(request))) return fail("rate_limited", requestId, started);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_input", requestId, started);
  }
  const input = analyzeRequestSchema.safeParse(body);
  if (!input.success) return fail("invalid_input", requestId, started);

  try {
    const outcome = await analyzeRant(input.data.text, { classifier: getClassifier(), timeoutMs: getTimeoutMs() });
    if (outcome.status === "safety") {
      logEvent("info", { requestId, route: ROUTE, status: 200, type: "safety_flow", meta: { reasons: outcome.safety.reasons.join(",") } });
      return reply({ status: "safety" }, requestId);
    }
    logEvent("info", {
      requestId,
      route: ROUTE,
      status: 200,
      type: "analyzed",
      durationMs: Date.now() - started,
      meta: { provider: outcome.provider, topics: outcome.result.topics.length, caution: outcome.safety.level === "caution" },
    });
    return reply({ status: "ok", caution: outcome.safety.level === "caution", result: outcome.result }, requestId);
  } catch (error) {
    if (error instanceof AnalyzeError) return fail(error.type, requestId, started, error.cause);
    return fail("ai_unavailable", requestId, started, error);
  }
}
