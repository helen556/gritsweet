/** Усі суми — цілі копійки. Без float у розрахунках. */
export function assertMinor(n: unknown): asserts n is number {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Некоректна сума в копійках");
}
export function mulMinor(unit: number, qty: number): number {
  assertMinor(unit);
  if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("Некоректна кількість");
  const r = unit * qty;
  if (!Number.isSafeInteger(r)) throw new Error("Переповнення суми");
  return r;
}
export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => { const r = a + b; if (!Number.isSafeInteger(r)) throw new Error("Переповнення суми"); return r; }, 0);
}
/** "250,00" / "250.5" / "250" → 25000 / 25050 / 25000 (рядковий розбір, без float). */
export function parseUahToMinor(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error("Невірний формат ціни");
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
export function formatMinor(minor: number, locale: "uk" | "en", currency = "UAH"): string {
  const whole = Math.trunc(minor / 100);
  const frac = minor % 100;
  const w = whole.toLocaleString(locale === "uk" ? "uk-UA" : "en-US");
  const f = frac ? (locale === "uk" ? "," : ".") + String(frac).padStart(2, "0") : "";
  return locale === "uk" ? `${w}${f} грн` : `${currency === "UAH" ? "₴" : currency + " "}${w}${f}`;
}
export const minorToInput = (m: number | null) => (m == null ? "" : `${Math.trunc(m / 100)}${m % 100 ? "." + String(m % 100).padStart(2, "0") : ""}`);
