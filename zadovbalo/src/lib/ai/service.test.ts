import { describe, expect, it } from "vitest";
import { analyzeRant } from "./service";
import { classifyLocally, mockClassifier } from "./providers/mock";
import { classificationSchema } from "./schema";
import type { RantClassifier } from "./types";

const fixed = (value: unknown): RantClassifier => ({ id: "fixed", classify: async () => value });

describe("mock classifier", () => {
  it("finds several topics and returns a schema-valid result", () => {
    const result = classifyLocally("Задовбала робота, клієнт хоче ще правки, а грошей нема, і ще посварилась з мамою!!!");
    expect(classificationSchema.safeParse(result).success).toBe(true);
    const categories = result.topics.map((t) => t.category);
    expect(categories).toEqual(expect.arrayContaining(["work", "client", "money", "relationship_conflict"]));
  });

  it("falls back to unknown when nothing matches", () => {
    expect(classifyLocally("ммм ну таке").topics[0]?.category).toBe("unknown");
  });

  it("does not confuse 'цінують' with prices", () => {
    const categories = classifyLocally("мене не цінують на роботі").topics.map((t) => t.category);
    expect(categories).not.toContain("high_prices");
    expect(categories).toContain("not_appreciated");
  });

  it("raises intensity for caps, exclamations and swearing", () => {
    const calm = classifyLocally("трохи втомилась від роботи").topics[0]!.intensity;
    const loud = classifyLocally("ЗАЇБАЛА ЦЯ РОБОТА!!! ВСЕ БІСИТЬ!!!").topics[0]!.intensity;
    expect(loud).toBeGreaterThan(calm);
  });
});

describe("analyzeRant", () => {
  it("returns safety without calling the classifier", async () => {
    let called = false;
    const spy: RantClassifier = { id: "spy", classify: async () => ((called = true), {}) };
    const outcome = await analyzeRant("не хочу більше жити", { classifier: spy, timeoutMs: 1000 });
    expect(outcome.status).toBe("safety");
    expect(called).toBe(false);
  });

  it("normalizes a valid response: dedupe, registry labels, sorted by intensity", async () => {
    const outcome = await analyzeRant("робота і гроші", {
      timeoutMs: 1000,
      classifier: fixed({
        topics: [
          { category: "money", label: "whatever", emotion: "anxiety", intensity: 7 },
          { category: "work", label: "Робота", emotion: "anger", intensity: 8 },
          { category: "money", label: "Гроші", emotion: "anxiety", intensity: 9 },
          { category: "unknown", label: "?", emotion: "anger", intensity: 3 },
        ],
        primary_emotion: "anger",
        recommended_mechanic: "swipe_away",
        tone: "direct",
      }),
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.result.topics.map((t) => [t.category, t.label, t.intensity])).toEqual([
      ["money", "ГРОШІ", 9],
      ["work", "РОБОТА", 8],
    ]);
  });

  it("rejects an invalid AI response", async () => {
    await expect(
      analyzeRant("робота", { timeoutMs: 1000, classifier: fixed({ topics: [{ category: "aliens" }] }) }),
    ).rejects.toMatchObject({ type: "invalid_response" });
  });

  it("times out even if the provider ignores the signal", async () => {
    const slow: RantClassifier = { id: "slow", classify: () => new Promise(() => {}) };
    await expect(analyzeRant("робота", { timeoutMs: 30, classifier: slow })).rejects.toMatchObject({ type: "timeout" });
  });

  it("maps provider failures to ai_unavailable", async () => {
    const broken: RantClassifier = { id: "broken", classify: async () => Promise.reject(new Error("boom")) };
    await expect(analyzeRant("робота", { timeoutMs: 1000, classifier: broken })).rejects.toMatchObject({ type: "ai_unavailable" });
  });

  it("flags caution but still analyzes hyperbole", async () => {
    const outcome = await analyzeRant("шеф бісить, я його вбʼю", { timeoutMs: 2000, classifier: mockClassifier });
    expect(outcome.status).toBe("ok");
    expect(outcome.safety.level).toBe("caution");
  });
});
