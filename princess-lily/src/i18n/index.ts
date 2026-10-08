import uk from "./uk";
import en from "./en";
import type { Dict } from "./uk";

export const LOCALES = ["uk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uk";
export const hasLocale = (l: string): l is Locale => (LOCALES as readonly string[]).includes(l);
const dicts: Record<Locale, Dict> = { uk, en };
export const getDict = (l: Locale): Dict => dicts[l];
export type { Dict };
