"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

/** Кошик без реєстрації: у localStorage зберігаються лише id варіантів і кількість. Ціни — тільки з сервера. */
export type CartLine = { variantId: string; quantity: number };
const KEY = "pl_cart_v1";

type Ctx = {
  lines: CartLine[]; ready: boolean; count: number;
  add(variantId: string, qty?: number): void;
  setQty(variantId: string, qty: number): void;
  remove(variantId: string): void;
  replace(lines: CartLine[]): void;
  clear(): void;
};
const CartCtx = createContext<Ctx | null>(null);

function read(): CartLine[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((l) => typeof l?.variantId === "string").map((l) => ({ variantId: l.variantId, quantity: Math.max(1, Math.min(10, Math.floor(Number(l.quantity) || 1))) })).slice(0, 30) : [];
  } catch { return []; }
}
const subscribeNoop = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const current = useMemo(() => lines ?? (hydrated ? read() : []), [lines, hydrated]);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setLines(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<Ctx>(() => ({
    lines: current, ready: hydrated, count: current.reduce((a, l) => a + l.quantity, 0),
    add: (id, q = 1) => { const ex = current.find((l) => l.variantId === id); persist(ex ? current.map((l) => (l.variantId === id ? { ...l, quantity: Math.min(10, l.quantity + q) } : l)) : [...current, { variantId: id, quantity: q }]); },
    setQty: (id, q) => persist(current.map((l) => (l.variantId === id ? { ...l, quantity: Math.max(1, Math.min(10, q)) } : l))),
    remove: (id) => persist(current.filter((l) => l.variantId !== id)),
    replace: (next) => persist(next),
    clear: () => persist([]),
  }), [current, hydrated, persist]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("CartProvider missing");
  return c;
}
