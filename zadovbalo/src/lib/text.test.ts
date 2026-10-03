import { describe, expect, it } from "vitest";
import { parseAmountInput, splitPhrases } from "./text";

describe("text utils", () => {
  it("splits a rant into short task-like phrases", () => {
    expect(splitPhrases("звіт до пʼятниці, лікар і податкова. А ще прибрати квартиру!")).toEqual(["звіт до пʼятниці", "лікар", "податкова", "прибрати квартиру"]);
  });
  it("parses amounts typed by people", () => {
    expect(parseAmountInput("48 500")).toBe(48500);
    expect(parseAmountInput("1500,50")).toBe(1500.5);
    expect(parseAmountInput("-5")).toBeNull();
    expect(parseAmountInput("0")).toBeNull();
    expect(parseAmountInput("1e30")).toBeNull();
  });
});
