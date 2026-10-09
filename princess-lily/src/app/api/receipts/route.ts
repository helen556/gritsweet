import { orderByToken } from "@/lib/orders";
import { saveReceipt } from "@/lib/receipts";
import { rateLimit } from "@/lib/rate-limit";

/** Квитанція від покупця до СВОГО замовлення (доступ за секретним токеном сторінки статусу). Файл приватний. */
export async function POST(req: Request) {
  if (!(await rateLimit("receipt", 10, 3600))) return Response.json({ error: "rate" }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return Response.json({ error: "size" }, { status: 413 });
  const fd = await req.formData().catch(() => null);
  const token = String(fd?.get("token") ?? "");
  const file = fd?.get("file");
  const order = await orderByToken(token);
  if (!order || !(file instanceof File)) return Response.json({ error: "invalid" }, { status: 400 });
  if (order.payment_mode !== "manual_link" || !["pending_payment", "pending_verification"].includes(order.payment_status))
    return Response.json({ error: "not_allowed" }, { status: 409 });
  const r = await saveReceipt(order.id, Buffer.from(await file.arrayBuffer()), file.name, "покупець", 5 * 1024 * 1024);
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.error }, { status: 400 });
}
