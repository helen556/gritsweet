import "server-only";
import { db } from "@/db";
import { BUNDLE_CONTENTS } from "./book-specs";
import type { BookFileRow } from "@/components/admin/BookFilesUpload";

/** PDF-варіанти всіх книжок (без комплектів — їм окремий файл не потрібен) зі станом «файл завантажено». */
export async function bookFileRows(onlyProducts?: string[]): Promise<BookFileRow[]> {
  const rows = await db.selectFrom("product_variants as v").innerJoin("products as p", "p.id", "v.product_id")
    .innerJoin("product_translations as t", (j) => j.onRef("t.product_id", "=", "p.id").on("t.locale", "=", "uk"))
    .select(["v.id", "v.book_locale", "v.private_pdf_key", "p.id as pid", "t.title"])
    .where("v.format", "=", "pdf").where("p.status", "!=", "draft").orderBy("p.sort_order").orderBy("v.book_locale", "desc").execute();
  return rows.filter((r) => !BUNDLE_CONTENTS[r.pid] && (!onlyProducts || onlyProducts.includes(r.pid)))
    .map((r) => ({ variantId: r.id, productId: r.pid, title: r.title, locale: r.book_locale, uploaded: !!r.private_pdf_key }));
}
