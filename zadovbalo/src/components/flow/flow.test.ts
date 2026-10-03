import { describe, expect, it } from "vitest";
import { flowReducer, initialFlow, remainingTopics, type FlowState } from "./state";

const analysis = {
  topics: [
    { category: "work" as const, label: "РОБОТА", emotion: "anger" as const, intensity: 8 },
    { category: "money" as const, label: "ГРОШІ", emotion: "anxiety" as const, intensity: 6 },
  ],
  primaryEmotion: "anger" as const,
  recommendedMechanic: "swipe_away" as const,
  tone: "direct" as const,
};

describe("flowReducer", () => {
  it("walks the happy path and offers the remaining topic", () => {
    let s: FlowState = flowReducer(initialFlow, { type: "start" });
    s = flowReducer(s, { type: "write" });
    s = flowReducer(s, { type: "edit", text: "робота і гроші" });
    s = flowReducer(s, { type: "analyze" });
    s = flowReducer(s, { type: "analyzed", result: analysis, caution: false });
    expect(s.stage).toBe("results");
    s = flowReducer(s, { type: "choose", category: "work" });
    s = flowReducer(s, { type: "completed", kept: ["Звіт"] });
    expect(s.stage).toBe("done");
    expect(remainingTopics(s).map((t) => t.category)).toEqual(["money"]);
    s = flowReducer(s, { type: "more" });
    expect(s.stage).toBe("results");
  });

  it("forgets the text when the user is done", () => {
    let s = flowReducer({ ...initialFlow, stage: "done", text: "особисте" }, { type: "enough" });
    expect(s.text).toBe("");
    s = flowReducer(s, { type: "restart" });
    expect(s.stage).toBe("exhale");
  });

  it("appends a transcript to existing text", () => {
    const s = flowReducer({ ...initialFlow, stage: "dictate", text: "по-перше" }, { type: "transcribed", text: "по-друге" });
    expect(s).toMatchObject({ stage: "write", text: "по-перше по-друге" });
  });

  it("drops analysis on safety", () => {
    const s = flowReducer({ ...initialFlow, analysis: { result: analysis, caution: false } }, { type: "safety" });
    expect(s).toMatchObject({ stage: "safety", analysis: null });
  });
});
