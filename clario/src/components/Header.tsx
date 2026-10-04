"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/content/dictionaries";
import { BookButton } from "@/components/booking/BookingProvider";
import { EyeMark } from "@/components/Icon";
import { btn } from "@/components/ui";

type Props = { t: Pick<Dictionary, "nav" | "ui" | "cta">; lang: Locale };

const EASE = [0.16, 1, 0.3, 1] as const;

export function Brand({ light, label, href }: { light: boolean; label: string; href: string }) {
  return (
    <Link href={href} aria-label={label} className={`flex items-center gap-3 transition-colors duration-500 ${light ? "text-white" : "text-graphite-800"}`}>
      <EyeMark className="w-9 lg:w-10" />
      <span className="flex flex-col leading-none">
        <span className="text-[1.15rem] font-semibold tracking-[0.01em]">Clario</span>
        <span className={`mt-1 text-[0.6rem] font-medium whitespace-nowrap uppercase tracking-[0.24em] transition-colors duration-500 ${light ? "text-white/70" : "text-cold-500"}`}>Vision Clinic</span>
      </span>
    </Link>
  );
}

function LangSwitch({ lang, light, label }: { lang: Locale; light: boolean; label: string }) {
  const items: { code: Locale; label: string; href: string }[] = [
    { code: "uk", label: "UA", href: "/" },
    { code: "en", label: "EN", href: "/en" },
  ];
  return (
    <nav aria-label={label} className={`flex rounded-full border p-[3px] transition-colors duration-500 ${light ? "border-white/30" : "border-graphite-800/12"}`}>
      {items.map((i) => {
        const active = i.code === lang;
        return (
          <Link
            key={i.code}
            href={i.href}
            hrefLang={i.code}
            lang={i.code}
            aria-current={active ? "true" : undefined}
            className={`grid h-8 min-w-10 place-items-center rounded-full px-2.5 text-[0.72rem] font-semibold tracking-[0.1em] transition-colors duration-500 ${
              active ? (light ? "bg-white text-graphite-900" : "bg-graphite-800 text-white") : light ? "text-white/75 hover:text-white" : "text-graphite-600 hover:text-graphite-900"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Header({ t, lang }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const light = !scrolled && !menu;
  const home = lang === "uk" ? "/" : "/en";

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4"
    >
      <div
        className={`mx-auto flex h-16 max-w-[1320px] items-center gap-2 rounded-full pr-2 pl-5 sm:gap-4 transition-[background-color,box-shadow,border-color] duration-700 sm:pl-6 lg:h-[4.5rem] ${
          light ? "border border-transparent" : "glass shadow-[var(--shadow-soft)]"
        }`}
      >
        <div className="mr-auto">
          <Brand light={light} label={t.ui.home} href={home} />
        </div>

        <nav aria-label={t.ui.primaryNav} className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {t.nav.map((n) => (
              <li key={n.href}>
                <a
                  href={`${home}${n.href}`}
                  className={`group relative rounded-full px-3.5 py-2 text-[0.88rem] font-medium transition-colors duration-500 ${light ? "text-white/85 hover:text-white" : "text-graphite-700 hover:text-graphite-900"}`}
                >
                  {n.label}
                  <span className="absolute inset-x-3.5 bottom-1 h-px origin-left scale-x-0 bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <LangSwitch lang={lang} light={light} label={t.ui.language} />

        <div className="hidden sm:block">
          <BookButton className={`${light ? btn.primaryLight : btn.primary} min-h-11 px-6 text-[0.88rem]`}>{t.cta.primary}</BookButton>
        </div>

        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-controls="mobile-menu"
          className={`grid size-11 place-items-center rounded-full transition-colors duration-500 xl:hidden ${light ? "text-white" : "text-graphite-800"}`}
        >
          <span className="sr-only">{menu ? t.ui.close : t.ui.menu}</span>
          <span className="relative block h-3 w-5" aria-hidden="true">
            <span className={`absolute left-0 h-[1.5px] w-full rounded bg-current transition-transform duration-500 ${menu ? "top-1/2 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-[1.5px] w-full rounded bg-current transition-transform duration-500 ${menu ? "top-1/2 -rotate-45" : "bottom-0"}`} />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {menu && (
          <motion.div
            id="mobile-menu"
            className="mx-auto mt-2 max-w-[1320px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 backdrop-blur-2xl shadow-[var(--shadow-lift)] xl:hidden"
            initial={{ opacity: 0, y: -12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <nav aria-label={t.ui.primaryNav} className="px-6 pt-4 pb-6">
              <ul>
                {t.nav.map((n, i) => (
                  <motion.li key={n.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i + 0.1, duration: 0.5, ease: EASE }}>
                    <a href={`${home}${n.href}`} onClick={() => setMenu(false)} className="flex items-center justify-between border-b border-graphite-800/8 py-4 text-[1.15rem] font-light">
                      {n.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
              <BookButton onClick={() => setMenu(false)} className={`${btn.primary} mt-6 h-14 w-full`}>
                {t.cta.primary}
              </BookButton>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
