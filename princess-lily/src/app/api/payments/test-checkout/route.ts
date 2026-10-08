import { db } from "@/db";
import { adapterById, hmacHex } from "@/lib/payments/providers";
import { paymentConfig, appUrl } from "@/lib/config";
import { processPaymentNotification } from "@/lib/fulfillment";
import { newId } from "@/lib/ids";

/**
 * ЛИШЕ ДЛЯ РОЗРОБКИ: імітація сторінки платіжного провайдера.
 * Працює тільки коли PAYMENT_PROVIDER=test і NODE_ENV != production (див. config.ts). Інакше 404.
 */
const enabled = () => !!adapterById("test") && process.env.NODE_ENV !== "production";
const safeReturn = (r: string | null) => (r && r.startsWith(appUrl() + "/") ? r : appUrl());

export async function GET(req: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const order = await db.selectFrom("orders").select(["id", "number", "total_minor", "currency"]).where("id", "=", u.searchParams.get("order") ?? "").executeTakeFirst();
  if (!order) return new Response("Not found", { status: 404 });
  const ret = safeReturn(u.searchParams.get("return"));
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>TEST PAYMENT</title>
<body style="font-family:system-ui;max-width:32rem;margin:3rem auto;padding:1rem;background:#fff7e6">
<h1>⚠️ Тестова оплата (не справжня)</h1><p>Замовлення ${order.number}: ${(order.total_minor / 100).toFixed(2)} ${order.currency}</p>
<form method="post"><input type="hidden" name="order" value="${order.id}"><input type="hidden" name="return" value="${ret}">
<button name="status" value="success" style="font-size:1.1rem;padding:.7rem 1.2rem">Імітувати успішну оплату</button>
<button name="status" value="failure" style="font-size:1.1rem;padding:.7rem 1.2rem">Імітувати невдачу</button></form></body>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
}

export async function POST(req: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const fd = await req.formData();
  const order = await db.selectFrom("orders").select(["id", "total_minor", "currency"]).where("id", "=", String(fd.get("order"))).executeTakeFirst();
  if (!order) return new Response("Not found", { status: 404 });
  // Проходимо той самий шлях, що й справжній вебхук: підписане тіло → перевірка підпису → обробка
  const body = JSON.stringify({ event_id: newId("tevt"), order_id: order.id, amount_minor: order.total_minor, currency: order.currency, status: fd.get("status") === "success" ? "success" : "failure" });
  const n = await adapterById("test")!.parseWebhook(body, new Headers({ "x-signature": hmacHex(paymentConfig().secret, body) }));
  if (n) await processPaymentNotification(n);
  return Response.redirect(safeReturn(String(fd.get("return"))), 303);
}
