import type { Currency } from "@/lib/topics";

/** Скільки «купюр» приблизно має знадобитися, щоб дійти до нуля. */
const TARGET_MOVES = 14;
export const STACK_SIZE = 5;

function decimalsFor(amount: number) {
  return Number.isInteger(amount) ? 0 : 2;
}

/** Крок однієї символічної купюри: «кругле» число 1/2/5 × 10ⁿ, щоб нуль був досяжний за розумну кількість рухів. */
export function billStep(amount: number): number {
  if (!(amount > 0)) return 0;
  const raw = amount / TARGET_MOVES;
  if (raw < 0.01) return 0.01;
  const exp = Math.floor(Math.log10(raw));
  const base = raw / 10 ** exp;
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  const step = nice * 10 ** exp;
  return step >= 1 ? Math.round(step) : Math.round(step * 100) / 100;
}

/** Відняти один перенос. Останній крок — точно до нуля, ніколи не нижче. Копійки без похибок float. */
export function applyTransfer(remaining: number, step: number): number {
  const cents = Math.max(0, Math.round(remaining * 100) - Math.round(step * 100));
  return cents / 100;
}

export function formatAmount(value: number, currency: Currency | null | undefined, original: number): string {
  const digits = decimalsFor(original);
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (currency) return new Intl.NumberFormat("uk-UA", { ...opts, style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(value);
  return new Intl.NumberFormat("uk-UA", opts).format(value);
}
