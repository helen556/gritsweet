import type { Currency } from "@/lib/topics";

/** Купюра вправи — справжня 1000 грн (фото з наданих матеріалів). Сума вправи — лише в гривнях. */
export const BILL = 1000;
/** Скільки купюр у пачці. */
export const PACK_SIZE = 100;
/** Більше — «по купюрі» стає безкінечним, лишаємо лише пачки. */
export const MAX_BILL_MOVES = 300;
/** Скільки перенесень пачками ще зручно; більше — переносимо стос із кількох справжніх пачок (і так і пишемо). */
const MAX_PACK_MOVES = 30;

export type NoteKind = "uah-1000";

export interface DebtPlan {
  note: NoteKind;
  /** Номінал купюри, ₴. */
  bill: number;
  /** Скільки пачок по 100 купюр переноситься за раз (1, 10, 100…) — без прихованого масштабу. */
  packs: number;
  /** Скільки списує один перенос «пачкою» (packs × 100 × купюра). */
  pack: number;
  /** Чи має сенс «по купюрі» (не безкінечно). */
  billMode: boolean;
  /** Чи має сенс «пачкою». */
  packMode: boolean;
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
 * Як переносити суму (у гривнях). Завжди справжня 1000 грн; останній перенос — лише залишок.
 * Великі суми — пачками по 100 купюр; дуже великі — стосом із 10, 100… пачок, і це підписано.
 */
export function planDebt(total: number): DebtPlan {
  const bills = Math.ceil(total / BILL);
  let packs = 1;
  while (total / (BILL * PACK_SIZE * packs) > MAX_PACK_MOVES) packs *= 10;
  return { note: "uah-1000", bill: BILL, packs, pack: BILL * PACK_SIZE * packs, billMode: bills <= MAX_BILL_MOVES, packMode: bills > 12 };
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

function decimalsFor(amount: number) {
  return Number.isInteger(amount) ? 0 : 2;
}

export function formatAmount(value: number, currency: Currency | null | undefined, original: number): string {
  const digits = decimalsFor(original);
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (currency) return new Intl.NumberFormat("uk-UA", { ...opts, style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(value);
  return new Intl.NumberFormat("uk-UA", opts).format(value);
}
