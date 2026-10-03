import type { Currency } from "@/lib/topics";

/** Скільки купюр у пачці. */
export const PACK_SIZE = 100;
/** Більше — «по купюрі» стає безкінечним, лишаємо лише пачки. */
export const MAX_BILL_MOVES = 300;
/** Більше пачок — пачка стає умовною (масштаб підписано явно). */
const MAX_PACK_MOVES = 24;
const SYMBOLIC_TARGET = 12;

export type NoteKind = "uah-500" | "uah-1000" | "usd-100" | "neutral";

export interface DebtPlan {
  /** Яка купюра: справжнє фото (гривня) або чесна нейтральна. */
  note: NoteKind;
  /** Номінал купюри (у валюті суми). */
  bill: number;
  /** Скільки списує одна пачка. */
  pack: number;
  /** Пачка умовна: її вартість не дорівнює 100 купюрам — це явно підписуємо. */
  symbolicPack: boolean;
  /** Чи має сенс «по купюрі» (не безкінечно). */
  billMode: boolean;
  /** Чи має сенс «пачкою». */
  packMode: boolean;
}

function decimalsFor(amount: number) {
  return Number.isInteger(amount) ? 0 : 2;
}

/** «Кругле» число 1/2/5 × 10ⁿ. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 0;
  if (raw < 0.01) return 0.01;
  const exp = Math.floor(Math.log10(raw));
  const base = raw / 10 ** exp;
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  const step = nice * 10 ** exp;
  return step >= 1 ? Math.round(step) : Math.round(step * 100) / 100;
}

/**
 * Як перекладати суму. Гривня — справжні 500/1000 грн. Інші валюти й «без валюти» — нейтральна символічна купюра
 * з чесним номіналом (не видаємо гривню чи макет за долари). Великі суми — пачками; якщо й пачок забагато,
 * пачка стає умовною й це явно підписано.
 */
export function planDebt(total: number, currency: Currency | null | undefined, hasUsdNote = false): DebtPlan {
  let note: NoteKind;
  let bill: number;
  if (currency === "UAH") {
    note = total >= 5000 ? "uah-1000" : "uah-500";
    bill = note === "uah-1000" ? 1000 : 500;
  } else if (currency === "USD" && hasUsdNote) {
    note = "usd-100";
    bill = 100;
  } else if (currency) {
    note = "neutral";
    bill = total >= 2000 ? 100 : total >= 200 ? 20 : niceStep(total / 10);
  } else {
    note = "neutral";
    bill = niceStep(total / SYMBOLIC_TARGET);
  }
  const bills = Math.ceil(total / bill);
  let pack = bill * PACK_SIZE;
  let symbolicPack = false;
  if (total / pack > MAX_PACK_MOVES) {
    pack = niceStep(total / SYMBOLIC_TARGET);
    symbolicPack = true;
  }
  return { note, bill, pack, symbolicPack, billMode: bills <= MAX_BILL_MOVES, packMode: bills > 12 };
}

/** Відняти один перенос. Останній крок — точно до нуля, ніколи не нижче. Копійки без похибок float. */
export function applyTransfer(remaining: number, step: number): number {
  const cents = Math.max(0, Math.round(remaining * 100) - Math.round(step * 100));
  return cents / 100;
}

/** Скільки насправді списав перенос (останній — лише залишок). */
export function transferred(remaining: number, step: number): number {
  return Math.min(remaining, step);
}

export function formatAmount(value: number, currency: Currency | null | undefined, original: number): string {
  const digits = decimalsFor(original);
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (currency) return new Intl.NumberFormat("uk-UA", { ...opts, style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(value);
  return new Intl.NumberFormat("uk-UA", opts).format(value);
}
