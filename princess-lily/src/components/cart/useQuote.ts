"use client";
import { useEffect, useState } from "react";
import { quoteAction } from "@/app/[lang]/actions";
import type { Quote } from "@/lib/quote";
import { useCart } from "./CartProvider";

/** Тягне серверний розрахунок для поточного кошика; недоступні позиції прибирає з кошика. */
export function useQuote(lang: "uk" | "en") {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [removed, setRemoved] = useState(false);
  const key = JSON.stringify(cart.lines);
  useEffect(() => {
    if (!cart.ready) return;
    let cancelled = false;
    quoteAction(cart.lines, lang).then((q) => {
      if (cancelled) return;
      setQuote(q);
      if (q.unavailable.length) {
        setRemoved(true);
        cart.replace(cart.lines.filter((l) => !q.unavailable.includes(l.variantId)));
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cart.ready, lang]);
  return { quote, removed, cart };
}
