import { describe, expect, it } from "vitest";
import { amountAppearsIn, extractAmounts, pickAmount } from "./amount";

const pick = (t: string) => pickAmount(extractAmounts(t));

describe("extractAmounts", () => {
  it.each([
    ["винна 50 000 грн за кредит", 50000, "UAH"],
    ["борг 12к гривень", 12000, "UAH"],
    ["ще 1,5 млн доларів іпотеки", 1500000, "USD"],
    ["$300 до пʼятниці", 300, "USD"],
    ["2000 євро позики", 2000, "EUR"],
    ["маю віддати 3 тис злотих", 3000, "PLN"],
    ["должен 200 тыс рублей", 200000, null],
    ["кредитка на 1 500,50 грн", 1500.5, "UAH"],
    ["позичила 7 лямів", 7000000, null],
  ])("%s", (text, amount, currency) => {
    expect(pick(text)).toEqual({ amount, currency });
  });

  it("returns nothing when there is no number", () => {
    expect(pick("хочу, щоб цей борг зник")).toBeNull();
  });

  it("ignores bare years", () => {
    expect(pick("з 2022 року все погано")).toBeNull();
  });

  it("verifies a model amount against the text", () => {
    expect(amountAppearsIn("винна 50 тис", 50000)).toBe(true);
    expect(amountAppearsIn("винна 50 тис", 70000)).toBe(false);
  });
});
