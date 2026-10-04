import { z } from "zod";

export const serviceIds = ["consultation", "diagnostics", "pediatric", "laser", "cataract", "optics"] as const;

export type BookingField = "name" | "phone" | "email" | "service" | "date";

/** Today's date as YYYY-MM-DD in Kyiv, so "today" matches the clinic's calendar. */
export function todayInKyiv(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const bookingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]+$/)
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 15;
    }),
  email: z.union([z.literal(""), z.email().max(120)]),
  service: z.enum(serviceIds),
  date: z.union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => v >= todayInKyiv()),
  ]),
  comment: z.string().trim().max(1000),
  lang: z.enum(["uk", "en"]),
});

export type BookingInput = z.infer<typeof bookingSchema>;

/** Returns the list of invalid fields (empty when valid). */
export function validateBooking(data: unknown): BookingField[] {
  const result = bookingSchema.safeParse(data);
  if (result.success) return [];
  const fields = new Set<BookingField>();
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "phone" || key === "email" || key === "service" || key === "date") fields.add(key);
  }
  return [...fields];
}
