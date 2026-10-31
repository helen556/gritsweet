import { requireAdmin } from "@/lib/auth";
import { bookFileRows } from "@/lib/book-files";
import BookFilesUpload from "@/components/admin/BookFilesUpload";

export const metadata = { title: "Файли книжок" };

/** PDF усіх книжок на одній сторінці: одна кнопка для всіх файлів або окремо для кожної мовної версії. */
export default async function BookFiles() {
  await requireAdmin("owner");
  const list = await bookFileRows();
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
