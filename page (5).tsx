import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { todayKyiv } from "@/lib/dates";
import { STATUS_LABELS, withSnap } from "@/lib/orders";
import { formatUaPhone } from "@/lib/phone";

export default async function Overview() {
  await requireAdmin();
  const today = todayKyiv();
  const newCount = await db.selectFrom("orders").select(({ fn }) => fn.countAll<number>().as("n")).where("status", "=", "NEW").executeTakeFirstOrThrow();
  const upcoming = (await db.selectFrom("orders").selectAll().where("desired_date", ">=", today).where("status", "in", ["CONFIRMED", "IN_PROGRESS"]).orderBy("desired_date").limit(8).execute()).map(withSnap);
  const latest = (await db.selectFrom("orders").selectAll().where("status", "in", ["NEW", "CLARIFYING"]).orderBy("created_at", "desc").limit(8).execute()).map(withSnap);
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">Огляд</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/admin/orders?status=NEW" className="card p-4"><span className="text-3xl font-semibold">{Number(newCount.n)}</span><span className="block text-sm text-muted">нових заявок</span></Link>
        <Link href="/admin/calendar" className="card p-4"><span className="text-3xl font-semibold">{upcoming.length}</span><span className="block text-sm text-muted">найближчих підтверджених</span></Link>
        <Link href="/admin/catalog" className="card p-4 flex items-center text-lg font-semibold">Каталог і ціни</Link>
        <Link href="/admin/settings" className="card p-4 flex items-center text-lg font-semibold">Тексти та налаштування</Link>
      </div>
      <section>
        <h2 className="text-2xl">Нові та в уточненні</h2>
        {latest.length === 0 ? <p className="mt-2 text-muted">Нових заявок немає.</p> : (
          <ul className="mt-3 grid gap-2">{latest.map((o) => (
            <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="card flex items-center justify-between gap-3 p-4">
              <span><span className="font-semibold">{o.customer_name}</span> · {o.snap.productName}, {o.snap.qtyLabel}<span className="block text-sm text-muted">на {o.desired_date} · {formatUaPhone(o.phone)}</span></span>
              <span className="rounded-full bg-milk px-3 py-1 text-xs font-semibold">{STATUS_LABELS[o.status]}</span>
            </Link></li>))}
          </ul>)}
      </section>
      <section>
        <h2 className="text-2xl">Найближчі підтверджені</h2>
        {upcoming.length === 0 ? <p className="mt-2 text-muted">Поки нічого не підтверджено.</p> : (
          <ul className="mt-3 grid gap-2">{upcoming.map((o) => (
            <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="card flex items-center justify-between gap-3 p-4">
              <span><span className="font-semibold">{o.desired_date}</span> · {o.customer_name} · {o.snap.productName}, {o.snap.qtyLabel}</span>
              <span className="rounded-full bg-milk px-3 py-1 text-xs font-semibold">{STATUS_LABELS[o.status]}</span>
            </Link></li>))}
          </ul>)}
      </section>
    </div>
  );
}
