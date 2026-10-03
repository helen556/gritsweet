import { describe, expect, it } from "vitest";
import type { Analysis } from "@/lib/ai/service";
import { flowReducer, initialFlow, type FlowState } from "./state";

const analysis = (over: Partial<Analysis> = {}): Analysis => ({
  categories: ["financial_debt", "overload"],
  primaryCategory: "financial_debt",
  emotion: null,
  needsClarification: false,
  amount: 50000,
  currency: "UAH",
  sceneIds: ["debt", "backpack"],
  ...over,
});

describe("flowReducer", () => {
  it("ai result → confirm → debt needs setup → scene → finish", () => {
    let s: FlowState = flowReducer(initialFlow, { type: "write" });
    s = flowReducer(s, { type: "edit", text: "кредит 50 тис грн і все на мені" });
    s = flowReducer(s, { type: "analyze" });
    s = flowReducer(s, { type: "analyzed", analysis: analysis() });
    expect(s).toMatchObject({ stage: "confirm", category: "financial_debt", source: "ai", extracted: { amount: 50000 } });
    s = flowReducer(s, { type: "choose_scene", scene: "debt" });
    expect(s.stage).toBe("setup");
    s = flowReducer(s, { type: "setup_done", input: { amount: 50000, currency: "UAH" } });
    expect(s.stage).toBe("scene");
    s = flowReducer(s, { type: "change_action" });
    expect(s.stage).toBe("confirm");
    s = flowReducer(s, { type: "choose_scene", scene: "backpack" });
    s = flowReducer(s, { type: "setup_done", input: { labels: ["звіт"] } });
    s = flowReducer(s, { type: "finish_scene" });
    expect(s.stage).toBe("finish");
  });

  it("ambiguous → clarify; war anger → explicit choice first", () => {
    expect(flowReducer(initialFlow, { type: "analyzed", analysis: analysis({ needsClarification: true }) }).stage).toBe("clarify");
    expect(flowReducer(initialFlow, { type: "analyzed", analysis: analysis({ categories: ["war_anger"], primaryCategory: "war_anger" }) }).stage).toBe("war_choice");
    expect(flowReducer(initialFlow, { type: "choose_category", category: "war_anger" }).stage).toBe("war_choice");
  });

  it("manual fallback keeps keyword hints separate from ai", () => {
    const s = flowReducer(initialFlow, { type: "manual", reason: "quota", keywordSuggestions: ["anger"] });
    expect(s).toMatchObject({ stage: "manual", source: "manual", manualReason: "quota", keywordSuggestions: ["anger"], analysis: null });
  });

  it("reset wipes text, analysis and amounts", () => {
    let s = flowReducer(initialFlow, { type: "edit", text: "особисте" });
    s = flowReducer(s, { type: "analyzed", analysis: analysis() });
    s = flowReducer(s, { type: "reset" });
    expect(s).toEqual(initialFlow);
  });

  it("choosing needs_support opens support", () => {
    expect(flowReducer(initialFlow, { type: "choose_category", category: "needs_support" }).stage).toBe("support");
  });
});
