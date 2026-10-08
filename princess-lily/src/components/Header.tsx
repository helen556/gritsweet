"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCart } from "./cart/CartProvider";
import type { Dict } from "@/i18n";

/** Перемикач мови зберігає поточну сторінку та параметри. */
function switchHref(pathname: string, search: string, to: "uk" | "en") {
  const rest = pathname.replace(/^\/(uk|en)(?=\/|$)/, "");
  return `/${to}${rest}${search ? `?${search}` : ""}`;
}

const noopSubscribe = () => () => {};

export default function Header({ lang, t }: { lang: "uk" | "en"; t: Pick<Dict, "nav" | "brand"> }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { count, ready: cartReady } = useCart();
  // Header гідратується пізніше (Suspense) — бейдж лише після монтування, щоб не було розбіжності з SSR
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const ready = cartReady && mounted;
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- закрити меню при навігації
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { href: `/${lang}/books`, label: t.nav.books },
    { href: `/${lang}/about`, label: t.nav.about },
    { href: `/${lang}#faq`, label: t.nav.faq },
    { href: `/${lang}/contacts`, label: t.nav.contacts },
  ];
  const search = sp.toString();
  const isActive = (href: string) => !href.includes("#") && pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-milk/80 backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-milk">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href={`/${lang}`} className="mr-auto flex min-h-11 items-center font-display text-xl font-semibold text-moss-900 sm:text-2xl">
          {t.brand.name}
        </Link>
        <nav aria-label={t.nav.menu} className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
              className="rounded-full px-3 py-2 text-[0.95rem] font-medium text-ink-soft transition-colors hover:bg-moss-100 hover:text-moss-900 aria-[current=page]:text-moss-900 aria-[current=page]:underline aria-[current=page]:decoration-gold aria-[current=page]:underline-offset-8">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center rounded-full border border-black/10 bg-paper/70 p-0.5 text-sm" role="group" aria-label={t.nav.language}>
          {(["uk", "en"] as const).map((l) => (
            <Link key={l} href={switchHref(pathname, search, l)} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined}
              className="grid min-h-10 min-w-10 place-items-center rounded-full px-2 font-semibold uppercase text-ink-soft transition-colors aria-[current=true]:bg-moss-700 aria-[current=true]:text-paper">
              {l === "uk" ? "UA" : "EN"}
            </Link>
          ))}
        </div>
        <Link href={`/${lang}/cart`} className="btn btn-ghost btn-sm !px-3" aria-label={`${t.nav.cart}${ready && count ? `: ${count}` : ""}`}>
          <svg aria-hidden="true" className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
          <span className="hidden sm:inline">{t.nav.cart}</span>
          {ready && count > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-rose px-1.5 text-xs font-bold text-paper">{count}</span>}
        </Link>
        <button ref={btnRef} type="button" className="btn btn-ghost btn-sm !px-3 md:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? t.nav.close : t.nav.menu}</span>
          <svg aria-hidden="true" className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
      </div>
      <div id="mobile-nav" ref={panelRef} hidden={!open} className="border-t border-black/5 bg-milk md:hidden">
        <nav aria-label={t.nav.menu} className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl px-3 text-lg font-medium hover:bg-moss-100">{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
