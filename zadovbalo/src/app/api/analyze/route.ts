import type { AnalyzeResponse } from "@/lib/ai/contract";
import { getClassifier, getTimeoutMs } from "@/lib/ai/providers";
import { analyzeRequestSchema } from "@/lib/ai/schema";
import { analyzeText } from "@/lib/ai/service";
import { checkAiLimits, clientIdFor } from "@/lib/server/limits";
import { logEvent } from "@/lib/server/log";
import { newRequestId, noStoreHeaders } from "@/lib/server/request";

const ROUTE = "/api/analyze";
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
  const requestId = newRequestId();
  const started = Date.now();
  const reply = (body: AnalyzeResponse, status = 200) => {
    const type = body.status === "manual" ? `manual:${body.reason}` : body.status === "support" ? `support:${body.reason}` : body.status;
    // Лише код результату, статус, затримка й технічний id — без тексту, суми й відповіді моделі.
    logEvent(status >= 500 ? "error" : body.status === "manual" ? "warn" : "info", { requestId, route: ROUTE, status, type, durationMs: Date.now() - started });
    return Response.json(body, { status, headers: { ...noStoreHeaders, "X-Request-Id": requestId } });
  };

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return reply({ status: "invalid_input" }, 413);

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return reply({ status: "invalid_input" }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply({ status: "invalid_input" }, 400);
  }
  const input = analyzeRequestSchema.safeParse(body);
  if (!input.success) return reply({ status: "invalid_input" }, 400);

  const clientId = await clientIdFor(request);
  const outcome = await analyzeText(input.data.text, {
    classifier: getClassifier(),
    timeoutMs: getTimeoutMs(),
    checkLimits: () => checkAiLimits(clientId),
  });
  return reply(outcome);
}
