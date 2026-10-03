import type { Category } from "@/lib/topics";

export const SCENE_IDS = ["debt", "backpack", "yarn", "clay", "paper", "ice", "stickers", "sand", "war_map"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const isSceneId = (v: unknown): v is SceneId => typeof v === "string" && (SCENE_IDS as readonly string[]).includes(v);

export interface SceneMeta {
  id: SceneId;
  title: string;
  /** Що людина робитиме — одним рядком. */
  action: string;
  /** Руйнівна дія: не пропонується в режимі підтримки. */
  destructive: boolean;
  /** Тиха сцена без вимоги завершувати. */
  quiet?: boolean;
}

export const SCENES: Record<SceneId, SceneMeta> = {
  debt: { id: "debt", title: "Зменшити суму", action: "Переносити купюри на суму, поки вона не стане нулем", destructive: false },
  backpack: { id: "backpack", title: "Розвантажити рюкзак", action: "Витягати справи й розкладати по купках", destructive: false },
  yarn: { id: "yarn", title: "Розплутати клубок", action: "Повільно тягнути нитку за кінчик", destructive: false },
  clay: { id: "clay", title: "Мʼяти глину", action: "Тиснути, стискати, розтягувати, розгладжувати", destructive: false },
  paper: { id: "paper", title: "Рвати папір", action: "Мʼяти й рвати аркуш уздовж пальця", destructive: true },
  ice: { id: "ice", title: "Розбити лід", action: "Пускати тріщини, поки лід не розійдеться", destructive: true },
  stickers: { id: "stickers", title: "Відклеїти наліпки", action: "Відклеювати чужі слова зі скла", destructive: false },
  sand: { id: "sand", title: "Пісок і вода", action: "Проводити борозни, пересувати камінці, вести воду", destructive: false, quiet: true },
  war_map: { id: "war_map", title: "Карта", action: "Рвати, палити або знищити символічну карту", destructive: true },
};

/** Які дії пропонуємо для теми (перша — основна). */
export const CATEGORY_SCENES: Record<Category, readonly SceneId[]> = {
  financial_debt: ["debt"],
  overload: ["backpack"],
  rumination: ["yarn"],
  anger: ["clay", "paper", "ice"],
  hurtful_words: ["stickers"],
  control: ["sand"],
  // Карта — лише після явного вибору «злість» (див. WarChoice); тиха альтернатива — пісок.
  war_anger: ["war_map", "sand"],
  general: ["clay", "sand", "paper"],
  needs_support: ["sand"],
};

/** Дозволені сцени для набору тем — єдине джерело правди для валідації відповіді AI. */
export function allowedScenes(categories: readonly Category[]): SceneId[] {
  return [...new Set(categories.flatMap((c) => CATEGORY_SCENES[c]))];
}
