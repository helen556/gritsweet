"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Dictionary, Locale, ServiceId } from "@/content/dictionaries";
import { BookingForm } from "./BookingForm";

type Ctx = { open: (service?: ServiceId) => void };
const BookingContext = createContext<Ctx>({ open: () => {} });
export const useBooking = () => useContext(BookingContext);

type Props = {
  children: ReactNode;
  t: Dictionary["booking"];
  services: Dictionary["services"]["items"];
  closeLabel: string;
  lang: Locale;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/** Provides `open()` to every CTA and renders the booking side panel. */
export function BookingProvider({ children, t, services, closeLabel, lang }: Props) {
  const [state, setState] = useState<{ open: boolean; service: ServiceId | ""; key: number; side: boolean }>({ open: false, service: "", key: 0, side: false });
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = useCallback((service?: ServiceId) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    const side = window.matchMedia("(min-width: 640px)").matches;
    setState((s) => ({ open: true, service: service ?? "", key: s.key + 1, side }));
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    if (!state.open) return;
    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    body.style.paddingRight = `${scrollbar}px`;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("input:not([tabindex='-1']), select, textarea")?.focus(), 350);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = [...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([tabindex='-1']), select, textarea")];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      body.style.overflow = "";
      body.style.paddingRight = "";
      document.removeEventListener("keydown", onKey);
      returnFocus.current?.focus?.();
    };
  }, [state.open, close]);

  return (
    <BookingContext.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {state.open && (
          <div className="fixed inset-0 z-[80]" key="booking">
            <motion.div
              className="absolute inset-0 bg-graphite-950/45 backdrop-blur-[6px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              onClick={close}
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-panel-title"
              className="absolute inset-x-0 bottom-0 flex max-h-[94svh] flex-col overflow-hidden rounded-t-[2rem] bg-white/90 shadow-[0_-30px_80px_-20px_rgb(0_0_0/0.45)] backdrop-blur-2xl sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:w-[min(520px,calc(100vw-1.5rem))] sm:rounded-[2rem]"
              initial={state.side ? { opacity: 0, x: 64 } : { opacity: 0, y: 64 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={state.side ? { opacity: 0, x: 64 } : { opacity: 0, y: 64 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-ice-200/60 blur-3xl" aria-hidden="true" />
              <div className="relative flex items-center justify-between px-6 pt-6 sm:px-9 sm:pt-9">
                <h2 id="booking-panel-title" className="text-[1.9rem] font-light leading-tight">{t.panelTitle}</h2>
                <button
                  type="button"
                  onClick={close}
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-graphite-800/10 bg-white/70 text-graphite-800 transition-[transform,background-color,box-shadow] duration-500 hover:rotate-90 hover:bg-white hover:shadow-[var(--shadow-glow)]"
                >
                  <span className="sr-only">{closeLabel}</span>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <div className="relative overflow-y-auto overscroll-contain px-6 pt-6 pb-8 sm:px-9 sm:pb-9">
                <BookingForm key={state.key} t={t} services={services} lang={lang} initialService={state.service} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </BookingContext.Provider>
  );
}

/** Any button that opens the booking panel, optionally with a preselected service. */
export function BookButton({ service, className, children, onClick }: { service?: ServiceId; className?: string; children: ReactNode; onClick?: () => void }) {
  const { open } = useBooking();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onClick?.();
        open(service);
      }}
      aria-haspopup="dialog"
    >
      {children}
    </button>
  );
}
