import Link from "next/link";
import { db } from "@/db";
import NewBookForm from "@/components/admin/NewBookForm";
import { quickProductAction } from "../../actions";

export const metadata = { title: "Товари" };
const ST: Record<string, string> = { draft: "Прихована", coming_soon: "«Незабаром»", published: "Опублікована" };

export default async function Products() {
  const rows = await db.selectFrom("products as p").leftJoin("product_translations as t", (j) => j.onRef("t.product_id", "=", "p.id").on("t.locale", "=", "uk"))
    .select(["p.id", "p.slug", "p.status", "p.sort_order", "p.cover_base", "t.title", "t.cover_base as uk_cover"]).orderBy("p.sort_order").execute();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-moss-900 sm:text-3xl">Товари</h1>
      <ul className="divide-y divide-black/8 rounded-2xl border border-black/6 bg-paper">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-2 p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:p-4">
            <span className="flex items-center gap-2 sm:mr-auto">
              <Link href={`/admin/products/${r.id}`} className="font-semibold underline">{r.title ?? r.slug}</Link>
              {!r.cover_base && !r.uk_cover && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs">без обкладинки</span>}
            </span>
            <form action={quickProductAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="sort_order" defaultValue={r.sort_order} inputMode="numeric" aria-label="Порядок показу" title="Порядок показу" className="input !min-h-10 !w-14 !px-2 !py-1 text-center" />
              <select name="status" defaultValue={r.status} className="input !min-h-10 !w-auto min-w-0 flex-1 !py-1" aria-label="Статус">
                {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm">Зберегти</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="card p-4 sm:p-5">
        <h2 className="text-xl sm:text-2xl">Додати книжку</h2>
        <p className="mt-1 text-sm text-ink-soft">Книжка створюється прихованою. Потім на її сторінці додайте ціни, опис і PDF та поставте статус «Опублікована».</p>
        <NewBookForm />
      </section>
    </div>
  );
}
