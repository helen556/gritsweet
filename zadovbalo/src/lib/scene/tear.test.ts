import { describe, expect, it } from "vitest";
import { area } from "./geometry";
import { crossings, pointInPoly, splitByPath } from "./tear";

const sheet = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 300 },
  { x: 0, y: 300 },
];

describe("tear", () => {
  it("splits along a wavy finger path into two pieces of equal total area", () => {
    const path = [
      { x: -20, y: 100 },
      { x: 60, y: 130 },
      { x: 120, y: 90 },
      { x: 230, y: 160 },
    ];
    const res = splitByPath(sheet, path);
    expect(res).not.toBeNull();
    const [a, b] = res!;
    expect(area(a) + area(b)).toBeCloseTo(area(sheet), 0);
    expect(area(a)).toBeGreaterThan(5000);
    expect(area(b)).toBeGreaterThan(5000);
  });

  it("a path that does not cross the sheet twice does not split", () => {
    expect(splitByPath(sheet, [{ x: -10, y: 50 }, { x: 100, y: 60 }])).toBeNull();
  });

  it("finds crossings in order and tests points", () => {
    const xs = crossings(sheet, [{ x: -10, y: 50 }, { x: 250, y: 50 }]);
    expect(xs.map((c) => Math.round(c.point.x))).toEqual([0, 200]);
    expect(pointInPoly({ x: 10, y: 10 }, sheet)).toBe(true);
    expect(pointInPoly({ x: -1, y: 10 }, sheet)).toBe(false);
  });
});
