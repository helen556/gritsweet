import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductForAdmin } from "@/lib/catalog";
import { minorToInput } from "@/lib/money";
import ActionForm from "@/components/admin/ActionForm";
import UploadForm from "@/components/admin/UploadForm";
import { saveProductAction, saveVariantAction, removePdfAction, deleteImageAction } from "../../../actions";

export const metadata = { title: "Редагування товару" };
const REASON: Record<string, string> = { not_published: "товар не опубліковано", inactive: "варіант вимкнено", no_price: "немає ціни", no_file: "не завантажено PDF", out_of_stock: "немає залишку" };

export default async function EditProduct({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const p = await getProductForAdmin(id);
  if (!p) notFound();
  const tr = (l: "uk" | "en") => p.translations.find((t) => t.locale === l);
  return (
    <div className="space-y-8">
      <Link href="/admin/products" className="underline">← Товари</Link>
      <section className="card p-5 sm:p-6">
        <h1 className="text-3xl text-plum-900">{tr("uk")?.title}</h1>
        <ActionForm action={saveProductAction} submit="Зберегти товар" className="mt-4 space-y-5">
          <input type="hidden" name="id" value={p.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="field"><label htmlFor="status">Статус</label>
              <select id="status" name="status" defaultValue={p.status} className="input">
                <option value="draft">Чернетка (не видно на сайті)</option><option value="coming_soon">Незабаром (видно, не продається)</option><option value="published">Опубліковано</option>
              </select></div>
            <div className="field"><label htmlFor="slug">Адреса (slug)</label><input id="slug" name="slug" defaultValue={p.slug} className="input" /></div>
            <div className="field"><label htmlFor="sort_order">Порядок</label><input id="sort_order" name="sort_order" inputMode="numeric" defaultValue={p.sort_order} className="input" /></div>
            <div className="field"><label htmlFor="age_from">Вік від</label><input id="age_from" name="age_from" inputMode="numeric" defaultValue={p.age_from ?? ""} className="input" /></div>
            <div className="field"><label htmlFor="age_to">Вік до</label><input id="age_to" name="age_to" inputMode="numeric" defaultValue={p.age_to ?? ""} className="input" /></div>
            <div className="field"><label htmlFor="pages">Сторінок (якщо надано)</label><input id="pages" name="pages" inputMode="numeric" defaultValue={p.pages ?? ""} className="input" /></div>
            <div className="field"><label htmlFor="size_label">Розмір (якщо надано)</label><input id="size_label" name="size_label" defaultValue={p.size_label ?? ""} className="input" /></div>
            <div className="field"><label htmlFor="binding_label">Обкладинка/папір (якщо надано)</label><input id="binding_label" name="binding_label" defaultValue={p.binding_label ?? ""} className="input" /></div>
          </div>
          {(["uk", "en"] as const).map((l) => (
            <fieldset key={l} className="rounded-2xl border border-black/10 p-4">
              <legend className="px-2 font-semibold">{l === "uk" ? "Українська" : "English"} — текст сторінки</legend>
              <div className="grid gap-4">
                <div className="field"><label htmlFor={`${l}_title`}>Назва</label><input id={`${l}_title`} name={`${l}_title`} defaultValue={tr(l)?.title ?? ""} className="input" /></div>
                <div className="field"><label htmlFor={`${l}_description`}>Опис (абзаци через порожній рядок)</label><textarea id={`${l}_description`} name={`${l}_description`} rows={6} defaultValue={tr(l)?.description ?? ""} className="input" /></div>
                <div className="field"><label htmlFor={`${l}_cover_alt`}>Alt-текст обкладинки</label><input id={`${l}_cover_alt`} name={`${l}_cover_alt`} defaultValue={tr(l)?.cover_alt ?? ""} className="input" /></div>
                <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name={`${l}_confirmed`} defaultChecked={!!tr(l)?.is_confirmed} className="h-5 w-5" /> Переклад погоджено (інакше на сайті буде позначка про оригінальну назву)</label>
              </div>
            </fieldset>
          ))}
        </ActionForm>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Обкладинки мовних версій</h2>
        <p className="mt-1 text-sm text-ink-soft">Для кожної мови — своя обкладинка (UA і EN). Якщо для мови немає окремої, показується загальна. Назву на обкладинці не обрізаємо.</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {([["", "Загальна"], ["uk", "Українська версія"], ["en", "Англійська версія"]] as const).map(([loc, label]) => {
            const c = loc ? p.translations.find((t) => t.locale === loc) : null;
            const base = loc ? c?.cover_base : p.cover_base;
            const w = loc ? JSON.parse(c?.cover_widths ?? "[]")[0] : p.widths[0];
            return (
              <div key={loc || "all"} className="rounded-2xl border border-black/10 p-3">
                <p className="font-semibold">{label}</p>
                {base && w ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${base}-${w}.webp`} alt="" className="mt-2 aspect-square w-full rounded-xl bg-cream object-contain" />
                ) : <p className="mt-2 grid aspect-square place-items-center rounded-xl bg-cream text-sm text-ink-soft">немає</p>}
                <UploadForm kind="cover" targetId={p.id} extra={{ locale: loc }} accept="image/jpeg,image/png,image/webp" label="JPG/PNG/WebP, до 10 МБ" />
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Книжка зсередини (справжні розвороти)</h2>
        <p className="mt-1 text-sm text-ink-soft">Блок на сайті з’являється лише тоді, коли тут є хоча б один розворот. Не завантажуйте макети чи згенеровані картинки.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {p.images.map((im) => (
            <li key={im.id} className="rounded-xl border border-black/10 p-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${im.base}-${JSON.parse(im.widths)[0]}.webp`} alt="" className="aspect-[3/2] w-full rounded-lg bg-cream object-contain" />
              <p className="mt-1 text-ink-soft">{im.locale ? (im.locale === "uk" ? "UA" : "EN") : "UA+EN"} · {im.alt_uk || "без підпису"}</p>
              <form action={deleteImageAction}><input type="hidden" name="id" value={im.id} /><button className="btn btn-danger btn-sm mt-1">Видалити</button></form>
            </li>
          ))}
        </ul>
        <UploadForm kind="spread" targetId={p.id} accept="image/jpeg,image/png,image/webp" label="Додати розворот (для обох мов)" />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Варіанти (мова книжки × формат)</h2>
        <p className="mt-1 text-sm text-ink-soft">Продається лише варіант зі статусом товару «Опубліковано», увімкненим перемикачем, ціною &gt; 0, а також PDF-файлом (для PDF) або залишком (для друку). Порожня ціна = «Незабаром».</p>
        <div className="mt-4 space-y-4">
          {p.variants.map((v) => (
            <div key={v.id} className="rounded-2xl border border-black/10 p-4">
              <p className="font-semibold">{v.book_locale === "uk" ? "Українська" : "Англійська"} · {v.format === "pdf" ? "PDF" : "Друк"}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-sm ${v.sellable ? "bg-plum-100" : "bg-rose-100"}`}>{v.sellable ? "продається" : `не продається: ${REASON[v.reason!]}`}</span></p>
              <ActionForm action={saveVariantAction} submit="Зберегти варіант" className="mt-3 grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="id" value={v.id} /><input type="hidden" name="product_id" value={p.id} />
                <div className="field"><label htmlFor={`price-${v.id}`}>Ціна, грн</label><input id={`price-${v.id}`} name="price" inputMode="decimal" defaultValue={minorToInput(v.price_minor)} placeholder="порожньо = немає" className="input" /></div>
                {v.format === "print" && <div className="field"><label htmlFor={`stock-${v.id}`}>Залишок, шт</label><input id={`stock-${v.id}`} name="stock" inputMode="numeric" defaultValue={v.stock ?? ""} className="input" /></div>}
                <div className="field sm:col-span-2"><label htmlFor={`rn-${v.id}`}>Примітка про надходження</label><input id={`rn-${v.id}`} name="restock_note" defaultValue={v.restock_note ?? ""} className="input" /></div>
                <label className="flex min-h-11 items-center gap-2 sm:col-span-4"><input type="checkbox" name="is_active" defaultChecked={!!v.is_active} className="h-5 w-5" /> Увімкнено для продажу</label>
              </ActionForm>
              {v.format === "pdf" && (
                <div className="mt-3 border-t border-black/10 pt-3">
                  <p className="text-sm">PDF: {v.private_pdf_key ? <span className="font-semibold text-plum-700">завантажено (приватне сховище)</span> : <span className="text-copper">не завантажено</span>}</p>
                  <UploadForm kind="pdf" targetId={v.id} accept="application/pdf" label="Завантажити PDF (до 100 МБ)" />
                  {v.private_pdf_key && <form action={removePdfAction} className="mt-2"><input type="hidden" name="id" value={v.id} /><button className="btn btn-danger btn-sm">Видалити PDF</button></form>}
                </div>
              )}
            </div>
          ))}
        </div>
        <h3 className="mt-6 text-xl">Додати варіант</h3>
        <ActionForm action={saveVariantAction} submit="Додати варіант" className="mt-2 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="product_id" value={p.id} />
          <div className="field"><label htmlFor="nv-l">Мова книжки</label><select id="nv-l" name="book_locale" className="input"><option value="uk">Українська</option><option value="en">Англійська</option></select></div>
          <div className="field"><label htmlFor="nv-f">Формат</label><select id="nv-f" name="format" className="input"><option value="pdf">PDF</option><option value="print">Друк</option></select></div>
          <div className="field"><label htmlFor="nv-p">Ціна, грн</label><input id="nv-p" name="price" inputMode="decimal" className="input" /></div>
          <div className="field"><label htmlFor="nv-s">Залишок (друк)</label><input id="nv-s" name="stock" inputMode="numeric" className="input" /></div>
        </ActionForm>
      </section>
    </div>
  );
}
