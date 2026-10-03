/** Теми (що тисне). Емоція — окреме поле, не тема. */
export const CATEGORIES = [
  "financial_debt",
  "overload",
  "rumination",
  "anger",
  "hurtful_words",
  "control",
  "war_anger",
  "general",
  "needs_support",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const EMOTIONS = ["anger", "anxiety", "fear", "sadness", "exhaustion", "overwhelm", "shame", "numbness"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const CURRENCIES = ["UAH", "USD", "EUR", "PLN", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCategory = (v: unknown): v is Category => typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);

/** Тексти тем: підпис для вибору й фрагмент для фрази «Схоже, зараз найбільше тиснуть …». */
export const CATEGORY_COPY: Record<Category, { label: string; hint: string; phrase: string; plural: boolean }> = {
  financial_debt: { label: "Гроші й борги", hint: "Сума, що висить над головою", phrase: "гроші", plural: true },
  overload: { label: "Все на мені", hint: "Забагато справ і відповідальності", phrase: "те, що все на тобі", plural: false },
  rumination: { label: "Думки по колу", hint: "Одне й те саме крутиться в голові", phrase: "думки, що крутяться по колу", plural: true },
  anger: { label: "Злість", hint: "Хочеться щось змʼяти чи розбити", phrase: "злість", plural: false },
  hurtful_words: { label: "Чужі слова", hint: "Сказане кимось досі липне", phrase: "чужі слова", plural: true },
  control: { label: "Все вислизає", hint: "Хочеться хоч трохи керувати чимось", phrase: "відчуття, що все вислизає з рук", plural: false },
  war_anger: { label: "Злість через війну", hint: "Лють, якій нема куди подітися", phrase: "злість через війну", plural: false },
  general: { label: "Просто накипіло", hint: "Без конкретної причини", phrase: "загальна втома від усього", plural: false },
  needs_support: { label: "Дуже важко", hint: "Зараз потрібна підтримка", phrase: "щось дуже важке", plural: false },
};

/** Порядок у ручному виборі. needs_support іде окремою кнопкою. */
export const MANUAL_CATEGORIES: readonly Category[] = [
  "financial_debt",
  "overload",
  "rumination",
  "anger",
  "hurtful_words",
  "control",
  "war_anger",
  "general",
];
