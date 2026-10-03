import { analyticsPayloadSchema } from "@/lib/analytics/events";
import { allowRequest, clientIdFor } from "@/lib/server/limits";
import { logEvent } from "@/lib/server/log";
import { newRequestId } from "@/lib/server/request";

/** Загальні події → структурований лог. Підключити зовнішню аналітику — тут. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 512) return new Response(null, { status: 413 });
  if (!(await allowRequest(await clientIdFor(request), "ev", 120, 60))) return new Response(null, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = analyticsPayloadSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  logEvent("info", { requestId: newRequestId(), route: "/api/events", status: 204, type: parsed.data.event });
  return new Response(null, { status: 204 });
}
