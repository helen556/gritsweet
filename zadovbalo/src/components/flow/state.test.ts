import { describe, expect, it } from "vitest";
import { localRoute } from "@/lib/ai/route";
import type { Analysis } from "@/lib/ai/service";
import { flowReducer, initialFlow, type FlowState } from "./state";

const analysis = (over: Partial<Analysis> = {}): Analysis => ({
  categories: ["financial_debt"],
  primaryCategory: "financial_debt",
  emotion: null,
  needsClarification: false,
  amount: 200000,
  currency: "USD",
  sceneIds: ["debt"],
  ...over,
});

const local = (text: string, s: FlowState = initialFlow) =>
  flowReducer(s, { type: "local", route: localRoute(text), reason: "not_configured", amount: null, currency: null });

describe("flowReducer — однозначна тема веде одразу в сцену", () => {
  it("AI: борг у гривнях → одразу гроші, без анкети", () => {
    const s = flowReducer(initialFlow, { type: "analyzed", analysis: analysis({ currency: "UAH" }), warMood: null });
    expect(s).toMatchObject({ stage: "scene", scene: "debt", source: "ai", sceneInput: { amount: 200000, currency: "UAH" } });
  });

  it("борг у доларах → просимо суму в гривнях (без мовчазної конвертації)", () => {
    const s = flowReducer(initialFlow, { type: "analyzed", analysis: analysis(), warMood: null });
    expect(s).toMatchObject({ stage: "setup", scene: "debt", extracted: { amount: 200000, currency: "USD" } });
  });

  it("борг без суми/валюти → короткий крок суми", () => {
    const s = flowReducer(initialFlow, { type: "analyzed", analysis: analysis({ amount: null, currency: null }), warMood: null });
    expect(s).toMatchObject({ stage: "setup", scene: "debt" });
    expect(flowReducer(s, { type: "setup_done", input: { amount: 10, currency: "UAH" } }).stage).toBe("scene");
  });

  it("без AI: «Мене бісить Росія» → карта, без повторного вибору категорії", () => {
    expect(local("Мене бісить Росія")).toMatchObject({ stage: "scene", scene: "war_map", source: "local" });
  });

  it("без AI: «Все на мені» → рюкзак (крок підписів), «думки по колу» → клубок", () => {
    expect(local("Все на мені")).toMatchObject({ stage: "setup", scene: "backpack" });
    expect(local("думки по колу")).toMatchObject({ stage: "scene", scene: "yarn" });
    expect(local("не встигла сказати йому")).toMatchObject({ stage: "scene", scene: "unsaid" });
  });

  it("страх/горе через війну → тихіший вибір, не карта", () => {
    expect(local("мені страшно через обстріли")).toMatchObject({ stage: "war_choice", warMood: "fear" });
    expect(local("війна")).toMatchObject({ stage: "war_choice", warMood: null });
  });

  it("кілька тем → «З чого почнемо?»; неоднозначно → ручний вибір", () => {
    expect(local("кредит і все на мені")).toMatchObject({ stage: "choose", options: ["financial_debt", "overload"] });
    expect(local("ну таке")).toMatchObject({ stage: "manual" });
    const a = flowReducer(initialFlow, { type: "analyzed", analysis: analysis({ categories: ["overload", "rumination"], primaryCategory: null, needsClarification: true }), warMood: null });
    expect(a).toMatchObject({ stage: "clarify", options: ["overload", "rumination"] });
  });

  it("«злість» поряд із конкретною темою не заважає", () => {
    const s = flowReducer(initialFlow, { type: "analyzed", analysis: analysis({ categories: ["war_anger", "anger"], primaryCategory: "anger", amount: null, currency: null }), warMood: "anger" });
    expect(s).toMatchObject({ stage: "scene", scene: "war_map" });
  });

  it("змінити сцену завжди доступно; reset усе стирає", () => {
    let s = local("Все на мені");
    s = flowReducer(s, { type: "setup_done", input: { labels: ["робота"] } });
    s = flowReducer(s, { type: "change_scene" });
    expect(s).toMatchObject({ stage: "manual", scene: null });
    s = flowReducer(s, { type: "choose_scene", scene: "bubble" });
    expect(s.stage).toBe("scene");
    s = flowReducer(flowReducer(s, { type: "edit", text: "особисте" }), { type: "reset" });
    expect(s).toEqual(initialFlow);
  });

  it("нові шляхи: бісить → посуд, плівка напряму, самотність → «Побудь тут», пауза → короткий вибір", () => {
    expect(local("просто бісить усе")).toMatchObject({ stage: "scene", scene: "dishes" });
    expect(local("хочу полопати плівку")).toMatchObject({ stage: "scene", scene: "bubble" });
    expect(local("мені сумно й самотньо")).toMatchObject({ stage: "scene", scene: "stay" });
    expect(local("хочу тиші")).toMatchObject({ stage: "scene", scene: "candle" });
    expect(local("втомився, хочу паузу")).toMatchObject({ stage: "choose", options: ["pause"] });
  });

  it("страх через війну не веде в руйнування", () => {
    const s = local("мені страшно через обстріли");
    expect(s.stage).toBe("war_choice");
    expect(s.scene).toBeNull();
  });

  it("needs_support → підтримка", () => {
    expect(flowReducer(initialFlow, { type: "choose_category", category: "needs_support" }).stage).toBe("support");
  });
});
