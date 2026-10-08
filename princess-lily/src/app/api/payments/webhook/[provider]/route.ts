import { adapterById } from "@/lib/payments/providers";
import { processPaymentNotification } from "@/lib/fulfillment";

/**
 * Вебхук платіжного провайдера — ЄДИНЕ джерело автоматичного підтвердження оплати.
 * Підпис перевіряється адаптером; сума, валюта й order_id — відносно збереженого замовлення.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider } = await ctx.params;
  const adapter = adapterById(provider);
  if (!adapter) return Response.json({ error: "not_configured" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 64_000) return Response.json({ error: "too_large" }, { status: 413 });
  const n = await adapter.parseWebhook(raw, req.headers);
  if (!n) return Response.json({ error: "invalid_signature" }, { status: 401 });
  const result = await processPaymentNotification(n);
  // 200 і для дублікатів — щоб провайдер не повторював безкінечно
  return Response.json({ result });
}
