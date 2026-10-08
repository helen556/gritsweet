import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { resetDb, baseCheckout } from "./helpers";
import { quoteCart } from "@/lib/quote";
import { createOrder, customerClaimsPaid, effectivePaymentMode } from "@/lib/orders";
import { processPaymentNotification, markPaid, consumeDownload, deliverPdfEmail, retryDueEmails, issueDownloadGrants } from "@/lib/fulfillment";
import { adapterById, hmacHex } from "@/lib/payments/providers";
import { parseUahToMinor, formatMinor, mulMinor } from "@/lib/money";
import { sellability } from "@/lib/catalog-rules";
import * as email from "@/lib/email";
import { setSetting } from "@/lib/settings";

const notif = (orderId: string, over: Record<string, unknown> = {}) => ({ provider: "test", eventId: `evt-${Math.random()}`, orderId, amountMinor: 25000, currency: "UAH", status: "success" as const, ...over });

beforeEach(async () => { await resetDb(); vi.restoreAllMocks(); });

describe("money", () => {
  it("parses prices without float errors", () => {
    expect(parseUahToMinor("250")).toBe(25000);
    expect(parseUahToMinor("0,1")).toBe(10);
    expect(parseUahToMinor("19.99")).toBe(1999);
    expect(parseUahToMinor("")).toBeNull();
    expect(() => parseUahToMinor("1e3")).toThrow();
    expect(mulMinor(1999, 3)).toBe(5997);
    expect(formatMinor(45050, "uk")).toBe("450,50 грн");
  });
});

describe("catalog rules", () => {
  it("seeded draft book is not purchasable (no price) — shows Coming soon", async () => {
    const v = await db.selectFrom("product_variants").selectAll().where("product_id", "=", "prd_bublik").execute();
    expect(v.length).toBe(2);
    expect(v.every((x) => x.price_minor === null && x.book_locale === "uk")).toBe(true);
    const q = await quoteCart(v.map((x) => ({ variantId: x.id, quantity: 1 })), "uk");
    expect(q.lines).toHaveLength(0);
    expect(q.unavailable).toHaveLength(2);
  });
  it("zero price or missing PDF file is never sellable", () => {
    const base = { productStatus: "published" as const, isActive: 1, stock: 5, privatePdfKey: "pdf/a.pdf" };
    expect(sellability({ ...base, priceMinor: 0, format: "pdf" }).ok).toBe(false);
    expect(sellability({ ...base, priceMinor: 100, format: "pdf", privatePdfKey: null }).ok).toBe(false);
    expect(sellability({ ...base, priceMinor: 100, format: "print", stock: 0 }).ok).toBe(false);
  });
});

describe("pricing is server-side", () => {
  it("ignores client-sent prices and clamps PDF quantity", async () => {
    const q = await quoteCart([{ variantId: "v_pdf", quantity: 5, priceMinor: 1 } as never, { variantId: "v_print", quantity: 2 }], "uk");
    expect(q.lines.find((l) => l.variantId === "v_pdf")!.quantity).toBe(1);
    expect(q.totalMinor).toBe(25000 + 2 * 45050);
    expect(q.shippingRequired).toBe(true);
  });
  it("rejects a checkout whose expected total was tampered with", async () => {
    const r = await createOrder(baseCheckout(), 100);
    expect(r).toEqual({ ok: false, error: "changed" });
  });
  it("price change after order does not alter historical order amount", async () => {
    const r = await createOrder(baseCheckout());
    if (!r.ok) throw new Error();
    await db.updateTable("product_variants").set({ price_minor: 99900 }).where("id", "=", "v_pdf").execute();
    const o = await db.selectFrom("orders").selectAll().where("id", "=", r.orderId).executeTakeFirstOrThrow();
    const it = await db.selectFrom("order_items").selectAll().where("order_id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o.total_minor).toBe(25000);
    expect(it.unit_price_minor).toBe(25000);
  });
});

describe("mixed cart", () => {
  it("requires delivery data only when printed items present", async () => {
    expect(await createOrder(baseCheckout())).toMatchObject({ ok: true });
    expect(await createOrder(baseCheckout({ lines: [{ variantId: "v_pdf", quantity: 1 }, { variantId: "v_print", quantity: 1 }] }))).toEqual({ ok: false, error: "shipping_required" });
    const r = await createOrder(baseCheckout({ lines: [{ variantId: "v_pdf", quantity: 1 }, { variantId: "v_print", quantity: 1 }], phone: "+380501234567", npCity: "Київ", npPoint: "Відділення №1" }));
    if (!r.ok) throw new Error(r.error);
    const f = await db.selectFrom("fulfillments").select(["kind", "status"]).where("order_id", "=", r.orderId).orderBy("kind").execute();
    expect(f).toEqual([{ kind: "digital", status: "awaiting_payment" }, { kind: "shipping", status: "awaiting_payment" }]);
    const o = await db.selectFrom("orders").select(["total_minor", "shipping_required"]).where("id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o).toEqual({ total_minor: 70050, shipping_required: 1 });
  });
  it("is idempotent for double submit", async () => {
    const input = baseCheckout();
    const a = await createOrder(input);
    const b = await createOrder(input);
    expect(a.ok && b.ok && a.orderId === b.orderId && b.duplicate).toBe(true);
  });
});

describe("webhook verification", () => {
  it("rejects invalid signature", async () => {
    const a = adapterById("test")!;
    const body = JSON.stringify({ event_id: "e1", order_id: "x", amount_minor: 25000, currency: "UAH", status: "success" });
    expect(await a.parseWebhook(body, new Headers({ "x-signature": "00".repeat(32) }))).toBeNull();
    expect(await a.parseWebhook(body, new Headers({}))).toBeNull();
    const ok = await a.parseWebhook(body, new Headers({ "x-signature": hmacHex("whsec_test_only", body) }));
    expect(ok?.orderId).toBe("x");
  });
  it("rejects wrong amount and wrong currency; does not mark paid", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    expect(await processPaymentNotification(notif(r.orderId, { amountMinor: 100 }))).toBe("amount_mismatch");
    expect(await processPaymentNotification(notif(r.orderId, { currency: "USD" }))).toBe("currency_mismatch");
    expect(await processPaymentNotification(notif("ord_missing"))).toBe("unknown_order");
    const o = await db.selectFrom("orders").select("payment_status").where("id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o.payment_status).toBe("pending_verification");
    expect(await db.selectFrom("download_grants").selectAll().execute()).toHaveLength(0);
  });
  it("replayed webhook is processed once; email not duplicated", async () => {
    const spy = vi.spyOn(email, "sendEmail").mockResolvedValue({ ok: true, id: "m1" });
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    const n = notif(r.orderId, { eventId: "evt-same" });
    expect(await processPaymentNotification(n)).toBe("applied");
    expect(await processPaymentNotification(n)).toBe("duplicate");
    expect(await processPaymentNotification(notif(r.orderId))).toBe("already_paid");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await db.selectFrom("email_deliveries").selectAll().execute()).toHaveLength(1);
  });
});

describe("PDF access", () => {
  it("unpaid order cannot get download grants", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await expect(issueDownloadGrants(r.orderId)).rejects.toThrow();
    expect((await consumeDownload("a".repeat(43))).ok).toBe(false);
  });
  it("success URL alone does nothing; only verified payment issues links, which expire and are limited", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "test" });
    const { grants } = await issueDownloadGrants(r.orderId);
    const t = grants[0].token;
    const d = await consumeDownload(t);
    expect(d).toMatchObject({ ok: true, key: "pdf/test.pdf" });
    for (let i = 0; i < 4; i++) await consumeDownload(t);
    expect(await consumeDownload(t)).toEqual({ ok: false, reason: "exhausted" });
    const { grants: g2 } = await issueDownloadGrants(r.orderId);
    await db.updateTable("download_grants").set({ expires_at: new Date(Date.now() - 1000).toISOString() }).execute();
    expect(await consumeDownload(g2[0].token)).toEqual({ ok: false, reason: "expired" });
  });
  it("refunded/cancelled-after-paid order: links stop working", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "test" });
    const { grants } = await issueDownloadGrants(r.orderId);
    await db.updateTable("orders").set({ payment_status: "cancelled" }).where("id", "=", r.orderId).execute();
    expect(await consumeDownload(grants[0].token)).toEqual({ ok: false, reason: "unpaid" });
  });
});

describe("manual payment mode", () => {
  it("customer claim only moves to verification; admin confirmation triggers fulfillment once", async () => {
    vi.stubEnv("PAYMENT_MODE", "manual_link");
    expect(await effectivePaymentMode()).toBe("disabled"); // посилання ще не задано
    await setSetting("payment_link_url", "https://pay.example.com/link");
    expect(await effectivePaymentMode()).toBe("manual_link");
    const spy = vi.spyOn(email, "sendEmail").mockResolvedValue({ ok: true, id: "m1" });
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await customerClaimsPaid(r.orderId);
    let o = await db.selectFrom("orders").select("payment_status").where("id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o.payment_status).toBe("pending_verification");
    expect(spy).not.toHaveBeenCalled();
    expect(await markPaid(r.orderId, { source: "admin" })).toBe(true);
    expect(await markPaid(r.orderId, { source: "admin" })).toBe(false);
    o = await db.selectFrom("orders").select("payment_status").where("id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o.payment_status).toBe("paid");
    expect(spy).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});

describe("missing keys", () => {
  it("payment disabled → no order is created", async () => {
    vi.stubEnv("PAYMENT_MODE", "disabled");
    expect(await createOrder(baseCheckout())).toEqual({ ok: false, error: "payment_unavailable" });
    vi.stubEnv("PAYMENT_MODE", "provider"); vi.stubEnv("PAYMENT_WEBHOOK_SECRET", "");
    expect(await effectivePaymentMode()).toBe("disabled");
    vi.unstubAllEnvs();
  });
  it("test provider never active in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(adapterById("test")).toBeNull();
    vi.unstubAllEnvs();
  });
  it("email not configured → explicit state, no fake success", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "test" });
    const d = await db.selectFrom("email_deliveries").selectAll().executeTakeFirstOrThrow();
    expect(d.status).toBe("not_configured");
    const f = await db.selectFrom("fulfillments").select("status").where("order_id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(f.status).toBe("email_not_configured");
    // відкликані токени з невдалого листа не працюють
    const grants = await db.selectFrom("download_grants").selectAll().execute();
    expect(grants.every((g) => g.revoked === 1)).toBe(true);
  });
});

describe("email retry", () => {
  it("failed send is retried later and then succeeds once", async () => {
    const spy = vi.spyOn(email, "sendEmail").mockResolvedValueOnce({ ok: false, error: "timeout" }).mockResolvedValue({ ok: true, id: "m2" });
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "test" });
    let d = await db.selectFrom("email_deliveries").selectAll().executeTakeFirstOrThrow();
    expect(d.status).toBe("failed");
    expect(d.next_attempt_at).not.toBeNull();
    expect(await retryDueEmails()).toHaveLength(0); // ще не час
    await db.updateTable("email_deliveries").set({ next_attempt_at: new Date(Date.now() - 1).toISOString() }).execute();
    await retryDueEmails();
    d = await db.selectFrom("email_deliveries").selectAll().executeTakeFirstOrThrow();
    expect(d.status).toBe("sent");
    expect(d.attempts).toBe(2);
    // повторний виклик з тим самим ключем не надсилає лист удруге
    await deliverPdfEmail(r.orderId, d.dedupe_key);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it("admin resend uses a new key and sends again", async () => {
    const spy = vi.spyOn(email, "sendEmail").mockResolvedValue({ ok: true, id: "m3" });
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "test" });
    await deliverPdfEmail(r.orderId, `pdf:${r.orderId}:manual:1`);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("stock", () => {
  it("decrements printed stock on payment", async () => {
    const r = await createOrder(baseCheckout({ lines: [{ variantId: "v_print", quantity: 2 }], phone: "+380501234567", npCity: "Київ", npPoint: "1" })); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "test" });
    const v = await db.selectFrom("product_variants").select("stock").where("id", "=", "v_print").executeTakeFirstOrThrow();
    expect(v.stock).toBe(1);
    const f = await db.selectFrom("fulfillments").select("status").where("order_id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(f.status).toBe("to_ship");
  });
});
