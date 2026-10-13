import Link from "next/link";
import { db } from "@/db";
import ActionForm from "@/components/admin/ActionForm";
import { createProductAction, quickProductAction } from "../../actions";

export const metadata = { title: "Товари" };
const ST: Record<string, string> = { draft: "Приховано (чернетка)", coming_soon: "Показано, без продажу («Незабаром»)", published: "Опубліковано (продається, якщо є ціна)" };

export default async function Products() {
  const rows = await db.selectFrom("products as p").leftJoin("product_translations as t", (j) => j.onRef("t.product_id", "=", "p.id").on("t.locale", "=", "uk"))
    .select(["p.id", "p.slug", "p.status", "p.sort_order", "p.cover_base", "t.title", "t.cover_base as uk_cover"]).orderBy("p.sort_order").execute();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl text-moss-900">Товари</h1>
      <ul className="divide-y divide-black/8 rounded-2xl border border-black/6 bg-paper">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <Link href={`/admin/products/${r.id}`} className="mr-auto font-semibold underline">{r.title ?? r.slug}</Link>
            {!r.cover_base && !r.uk_cover && <span className="rounded-full bg-rose-100 px-3 py-1 text-sm">немає обкладинки</span>}
            <form action={quickProductAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label className="text-sm" htmlFor={`o-${r.id}`}>Порядок</label>
              <input id={`o-${r.id}`} name="sort_order" defaultValue={r.sort_order} inputMode="numeric" className="input !min-h-10 !w-16 !py-1" />
              <select name="status" defaultValue={r.status} className="input !min-h-10 !w-auto !py-1" aria-label="Статус">
                {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm">Зберегти</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="card p-5">
        <h2 className="text-2xl">Додати книжку</h2>
        <p className="mt-1 text-sm text-ink-soft">Створюється прихована чернетка з варіантами UA/EN × PDF/друк. Далі: обкладинки, описи, ціни, наявність, файли PDF → статус «Опубліковано». Каталог на сайті підлаштовується під будь-яку кількість книжок.</p>
        <ActionForm action={createProductAction} submit="Створити чернетку" className="mt-3 grid gap-3 sm:max-w-md">
          <div className="field"><label htmlFor="np-title">Назва (укр.)</label><input id="np-title" name="title" required className="input" /></div>
          <div className="field"><label htmlFor="np-title-en">Назва англійською (якщо вже є)</label><input id="np-title-en" name="title_en" className="input" /></div>
          <div className="field"><label htmlFor="np-slug">Адреса сторінки (slug, латиницею)</label><input id="np-slug" name="slug" required pattern="[a-z0-9-]+" placeholder="yak-lili-..." className="input" /></div>
        </ActionForm>
      </section>
    </div>
  );
}
