import Link from "next/link";
import { db } from "@/db";
import { formatMinor } from "@/lib/money";

export const metadata = { title: "Замовлення" };
const PS: Record<string, string> = { pending_payment: "Очікує оплату", pending_verification: "Перевірити оплату", paid: "Оплачено", failed: "Неуспішно", cancelled: "Скасовано" };

export default async function Orders({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const st = typeof sp.status === "string" && sp.status in PS ? sp.status : "";
  let query = db.selectFrom("orders").select(["id", "number", "email", "name", "payment_status", "total_minor", "shipping_required", "created_at"]).orderBy("created_at", "desc").limit(100);
  if (q) query = query.where((eb) => eb.or([eb("number", "like", `%${q}%`), eb("email", "like", `%${q.toLowerCase()}%`), eb("name", "like", `%${q}%`), eb("phone", "like", `%${q}%`)]));
  if (st) query = query.where("payment_status", "=", st as never);
  const rows = await query.execute();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-moss-900">Замовлення</h1>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="field"><label htmlFor="q">Пошук: номер, email, ім’я, телефон</label><input id="q" name="q" defaultValue={q} className="input sm:w-80" /></div>
        <div className="field"><label htmlFor="status">Оплата</label><select id="status" name="status" defaultValue={st} className="input"><option value="">Усі</option>{Object.entries(PS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn btn-ghost">Знайти</button>
      </form>
      <ul className="divide-y divide-black/8 rounded-2xl border border-black/6 bg-paper">
        {rows.map((o) => (
          <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="grid gap-1 p-4 hover:bg-moss-100/40 sm:grid-cols-[9rem_1fr_9rem_10rem] sm:items-center">
            <span className="font-semibold">{o.number}</span>
            <span className="truncate text-ink-soft">{o.name} · {o.email}{o.shipping_required ? " · 📦" : ""}</span>
            <span>{formatMinor(o.total_minor, "uk")}</span>
            <span className={`justify-self-start rounded-full px-3 py-1 text-sm ${o.payment_status === "paid" ? "bg-moss-100" : o.payment_status === "pending_verification" ? "bg-gold/40" : "bg-cream"}`}>{PS[o.payment_status]}</span>
          </Link></li>
        ))}
        {!rows.length && <li className="p-4 text-ink-soft">Немає замовлень</li>}
      </ul>
    </div>
  );
}
