import type { AnalysisResult } from "@/lib/ai/service";
import type { ClientAnalyzeError } from "@/lib/ai/client";
import type { CategoryId } from "@/lib/topics/categories";

export type Stage =
  | "intro"
  | "exhale"
  | "write"
  | "dictate"
  | "analyzing"
  | "results"
  | "mechanic"
  | "done"
  | "finished"
  | "safety"
  | "error";

export interface FlowState {
  stage: Stage;
  /** Текст тримаємо лише в памʼяті вкладки — для повтору запиту. */
  text: string;
  /** Як прийшов текст — лише для агрегованої аналітики. */
  via: "text" | "voice";
  analysis: { result: AnalysisResult; caution: boolean } | null;
  active: CategoryId | null;
  kept: string[];
  completed: CategoryId[];
  error: ClientAnalyzeError | null;
}

export type FlowAction =
  | { type: "start" }
  | { type: "write" }
  | { type: "dictate" }
  | { type: "transcribed"; text: string }
  | { type: "edit"; text: string }
  | { type: "analyze" }
  | { type: "analyzed"; result: AnalysisResult; caution: boolean }
  | { type: "safety" }
  | { type: "failed"; error: ClientAnalyzeError }
  | { type: "choose"; category: CategoryId }
  | { type: "completed"; kept: string[] }
  | { type: "more" }
  | { type: "enough" }
  | { type: "restart" };

export const initialFlow: FlowState = {
  stage: "intro",
  text: "",
  via: "text",
  analysis: null,
  active: null,
  kept: [],
  completed: [],
  error: null,
};

export function remainingTopics(state: FlowState) {
  return state.analysis?.result.topics.filter((t) => !state.completed.includes(t.category)) ?? [];
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "start":
      return { ...state, stage: "exhale" };
    case "write":
      return { ...state, stage: "write", error: null };
    case "dictate":
      return { ...state, stage: "dictate", error: null };
    case "transcribed":
      return { ...state, stage: "write", via: "voice", text: [state.text.trim(), action.text.trim()].filter(Boolean).join(" ") };
    case "edit":
      return { ...state, text: action.text };
    case "analyze":
      return { ...state, stage: "analyzing", error: null };
    case "analyzed":
      return { ...state, stage: "results", analysis: { result: action.result, caution: action.caution }, completed: [], active: null };
    case "safety":
      return { ...state, stage: "safety", analysis: null, active: null };
    case "failed":
      return { ...state, stage: "error", error: action.error };
    case "choose":
      return { ...state, stage: "mechanic", active: action.category, kept: [] };
    case "completed":
      return {
        ...state,
        stage: "done",
        kept: action.kept,
        completed: state.active && !state.completed.includes(state.active) ? [...state.completed, state.active] : state.completed,
      };
    case "more":
      return { ...state, stage: remainingTopics(state).length > 0 ? "results" : "write", active: null, text: remainingTopics(state).length > 0 ? state.text : "" };
    case "enough":
      // Текст більше не потрібен — прибираємо з памʼяті.
      return { ...initialFlow, stage: "finished" };
    case "restart":
      return { ...initialFlow, stage: "exhale" };
  }
}
