/** Нормалізує український номер до формату +380XXXXXXXXX. Повертає null, якщо номер некоректний. */
export function normalizeUaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let core: string | null = null;
  if (digits.length === 12 && digits.startsWith("380")) core = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith("80")) core = digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("0")) core = digits.slice(1);
  else if (digits.length === 9) core = digits;
  if (!core || !/^[3-9]\d{8}$/.test(core)) return null;
  return `+380${core}`;
}
export function formatUaPhone(e164: string): string {
  const m = /^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
