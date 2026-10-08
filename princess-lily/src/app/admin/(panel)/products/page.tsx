import Link from "next/link";
import { db } from "@/db";
import ActionForm from "@/components/admin/ActionForm";
import { createProductAction } from "../../actions";

export const metadata = { title: "Товари" };
const ST: Record<string, string> = { draft: "Чернетка (прихована)", coming_soon: "Незабаром (видно, не продається)", published: "Опубліковано" };

export default async function Products() {
  const rows = await db.selectFrom("products as p").leftJoin("product_translations as t", (j) => j.onRef("t.product_id", "=", "p.id").on("t.locale", "=", "uk"))
    .select(["p.id", "p.slug", "p.status", "t.title"]).orderBy("p.sort_order").execute();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl text-moss-900">Товари</h1>
      <ul className="divide-y divide-black/8 rounded-2xl border border-black/6 bg-paper">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <Link href={`/admin/products/${r.id}`} className="mr-auto font-semibold underline">{r.title ?? r.slug}</Link>
            <span className="rounded-full bg-cream px-3 py-1 text-sm">{ST[r.status]}</span>
          </li>
        ))}
      </ul>
      <section className="card p-5">
        <h2 className="text-2xl">Додати книжку</h2>
        <ActionForm action={createProductAction} submit="Створити чернетку" className="mt-3 grid gap-3 sm:max-w-md">
          <div className="field"><label htmlFor="np-title">Назва (укр.)</label><input id="np-title" name="title" required className="input" /></div>
          <div className="field"><label htmlFor="np-slug">Адреса сторінки (slug, латиницею)</label><input id="np-slug" name="slug" required pattern="[a-z0-9-]+" placeholder="yak-lili-..." className="input" /></div>
        </ActionForm>
      </section>
    </div>
  );
}
