import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { BUNDLE_CONTENTS } from "@/lib/book-specs";
import BookFilesUpload, { type BookFileRow } from "@/components/admin/BookFilesUpload";

export const metadata = { title: "Файли книжок" };

/** PDF усіх книжок на одній сторінці: одна кнопка для всіх файлів або окремо для кожної мовної версії. */
export default async function BookFiles() {
  await requireAdmin("owner");
  const rows = await db.selectFrom("product_variants as v").innerJoin("products as p", "p.id", "v.product_id")
    .innerJoin("product_translations as t", (j) => j.onRef("t.product_id", "=", "p.id").on("t.locale", "=", "uk"))
    .select(["v.id", "v.book_locale", "v.private_pdf_key", "p.id as pid", "t.title"])
    .where("v.format", "=", "pdf").where("p.status", "!=", "draft").orderBy("p.sort_order").orderBy("v.book_locale", "desc").execute();
  const list: BookFileRow[] = rows.filter((r) => !BUNDLE_CONTENTS[r.pid])
    .map((r) => ({ variantId: r.id, productId: r.pid, title: r.title, locale: r.book_locale, uploaded: !!r.private_pdf_key }));
  const done = list.filter((r) => r.uploaded).length;
  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <h1 className="text-3xl text-plum-900">Файли книжок (PDF)</h1>
        <p className="mt-1 text-ink-soft">Ці файли покупці автоматично отримують на пошту після оплати. Завантажено: <strong>{done} з {list.length}</strong>. Комплекту окремий файл не потрібен — покупець отримує всі 5 книжок обраною мовою.</p>
      </section>
      <BookFilesUpload rows={list} />
    </div>
  );
}
