import { logEvent } from "@/lib/server/log";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { clientKey, newRequestId, noStoreHeaders } from "@/lib/server/request";
import { getServerTranscriber } from "@/lib/speech/server-registry";

const ROUTE = "/api/transcribe";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const allow = createRateLimiter({ limit: 10, windowMs: 60_000 });

function json(body: object, requestId: string, status: number) {
  return Response.json(body, { status, headers: { ...noStoreHeaders, "X-Request-Id": requestId } });
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  const started = Date.now();
  const done = (status: number, type: string) => {
    logEvent(status >= 500 && status !== 501 ? "error" : status >= 400 ? "warn" : "info", { requestId, route: ROUTE, status, type, durationMs: Date.now() - started });
    return status;
  };

  if (!allow(clientKey(request))) return json({ error: "rate_limited" }, requestId, done(429, "rate_limited"));

  const transcriber = getServerTranscriber();
  if (!transcriber) return json({ error: "not_configured" }, requestId, done(501, "not_configured"));

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_AUDIO_BYTES) return json({ error: "too_large" }, requestId, done(413, "too_large"));

  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return json({ error: "invalid_input" }, requestId, done(400, "invalid_input"));
    }
    // Аудіо живе лише в пам’яті цього запиту.
    const text = await transcriber.transcribe(audio, { language: "uk", signal: AbortSignal.timeout(30_000) });
    return json({ text }, requestId, done(200, "transcribed"));
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return json({ error: timeout ? "timeout" : "unavailable" }, requestId, done(timeout ? 504 : 502, timeout ? "timeout" : "unavailable"));
  }
}
