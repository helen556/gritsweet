import { formatInTimeZone } from "date-fns-tz";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

export const TZ = "Europe/Kyiv";

/** Сьогоднішня дата за Києвом, YYYY-MM-DD. */
export function todayKyiv(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}
export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime());
}
export function daysFromToday(date: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(todayKyiv()));
}
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let d = parseISO(from);
  const end = parseISO(to);
  while (d <= end) { out.push(formatInTimeZone(d, "UTC", "yyyy-MM-dd")); d = addDays(d, 1); }
  return out;
}
export function formatDateUk(iso: string): string {
  return formatInTimeZone(parseISO(iso + "T12:00:00Z"), "UTC", "d MMMM yyyy", { locale: undefined });
}
