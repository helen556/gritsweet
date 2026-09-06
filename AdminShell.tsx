"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";

const items = [
  { href: "/admin", label: "Огляд", icon: "M3 12l9-8 9 8v8a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/admin/orders", label: "Заявки", icon: "M5 4h14v16H5zM9 9h6M9 13h6" },
  { href: "/admin/calendar", label: "Календар", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { href: "/admin/catalog", label: "Каталог", icon: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v7H4zM13 14h7v7h-7z" },
  { href: "/admin/photos", label: "Фото", icon: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15 9h.01" },
  { href: "/admin/reviews", label: "Відгуки", icon: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5" },
  { href: "/admin/settings", label: "Тексти", icon: "M4 6h16M4 12h10M4 18h16" },
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const path = usePathname();
  const active = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  return (
    <div className="min-h-dvh bg-milk text-ink">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/admin" className="display text-xl">Grid Sweet Life · адмінка</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{email}</span>
            <Link href="/" className="underline">Сайт</Link>
            <form action={logout}><button className="underline">Вийти</button></form>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 md:flex" aria-label="Розділи">
          {items.map((i) => <Link key={i.href} href={i.href} className={`rounded-full px-4 py-2 text-sm font-semibold ${active(i.href) ? "bg-choco text-cream" : "hover:bg-ink/5"}`}>{i.label}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-ink/10 bg-cream md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Розділи">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold ${active(i.href) ? "text-cherry" : "text-ink/70"}`} aria-current={active(i.href) ? "page" : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={i.icon} /></svg>{i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
