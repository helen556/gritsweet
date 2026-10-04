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

describe("гроші: лише гривні, справжня 1000 грн", () => {
  it("завжди та сама купюра 1000 грн", () => {
    expect(planDebt(300)).toMatchObject({ note: "uah-1000", bill: 1000, billMode: true, packMode: false });
    expect(planDebt(48500)).toMatchObject({ note: "uah-1000", bill: 1000, pack: 100000, packs: 1, packMode: true });
  });

  it("великі суми — стос зі справжніх пачок, без прихованого масштабу", () => {
    const p = planDebt(5_000_000);
    expect(p.billMode).toBe(false);
    expect(p.packs).toBe(10);
    expect(p.pack).toBe(p.packs * 100 * 1000);
    expect(moves(5_000_000, p.pack).n).toBeLessThanOrEqual(30);
  });

  it.each([0.5, 7, 300, 1000, 48500, 200000, 987_654_321.55, 1e12])("доходить точно до нуля: %d", (amount) => {
    const p = planDebt(amount);
    for (const step of [p.billMode ? p.bill : p.pack, p.pack]) {
      const r = moves(amount, step);
      expect(r.left).toBe(0);
      expect(Math.round(r.sum * 100)).toBe(Math.round(amount * 100));
      expect(r.n).toBeLessThanOrEqual(300);
    }
  });

  it("ніколи не мінус; останній крок — лише залишок; одна дія — одне списання", () => {
    expect(applyTransfer(300, 1000)).toBe(0);
    expect(transferred(300, 1000)).toBe(300);
    expect(applyTransfer(2500, 1000)).toBe(1500);
    expect(applyTransfer(0.1 + 0.2, 0.1)).toBe(0.2);
  });

  it("формат українською", () => {
    expect(formatAmount(48500, "UAH", 48500).replace(/\s/g, " ")).toBe("48 500 ₴");
    expect(formatAmount(1500.5, "UAH", 1500.5).replace(/\s/g, " ")).toBe("1 500,50 ₴");
  });
});
