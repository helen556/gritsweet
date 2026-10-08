import type { BookFormat, ProductStatus } from "@/db/types";

/** Чисті правила продажу (без БД) — використовуються і сервером, і тестами. */
export type SellableInput = {
  productStatus: ProductStatus;
  isActive: number;
  priceMinor: number | null;
  format: BookFormat;
  stock: number | null;
  privatePdfKey: string | null;
};
export type UnavailableReason = "not_published" | "inactive" | "no_price" | "no_file" | "out_of_stock";

export function sellability(v: SellableInput): { ok: true } | { ok: false; reason: UnavailableReason } {
  if (v.productStatus !== "published") return { ok: false, reason: "not_published" };
  if (!v.isActive) return { ok: false, reason: "inactive" };
  if (v.priceMinor == null || !Number.isSafeInteger(v.priceMinor) || v.priceMinor <= 0) return { ok: false, reason: "no_price" };
  if (v.format === "pdf" && !v.privatePdfKey) return { ok: false, reason: "no_file" };
  if (v.format === "print" && !(v.stock != null && v.stock > 0)) return { ok: false, reason: "out_of_stock" };
  return { ok: true };
}

export const MAX_PRINT_QTY = 10;
/** PDF — одна ліцензія на рядок; друк — до наявного залишку. */
export function clampQty(format: BookFormat, qty: number, stock: number | null): number {
  const q = Math.floor(Number(qty));
  if (!Number.isFinite(q) || q < 1) return 1;
  if (format === "pdf") return 1;
  return Math.max(1, Math.min(q, MAX_PRINT_QTY, stock ?? 0));
}
