import type { Category } from "@/lib/topics";

export const SCENE_IDS = ["debt", "backpack", "yarn", "sand", "dishes", "bubble", "candle", "stay", "can", "war_map", "unsaid"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const isSceneId = (v: unknown): v is SceneId => typeof v === "string" && (SCENE_IDS as readonly string[]).includes(v);

/** Сцени попередніх версій → нинішні (старі посилання й відповіді моделі не ламаються). Глину замінила плівка. */
export const LEGACY_SCENES: Readonly<Record<string, SceneId>> = { stickers: "unsaid", paper: "bubble", ice: "bubble", clay: "bubble" };

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
  /** Підпис кнопки повтору («Нова плівка», «Нова банка»…). */
  restart: string;
  /** Руйнівна дія: не пропонується в режимі підтримки. */
  destructive: boolean;
}

export const SCENES: Record<SceneId, SceneMeta> = {
  debt: {
    id: "debt",
    title: "Гроші й борги",
    action: "Переносити купюри, поки сума не стане нулем",
    intro: "Уяви, як ця сума зменшується. Перенось купюри на неї.",
    hint: "Візьми купюру й перенеси на суму.",
    outro: "Який маленький крок до цього ти можеш зробити насправді?",
    outroNote: "Один реальний крок (необовʼязково)",
    restart: "Почати знову",
    destructive: false,
  },
  backpack: {
    id: "backpack",
    title: "Усе на мені",
    action: "Витягати камені з рюкзака й закрити його",
    intro: "Подумай, що ти зараз тягнеш на собі. Назви камені, якщо хочеш, і відкладай по одному.",
    hint: "Витягни камінь і поклади поруч.",
    outro: "Не все потрібно нести зараз.",
    outroNote: "Що відкладаю на сьогодні (необовʼязково)",
    restart: "Почати знову",
    destructive: false,
  },
  yarn: {
    id: "yarn",
    title: "Думки по колу",
    action: "Витягнути нитку з плутанини й змотати клубок",
    intro: "Подумай про те, що крутиться в голові. Не треба розібратися з усім одразу — почни з однієї ниточки.",
    hint: "Візьми кінець нитки й крути пальцем по колу.",
    outro: "Можна рухатися по одній думці, по одному кроку.",
    restart: "Почати знову",
    destructive: false,
  },
  sand: {
    id: "sand",
    title: "Навести лад",
    action: "Дістати камінці з піску, викласти рядочком, розрівняти пісок",
    intro: "Подумай, що хочеться впорядкувати. Діставай камінці з піску й знаходь кожному місце.",
    hint: "Перенеси камінці на вільну частину дошки. Потім розрівняй пісок.",
    outro: "На що ти можеш вплинути зараз, а що можна поки залишити?",
    outroNote: "Твоя відповідь (необовʼязково)",
    restart: "Почати знову",
    destructive: false,
  },
  dishes: {
    id: "dishes",
    title: "Просто бісить",
    action: "Розбити тарілку чи пляшку об стіну",
    intro: "Бісить? Можеш нічого не пояснювати. Обери, що хочеш розбити.",
    hint: "Відтягни предмет і відпусти — він полетить у стіну.",
    outro: "Як ти зараз?",
    restart: "Почати знову",
    destructive: true,
  },
  bubble: {
    id: "bubble",
    title: "Полопати плівку",
    action: "Лопати пухирці пакувальної плівки",
    intro: "Можеш нічого не пояснювати. Просто лопай пухирці.",
    hint: "Натисни на пухирець і трохи потримай.",
    outro: "Можеш продовжити або зупинитися тут.",
    restart: "Нова плівка",
    destructive: false,
  },
  candle: {
    id: "candle",
    title: "Хочу тиші",
    action: "Запалити свічку й посидіти в тиші",
    intro: "Тут тихо. Запали свічку й побудь скільки хочеш.",
    hint: "Піднеси сірник до ґнота.",
    outro: "Можеш побути тут ще.",
    restart: "Почати знову",
    destructive: false,
  },
  stay: {
    id: "stay",
    title: "Побудь тут",
    action: "Свічка, чай і дощ за вікном",
    intro: "Можеш просто побути тут. Нічого не потрібно робити правильно.",
    hint: "Можна повернути чашку або провести пальцем по запітнілому склу.",
    outro: "Можеш побути тут стільки, скільки потрібно.",
    restart: "Почати знову",
    destructive: false,
  },
  can: {
    id: "can",
    title: "Хочу паузу",
    action: "Відкрити холодну банку",
    intro: "Пауза. Нічого не треба вирішувати просто зараз.",
    hint: "Підчепи кільце й потягни вгору.",
    outro: "Можна ще трохи посидіти.",
    restart: "Нова банка",
    destructive: false,
  },
  war_map: {
    id: "war_map",
    title: "Злість через війну",
    action: "Рвати, палити або знищити паперову карту",
    intro: "Якщо зараз це про злість через війну — можеш виразити її тут, з паперовою картою.",
    hint: "Проведи пальцем, щоб розірвати.",
    outro: "Зупинись на мить. Як ти зараз?",
    restart: "Нова карта",
    destructive: true,
  },
  unsaid: {
    id: "unsaid",
    title: "Те, що не встигла сказати",
    action: "Написати й «відправити» невисловлене — приватно",
    intro: "Напиши те, що хотіла сказати, але не відправила. Тут можна договорити.",
    hint: "Напиши повідомлення й натисни «Надіслати».",
    outro: "Твої слова тепер мають місце. Можеш побути тут стільки, скільки потрібно.",
    restart: "Почати знову",
    destructive: false,
  },
};

/** Сцени теми (перша — основна). */
export const CATEGORY_SCENES: Record<Category, readonly SceneId[]> = {
  financial_debt: ["debt"],
  overload: ["backpack"],
  rumination: ["yarn"],
  anger: ["dishes", "bubble"],
  unsaid_words: ["unsaid"],
  control: ["sand"],
  // Карта — лише для злості; страх і горе через війну отримують тихіші варіанти.
  war_anger: ["war_map"],
  quiet: ["candle"],
  lonely: ["stay"],
  // Пауза — короткий вибір між трьома тихими діями.
  pause: ["can", "bubble", "candle"],
  general: ["bubble", "candle", "yarn"],
  needs_support: ["candle"],
};

/** Теми, для яких завжди показується короткий вибір із кількох сцен (а не одразу перша). */
export const CHOICE_CATEGORIES: readonly Category[] = ["pause", "general"];

/** Тихі дії, коли війна — це страх чи втрата, а не злість. */
export const WAR_QUIET_SCENES: readonly SceneId[] = ["candle", "unsaid"];

/** Дозволені сцени для набору тем — єдине джерело правди для валідації відповіді AI. */
export function allowedScenes(categories: readonly Category[]): SceneId[] {
  return [...new Set(categories.flatMap((c) => CATEGORY_SCENES[c]))];
}

/** Тема, до якої належить сцена (для підказок у ручному виборі). */
export const SCENE_CATEGORY: Record<SceneId, Category> = {
  debt: "financial_debt",
  backpack: "overload",
  yarn: "rumination",
  sand: "control",
  dishes: "anger",
  bubble: "anger",
  candle: "quiet",
  stay: "lonely",
  can: "pause",
  war_map: "war_anger",
  unsaid: "unsaid_words",
};
