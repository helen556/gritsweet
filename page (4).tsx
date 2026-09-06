import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { deleteReview, moveReview, saveReview, setReviewPublished, uploadReview } from "../actions";

export default async function ReviewsAdmin() {
  await requireAdmin();
  const reviews = await db.selectFrom("reviews").selectAll().orderBy("sort_order").orderBy("created_at").execute();
  return (
    <div>
      <h1 className="text-3xl">Відгуки</h1>
      <p className="mt-1 text-sm text-muted">Нові скриншоти зберігаються як чернетки в приватному сховищі. Перед публікацією приховайте імена, нікнейми й аватарки в самому файлі (або завантажте вже анонімізовану копію) та позначте перевірку дозволу.</p>
      <ActionForm action={uploadReview} submitLabel="Завантажити як чернетку" className="card mt-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Скриншот відгуку<input type="file" name="file" accept="image/*" required className="field mt-1" /></label>
          <label>Короткий опис зображення (для доступності)<input name="alt" className="field mt-1" placeholder="напр. Скриншот відгуку: торт до дня народження, подяка за смак" /></label>
        </div>
      </ActionForm>
      <ul className="mt-5 grid gap-4">
        {reviews.map((r, i) => (
          <li key={r.id} className={`card grid gap-4 p-4 sm:grid-cols-[140px_1fr] ${r.is_published ? "" : "opacity-90"}`}>
            <a href={`/admin/review-image/${r.private_path}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl bg-milk"><img src={`/admin/review-image/${r.private_path}`} alt={r.alt || "Відгук"} className="h-auto w-full" style={{ aspectRatio: `${r.width} / ${r.height}` }} /></a>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${r.is_published ? "bg-choco text-cream" : "bg-milk"}`}>{r.is_published ? "Опубліковано" : "Чернетка"}</span>
                <span className="text-xs text-muted">#{i + 1}</span>
                <ActionForm action={moveReview} hiddens={{ id: r.id, dir: "up" }} submitLabel="↑" submitClass="chip !min-h-9" inline />
                <ActionForm action={moveReview} hiddens={{ id: r.id, dir: "down" }} submitLabel="↓" submitClass="chip !min-h-9" inline />
                {r.is_published
                  ? <ActionForm action={setReviewPublished} hiddens={{ id: r.id, value: "0" }} submitLabel="Приховати" submitClass="chip !min-h-9" inline />
                  : <ActionForm action={setReviewPublished} hiddens={{ id: r.id, value: "1" }} submitLabel="Опублікувати" submitClass="chip !min-h-9" inline />}
                <ActionForm action={deleteReview} hiddens={{ id: r.id }} submitLabel="Видалити" submitClass="chip !min-h-9 text-cherry" inline confirm="Видалити цей відгук назавжди? Файл буде стерто." />
              </div>
              <ActionForm action={saveReview} hiddens={{ id: r.id, sort_order: String(r.sort_order) }} submitLabel="Зберегти" submitClass="btn btn-outline !min-h-10" className="mt-3">
                <label className="block text-sm">Короткий опис<input name="alt" defaultValue={r.alt} className="field mt-1" /></label>
                <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" name="consent_checked" defaultChecked={!!r.consent_checked} className="mt-1 h-5 w-5 accent-cherry" /><span>Дозвіл на публікацію перевірено, імена/аватарки приховані в самому файлі</span></label>
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
