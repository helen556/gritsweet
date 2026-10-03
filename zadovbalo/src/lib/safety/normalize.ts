/**
 * Зводить текст до форми, зручної для пошуку фраз:
 * нижній регістр, без апострофів, ё→е, повтори літер стиснуті («нееее» → «не»),
 * усе, що не літера/цифра, — пробіл.
 */
export function normalizeForMatching(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[’'ʼ`´‘]/g, "")
    .replace(/ё/g, "е")
    .replace(/([\p{L}])\1{2,}/gu, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}
