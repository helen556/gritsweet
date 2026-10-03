import { describe, expect, it } from "vitest";
import { createHeightfield, dent, fillLump, smooth, smudge, squeeze, volume, shade } from "./heightfield";

describe("heightfield", () => {
  it("dent removes material at contact and pushes it to the rim (volume ~ preserved)", () => {
    const hf = createHeightfield(80, 80);
    fillLump(hf);
    const before = volume(hf);
    const centre = hf.data[40 * 80 + 40]!;
    dent(hf, 40, 40, 6, 0.3);
    expect(hf.data[40 * 80 + 40]!).toBeLessThan(centre);
    expect(Math.abs(volume(hf) - before) / before).toBeLessThan(0.01);
  });

  it("deformations accumulate", () => {
    const hf = createHeightfield(80, 80);
    fillLump(hf);
    dent(hf, 40, 40, 6, 0.2);
    const once = hf.data[40 * 80 + 40]!;
    dent(hf, 40, 40, 6, 0.2);
    expect(hf.data[40 * 80 + 40]!).toBeLessThan(once);
  });

  it("smudge moves material along the drag; smooth adds gloss; squeeze stays finite", () => {
    const hf = createHeightfield(80, 80);
    fillLump(hf);
    const edge = hf.data[40 * 80 + 74]!;
    for (let i = 0; i < 6; i++) smudge(hf, 70 + i, 40, 1, 0, 6, 0.9);
    expect(hf.data[40 * 80 + 74]!).toBeGreaterThan(edge);
    smooth(hf, 40, 40, 8, 0.8);
    expect(hf.gloss[40 * 80 + 40]!).toBeGreaterThan(0);
    squeeze(hf, "x", 0.05);
    expect(Number.isFinite(volume(hf))).toBe(true);
    const out = new Uint8ClampedArray(80 * 80 * 4);
    shade(hf, out, { base: [130, 140, 145], grain: 0.1, specular: 0.1, shininess: 20, relief: 6 });
    expect(out[(40 * 80 + 40) * 4 + 3]).toBe(255);
    expect(out[3]).toBe(0);
  });
});

import { relax } from "./heightfield";
describe("relax", () => {
  it("steep slopes slump until below the talus angle and keep volume", () => {
    const hf = createHeightfield(20, 20);
    hf.data.fill(0.5);
    hf.data[10 * 20 + 10] = 2;
    const before = volume(hf);
    for (let k = 0; k < 200; k++) relax(hf, 1, 1, 18, 18, 0.05);
    expect(hf.data[10 * 20 + 10]!).toBeLessThan(0.8);
    expect(volume(hf)).toBeCloseTo(before, 3);
  });
});
