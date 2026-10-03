import type { Currency } from "@/lib/topics";

export interface AmountMention {
  amount: number;
  currency: Currency | null;
}

const MAX_AMOUNT = 1e12;

const MULTIPLIERS: [RegExp, number][] = [
  [/^(к|k|тис\p{L}*|тыс\p{L}*|тищ\p{L}*)$/u, 1e3],
  [/^(млн|мільйон\p{L}*|миллион\p{L}*|лям\p{L}*|m|mln)$/u, 1e6],
  [/^(млрд|мільярд\p{L}*|миллиард\p{L}*|ярд\p{L}*|bn)$/u, 1e9],
];

const CURRENCY_WORDS: [RegExp, Currency][] = [
  [/^(грн|гривн\p{L}*|гривен\p{L}*|гривень|uah|₴)$/u, "UAH"],
  [/^(\$|долар\p{L}*|доллар\p{L}*|бакс\p{L}*|usd|дол)$/u, "USD"],
  [/^(€|євро|евро|eur|euro)$/u, "EUR"],
  [/^(zł|zl|злот\p{L}*|pln)$/u, "PLN"],
  [/^(£|фунт\p{L}*|gbp)$/u, "GBP"],
];

const SYMBOL_BEFORE: Record<string, Currency> = { $: "USD", "€": "EUR", "₴": "UAH", "£": "GBP" };

function parseNumber(raw: string, hasMultiplier: boolean): number | null {
  let s = raw.replace(/[\s  ']/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s) && !hasMultiplier) s = s.replace(/[.,]/g, ""); // 1,500 / 1.500.000
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function currencyOf(token: string | undefined): Currency | null {
  if (!token) return null;
  const t = token.toLowerCase();
  return CURRENCY_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
}

function multiplierOf(token: string | undefined): number | null {
  if (!token) return null;
  const t = token.toLowerCase().replace(/\.$/, "");
  return MULTIPLIERS.find(([re]) => re.test(t))?.[1] ?? null;
}

/**
 * Знаходить суми, які людина явно написала: «50 тис грн», «$300», «1,5 млн», «12к гривень».
 * Нічого не вигадує: немає числа — немає суми.
 */
export function extractAmounts(text: string): AmountMention[] {
  const found: AmountMention[] = [];
  // символ? число (з пробілами-розділювачами) суфікс-множник? (злитий або окремим словом) валюта?
  const re = /([$€₴£])?\s?(\d[\d\s  '.,]*\d|\d)\s?([\p{L}$€₴£.]+)?(?:\s+([\p{L}$€₴£.]+))?/gu;
  for (const m of text.matchAll(re)) {
    const [, symbol, num, w1, w2] = m;
    if (!num) continue;
    const t1 = w1?.replace(/\.$/, "");
    const t2 = w2?.replace(/\.$/, "");
    const mult = multiplierOf(t1);
    const currency =
      (symbol ? SYMBOL_BEFORE[symbol] : null) ?? currencyOf(mult ? t2 : t1);
    // Число без множника й без валюти, що виглядає як рік/час, ігноруємо.
    const base = parseNumber(num.trim(), Boolean(mult));
    if (base === null || base <= 0) continue;
    if (!mult && !currency && /^(19|20)\d{2}$/.test(num.trim())) continue;
    const amount = Math.round(base * (mult ?? 1) * 100) / 100;
    if (amount <= 0 || amount > MAX_AMOUNT) continue;
    found.push({ amount, currency });
  }
  return found;
}

/** Найімовірніша сума: перша з валютою, інакше перша з множником/найбільша. */
export function pickAmount(mentions: AmountMention[]): AmountMention | null {
  if (mentions.length === 0) return null;
  return mentions.find((m) => m.currency) ?? [...mentions].sort((a, b) => b.amount - a.amount)[0] ?? null;
}

/** Чи справді така сума є в тексті (захист від вигаданих моделлю чисел). */
export function amountAppearsIn(text: string, amount: number): boolean {
  return extractAmounts(text).some((m) => Math.abs(m.amount - amount) < 0.005 * Math.max(1, amount));
}
