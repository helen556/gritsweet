import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "@/lib/topics/categories";
import { IMPLEMENTED_MECHANICS, MECHANICS } from "@/lib/mechanics/registry";
import { SCENARIOS } from "./registry";
import { resolveMechanic } from "./resolve";

describe("scenario registry", () => {
  it("has a scenario for every category", () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it.each(CATEGORY_IDS)("%s resolves to an implemented mechanic with content", (category) => {
    const scenario = SCENARIOS[category];
    for (const caution of [false, true]) {
      const resolved = resolveMechanic(scenario, { caution });
      expect(IMPLEMENTED_MECHANICS).toContain(resolved.component);
      if (resolved.component !== "breathe") expect(resolved.items.length).toBeGreaterThan(0);
      if (caution) {
        expect(MECHANICS[resolved.intended].destructive).toBe(false);
        expect(MECHANICS[resolved.component].destructive).toBe(false);
      }
    }
    expect(scenario.copy.title && scenario.copy.hint && scenario.copy.done).toBeTruthy();
  });

  it("uses analysed topics as items for 'everything'", () => {
    const r = resolveMechanic(SCENARIOS.everything, { caution: false, topicLabels: ["РОБОТА", "ГРОШІ", "СОН"] });
    expect(r.items).toEqual(["РОБОТА", "ГРОШІ", "СОН"]);
  });
});
