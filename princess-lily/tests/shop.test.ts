import { describe, it, expect, beforeEach, vi } from "vitest";
import { db, normalizePgUrl } from "@/db";
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
  it("seeded books: 399 print in stock, 299 PDF (sold even before the PDF file is uploaded — manual delivery), UA+EN titles", async () => {
    const v = await db.selectFrom("product_variants").selectAll().where("product_id", "=", "prd_bublik").execute();
    expect(v.length).toBe(4);
    expect(new Set(v.map((x) => x.book_locale))).toEqual(new Set(["uk", "en"]));
    expect(v.filter((x) => x.format === "print").every((x) => x.price_minor === 39900 && x.is_active === 1 && (x.stock ?? 0) > 0)).toBe(true);
    expect(v.filter((x) => x.format === "pdf").every((x) => x.price_minor === 29900 && x.is_active === 1)).toBe(true);
    const q = await quoteCart(v.map((x) => ({ variantId: x.id, quantity: 1 })), "uk");
    expect(q.lines.map((l) => l.format).sort()).toEqual(["pdf", "pdf", "print", "print"]);
    expect(q.unavailable).toHaveLength(0);
    const books = await db.selectFrom("products").select(["slug", "status"]).where("id", "in", ["prd_bublik", "prd_doctor", "prd_potty"]).orderBy("sort_order").execute();
    expect(books.map((b) => b.slug)).toEqual(["lili-ide-do-likarya", "yak-lili-navchylasia-sidaty-na-horshchyk", "yak-lili-vchyla-bublyka"]);
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

describe("packaged covers", () => {
  it("apply by book id when an older database stored a different slug", async () => {
    const { applyPackagedMedia } = await import("@/db/seed");
    await db.updateTable("products").set({ slug: "lili-yde-do-likarya" }).where("id", "=", "prd_doctor").execute();
    await db.updateTable("product_translations").set({ cover_base: null }).where("product_id", "=", "prd_doctor").execute();
    await applyPackagedMedia(db);
    const t = await db.selectFrom("product_translations").select(["locale", "cover_base"]).where("product_id", "=", "prd_doctor").orderBy("locale").execute();
    expect(t).toEqual([{ locale: "en", cover_base: "/media/cover-lili-ide-do-likarya-en" }, { locale: "uk", cover_base: "/media/cover-lili-ide-do-likarya-uk" }]);
  });
});

describe("Supabase storage auth headers", () => {
  it("new sb_secret_ keys go only in apikey; legacy JWT keys also as Bearer", async () => {
    const { privateStorage } = await import("@/lib/storage");
    const seen: Record<string, string>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { seen.push(init.headers as Record<string, string>); return new Response("{}", { status: 200 }); }));
    Object.assign(process.env, { PRIVATE_STORAGE: "supabase", SUPABASE_URL: "https://x.supabase.co" });
    try {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_abc";
      await privateStorage().put("receipts/ord_a/rcp_b.png", Buffer.from("x"), "image/png");
      process.env.SUPABASE_SERVICE_ROLE_KEY = "aaa.bbb.ccc";
      await privateStorage().put("receipts/ord_a/rcp_c.png", Buffer.from("x"), "image/png");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.PRIVATE_STORAGE; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    expect(seen[0].apikey).toBe("sb_secret_abc");
    expect(seen[0].Authorization).toBeUndefined();
    expect(seen[1].Authorization).toBe("Bearer aaa.bbb.ccc");
  });
});

describe("receipt storage fallback", () => {
  it("Supabase rejects the upload (bad key) → the file is kept in the database and can be read back", async () => {
    const { privateStorage } = await import("@/lib/storage");
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"Unauthorized"}', { status: 400 })));
    Object.assign(process.env, { PRIVATE_STORAGE: "supabase", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "wrong" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const s = privateStorage();
      await s.put("receipts/ord_a/rcp_z.png", Buffer.from("receipt-bytes"), "image/png");
      expect((await s.get("receipts/ord_a/rcp_z.png"))?.toString()).toBe("receipt-bytes");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.PRIVATE_STORAGE; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });
});

describe("PDF without an uploaded file", () => {
  it("is sold; after payment the order waits for manual delivery instead of sending broken links", async () => {
    await db.updateTable("product_variants").set({ private_pdf_key: null }).where("id", "=", "v_pdf").execute();
    const r = await createOrder(baseCheckout(), 25000);
    if (!r.ok) throw new Error("order not created");
    const o = await db.selectFrom("orders").select("id").orderBy("created_at", "desc").executeTakeFirstOrThrow();
    await markPaid(o.id, { source: "manual", checkedBy: "owner@example.com" });
    const f = await db.selectFrom("fulfillments").select("status").where("order_id", "=", o.id).where("kind", "=", "digital").executeTakeFirstOrThrow();
    expect(f.status).toBe("manual");
    expect(await db.selectFrom("email_deliveries").select("id").where("order_id", "=", o.id).execute()).toHaveLength(0);
  });
});

describe("PDF delivery channel", () => {
  it("stores Telegram as the PDF channel (only for orders with a PDF)", async () => {
    const r = await createOrder(baseCheckout({ pdfChannel: "telegram", telegram: "@lily_reader" }), 25000);
    if (!r.ok) throw new Error("order not created");
    const o = await db.selectFrom("orders").select(["pdf_channel", "telegram"]).where("id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o).toEqual({ pdf_channel: "telegram", telegram: "@lily_reader" });
    const r2 = await createOrder(baseCheckout({ lines: [{ variantId: "v_print", quantity: 1 }], phone: "+380501234567", npCity: "Київ", npPoint: "1", pdfChannel: "telegram", telegram: "@x_reader" }), 45050);
    if (!r2.ok) throw new Error("order not created");
    const o2 = await db.selectFrom("orders").select(["pdf_channel", "telegram"]).where("id", "=", r2.orderId).executeTakeFirstOrThrow();
    expect(o2).toEqual({ pdf_channel: null, telegram: null });
  });
});

describe("підключення до бази", () => {
  it("пулер Supabase переводиться з session (5432) на transaction (6543), sslmode прибирається", () => {
    expect(normalizePgUrl("postgres://postgres.abc:p%40ss@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"))
      .toBe("postgres://postgres.abc:p%40ss@aws-1-eu-west-1.pooler.supabase.com:6543/postgres");
    expect(normalizePgUrl("postgres://u:p@aws-1-eu-west-1.pooler.supabase.com:6543/postgres")).toContain(":6543/");
    expect(normalizePgUrl("postgres://postgres:pg@localhost:5432/pl")).toBe("postgres://postgres:pg@localhost:5432/pl");
  });
});

describe("sitemap: дати lastmod", () => {
  it("текст дати з Postgres перетворюється на коректну дату ISO", async () => {
    const { w3cDate } = await import("@/lib/seo");
    expect(w3cDate("2026-10-12 21:03:35.814673+00")?.toISOString()).toBe("2026-10-12T21:03:35.814Z");
    expect(w3cDate("2026-10-13T07:15:25.292Z")?.toISOString()).toBe("2026-10-13T07:15:25.292Z");
    expect(w3cDate("2026-10-13 07:15:25")?.toISOString()).toBe("2026-10-13T07:15:25.000Z");
    expect(w3cDate("nonsense")).toBeUndefined();
    expect(w3cDate(null)).toBeUndefined();
  });
});

describe("approved titles, new potty cover and specs (27.10.2026)", () => {
  /** Стан бази, як у production до оновлення: стара назва й адреса, старі описи й обкладинка, замовлення зі старою назвою. */
  async function legacyDb() {
    await db.updateTable("products").set({ slug: "yak-ya-navchylasya-sydity-na-horshchyk", pages: null }).where("id", "=", "prd_potty").execute();
    await db.updateTable("product_translations").set({
      title: "Як я навчилася сидіти на горщик", cover_base: "/media/cover-lili-yak-ya-navchylasya-sydity-na-horshchyk-uk",
      description: "Знайомство з горщиком — великий крок для маленької дитини. Історія Лілі допомагає підійти до нього з цікавістю, без сорому та поспіху. Читайте разом і говоріть про нові звички, самостійність та право вчитися у власному темпі.",
    }).where("product_id", "=", "prd_potty").where("locale", "=", "uk").execute();
    await db.updateTable("product_translations").set({ description: "Власний опис, відредагований в адмінці." }).where("product_id", "=", "prd_friend").where("locale", "=", "uk").execute();
    await db.updateTable("product_translations").set({ cover_alt: "Cover of “Princess Lily’s Lily Learns to Be a Friend”" }).where("product_id", "=", "prd_friend").where("locale", "=", "en").execute();
    const o = await createOrder(baseCheckout({ lines: [{ variantId: "var_potty_uk_print", quantity: 1 }], phone: "+380501234567", npCity: "Київ", npPoint: "1" }));
    await db.deleteFrom("data_migrations").execute();
    return o;
  }

  it("migration renames the potty book once, keeps admin edits and order history", async () => {
    const { setSetting: set } = await import("@/lib/settings");
    await set("payment_mode", "manual_link"); await set("payment_link_url", "https://send.monobank.ua/test");
    const o = await legacyDb();
    expect(o.ok).toBe(true);
    const { seed } = await import("@/db/seed");
    await seed(db);
    const p = await db.selectFrom("products").select(["slug", "pages"]).where("id", "=", "prd_potty").executeTakeFirstOrThrow();
    expect(p).toEqual({ slug: "yak-lili-navchylasia-sidaty-na-horshchyk", pages: 26 });
    const uk = await db.selectFrom("product_translations").selectAll().where("product_id", "=", "prd_potty").where("locale", "=", "uk").executeTakeFirstOrThrow();
    expect(uk.title).toBe("Як Лілі навчилася сідати на горщик");
    expect(uk.description).toMatch(/^Якщо ваш малюк какає стоячки/);
    expect(uk.cover_base).toBe("/media/cover-yak-lili-navchylasia-sidaty-na-horshchyk-uk-v2");
    expect(uk.cover_alt).toContain("«Як Лілі навчилася сідати на горщик»");
    // відредагований в адмінці опис не перезаписано; alt без повтору Lily
    const fr = await db.selectFrom("product_translations").select(["locale", "description", "cover_alt"]).where("product_id", "=", "prd_friend").orderBy("locale").execute();
    expect(fr.find((x) => x.locale === "uk")!.description).toBe("Власний опис, відредагований в адмінці.");
    expect(fr.find((x) => x.locale === "en")!.cover_alt).not.toMatch(/Lily’s Lily/);
    // комплект — нова назва в описі та нова обкладинка
    const set5 = await db.selectFrom("product_translations").select(["description", "cover_base"]).where("product_id", "=", "prd_set5").where("locale", "=", "uk").executeTakeFirstOrThrow();
    expect(set5.description).toContain("• Як Лілі навчилася сідати на горщик");
    expect(set5.cover_base).toBe("/media/cover-komplekt-5-knyzhok-uk-v3");
    // історія замовлень не змінюється
    const it = await db.selectFrom("order_items").select("title_snapshot").where("product_id", "=", "prd_potty").executeTakeFirstOrThrow();
    expect(it.title_snapshot).toBe("Як я навчилася сидіти на горщик");
    // стара адреса веде на нову
    const { redirectedSlug } = await import("@/lib/catalog");
    expect(await redirectedSlug("yak-ya-navchylasya-sydity-na-horshchyk")).toBe("yak-lili-navchylasia-sidaty-na-horshchyk");
    expect(await redirectedSlug("no-such-book")).toBeNull();
    // повторний запуск нічого не змінює (міграція одноразова)
    await db.updateTable("product_translations").set({ title: "Назву змінено в адмінці" }).where("product_id", "=", "prd_potty").where("locale", "=", "uk").execute();
    await seed(db);
    expect((await db.selectFrom("product_translations").select("title").where("product_id", "=", "prd_potty").where("locale", "=", "uk").executeTakeFirstOrThrow()).title).toBe("Назву змінено в адмінці");
  });

  it("admin-uploaded covers are never replaced by packaged ones", async () => {
    await db.updateTable("product_translations").set({ cover_base: "/uploads/covers/custom-abc" }).where("product_id", "=", "prd_potty").where("locale", "=", "uk").execute();
    const { applyPackagedMedia } = await import("@/db/seed");
    await applyPackagedMedia(db);
    const t = await db.selectFrom("product_translations").select("cover_base").where("product_id", "=", "prd_potty").where("locale", "=", "uk").executeTakeFirstOrThrow();
    expect(t.cover_base).toBe("/uploads/covers/custom-abc");
  });

  it("specs: author, 26 pages, glossy cover only for print, bundle pages per book", async () => {
    const { bookSpecRows } = await import("@/lib/book-specs");
    const { getDict } = await import("@/i18n");
    const uk = getDict("uk");
    const book = { id: "prd_potty", pages: null, age_from: 2, age_to: 6, size_label: null, binding_label: null };
    const rows = bookSpecRows(uk, book, ["uk", "en"], ["pdf", "print"]);
    const val = (k: string) => rows.find((r) => r.key === k)?.value;
    expect(val("author")).toBe("Єлизавета Дяченко");
    expect(val("series")).toBe("Історії принцеси Лілі");
    expect(val("pages")).toBe("26");
    expect(val("illustrations")).toBe("кольорові");
    expect(val("language")).toBe("українська / англійська");
    expect(val("format")).toBe("друкована книжка / PDF");
    expect(rows.find((r) => r.key === "cover")).toMatchObject({ value: "глянцева", printOnly: true });
    expect(val("category")).toBe("дитяча ілюстрована література");
    // лише PDF — без обкладинки; тип палітурки й розмір не вигадуються
    expect(bookSpecRows(uk, book, ["uk"], ["pdf"]).some((r) => r.key === "cover" || r.key === "binding" || r.key === "size")).toBe(false);
    const set = bookSpecRows(getDict("en"), { ...book, id: "prd_set5", pages: 26 }, ["en"], ["print"]);
    expect(set.find((r) => r.key === "pages")?.value).toBe("26 in each book");
    expect(set.find((r) => r.key === "books")?.value).toBe("5");
    expect(set.find((r) => r.key === "author")?.value).toBe("Elizaveta Dyachenko");
  });

  it("legal documents stay unpublished until details are filled and approved", async () => {
    const { legalStatus } = await import("@/lib/legal");
    expect((await legalStatus()).ready).toBe(false);
    for (const [k, v] of [["seller_details_uk", "ФОП …"], ["seller_details_en", "Sole proprietor …"], ["legal_retention_uk", "3 роки"], ["legal_retention_en", "3 years"], ["contact_email", "a@b.ua"]] as const) await setSetting(k, v);
    expect((await legalStatus()).ready).toBe(false); // ще не погоджено
    await setSetting("legal_approved", "1");
    expect(await legalStatus()).toMatchObject({ ready: true, missing: [] });
  });
});

describe("Meta Conversions API", () => {
  it("Purchase only after confirmed payment, only with consent; hashed contacts; same event_id as the pixel", async () => {
    await setSetting("payment_mode", "manual_link"); await setSetting("payment_link_url", "https://send.monobank.ua/test");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890"); vi.stubEnv("META_CAPI_ACCESS_TOKEN", "test-token");
    const calls: { url: string; body: string }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => { calls.push({ url: String(url), body: String(init?.body) }); return new Response("{}", { status: 200 }); });
    try {
      const noConsent = await createOrder(baseCheckout());
      const withConsent = await createOrder(baseCheckout({ meta: { fbp: "fb.1.123.456", fbc: null } }));
      if (!noConsent.ok || !withConsent.ok) throw new Error("order");
      const { sendPurchaseToMeta } = await import("@/lib/meta-capi");
      expect(await sendPurchaseToMeta(withConsent.orderId)).toBe("skipped"); // ще не оплачено
      await markPaid(noConsent.orderId, { source: "admin", checkedBy: "owner@example.com" });
      expect(calls.filter((c) => c.url.includes("graph.facebook.com"))).toHaveLength(0);
      await markPaid(withConsent.orderId, { source: "admin", checkedBy: "owner@example.com" });
      const meta = calls.filter((c) => c.url.includes("graph.facebook.com/"));
      expect(meta).toHaveLength(1);
      expect(meta[0].url).toContain("/1234567890/events");
      const ev = JSON.parse(meta[0].body).data[0];
      expect(ev).toMatchObject({ event_name: "Purchase", event_id: `purchase-${withConsent.orderId}`, custom_data: { currency: "UAH", value: 250 } });
      expect(ev.user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(meta[0].body).not.toContain("parent@example.com");
      expect(ev.user_data.fbp).toBe("fb.1.123.456");
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("provider payment retry", () => {
  it("new invoice for an unpaid or failed order, localized description; never for a paid one", async () => {
    // тестовий провайдер (як у vitest.config: PAYMENT_MODE=provider, PAYMENT_PROVIDER=test)
    const { startProviderPayment } = await import("@/lib/orders");
    const payments = await import("@/lib/payments/providers");
    const seen: string[] = [];
    const adapter = payments.adapterById("test")!;
    const orig = adapter.createCheckout;
    adapter.createCheckout = async (req) => { seen.push(req.description); return orig(req); };
    try {
      const o = await createOrder(baseCheckout());
      if (!o.ok) throw new Error("order");
      expect(await startProviderPayment(o.orderId, "/uk/order/x")).toMatch(/test-checkout/);
      expect(seen.at(-1)).toMatch(/^Оплата замовлення PL-\d+ · Історії принцеси Лілі$/);
      await db.updateTable("orders").set({ payment_status: "failed" }).where("id", "=", o.orderId).execute();
      expect(await startProviderPayment(o.orderId, "/uk/order/x")).toMatch(/test-checkout/);
      await markPaid(o.orderId, { source: "admin", checkedBy: "owner@example.com" });
      expect(await startProviderPayment(o.orderId, "/uk/order/x")).toBeNull();
      // збій провайдера: null (покупець бачить кнопку повтору), подія в хронології
      const o2 = await createOrder(baseCheckout());
      if (!o2.ok) throw new Error("order");
      adapter.createCheckout = async () => { throw new Error("timeout"); };
      expect(await startProviderPayment(o2.orderId, "/uk/order/y")).toBeNull();
      const ev = await db.selectFrom("order_events").select("details").where("order_id", "=", o2.orderId).execute();
      expect(ev.some((e) => e.details?.includes("Рахунок провайдера не створено"))).toBe(true);
    } finally { adapter.createCheckout = orig; }
  });
});
