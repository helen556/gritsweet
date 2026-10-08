import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../auth-actions";
import { effectivePaymentMode } from "@/lib/orders";
import { emailConfig } from "@/lib/config";

export default async function Panel({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [mode, email] = [await effectivePaymentMode(), emailConfig().provider];
  const nav = [["/admin", "Огляд"], ["/admin/orders", "Замовлення"], ["/admin/products", "Товари"], ["/admin/messages", "Звернення"], ...(admin.role === "owner" ? [["/admin/settings", "Налаштування"], ["/admin/log", "Журнал"]] : [])];
  return (
    <div className="pb-24 md:pb-0">
      <header className="border-b border-black/5 bg-paper/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin" className="mr-auto font-display text-xl font-semibold text-moss-900">Адмінка · Лілі</Link>
          <span className="text-sm text-ink-soft">{admin.email} ({admin.role === "owner" ? "власниця" : "персонал"})</span>
          <Link href="/uk" className="btn btn-ghost btn-sm" target="_blank">Сайт ↗</Link>
          <form action={logoutAction}><button className="btn btn-ghost btn-sm">Вийти</button></form>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 text-sm">
          <span className={`mr-2 inline-flex rounded-full px-3 py-1 ${mode === "disabled" ? "bg-rose-100" : "bg-moss-100"}`}>Оплата: {mode === "disabled" ? "не налаштовано" : mode === "manual_link" ? "посилання + ручна перевірка" : "провайдер (вебхук)"}</span>
          <span className={`inline-flex rounded-full px-3 py-1 ${email === "none" ? "bg-rose-100" : "bg-moss-100"}`}>Email: {email === "none" ? "не налаштовано" : email}</span>
        </div>
      </header>
      <nav aria-label="Розділи" className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-paper/95 backdrop-blur md:static md:border-0 md:bg-transparent">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 md:px-4">
          {nav.map(([h, l]) => <li key={h}><Link href={h} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-medium hover:bg-moss-100">{l}</Link></li>)}
        </ul>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
