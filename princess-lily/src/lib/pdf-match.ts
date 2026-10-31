/**
 * Розпізнавання книжки й мови за назвою файлу (для «завантажити всі файли одразу»).
 * Lili_Doctor_UA_email.pdf → лікар, UA; Lily_Spotty_EN_email.pdf → Бублик, EN; Lili_UA_updated_email.pdf → горщик, UA.
 */
const BOOKS: [string, RegExp][] = [
  ["prd_doctor", /doctor|likar|лікар/i],
  ["prd_bublik", /bublyk|bublik|spotty|бублик|кігт/i],
  ["prd_potty", /potty|horshch|горщик|ua[_ -]?updated/i],
  ["prd_friend", /friend|druzh|дружи/i],
  ["prd_sleep", /sleep|bedtime|son\b|сон/i],
];

export function matchBookFile(fileName: string): { productId: string; locale: "uk" | "en" } | null {
  const n = fileName.normalize("NFC");
  const book = BOOKS.find(([, re]) => re.test(n))?.[0];
  if (!book) return null;
  const locale = /(^|[_\W])(ua|uk|укр)([_\W]|$)/i.test(n) || /^lili/i.test(n) ? "uk"
    : /(^|[_\W])(en|eng)([_\W]|$)/i.test(n) || /^lily/i.test(n) || /learns|friend[^_]*pages/i.test(n) ? "en" : null;
  return locale ? { productId: book, locale } : null;
}
