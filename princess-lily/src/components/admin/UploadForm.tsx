"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Завантаження обкладинки / приватного PDF через захищений ендпоінт /api/admin/upload. */
export default function UploadForm({ kind, targetId, accept, label }: { kind: "cover" | "pdf"; targetId: string; accept: string; label: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true); setMsg({});
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) { setMsg({ ok: "Завантажено" }); e.currentTarget?.reset(); router.refresh(); } else setMsg({ error: j.error ?? "Помилка завантаження" });
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={targetId} />
      <div className="field"><label htmlFor={`f-${kind}-${targetId}`} className="text-sm">{label}</label>
        <input id={`f-${kind}-${targetId}`} type="file" name="file" accept={accept} required className="block min-h-11 text-sm" /></div>
      <button className="btn btn-ghost btn-sm" disabled={busy} aria-busy={busy}>{busy ? "Завантаження…" : "Завантажити"}</button>
      <span aria-live="polite" className="text-sm">{msg.ok && <span className="text-moss-700">✓ {msg.ok}</span>}{msg.error && <span className="err">{msg.error}</span>}</span>
    </form>
  );
}
