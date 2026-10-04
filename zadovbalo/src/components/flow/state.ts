import type { ClientReason } from "@/lib/ai/client";
import type { LocalRoute, WarMood } from "@/lib/ai/route";
import type { Analysis } from "@/lib/ai/service";
import { CATEGORY_SCENES, CHOICE_CATEGORIES, SCENE_CATEGORY, type SceneId } from "@/lib/scenes/registry";
import type { Category, Currency } from "@/lib/topics";

export type Stage =
  | "hero"
  | "write"
  | "dictate"
  | "analyzing"
  | "choose"
  | "clarify"
  | "manual"
  | "war_choice"
  | "setup"
  | "scene"
  | "finish"
  | "support";

/** Звідки тема: AI-класифікатор, правила за словами в тексті чи вибір людини. */
export type TopicSource = "ai" | "local" | "manual";

export interface FlowState {
  stage: Stage;
  /** Лише в памʼяті вкладки. Скидання/вихід очищає. */
  text: string;
  source: TopicSource;
  manualReason: ClientReason | null;
  keywordSuggestions: Category[];
  extracted: { amount: number | null; currency: Currency | null };
  category: Category | null;
  /** Теми для «З чого почнемо?» / уточнення. */
  options: Category[];
  warMood: WarMood;
  /** Дії, які людина назвала прямо («полопати плівку»): мають перевагу над типовою сценою теми. */
  requested: SceneId[];
  scene: SceneId | null;
  sceneInput: { amount?: number; currency?: Currency | null; labels?: string[] };
}

export type FlowAction =
  | { type: "write" }
  | { type: "dictate" }
  | { type: "edit"; text: string }
  | { type: "transcribed"; text: string }
  | { type: "analyze" }
  | { type: "analyzed"; analysis: Analysis; warMood: WarMood; requested?: SceneId[] }
  | { type: "local"; route: LocalRoute; reason: ClientReason | null; amount: number | null; currency: Currency | null }
  | { type: "manual"; reason: ClientReason | null; keywordSuggestions?: Category[] }
  | { type: "support" }
  | { type: "choose_category"; category: Category }
  | { type: "choose_scene"; scene: SceneId }
  | { type: "setup_done"; input: FlowState["sceneInput"] }
  | { type: "change_scene" }
  | { type: "edit_setup" }
  | { type: "finish_scene" }
  | { type: "reset" };

export const initialFlow: FlowState = {
  stage: "hero",
  text: "",
  source: "manual",
  manualReason: null,
  keywordSuggestions: [],
  extracted: { amount: null, currency: null },
  category: null,
  options: [],
  warMood: null,
  requested: [],
  scene: null,
  sceneInput: {},
};

/** «Злість» і «накипіло» — загальні; поряд із конкретною темою вони не потрібні. */
const GENERIC: readonly Category[] = ["anger", "general"];

export function focusCategories(categories: readonly Category[]): Category[] {
  const list = categories.filter((c) => c !== "needs_support");
  const specific = list.filter((c) => !GENERIC.includes(c));
  return [...new Set(specific.length ? specific : list)];
}

/** Сцена теми: та, яку людина назвала прямо, інакше — основна. */
export function sceneFor(category: Category, requested: readonly SceneId[]): SceneId {
  return requested.find((id) => SCENE_CATEGORY[id] === category && CATEGORY_SCENES[category].includes(id)) ?? CATEGORY_SCENES[category][0]!;
}

/**
 * Перехід у сцену: з налаштуванням, якщо бракує даних (підписи каменів; сума в гривнях).
 * Вправа з грошима — лише в гривнях: іншу валюту не перейменовуємо й не конвертуємо, а просимо суму в гривнях.
 */
function enterScene(state: FlowState, scene: SceneId): FlowState {
  const { amount, currency } = state.extracted;
  if (scene === "debt") {
    if (amount && currency === "UAH") return { ...state, scene, stage: "scene", sceneInput: { amount, currency } };
    return { ...state, scene, stage: "setup", sceneInput: {} };
  }
  if (scene === "backpack") return { ...state, scene, stage: "setup", sceneInput: {} };
  return { ...state, scene, stage: "scene", sceneInput: {} };
}

/** Єдине правило маршрутизації для AI, правил і ручного вибору. */
export function resolveTopics(
  state: FlowState,
  input: { categories: readonly Category[]; primary: Category | null; needsClarification: boolean; warMood: WarMood; source: TopicSource },
): FlowState {
  const base = { ...state, source: input.source, warMood: input.warMood };
  if (input.categories.includes("needs_support")) return { ...base, stage: "support", scene: null };
  // Страх чи горе через війну — не карта: спершу тихіша дія.
  if (input.warMood === "fear" || input.warMood === "grief") return { ...base, stage: "war_choice", category: input.categories[0] ?? "general" };

  const cats = focusCategories(input.categories);
  if (cats.length === 0) return { ...base, stage: "manual", category: null, options: [] };
  if (input.needsClarification && cats.length > 1) return { ...base, stage: "clarify", options: cats, category: null };

  const primary = input.primary && cats.includes(input.primary) ? input.primary : null;
  const chosen = cats.length === 1 ? cats[0]! : null;
  if (!chosen) {
    // Кілька тем — один короткий вибір «З чого почнемо?» (основну ставимо першою).
    const ordered = primary ? [primary, ...cats.filter((c) => c !== primary)] : cats;
    return { ...base, stage: "choose", options: ordered, category: null };
  }
  // «Хочу паузу» чи «просто накипіло» — один короткий вибір між кількома тихими діями (якщо дію не названо прямо).
  if (CHOICE_CATEGORIES.includes(chosen) && !state.requested.some((id) => SCENE_CATEGORY[id] === chosen || CATEGORY_SCENES[chosen].includes(id)))
    return { ...base, stage: "choose", options: [chosen], category: chosen };
  if (input.needsClarification && input.source === "ai") return { ...base, stage: "clarify", options: cats, category: null };
  const requestedHere = state.requested.find((id) => CATEGORY_SCENES[chosen].includes(id));
  return enterScene({ ...base, category: chosen }, requestedHere ?? sceneFor(chosen, state.requested));
}

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
      // Прямо названа дія береться з тексту (правила на пристрої), а не з вибору моделі.
      const next = { ...state, manualReason: null, requested: action.requested ?? [], extracted: { amount: a.amount, currency: a.currency } };
      return resolveTopics(next, { categories: a.categories, primary: a.primaryCategory, needsClarification: a.needsClarification, warMood: action.warMood, source: "ai" });
    }
    case "local": {
      const next = { ...state, manualReason: action.reason, keywordSuggestions: action.route.categories, requested: action.route.requested, extracted: { amount: action.amount, currency: action.currency } };
      if (action.route.clarity === "unclear") {
        // Війна без явної емоції: людина сама обере між злістю й тихішою дією.
        if (action.route.war) return { ...next, stage: "war_choice", source: "local", warMood: null, category: null };
        return { ...next, stage: "manual", source: "local", category: null, options: [] };
      }
      return resolveTopics(next, { categories: action.route.categories, primary: action.route.primary, needsClarification: false, warMood: action.route.warMood, source: "local" });
    }
    case "manual":
      return {
        ...state,
        stage: "manual",
        manualReason: action.reason,
        keywordSuggestions: action.keywordSuggestions ?? state.keywordSuggestions,
        category: null,
        options: [],
      };
    case "support":
      return { ...state, stage: "support", scene: null };
    case "choose_category":
      return resolveTopics({ ...state }, { categories: [action.category], primary: action.category, needsClarification: false, warMood: action.category === "war_anger" ? "anger" : null, source: "manual" });
    case "choose_scene":
      return enterScene(state, action.scene);
    case "setup_done":
      return { ...state, sceneInput: action.input, stage: "scene" };
    case "change_scene":
      return { ...state, scene: null, stage: "manual", manualReason: null };
    case "edit_setup":
      // Змінити суму, не повертаючись до вибору теми.
      return { ...state, stage: "setup", extracted: { amount: state.sceneInput.amount ?? state.extracted.amount, currency: state.sceneInput.currency ?? state.extracted.currency } };
    case "finish_scene":
      return { ...state, stage: "finish" };
    case "reset":
      // Повне очищення: текст, аналіз, сума — нічого не лишається.
      return { ...initialFlow };
  }
}
