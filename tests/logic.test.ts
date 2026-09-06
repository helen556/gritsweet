import { describe, it, expect } from "vitest";
import { estimate, formatEstimate, formatUnitPrice } from "../src/lib/pricing";
import { normalizeUaPhone } from "../src/lib/phone";

describe("pricing", () => {
  it("range × weight", () => expect(formatEstimate(estimate({ priceType: "RANGE", priceMin: 105000, priceMax: 110000, unit: "KG" }, 2000))).toBe("2\u00a0100–2\u00a0200 грн"));
  it("from × weight", () => expect(formatEstimate(estimate({ priceType: "FROM", priceMin: 100000, priceMax: null, unit: "KG" }, 2000))).toBe("від 2\u00a0000 грн"));
  it("fixed × pieces", () => expect(formatEstimate(estimate({ priceType: "FIXED", priceMin: 13000, priceMax: null, unit: "PIECE" }, 6))).toBe("780 грн"));
  it("ask", () => expect(formatEstimate(estimate({ priceType: "ASK", priceMin: null, priceMax: null, unit: "KG" }, 500))).toBe("Вартість уточнюйте"));
  it("decimal weight 1.5", () => expect(formatEstimate(estimate({ priceType: "FIXED", priceMin: 120000, priceMax: null, unit: "KG" }, 1500))).toBe("1\u00a0800 грн"));
  it("non-integer pieces rejected", () => expect(() => estimate({ priceType: "FIXED", priceMin: 100, priceMax: null, unit: "PIECE" }, 1.5)).toThrow());
  it("unit price label", () => expect(formatUnitPrice({ priceType: "FIXED", priceMin: 37000, priceMax: null, unit: "BOX" })).toBe("370 грн/коробочка"));
});
describe("phone", () => {
  it.each([["095 029 12 14", "+380950291214"], ["+38 (095) 029-12-14", "+380950291214"], ["380950291214", "+380950291214"], ["950291214", "+380950291214"]])("%s → %s", (i, o) => expect(normalizeUaPhone(i)).toBe(o));
  it.each(["", "123", "0950291", "+1 555 0100", "0150291214"])("rejects %s", (i) => expect(normalizeUaPhone(i)).toBeNull());
});
