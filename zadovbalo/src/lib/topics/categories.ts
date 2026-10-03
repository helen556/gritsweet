/** Усі тригери, які розпізнає класифікатор. Порядок значення не має. */
export const CATEGORY_IDS = [
  "war",
  "air_raid",
  "bad_news",
  "fear_for_family",
  "uncertainty",
  "ex",
  "relationship_conflict",
  "waiting_for_reply",
  "toxic_person",
  "family_boundaries",
  "friendship",
  "loneliness",
  "work",
  "boss",
  "client",
  "deadline",
  "overload",
  "procrastination",
  "starting_problem",
  "motivation",
  "money",
  "debt",
  "low_income",
  "high_prices",
  "purchase_frustration",
  "weight",
  "body_image",
  "diet",
  "low_energy",
  "sleep",
  "parental_overload",
  "mess",
  "no_time_for_self",
  "social_media",
  "comparison",
  "success_comparison",
  "hate_job",
  "quit_impulse",
  "text_ex",
  "argument_impulse",
  "prove_something",
  "not_understood",
  "not_appreciated",
  "plans_failed",
  "mistake",
  "shame",
  "self_anger",
  "numbness",
  "everything",
  "unknown",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const EMOTIONS = [
  "anger",
  "anxiety",
  "fear",
  "sadness",
  "exhaustion",
  "frustration",
  "overwhelm",
  "resentment",
  "shame",
  "guilt",
  "loneliness",
  "numbness",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const TONES = ["direct", "soft", "quiet", "playful"] as const;
export type Tone = (typeof TONES)[number];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}
