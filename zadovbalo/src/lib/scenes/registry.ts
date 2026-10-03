import type { Category } from "@/lib/topics";

export const SCENE_IDS = ["debt", "backpack", "yarn", "sand", "clay", "war_map", "unsaid"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const isSceneId = (v: unknown): v is SceneId => typeof v === "string" && (SCENE_IDS as readonly string[]).includes(v);

/** Сцени попередніх версій → нинішні (старі посилання й відповіді моделі не ламаються). */
export const LEGACY_SCENES: Readonly<Record<string, SceneId>> = { stickers: "unsaid", paper: "clay", ice: "clay" };

export function migrateScene(v: unknown): unknown {
  return typeof v === "string" && v in LEGACY_SCENES ? LEGACY_SCENES[v] : v;
}

export interface SceneMeta {
  id: SceneId;
  title: string;
  /** Що людина робитиме — одним рядком. */
  action: string;
  /** Вступ на початку сцени. */
  intro: string;
  /** Перша підказка жесту. */
  hint: string;
  /** Мʼяке завершення. */
  outro: string;
  /** Чи пропонувати необовʼязкове поле відповіді у фіналі (лише в памʼяті). */
  outroNote?: string;
  /** Руйнівна дія: не пропонується в режимі підтримки. */
  destructive: boolean;
}

export const SCENES: Record<SceneId, SceneMeta> = {
  debt: {
    id: "debt",
    title: "Гроші й борги",
    action: "Перекладати купюри, поки сума не стане нулем",
    intro: "Уяви, як ця сума поступово зменшується. Перекладай купюри й дай собі побачити цей момент.",
    hint: "Візьми купюру й перенеси на суму.",
    outro: "Який маленький крок до цього ти можеш зробити насправді?",
    outroNote: "Один реальний крок (необовʼязково)",
    destructive: false,
  },
  backpack: {
    id: "backpack",
    title: "Усе на мені",
    action: "Витягати камені з рюкзака й класти поруч",
    intro: "Подумай, що ти зараз тягнеш на собі. Назви камені, якщо хочеш, і відкладай по одному.",
    hint: "Витягни камінь і поклади поруч.",
    outro: "Не все потрібно нести саме зараз. Що можеш відкласти на сьогодні?",
    outroNote: "Що відкладаю на сьогодні (необовʼязково)",
    destructive: false,
  },
  yarn: {
    id: "yarn",
    title: "Думки по колу",
    action: "Витягнути нитку з плутанини й змотати клубок",
    intro: "Подумай про те, що крутиться в голові. Не потрібно розібратися з усім одразу — почни з однієї ниточки.",
    hint: "Підхопи кінець і води пальцем по колу — нитка змотуватиметься.",
    outro: "Можна рухатися по одній думці, по одному кроку.",
    destructive: false,
  },
  sand: {
    id: "sand",
    title: "Навести лад",
    action: "Дістати камінці з піску, викласти рядочком, розрівняти пісок",
    intro: "Подумай, що хочеться впорядкувати. Відділяй камінці від піску й знаходь для кожного своє місце.",
    hint: "Перенеси камінці на вільну частину дошки. Потім розрівняй пісок.",
    outro: "На що ти можеш вплинути зараз, а що можеш поки залишити?",
    outroNote: "Твоя відповідь (необовʼязково)",
    destructive: false,
  },
  clay: {
    id: "clay",
    title: "Дати форму",
    action: "Мʼяти, тягнути, тиснути й розгладжувати глину",
    intro: "Якщо важко підібрати слова, спробуй передати цей стан рухом. Мни, тягни й змінюй форму, як тобі хочеться.",
    hint: "Натискай і тягни. Проведи по поверхні, щоб розгладити.",
    outro: "Можеш продовжити або зупинитися тут.",
    destructive: false,
  },
  war_map: {
    id: "war_map",
    title: "Злість через війну",
    action: "Рвати, палити або знищити паперову карту",
    intro: "Якщо зараз це про злість через війну — можеш виразити її тут через дію з паперовою картою.",
    hint: "Проведи пальцем, щоб розірвати.",
    outro: "Зупинись на мить. Як ти зараз?",
    destructive: true,
  },
  unsaid: {
    id: "unsaid",
    title: "Те, що не встигла сказати",
    action: "Написати й «відправити» невисловлене — приватно",
    intro: "Напиши те, що хотіла сказати, але не відправила. Тут можна договорити.",
    hint: "Напиши повідомлення й натисни «Надіслати».",
    outro: "Твої слова тепер мають місце. Можеш побути тут стільки, скільки потрібно.",
    destructive: false,
  },
};

/** Сцена для теми (перша — основна). */
export const CATEGORY_SCENES: Record<Category, readonly SceneId[]> = {
  financial_debt: ["debt"],
  overload: ["backpack"],
  rumination: ["yarn"],
  anger: ["clay"],
  unsaid_words: ["unsaid"],
  control: ["sand"],
  // Карта — лише для злості; тихіші варіанти пропонуються окремо (страх/горе через війну).
  war_anger: ["war_map"],
  general: ["clay", "sand", "yarn"],
  needs_support: ["sand"],
};

/** Тихі дії, коли війна — це страх чи втрата, а не злість. */
export const WAR_QUIET_SCENES: readonly SceneId[] = ["sand", "unsaid"];

/** Дозволені сцени для набору тем — єдине джерело правди для валідації відповіді AI. */
export function allowedScenes(categories: readonly Category[]): SceneId[] {
  return [...new Set(categories.flatMap((c) => CATEGORY_SCENES[c]))];
}

/** Тема, до якої належить сцена (для «Змінити сцену»). */
export const SCENE_CATEGORY: Record<SceneId, Category> = {
  debt: "financial_debt",
  backpack: "overload",
  yarn: "rumination",
  sand: "control",
  clay: "anger",
  war_map: "war_anger",
  unsaid: "unsaid_words",
};
