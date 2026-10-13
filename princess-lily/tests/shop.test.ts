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
  it("seeded books: 399 print in stock, 299 PDF (sellable only once the PDF file is uploaded), UA+EN titles", async () => {
    const v = await db.selectFrom("product_variants").selectAll().where("product_id", "=", "prd_bublik").execute();
    expect(v.length).toBe(4);
    expect(new Set(v.map((x) => x.book_locale))).toEqual(new Set(["uk", "en"]));
    expect(v.filter((x) => x.format === "print").every((x) => x.price_minor === 39900 && x.is_active === 1 && (x.stock ?? 0) > 0)).toBe(true);
    expect(v.filter((x) => x.format === "pdf").every((x) => x.price_minor === 29900 && x.is_active === 1)).toBe(true);
    const q = await quoteCart(v.map((x) => ({ variantId: x.id, quantity: 1 })), "uk");
    expect(q.lines.map((l) => l.format).sort()).toEqual(["print", "print"]);
    expect(q.unavailable).toHaveLength(2); // PDF без файлу не продається
    const books = await db.selectFrom("products").select(["slug", "status"]).where("id", "in", ["prd_bublik", "prd_doctor", "prd_potty"]).orderBy("sort_order").execute();
    expect(books.map((b) => b.slug)).toEqual(["lili-ide-do-likarya", "lili-yak-ya-navchylasya-sydity-na-horshchyk", "yak-lili-vchyla-bublyka"]);
    expect(books.every((b) => b.status === "published")).toBe(true);
    const en = await db.selectFrom("product_translations").select(["title", "is_confirmed"]).where("product_id", "=", "prd_bublik").where("locale", "=", "en").executeTakeFirstOrThrow();
    expect(en).toEqual({ title: "How Lily Helped Spotty Get His Nails Trimmed", is_confirmed: 1 });
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

describe("catalog: covers, hiding and growth", () => {
  const cover = (base: string) => ({ cover_base: base, cover_widths: "[480]", cover_width: 1000, cover_height: 1000 });
  it("coverless book is hidden from the storefront; per-language cover follows the site/book language", async () => {
    const { listPublicProducts, getPublicProduct } = await import("@/lib/catalog");
    expect((await listPublicProducts("uk")).some((p) => p.id === "prd_test")).toBe(false);
    expect(await getPublicProduct("test-book", "uk")).toBeNull();
    await db.updateTable("product_translations").set(cover("/media/covers/test-uk")).where("product_id", "=", "prd_test").where("locale", "=", "uk").execute();
    await db.insertInto("product_translations").values({ product_id: "prd_test", locale: "en", title: "[TEST] Test book", description: "", cover_alt: "", is_confirmed: 1, ...cover("/media/covers/test-en") }).execute();
    const uk = (await listPublicProducts("uk")).find((p) => p.id === "prd_test")!;
    const en = (await listPublicProducts("en")).find((p) => p.id === "prd_test")!;
    expect(uk.cover!.base).toBe("/media/covers/test-uk");
    expect(en.cover!.base).toBe("/media/covers/test-en");
    expect(uk.coverByLocale.en!.base).toBe("/media/covers/test-en");
  });
  it("a 4th (and 5th) book appears in display order without any 3-book limit", async () => {
    const { listPublicProducts } = await import("@/lib/catalog");
    for (const [i, slug] of ["book-four", "book-five"].entries()) {
      await db.insertInto("products").values({ id: `prd_${slug}`, slug, status: "published", age_from: 2, age_to: 6, sort_order: 100 + i, cover_base: "/media/x", cover_widths: "[480]", cover_width: 900, cover_height: 900, pages: null, size_label: null, binding_label: null }).execute();
      await db.insertInto("product_translations").values({ product_id: `prd_${slug}`, locale: "uk", title: `[TEST] ${slug}`, description: "", cover_alt: "", is_confirmed: 1 }).execute();
    }
    const list = await listPublicProducts("uk");
    expect(list.map((p) => p.slug).slice(-2)).toEqual(["book-four", "book-five"]);
  });
  it("spreads block is empty without real spreads", async () => {
    const { listPublicSpreads } = await import("@/lib/catalog");
    expect(await listPublicSpreads("uk")).toEqual([]);
  });
});
