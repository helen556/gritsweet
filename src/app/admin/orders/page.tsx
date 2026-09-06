import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ALL_STATUSES, STATUS_LABELS, listOrders, withSnap } from "@/lib/orders";
import type { OrderStatus } from "@/db/types";
import { formatUaPhone } from "@/lib/phone";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; from?: string; to?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (ALL_STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : "ALL";
  const orders = (await listOrders({ status, from: sp.from, to: sp.to })).map(withSnap);
  return (
    <div>
      <h1 className="text-3xl">Заявки</h1>
      <form className="mt-4 grid gap-3 rounded-2xl bg-cream p-4 sm:grid-cols-4">
        <label>Статус<select name="status" defaultValue={status} className="field mt-1"><option value="ALL">Усі</option>{ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <label>Дата від<input type="date" name="from" defaultValue={sp.from} className="field mt-1" /></label>
        <label>Дата до<input type="date" name="to" defaultValue={sp.to} className="field mt-1" /></label>
        <div className="flex items-end gap-2"><button className="btn btn-cherry">Фільтрувати</button><Link href="/admin/orders" className="btn btn-outline">Скинути</Link></div>
      </form>
      {orders.length === 0 ? <p className="mt-6 text-muted">Заявок за цим фільтром немає.</p> : (
        <ul className="mt-4 grid gap-2">{orders.map((o) => (
          <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="card flex items-center justify-between gap-3 p-4">
            <span>
              <span className="font-semibold">{o.customer_name}</span> · {formatUaPhone(o.phone)}
              <span className="block text-sm">{o.snap.categoryName}: {o.snap.productName}, {o.snap.qtyLabel}{o.snap.filling ? `, ${o.snap.filling}` : ""}</span>
              <span className="block text-sm text-muted">на {o.desired_date} · {o.snap.estimateLabel} · подано {o.created_at.slice(0, 10)}</span>
            </span>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${o.status === "NEW" ? "bg-cherry text-white" : "bg-milk"}`}>{STATUS_LABELS[o.status]}</span>
          </Link></li>))}
        </ul>)}
    </div>
  );
}
