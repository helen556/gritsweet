import { orderByToken, customerClaimsPaid } from "@/lib/orders";
import { saveReceipt } from "@/lib/receipts";
import { rateLimit } from "@/lib/rate-limit";

/** Квитанція від покупця до СВОГО замовлення (доступ за секретним токеном сторінки статусу). Файл приватний. */
export async function POST(req: Request) {
  if (!(await rateLimit("receipt", 10, 3600))) return Response.json({ error: "rate" }, { status: 429 });
  // ліміт тіла запиту функцій Vercel ~4.5 МБ; великі фото браузер стискає перед надсиланням
  if (Number(req.headers.get("content-length") ?? 0) > 4.4 * 1024 * 1024) return Response.json({ error: "size" }, { status: 413 });
  const fd = await req.formData().catch(() => null);
  const token = String(fd?.get("token") ?? "");
  const file = fd?.get("file");
  const order = await orderByToken(token);
  if (!order || !(file instanceof File)) return Response.json({ error: "invalid" }, { status: 400 });
  if (order.payment_mode !== "manual_link" || !["pending_payment", "pending_verification"].includes(order.payment_status))
    return Response.json({ error: "not_allowed" }, { status: 409 });
  let r: Awaited<ReturnType<typeof saveReceipt>>;
  try {
    r = await saveReceipt(order.id, Buffer.from(await file.arrayBuffer()), file.name, "покупець", 4 * 1024 * 1024);
  } catch (e) {
    console.error("receipt upload failed", e);
    return Response.json({ error: "storage" }, { status: 502 });
  }
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  // квитанція обов'язкова: лише з нею покупець позначає «я оплатив(ла)» → замовлення йде на перевірку (НЕ «оплачено»)
  await customerClaimsPaid(order.id);
  return Response.json({ ok: true });
}
