import { analyticsPayloadSchema } from "@/lib/analytics/events";
import { logEvent } from "@/lib/server/log";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { clientKey, newRequestId } from "@/lib/server/request";

const allow = createRateLimiter({ limit: 120, windowMs: 60_000 });

/** Приймає агреговані події й пише їх у структурований лог. Підключити справжню аналітику — тут. */
export async function POST(request: Request) {
  if (!allow(clientKey(request))) return new Response(null, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = analyticsPayloadSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { event, ...meta } = parsed.data;
  logEvent("info", { requestId: newRequestId(), route: "/api/events", status: 204, type: event, meta });
  return new Response(null, { status: 204 });
}
