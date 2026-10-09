"use server";
import { z } from "zod";
import { db } from "@/db";
import { quoteCart, type CartLineInput } from "@/lib/quote";
import { createOrder, customerClaimsPaid, effectivePaymentMode, orderByToken } from "@/lib/orders";
import { activePaymentAdapter } from "@/lib/orders";
import { after } from "next/server";
import { notifyNewOrder } from "@/lib/telegram";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/config";
import { newId } from "@/lib/ids";
import { revalidatePath } from "next/cache";

const lineSchema = z.array(z.object({ variantId: z.string().max(64), quantity: z.number().int().min(1).max(10) })).max(30);
const langSchema = z.enum(["uk", "en"]);

/** Серверний розрахунок кошика для відображення. */
export async function quoteAction(lines: CartLineInput[], lang: "uk" | "en") {
  const l = lineSchema.safeParse(lines);
  if (!l.success) return { lines: [], unavailable: [], totalMinor: 0, currency: "UAH" as const, shippingRequired: false };
  return quoteCart(l.data, langSchema.parse(lang));
}

const checkoutSchema = z.object({
  lang: langSchema,
  lines: lineSchema.min(1),
  expectedTotalMinor: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(16).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(32).optional().default(""),
  otherRecipient: z.boolean().optional().default(false),
  recipientFirstName: z.string().trim().max(80).optional().default(""),
  recipientLastName: z.string().trim().max(80).optional().default(""),
  recipientPhone: z.string().trim().max(32).optional().default(""),
  npCity: z.string().trim().max(200).optional().default(""),
  npCityRef: z.string().trim().max(64).optional().default(""),
  npPoint: z.string().trim().max(300).optional().default(""),
  npPointRef: z.string().trim().max(64).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  website: z.string().max(0).optional().default(""), // honeypot
});
export type CheckoutPayload = z.input<typeof checkoutSchema>;
export type CheckoutResult = { ok: true; redirect: string } | { ok: false; error: string; fields?: string[] };

export async function placeOrder(payload: CheckoutPayload): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    return { ok: false, error: fields.includes("website") ? "generic" : "invalid", fields };
  }
  const d = parsed.data;
  if (!(await rateLimit("checkout", 8, 600))) return { ok: false, error: "rate" };
  const phoneOk = /^\+?[\d\s()-]{9,20}$/.test(d.phone);
  const q = await quoteCart(d.lines, d.lang);
  if (q.shippingRequired) {
    const recOk = !d.otherRecipient || (d.recipientFirstName && d.recipientLastName && /^\+?[\d\s()-]{9,20}$/.test(d.recipientPhone));
    const missing = [!phoneOk && "phone", !d.npCity && "npCity", !d.npPoint && "npPoint", !recOk && "recipient"].filter(Boolean) as string[];
    if (missing.length) return { ok: false, error: "invalid", fields: missing };
  }
  const r = await createOrder({
    lines: d.lines, email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone || null,
    recipient: d.otherRecipient ? { firstName: d.recipientFirstName, lastName: d.recipientLastName, phone: d.recipientPhone } : null,
    npCity: d.npCity || null, npCityRef: d.npCityRef || null, npPoint: d.npPoint || null, npPointRef: d.npPointRef || null,
    note: d.note || null, siteLocale: d.lang, idempotencyKey: d.idempotencyKey,
  }, d.expectedTotalMinor);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.duplicate || !r.accessToken) return { ok: false, error: "duplicate" };

  const statusUrl = `/${d.lang}/order/${r.accessToken}`;
  // Сповіщення власниці — після відповіді покупцю; недоступність Telegram не впливає на оформлення
  const orderId = r.orderId;
  after(() => notifyNewOrder(orderId).catch(() => {}));
  if ((await effectivePaymentMode()) === "provider") {
    const adapter = await activePaymentAdapter();
    const order = await db.selectFrom("orders").select(["number", "total_minor", "currency"]).where("id", "=", r.orderId).executeTakeFirstOrThrow();
    try {
      const co = await adapter!.createCheckout({ orderId: r.orderId, orderNumber: order.number, amountMinor: order.total_minor, currency: order.currency, description: `Order ${order.number}`, returnUrl: `${appUrl()}${statusUrl}` });
      await db.updateTable("orders").set({ payment_reference: co.reference }).where("id", "=", r.orderId).execute();
      return { ok: true, redirect: co.redirectUrl };
    } catch {
      return { ok: true, redirect: statusUrl }; // замовлення збережене; статус-сторінка покаже «очікує оплату»
    }
  }
  return { ok: true, redirect: statusUrl };
}

export async function claimPaidAction(token: string, lang: "uk" | "en") {
  if (!(await rateLimit("claim", 10, 600))) return;
  const o = await orderByToken(token);
  if (o) await customerClaimsPaid(o.id);
  revalidatePath(`/${langSchema.parse(lang)}/order/${token}`);
}

const contactSchema = z.object({
  lang: langSchema,
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  order: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().min(5).max(4000),
  website: z.string().max(0).optional().default(""),
});
export type ContactState = { status: "idle" | "ok" | "error"; error?: string; fields?: string[] };

/** Контактна форма реально зберігає звернення в БД (видно в адмінці). */
export async function submitContact(_: ContactState, fd: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { status: "error", error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  if (!(await rateLimit("contact", 5, 600))) return { status: "error", error: "rate" };
  const d = parsed.data;
  try {
    await db.insertInto("contact_messages").values({ id: newId("msg"), name: d.name, email: d.email, order_number: d.order || null, message: d.message, site_locale: d.lang, status: "new" }).execute();
  } catch { return { status: "error", error: "generic" }; }
  return { status: "ok" };
}
