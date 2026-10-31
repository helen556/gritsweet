"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pdfUploadFinishAction, pdfUploadStartAction } from "@/app/admin/actions";

/**
 * Завантаження PDF книжки. На Supabase файл іде з браузера прямо в приватний bucket за одноразовим підписаним
 * посиланням (великі файли не впираються в ліміт сервера), потім сервер перевіряє, що це PDF, і прив'язує його.
 */
export default function PdfUploadForm({ variantId }: { variantId: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return setMsg({ error: "PDF до 100 МБ" });
    setMsg({}); setProgress(0);
    const start = await pdfUploadStartAction(variantId).catch(() => ({ error: "Не вдалося почати завантаження" }));
    if ("error" in start) { setProgress(null); return setMsg({ error: start.error }); }
    if (start.mode === "server") {
      const fd = new FormData(); fd.set("kind", "pdf"); fd.set("id", variantId); fd.set("file", file);
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      setProgress(null);
      if (!r?.ok) return setMsg({ error: j.error ?? "Помилка завантаження" });
      setMsg({ ok: "Завантажено" }); form.reset(); return router.refresh();
    }
    const okPut = await new Promise<boolean>((resolve) => {
      const x = new XMLHttpRequest();
      x.open("PUT", start.url);
      x.setRequestHeader("content-type", "application/pdf");
      x.setRequestHeader("x-upsert", "true");
      x.upload.onprogress = (ev) => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
      x.onload = () => resolve(x.status >= 200 && x.status < 300);
      x.onerror = () => resolve(false);
      x.send(file);
    });
    if (!okPut) { setProgress(null); return setMsg({ error: "Не вдалося завантажити файл у сховище. Перевірте інтернет і спробуйте ще раз." }); }
    const fin: { ok?: string; error?: string } = await pdfUploadFinishAction(variantId, start.key).catch(() => ({ error: "Помилка перевірки файлу" }));
    setProgress(null);
    setMsg(fin);
    if (fin.ok) { form.reset(); router.refresh(); }
  }

  const busy = progress !== null;
  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="field"><label htmlFor={`pdf-${variantId}`} className="text-sm">Завантажити PDF (до 100 МБ)</label>
        <input id={`pdf-${variantId}`} type="file" name="file" accept="application/pdf" required className="block min-h-11 text-sm" /></div>
      <button className="btn btn-ghost btn-sm" disabled={busy} aria-busy={busy}>{busy ? `Завантаження… ${progress}%` : "Завантажити"}</button>
      <span aria-live="polite" className="text-sm">{msg.ok && <span className="text-plum-700">✓ {msg.ok}</span>}{msg.error && <span className="err">{msg.error}</span>}</span>
    </form>
  );
}
