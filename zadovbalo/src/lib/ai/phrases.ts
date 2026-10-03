import { CATEGORY_COPY, type Category } from "@/lib/topics";

/** «і» після приголосного, «й» після голосного — милозвучність. */
function and(prev: string) {
  return /[аеєиіїоуюя]$/i.test(prev.trim()) ? "й" : "і";
}

/**
 * Коротка репліка з перевірених шаблонів (не текст моделі).
 * «Схоже, зараз найбільше тиснуть гроші й те, що все на тобі.»
 */
export function confirmPhrase(categories: readonly Category[], primary: Category | null): string {
  const ordered = primary ? [primary, ...categories.filter((c) => c !== primary)] : [...categories];
  const shown = ordered.filter((c) => c !== "general" || ordered.length === 1).slice(0, 2);
  if (shown.length === 0) return "Схоже, просто накипіло.";
  const [a, b] = shown.map((c) => CATEGORY_COPY[c]);
  if (!b) return `Схоже, зараз найбільше ${a!.plural ? "тиснуть" : "тисне"} ${a!.phrase}.`;
  return `Схоже, зараз найбільше тиснуть ${a!.phrase} ${and(a!.phrase)} ${b.phrase}.`;
}
