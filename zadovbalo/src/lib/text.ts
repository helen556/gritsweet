/** Короткі фрази з тексту людини (для назв у рюкзаку). Нічого не вигадує — лише ріже її ж текст. */
export function splitPhrases(text: string, max = 6): string[] {
  const parts = text
    .split(/[\n,.;!?:()]+|\s(?:і|й|та|ще|а ще|и|також|плюс)\s/iu)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 3 && p.length <= 32 && /\p{L}/u.test(p));
  return [...new Set(parts)].slice(0, max);
}

export function parseAmountInput(raw: string): number | null {
  const s = raw.replace(/[\s  ']/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= 1e12 ? n : null;
}
