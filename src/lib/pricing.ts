import type { PriceType, Unit } from "@/db/types";

export type PriceInput = {
  priceType: PriceType;
  priceMin: number | null; // копійки за одиницю
  priceMax: number | null;
  unit: Unit;
};

export type Estimate =
  | { kind: "FIXED"; amount: number }
  | { kind: "RANGE"; min: number; max: number }
  | { kind: "FROM"; min: number }
  | { kind: "ASK" };

/**
 * Розрахунок орієнтовної вартості в копійках.
 * qty: грами для KG (напр. 2000 = 2 кг), штуки для решти.
 */
export function estimate(p: PriceInput, qty: number): Estimate {
  if (p.priceType === "ASK") return { kind: "ASK" };
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Некоректна кількість");
  const factor = p.unit === "KG" ? qty / 1000 : Math.trunc(qty);
  if (p.unit !== "KG" && factor !== qty) throw new Error("Кількість має бути цілим числом");
  const mul = (v: number) => Math.round(v * factor);
  switch (p.priceType) {
    case "FIXED":
      if (p.priceMin == null) return { kind: "ASK" };
      return { kind: "FIXED", amount: mul(p.priceMin) };
    case "RANGE":
      if (p.priceMin == null || p.priceMax == null) return { kind: "ASK" };
      return { kind: "RANGE", min: mul(p.priceMin), max: mul(p.priceMax) };
    case "FROM":
      if (p.priceMin == null) return { kind: "ASK" };
      return { kind: "FROM", min: mul(p.priceMin) };
  }
}

const uah = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });
export function formatUah(kopecks: number): string {
  return `${uah.format(Math.round(kopecks / 100))} грн`;
}

export function formatEstimate(e: Estimate): string {
  switch (e.kind) {
    case "FIXED": return formatUah(e.amount);
    case "RANGE": return `${uah.format(Math.round(e.min / 100))}–${formatUah(e.max)}`;
    case "FROM": return `від ${formatUah(e.min)}`;
    case "ASK": return "Вартість уточнюйте";
  }
}

/** Ціна за одиницю для картки каталогу. */
export function formatUnitPrice(p: PriceInput): string {
  const unitLabel: Record<Unit, string> = { KG: "/кг", PIECE: "/шт", BOX: "/коробочка", BOUQUET: "/букет" };
  if (p.priceType === "ASK") return "Вартість уточнюйте";
  const e = estimate(p, p.unit === "KG" ? 1000 : 1);
  return `${formatEstimate(e)}${unitLabel[p.unit]}`;
}

export function estimateToColumns(e: Estimate): { min: number | null; max: number | null } {
  switch (e.kind) {
    case "FIXED": return { min: e.amount, max: e.amount };
    case "RANGE": return { min: e.min, max: e.max };
    case "FROM": return { min: e.min, max: null };
    case "ASK": return { min: null, max: null };
  }
}
