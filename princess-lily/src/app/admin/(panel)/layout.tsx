import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../auth-actions";

export default async function Panel({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const nav = [["/admin", "Огляд"], ["/admin/orders", "Замовлення"], ["/admin/products", "Товари"], ["/admin/messages", "Звернення"], ...(admin.role === "owner" ? [["/admin/files", "Файли книжок"], ["/admin/settings", "Налаштування"], ["/admin/log", "Журнал"]] : [])];
  return (
    <div className="pb-24 md:pb-0">
      <header className="border-b border-black/5 bg-paper/80">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:gap-3 sm:py-3">
          <Link href="/admin" className="mr-auto font-display text-lg font-semibold text-plum-900 sm:text-xl">Адмінка · Лілі</Link>
          <span className="hidden text-sm text-ink-soft sm:inline">{admin.email}</span>
          <Link href="/uk" className="btn btn-ghost btn-sm" target="_blank">Сайт ↗</Link>
          <form action={logoutAction}><button className="btn btn-ghost btn-sm">Вийти</button></form>
        </div>
      </header>
      <nav aria-label="Розділи" className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-paper/95 backdrop-blur md:static md:border-0 md:bg-transparent">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 md:px-4">
          {nav.map(([h, l]) => <li key={h}><Link href={h} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-medium hover:bg-plum-100">{l}</Link></li>)}
        </ul>
      </nav>
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
