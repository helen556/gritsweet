import { describe, expect, it } from "vitest";
import { applyTransfer, formatAmount, planDebt, transferred } from "./debt";

function moves(amount: number, step: number) {
  let left = amount;
  let n = 0;
  let sum = 0;
  while (left > 0 && n < 100000) {
    sum += transferred(left, step);
    left = applyTransfer(left, step);
    n++;
  }
  return { n, left, sum };
}

describe("гроші: план перенесення", () => {
  it("гривня — справжні купюри 500/1000", () => {
    expect(planDebt(3000, "UAH")).toMatchObject({ note: "uah-500", bill: 500, billMode: true, packMode: false });
    expect(planDebt(48500, "UAH")).toMatchObject({ note: "uah-1000", bill: 1000, pack: 100000, symbolicPack: false });
  });

  it("долари без ліцензованого фото — чесна нейтральна купюра, не гривня", () => {
    const p = planDebt(200000, "USD");
    expect(p.note).toBe("neutral");
    expect(p.bill).toBe(100);
    expect(p).toMatchObject({ pack: 10000, symbolicPack: false, packMode: true });
    expect(planDebt(200000, "USD", true).note).toBe("usd-100");
  });

  it("величезні суми — умовна пачка, явно позначена", () => {
    const p = planDebt(5_000_000, "UAH");
    expect(p.symbolicPack).toBe(true);
    expect(p.billMode).toBe(false);
    expect(moves(5_000_000, p.pack).n).toBeLessThanOrEqual(24);
  });

  it.each([
    [0.5, null],
    [7, "EUR"],
    [300, "UAH"],
    [48500, "UAH"],
    [200000, "USD"],
    [987_654_321.55, "UAH"],
    [1e12, null],
  ] as const)("доходить точно до нуля: %d %s", (amount, cur) => {
    const p = planDebt(amount, cur);
    for (const step of [p.billMode ? p.bill : p.pack, p.pack]) {
      const r = moves(amount, step);
      expect(r.left).toBe(0);
      expect(Math.round(r.sum * 100)).toBe(Math.round(amount * 100));
      expect(r.n).toBeLessThanOrEqual(Math.max(24, 300));
    }
  });

  it("ніколи не мінус; останній крок — лише залишок", () => {
    expect(applyTransfer(300, 500)).toBe(0);
    expect(transferred(300, 500)).toBe(300);
    expect(applyTransfer(0.1 + 0.2, 0.1)).toBe(0.2);
  });

  it("формат українською", () => {
    expect(formatAmount(48500, "UAH", 48500).replace(/\s/g, " ")).toBe("48 500 ₴");
    expect(formatAmount(1500.5, "USD", 1500.5).replace(/\s/g, " ")).toBe("1 500,50 $");
    expect(formatAmount(2000, null, 2000).replace(/\s/g, " ")).toBe("2 000");
  });
});
