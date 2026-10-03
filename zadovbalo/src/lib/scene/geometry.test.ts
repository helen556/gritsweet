import { describe, expect, it } from "vitest";
import { area, clipHalfPlane, peel, reflect, roundedRect } from "./geometry";

describe("peel geometry", () => {
  const rect = roundedRect(200, 100, 10);
  it("clips by a half plane", () => {
    const half = clipHalfPlane(rect, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(area(half) / area(rect)).toBeCloseTo(0.5, 2);
  });
  it("reflects across the fold line", () => {
    expect(reflect({ x: -10, y: 5 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 10, y: 5 });
  });
  it("peeling from a corner grows with pull and conserves area", () => {
    const a = { x: -100, y: -50 };
    const small = peel(rect, a, { x: -60, y: -30 });
    const big = peel(rect, a, { x: 80, y: 40 });
    expect(small.peeledFraction).toBeGreaterThan(0);
    expect(big.peeledFraction).toBeGreaterThan(small.peeledFraction);
    expect(area(big.stuck) + area(big.flap)).toBeCloseTo(area(rect), 0);
    expect(peel(rect, a, { x: 400, y: 200 }).peeledFraction).toBeCloseTo(1, 2);
  });
});

import { voronoiCells } from "./geometry";
describe("voronoi", () => {
  it("cells tile the polygon", () => {
    const poly = roundedRect(200, 100, 4);
    const seeds = [
      { x: -60, y: -20 },
      { x: 40, y: 10 },
      { x: 0, y: 30 },
      { x: 80, y: -30 },
    ];
    const cells = voronoiCells(poly, seeds);
    const total = cells.reduce((a, c) => a + area(c), 0);
    expect(total).toBeCloseTo(area(poly), 0);
  });
});
