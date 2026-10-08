import "server-only";
import { db } from "@/db";
import type { BookFormat, Locale } from "@/db/types";
import { clampQty, sellability } from "./catalog-rules";
import { mulMinor, sumMinor } from "./money";

export type CartLineInput = { variantId: string; quantity: number };
export type QuotedLine = {
  variantId: string; productId: string; slug: string; title: string; bookLocale: Locale; format: BookFormat;
  coverBase: string | null; unitPriceMinor: number; quantity: number; lineTotalMinor: number; maxQty: number;
};
export type Quote = { lines: QuotedLine[]; unavailable: string[]; totalMinor: number; currency: "UAH"; shippingRequired: boolean };

/**
 * Серверний розрахунок кошика. Ціни ЗАВЖДИ беруться з каталогу; будь-які ціни/суми з браузера ігноруються.
 * Непридатні до продажу позиції повертаються в `unavailable` і не потрапляють у суму.
 */
export async function quoteCart(input: CartLineInput[], locale: Locale): Promise<Quote> {
  const merged = new Map<string, number>();
  for (const l of input.slice(0, 50)) {
    if (typeof l?.variantId !== "string" || l.variantId.length > 64) continue;
    merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + (Number(l.quantity) || 1));
  }
  const ids = [...merged.keys()];
  if (!ids.length) return { lines: [], unavailable: [], totalMinor: 0, currency: "UAH", shippingRequired: false };
  const rows = await db.selectFrom("product_variants as v").innerJoin("products as p", "p.id", "v.product_id")
    .select(["v.id", "v.product_id", "v.book_locale", "v.format", "v.price_minor", "v.currency", "v.stock", "v.private_pdf_key", "v.is_active", "p.status", "p.slug", "p.cover_base"])
    .where("v.id", "in", ids).execute();
  const trs = await db.selectFrom("product_translations").selectAll().where("product_id", "in", rows.map((r) => r.product_id).concat("")).execute();
  const lines: QuotedLine[] = [];
  const unavailable: string[] = [];
  for (const id of ids) {
    const r = rows.find((x) => x.id === id);
    if (!r || r.currency !== "UAH") { unavailable.push(id); continue; }
    const s = sellability({ productStatus: r.status, isActive: r.is_active, priceMinor: r.price_minor, format: r.format, stock: r.stock, privatePdfKey: r.private_pdf_key });
    if (!s.ok) { unavailable.push(id); continue; }
    const qty = clampQty(r.format, merged.get(id)!, r.stock);
    const tr = trs.find((t) => t.product_id === r.product_id && t.locale === locale) ?? trs.find((t) => t.product_id === r.product_id);
    lines.push({
      variantId: r.id, productId: r.product_id, slug: r.slug, title: tr?.title ?? r.slug, bookLocale: r.book_locale, format: r.format,
      coverBase: r.cover_base, unitPriceMinor: r.price_minor!, quantity: qty, lineTotalMinor: mulMinor(r.price_minor!, qty),
      maxQty: r.format === "pdf" ? 1 : Math.min(10, r.stock ?? 0),
    });
  }
  return { lines, unavailable, totalMinor: sumMinor(lines.map((l) => l.lineTotalMinor)), currency: "UAH", shippingRequired: lines.some((l) => l.format === "print") };
}
