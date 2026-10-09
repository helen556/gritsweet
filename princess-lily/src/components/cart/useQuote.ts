"use client";
import { useEffect, useState } from "react";
import { quoteAction } from "@/app/[lang]/actions";
import type { Quote } from "@/lib/quote";
import { useCart, type CartLine } from "./CartProvider";

/**
 * Серверний розрахунок. Для кошика — поточні рядки (недоступні прибираються з кошика);
 * для «Купити зараз» — передані рядки, кошик не читається й не змінюється.
 */
export function useQuote(lang: "uk" | "en", direct?: CartLine[] | null) {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [removed, setRemoved] = useState(false);
  const lines = direct ?? cart.lines;
  const ready = direct ? true : cart.ready;
  const key = JSON.stringify(lines);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    quoteAction(lines, lang).then((q) => {
      if (cancelled) return;
      setQuote(q);
      if (!direct && q.unavailable.length) {
        setRemoved(true);
        cart.replace(cart.lines.filter((l) => !q.unavailable.includes(l.variantId)));
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, lang]);
  return { quote, removed, cart, lines, ready };
}
