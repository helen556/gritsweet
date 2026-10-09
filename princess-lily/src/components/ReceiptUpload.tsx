"use client";
import { useState } from "react";

/** Покупець може приватно додати квитанцію до свого замовлення (доступ за токеном сторінки статусу). */
export default function ReceiptUpload({ token, t }: { token: string; t: { title: string; hint: string; upload: string; ok: string; err: string } }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  return (
    <form className="mt-6 rounded-2xl border border-black/10 p-4" onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      fd.set("token", token);
      setState("busy");
      const r = await fetch("/api/receipts", { method: "POST", body: fd }).catch(() => null);
      setState(r?.ok ? "ok" : "err");
    }}>
      <p className="font-semibold">{t.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{t.hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input type="file" name="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="min-h-11 text-sm" aria-label={t.title} />
        <button className="btn btn-ghost btn-sm" disabled={state === "busy"}>{t.upload}</button>
        <span aria-live="polite" className="text-sm">{state === "ok" ? `✓ ${t.ok}` : state === "err" ? <span className="err">{t.err}</span> : null}</span>
      </div>
    </form>
  );
}
