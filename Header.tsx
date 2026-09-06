"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const nav = [
  { href: "/#kataloh", label: "Десерти" },
  { href: "/#kvity", label: "Зефірні квіти" },
  { href: "/#roboty", label: "Роботи" },
  { href: "/#pro-mene", label: "Про мене" },
  { href: "/#umovy", label: "Умови" },
  { href: "/#kontakty", label: "Контакти" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled || open ? "bg-cocoa/90 backdrop-blur-md" : "bg-transparent"}`}>
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="display text-2xl tracking-wide text-cream" onClick={() => setOpen(false)}>Grid Sweet Life</Link>
        <nav aria-label="Основна навігація" className="hidden items-center gap-7 md:flex">
          {nav.map((n) => <Link key={n.href} href={n.href} className="text-sm text-cream/85 hover:text-cream">{n.label}</Link>)}
          <Link href="/#zamovlennia" className="btn btn-cherry !min-h-10 !py-2">Замовити</Link>
        </nav>
        <button type="button" className="md:hidden flex h-11 w-11 items-center justify-center rounded-full text-cream" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Закрити меню" : "Відкрити меню"} onClick={() => setOpen((v) => !v)}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M4 4l14 14M18 4L4 18" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Мобільна навігація" className="md:hidden border-t border-cream/10 bg-cocoa/95 px-5 pb-6 pt-2">
          {nav.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-3 text-lg text-cream/90">{n.label}</Link>)}
          <Link href="/#zamovlennia" onClick={() => setOpen(false)} className="btn btn-cherry mt-3 w-full">Замовити</Link>
        </nav>
      )}
    </header>
  );
}
