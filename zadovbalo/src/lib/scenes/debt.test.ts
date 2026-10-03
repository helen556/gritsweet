import { describe, expect, it } from "vitest";
import { applyTransfer, billStep, formatAmount, STACK_SIZE } from "./debt";

function movesToZero(amount: number, stack = false) {
  const step = billStep(amount) * (stack ? STACK_SIZE : 1);
  let left = amount;
  let n = 0;
  while (left > 0 && n < 10000) {
    left = applyTransfer(left, step);
    n++;
  }
  return { n, left };
}

describe("debt math", () => {
  it.each([0.5, 7, 99.99, 1500, 48500, 1_000_000, 987_654_321.55, 1e12])("reaches exactly zero for %d in a sane number of moves", (amount) => {
    const bills = movesToZero(amount);
    expect(bills.left).toBe(0);
    expect(bills.n).toBeGreaterThanOrEqual(5);
    expect(bills.n).toBeLessThanOrEqual(40);
    const stacks = movesToZero(amount, true);
    expect(stacks.left).toBe(0);
    expect(stacks.n).toBeLessThanOrEqual(bills.n);
  });

  it("never goes negative", () => {
    expect(applyTransfer(3, 5)).toBe(0);
    expect(applyTransfer(0.1 + 0.2, 0.1)).toBe(0.2);
  });

  it("formats currencies in Ukrainian", () => {
    expect(formatAmount(48500, "UAH", 48500).replace(/\s/g, " ")).toBe("48 500 ₴");
    expect(formatAmount(1500.5, "USD", 1500.5).replace(/\s/g, " ")).toBe("1 500,50 $");
    expect(formatAmount(12.5, "EUR", 12.5).replace(/\s/g, " ")).toBe("12,50 €");
    expect(formatAmount(2000, null, 2000).replace(/\s/g, " ")).toBe("2 000");
  });
});
