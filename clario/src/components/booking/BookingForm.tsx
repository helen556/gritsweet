"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type FormEvent } from "react";
import type { Dictionary, Locale, ServiceId } from "@/content/dictionaries";
import { todayInKyiv, validateBooking, type BookingField } from "@/lib/booking";
import { btn } from "@/components/ui";
import { EyeMark } from "@/components/Icon";

type Props = {
  t: Dictionary["booking"];
  services: Dictionary["services"]["items"];
  lang: Locale;
  initialService?: ServiceId | "";
};

type Status = "idle" | "sending" | "success" | "error";

const fieldBase =
  "peer w-full rounded-2xl border bg-white/85 px-4 text-[1rem] text-graphite-900 placeholder:text-cold-400 " +
  "transition-[border-color,box-shadow,background-color] duration-300 focus:bg-white focus:outline-none focus:ring-4";
const okField = "border-cold-300 focus:border-ice-600 focus:ring-ice-100";
const badField = "border-[#b4564b] ring-4 ring-[#b4564b]/10 focus:border-[#b4564b] focus:ring-[#b4564b]/15";

export function BookingForm({ t, services, lang, initialService = "" }: Props) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [status, setStatus] = useState<Status>("idle");
  const [invalid, setInvalid] = useState<BookingField[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState({ name: "", phone: "", email: "", service: initialService as string, date: "", comment: "" });

  const today = todayInKyiv();
  const isBad = (f: BookingField) => invalid.includes(f);

  const payload = (v = values) => ({
    name: v.name.trim(),
    phone: v.phone.trim(),
    email: v.email.trim(),
    service: v.service,
    date: v.date,
    comment: v.comment.trim(),
    lang,
  });

  const update = (name: keyof typeof values, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    if (submitted) setInvalid(validateBooking(payload(next)));
  };


  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    const form = e.currentTarget;
    const bad = validateBooking(payload());
    setInvalid(bad);
    if (bad.length) {
      setStatus("idle");
      (form.querySelector<HTMLElement>(`[name="${bad[0]}"]`))?.focus();
      return;
    }
    setStatus("sending");
    // Static preview build has no server: show the success state without sending anything
    if (process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1") {
      window.setTimeout(() => setStatus("success"), 700);
      return;
    }
    try {
      const website = (form.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), website }),
      });
      if (res.status === 422) {
        const data = (await res.json()) as { invalid?: BookingField[] };
        setInvalid(data.invalid ?? []);
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const reset = () => {
    setValues({ name: "", phone: "", email: "", service: "", date: "", comment: "" });
    setInvalid([]);
    setSubmitted(false);
    setStatus("idle");
  };

  const label = "mb-2 block text-[0.8rem] font-semibold tracking-[0.01em] text-graphite-700";
  const err = (f: BookingField) =>
    isBad(f) ? (
      <p id={id(`${f}-err`)} className="mt-1.5 text-[0.8rem] text-[#9b463c]">
        {t.errors[f]}
      </p>
    ) : null;
  const a11y = (f: BookingField) => ({
    "aria-invalid": isBad(f) || undefined,
    "aria-describedby": isBad(f) ? id(`${f}-err`) : undefined,
  });

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {status === "success" ? (
          <motion.div
            key="done"
            role="status"
            initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center px-2 py-10 text-center"
          >
            <span className="mb-6 grid size-20 place-items-center rounded-full bg-ice-50 text-ice-700 shadow-[var(--shadow-glow)]">
              <EyeMark className="w-10" />
            </span>
            <h3 className="text-3xl font-light">{t.success.title}</h3>
            <p className="mt-3 max-w-sm text-graphite-600">{t.success.text}</p>
            <button type="button" onClick={reset} className={`${btn.secondary} mt-8`}>
              {t.success.again}
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={onSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="grid gap-5"
          >
            <div>
              <label htmlFor={id("name")} className={label}>{t.fields.name}</label>
              <input id={id("name")} name="name" autoComplete="name" required value={values.name} onChange={(e) => update("name", e.target.value)} className={`${fieldBase} h-13 ${isBad("name") ? badField : okField}`} {...a11y("name")} />
              {err("name")}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={id("phone")} className={label}>{t.fields.phone}</label>
                <input id={id("phone")} name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="+38 0__ ___ __ __" value={values.phone} onChange={(e) => update("phone", e.target.value)} className={`${fieldBase} h-13 ${isBad("phone") ? badField : okField}`} {...a11y("phone")} />
                {err("phone")}
              </div>
              <div>
                <label htmlFor={id("email")} className={label}>{t.fields.email}</label>
                <input id={id("email")} name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={(e) => update("email", e.target.value)} className={`${fieldBase} h-13 ${isBad("email") ? badField : okField}`} {...a11y("email")} />
                {err("email")}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={id("service")} className={label}>{t.fields.service}</label>
                <div className="relative">
                  <select id={id("service")} name="service" required value={values.service} onChange={(e) => update("service", e.target.value)} className={`${fieldBase} h-13 appearance-none pr-11 ${values.service ? "" : "text-cold-500"} ${isBad("service") ? badField : okField}`} {...a11y("service")}>
                    <option value="" disabled>{t.fields.servicePlaceholder}</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2 text-graphite-700" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                {err("service")}
              </div>
              <div>
                <label htmlFor={id("date")} className={label}>{t.fields.date}</label>
                <input id={id("date")} name="date" type="date" min={today} value={values.date} onChange={(e) => update("date", e.target.value)} className={`${fieldBase} h-13 ${values.date ? "" : "text-cold-500"} ${isBad("date") ? badField : okField}`} {...a11y("date")} />
                {err("date")}
              </div>
            </div>
            <div>
              <label htmlFor={id("comment")} className={label}>{t.fields.comment}</label>
              <textarea id={id("comment")} name="comment" rows={3} maxLength={1000} value={values.comment} onChange={(e) => update("comment", e.target.value)} className={`${fieldBase} min-h-28 resize-y py-3.5 ${okField}`} />
            </div>
            {/* Honeypot */}
            <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden="true">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <div aria-live="polite" className="min-h-0">
              {submitted && invalid.length > 0 && <p className="text-sm text-[#9b463c]">{t.errors.summary}</p>}
              {status === "error" && <p className="text-sm text-[#9b463c]">{t.errors.server}</p>}
            </div>

            <button type="submit" disabled={status === "sending"} className={`${btn.primary} h-14 w-full`}>
              {status === "sending" ? t.sending : t.submit}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
