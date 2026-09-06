import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { deletePhoto, updatePhoto, uploadPhoto } from "../actions";

export default async function PhotosPage() {
  await requireAdmin();
  const photos = await db.selectFrom("photos").selectAll().orderBy("in_gallery", "desc").orderBy("sort_order").orderBy("created_at", "desc").execute();
  return (
    <div>
      <h1 className="text-3xl">Фото</h1>
      <p className="mt-1 text-sm text-muted">Фото можна обрати для позиції або категорії в «Каталозі», для блоку «Про мене» — у «Текстах». Позначка «У галереї» показує фото в блоці «Мої роботи» на головній. JPG/PNG/WebP/HEIC до 5 МБ; файл перекодовується у WebP.</p>
      <ActionForm action={uploadPhoto} submitLabel="Завантажити" className="card mt-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Файл<input type="file" name="file" accept="image/*" required className="field mt-1" /></label>
          <label>Підпис (для каталогу й доступності)<input name="alt" className="field mt-1" placeholder="напр. Торт Рафаело" /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="in_gallery" className="h-5 w-5 accent-cherry" />Показати в галереї «Мої роботи»</label>
        </div>
      </ActionForm>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id} className="card flex flex-col">
            <img src={p.path} alt={p.alt} className="aspect-square w-full object-cover" />
            <div className="grid gap-2 p-2 text-xs">
              <ActionForm action={updatePhoto} hiddens={{ id: p.id }} submitLabel="Зберегти" submitClass="chip !min-h-8 !text-xs" inline>
                <input name="alt" defaultValue={p.alt} className="field mb-1 !min-h-9 !text-xs" placeholder="підпис" />
                <input name="sort_order" defaultValue={p.sort_order} className="field mb-1 !min-h-9 !text-xs" inputMode="numeric" aria-label="порядок у галереї" />
              </ActionForm>
              <div className="flex flex-wrap gap-1">
                <ActionForm action={updatePhoto} hiddens={{ id: p.id, in_gallery_set: p.in_gallery ? "0" : "1" }} submitLabel={p.in_gallery ? "Прибрати з галереї" : "У галерею"} submitClass={`chip !min-h-8 !text-xs ${p.in_gallery ? "" : ""}`} inline />
                <ActionForm action={deletePhoto} hiddens={{ id: p.id }} submitLabel="Видалити" submitClass="chip !min-h-8 !text-xs text-cherry" inline confirm="Видалити фото назавжди?" />
              </div>
              <code className="truncate text-muted">{p.path}</code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
