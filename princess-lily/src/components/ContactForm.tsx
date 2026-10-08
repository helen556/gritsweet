"use client";
import { startTransition, useActionState } from "react";
import { submitContact, type ContactState } from "@/app/[lang]/actions";
import type { Dict } from "@/i18n";

export default function ContactForm({ lang, t }: { lang: "uk" | "en"; t: Dict["contact"] }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });
  const bad = (f: string) => state.fields?.includes(f) ? { "aria-invalid": true as const } : {};
  if (state.status === "ok") return <div className="card p-8" role="status"><p className="text-lg">{t.ok}</p></div>;
  return (
    <form action={action} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="card space-y-5 p-6 sm:p-8" noValidate>
      <input type="hidden" name="lang" value={lang} />
      <div className="field"><label htmlFor="c-name">{t.name}</label><input id="c-name" name="name" autoComplete="name" required maxLength={120} className="input" {...bad("name")} /></div>
      <div className="field"><label htmlFor="c-email">{t.email}</label><input id="c-email" name="email" type="email" autoComplete="email" required className="input" {...bad("email")} /></div>
      <div className="field"><label htmlFor="c-order">{t.order}</label><input id="c-order" name="order" maxLength={40} className="input" /></div>
      <div className="field"><label htmlFor="c-msg">{t.message}</label><textarea id="c-msg" name="message" rows={6} required minLength={5} maxLength={4000} className="input" {...bad("message")} /></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
      <div aria-live="assertive">{state.status === "error" && <p className="err" role="alert">{t.errors[(state.error as keyof typeof t.errors) ?? "generic"] ?? t.errors.generic}</p>}</div>
      <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{pending ? t.sending : t.send}</button>
    </form>
  );
}
