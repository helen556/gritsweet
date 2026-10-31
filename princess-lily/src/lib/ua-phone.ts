/**
 * Український мобільний номер у форматі +380XXXXXXXXX. Однакова перевірка в браузері й на сервері.
 * Приймає звичні способи введення (+380 50 123 45 67, 0501234567, 380501234567, (050) 123-45-67)
 * і повертає нормалізований +380XXXXXXXXX або null.
 */
export function normalizeUaPhone(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  const full = d.length === 12 && d.startsWith("380") ? d : d.length === 10 && d.startsWith("0") ? `38${d}` : d.length === 11 && d.startsWith("80") ? `3${d}` : "";
  // код оператора/міста після +380 не починається з 0
  return /^380[1-9]\d{8}$/.test(full) ? `+${full}` : null;
}

/** Маска під час введення: «+380 XX XXX XX XX» (лише цифри, не більше 9 після коду країни). */
export function maskUaPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("380")) d = d.slice(3);
  else if (d.startsWith("80")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  d = d.replace(/^0+/, "").slice(0, 9); // «+380 050…» — зайвий нуль після коду країни
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.length ? `+380 ${parts.join(" ")}` : "+380 ";
}
