import type { Analysis } from "@/lib/ai/service";
import type { ClientReason } from "@/lib/ai/client";
import type { SceneId } from "@/lib/scenes/registry";
import type { Category, Currency } from "@/lib/topics";

export type Stage =
  | "hero"
  | "write"
  | "dictate"
  | "analyzing"
  | "confirm"
  | "clarify"
  | "manual"
  | "war_choice"
  | "setup"
  | "scene"
  | "finish"
  | "support";

export interface FlowState {
  stage: Stage;
  /** Лише в памʼяті вкладки. Скидання/вихід очищає. */
  text: string;
  analysis: Analysis | null;
  /** Звідки теми: AI, ключові слова чи людина сама. */
  source: "ai" | "manual";
  manualReason: ClientReason | null;
  keywordSuggestions: Category[];
  extracted: { amount: number | null; currency: Currency | null };
  category: Category | null;
  scene: SceneId | null;
  sceneInput: { amount?: number; currency?: Currency | null; labels?: string[] };
}

export type FlowAction =
  | { type: "write" }
  | { type: "dictate" }
  | { type: "edit"; text: string }
  | { type: "transcribed"; text: string }
  | { type: "analyze" }
  | { type: "analyzed"; analysis: Analysis }
  | { type: "manual"; reason: ClientReason | null; keywordSuggestions?: Category[]; amount?: number | null; currency?: Currency | null }
  | { type: "support" }
  | { type: "choose_category"; category: Category }
  | { type: "choose_scene"; scene: SceneId }
  | { type: "setup_done"; input: FlowState["sceneInput"] }
  | { type: "change_action" }
  | { type: "finish_scene" }
  | { type: "reset" };

export const initialFlow: FlowState = {
  stage: "hero",
  text: "",
  analysis: null,
  source: "manual",
  manualReason: null,
  keywordSuggestions: [],
  extracted: { amount: null, currency: null },
  category: null,
  scene: null,
  sceneInput: {},
};

/** Сцени, яким перед стартом потрібні дані від людини. */
export const NEEDS_SETUP: readonly SceneId[] = ["debt", "backpack", "stickers"];

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "write":
      return { ...state, stage: "write" };
    case "dictate":
      return { ...state, stage: "dictate" };
    case "edit":
      return { ...state, text: action.text };
    case "transcribed":
      return { ...state, stage: "write", text: [state.text.trim(), action.text.trim()].filter(Boolean).join(" ") };
    case "analyze":
      return { ...state, stage: "analyzing" };
    case "analyzed": {
      const a = action.analysis;
      const category = a.primaryCategory ?? (a.categories.length === 1 ? a.categories[0]! : null);
      return {
        ...state,
        analysis: a,
        source: "ai",
        manualReason: null,
        extracted: { amount: a.amount, currency: a.currency },
        category,
        stage: a.needsClarification || !category ? "clarify" : category === "war_anger" ? "war_choice" : "confirm",
      };
    }
    case "manual":
      return {
        ...state,
        stage: "manual",
        source: "manual",
        analysis: null,
        manualReason: action.reason,
        keywordSuggestions: action.keywordSuggestions ?? [],
        extracted: { amount: action.amount ?? null, currency: action.currency ?? null },
        category: null,
      };
    case "support":
      return { ...state, stage: "support", scene: null };
    case "choose_category":
      if (action.category === "needs_support") return { ...state, stage: "support", category: action.category };
      return { ...state, category: action.category, stage: action.category === "war_anger" ? "war_choice" : "confirm" };
    case "choose_scene":
      return { ...state, scene: action.scene, stage: NEEDS_SETUP.includes(action.scene) ? "setup" : "scene", sceneInput: {} };
    case "setup_done":
      return { ...state, sceneInput: action.input, stage: "scene" };
    case "change_action":
      return { ...state, scene: null, stage: state.category && state.category !== "needs_support" ? "confirm" : "manual" };
    case "finish_scene":
      return { ...state, stage: "finish" };
    case "reset":
      // Повне очищення: текст, аналіз, сума — нічого не лишається.
      return { ...initialFlow };
  }
}
