"use server";

import { z } from "zod";
import { db } from "@/db";
import { getPublicProduct } from "@/lib/catalog";
import { checkDesiredDate } from "@/lib/calendar";
import { normalizeUaPhone } from "@/lib/phone";
import { estimate, estimateToColumns, formatEstimate } from "@/lib/pricing";
import { isIsoDate } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";
import { saveReference } from "@/lib/uploads";
import { newId } from "@/lib/ids";
import { addEvent, type Snapshot } from "@/lib/orders";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().positive(),
  filling: z.string().max(100).optional().default(""),
  selections: z.string().max(4000).optional().default("{}"),
  wishes: z.string().max(2000).optional().default(""),
  desiredDate: z.string().refine(isIsoDate, "Оберіть дату"),
  deliveryType: z.enum(["TAXI", "AGREE"]),
  name: z.string().trim().min(2, "Вкажіть ім’я").max(80),
  phone: z.string().trim().min(1, "Вкажіть номер телефону"),
  consent: z.literal("on", { message: "Потрібне підтвердження ознайомлення з політикою" }),
  idempotencyKey: z.string().min(16).max(64),
  website: z.string().max(0).optional(), // honeypot
});

export type SubmitResult =
  | { ok: true; orderId: string }
  | { ok: false; message: string; fields?: Record<string, string> };

export async function submitOrder(_prev: SubmitResult | null, formData: FormData): Promise<SubmitResult> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  const parsed = schema.safeParse({ ...raw, website: typeof raw.website === "string" ? raw.website : "" });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] = i.message;
    return { ok: false, message: "Перевірте виділені поля.", fields };
  }
  const d = parsed.data;
  if (raw.website) return { ok: true, orderId: "hp" }; // бот — тихо ігноруємо

  const phone = normalizeUaPhone(d.phone);
  if (!phone) return { ok: false, message: "Перевірте номер телефону.", fields: { phone: "Введіть український номер, напр. 095 029 12 14" } };

  // Ідемпотентність: повторне натискання повертає той самий результат
  const dup = await db.selectFrom("orders").select("id").where("idempotency_key", "=", d.idempotencyKey).executeTakeFirst();
  if (dup) return { ok: true, orderId: dup.id };

  if (!(await rateLimit("order", 5, 600))) return { ok: false, message: "Забагато заявок поспіль. Спробуйте трохи пізніше або зателефонуйте." };

  const product = await getPublicProduct(d.productId);
  if (!product) return { ok: false, message: "Ця позиція зараз недоступна. Оберіть іншу.", fields: { productId: "недоступно" } };

  // Кількість: грами для KG (крок 100 г), цілі для решти
  let qty = d.qty;
  if (product.unit === "KG") {
    qty = Math.round(qty);
    if (qty % 100 !== 0 || qty < 100 || qty > 30000) return { ok: false, message: "Вага має бути з кроком 0,1 кг.", fields: { qty: "напр. 1.5" } };
  } else {
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) return { ok: false, message: "Кількість має бути цілим числом.", fields: { qty: "ціле число" } };
  }
  if (product.min_qty != null && qty < product.min_qty) {
    const label = product.unit === "KG" ? `${product.min_qty / 1000} кг` : `${product.min_qty} шт`;
    return { ok: false, message: `Мінімум для цієї позиції — ${label}.`, fields: { qty: `мінімум ${label}` } };
  }
  if (product.fillings.length > 0 && d.filling && !product.fillings.includes(d.filling)) return { ok: false, message: "Оберіть начинку зі списку.", fields: { filling: "оберіть зі списку" } };

  // Склад: перевіряємо, що обрані варіанти існують у групах позиції
  const selections: { label: string; value: string }[] = [];
  if (product.options.length > 0) {
    let raw: Record<string, string> = {};
    try { raw = JSON.parse(d.selections || "{}"); } catch { raw = {}; }
    for (const g of product.options) {
      const v = typeof raw[g.key] === "string" ? raw[g.key] : "";
      if (!v && g.required) return { ok: false, message: `Оберіть: ${g.label}.`, fields: { qty: `оберіть ${g.label.toLowerCase()}` } };
      if (v && !g.choices.includes(v)) return { ok: false, message: `Оберіть варіант зі списку: ${g.label}.`, fields: { qty: "варіант зі списку" } };
      if (v) selections.push({ label: g.label, value: v });
    }
  }

  const avail = await checkDesiredDate(d.desiredDate);
  if (!avail.ok) return { ok: false, message: avail.reason, fields: { desiredDate: avail.reason } };

  // Ціну рахуємо тільки на сервері
  const est = estimate({ priceType: product.price_type, priceMin: product.price_min, priceMax: product.price_max, unit: product.unit }, qty);
  const cols = estimateToColumns(est);

  let referencePath: string | null = null;
  const ref = formData.get("reference");
  if (ref instanceof File && ref.size > 0) {
    try { referencePath = await saveReference(ref); } catch (e) { return { ok: false, message: (e as Error).message, fields: { reference: (e as Error).message } }; }
  }

  const settings = await getSettings();
  const qtyLabel = product.unit === "KG" ? `${qty / 1000} кг` : `${qty} ${product.unit === "PIECE" ? "шт" : product.unit === "BOX" ? "коробочки" : "букети"}`;
  const snapshot: Snapshot = {
    categoryName: product.category.name, productId: product.id, productName: product.name, unit: product.unit,
    qty, qtyLabel, filling: d.filling || undefined, sizeLabel: product.size_label ?? undefined, selections: selections.length ? selections : undefined,
    priceType: product.price_type, priceMin: product.price_min, priceMax: product.price_max, estimateLabel: formatEstimate(est),
    deliveryLabel: d.deliveryType === "TAXI" ? "Доставка таксі" : "Узгодити спосіб отримання", consentAt: new Date().toISOString(),
  };
  const id = newId();
  try {
    await db.insertInto("orders").values({
      id, status: "NEW", customer_name: d.name, phone, desired_date: d.desiredDate, delivery_type: d.deliveryType,
      wishes: d.wishes, reference_path: referencePath, snapshot: JSON.stringify(snapshot), price_type: product.price_type,
      estimated_min: cols.min, estimated_max: cols.max, idempotency_key: d.idempotencyKey,
    }).execute();
  } catch (e) {
    // Гонка при повторному натисканні: унікальний idempotency_key
    const dup2 = await db.selectFrom("orders").select("id").where("idempotency_key", "=", d.idempotencyKey).executeTakeFirst();
    if (dup2) return { ok: true, orderId: dup2.id };
    console.error("order insert failed", (e as Error).message); // без персональних даних
    return { ok: false, message: "Не вдалося зберегти заявку. Перевірте з’єднання і спробуйте ще раз." };
  }
  await addEvent(id, "CREATED", { urgent: avail.urgent, leadDays: settings.lead_days });
  return { ok: true, orderId: id };
}
