import type { Dict } from "@/i18n";
import type { BookFormat, Locale } from "@/db/types";

/**
 * Характеристики книжок серії — централізовано (погоджено власницею 27.10.2026).
 * Кількість сторінок окремої книжки можна змінити в адмінці (поле «Сторінок»), решта — спільна для серії.
 * Тип палітурки (тверда/м'яка) і фізичний розмір НЕ зазначаємо, доки їх не підтверджено.
 */
export const SERIES_SPECS = {
  pages: 26,
  /** Обкладинка друкованої книжки */
  printCover: "glossy",
  illustrations: "color",
} as const;

/** Комплекти: id товару → кількість книжок у ньому. */
export const BUNDLES: Record<string, number> = { prd_set5: 5 };

export type SpecRow = { key: string; label: string; value: string; /** показувати лише для друкованого формату */ printOnly?: boolean };

/** Рядки блоку «Характеристики книжки» для сторінки товару (формати й мови — лише ті, що реально продаються). */
export function bookSpecRows(t: Dict, p: { id: string; pages: number | null; age_from: number | null; age_to: number | null; size_label: string | null; binding_label: string | null }, langs: Locale[], formats: BookFormat[]): SpecRow[] {
  const s = t.specs;
  const bundle = BUNDLES[p.id];
  const pages = p.pages ?? SERIES_SPECS.pages;
  const order = <T extends string>(xs: T[], by: readonly T[]) => by.filter((x) => xs.includes(x));
  return [
    { key: "author", label: s.author, value: t.author.name },
    { key: "series", label: s.series, value: t.brand.name },
    ...(bundle ? [{ key: "books", label: s.booksInSet, value: String(bundle) }] : []),
    { key: "pages", label: s.pages, value: bundle ? s.pagesEach(pages) : String(pages) },
    ...(p.age_from != null && p.age_to != null ? [{ key: "age", label: t.product.ageLabel, value: t.product.age(p.age_from, p.age_to) }] : []),
    { key: "illustrations", label: s.illustrations, value: s.illustrationsColor },
    { key: "language", label: s.language, value: order(langs, ["uk", "en"] as const).map((l) => s.languages[l]).join(" / ") },
    { key: "format", label: s.format, value: order(formats, ["print", "pdf"] as const).map((f) => s.formats[f]).join(" / ") },
    ...(formats.includes("print") ? [{ key: "cover", label: s.cover, value: s.coverGlossy, printOnly: true }] : []),
    // лише коли власниця підтвердила й заповнила в адмінці
    ...(formats.includes("print") && p.binding_label ? [{ key: "binding", label: t.product.binding, value: p.binding_label, printOnly: true }] : []),
    ...(formats.includes("print") && p.size_label ? [{ key: "size", label: t.product.size, value: p.size_label, printOnly: true }] : []),
    { key: "category", label: s.category, value: s.categoryValue },
  ];
}
