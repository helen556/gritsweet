"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { pdfUploadFinishAction, pdfUploadStartAction } from "@/app/admin/actions";

/**
 * Завантаження PDF книжки. На Supabase файл іде з браузера прямо в приватний bucket за одноразовим підписаним
 * посиланням (великі файли не впираються в ліміт сервера), потім сервер перевіряє, що це PDF, і прив'язує його.
 * Якщо Supabase Storage недоступний — файл іде частинами по 3 МБ через сервер і зберігається в базі.
 * На телефоні стандартне поле файлу схоже на звичайний текст, тому — велика кнопка: вибір файлу одразу запускає завантаження.
 */
export default function PdfUploadForm({ variantId }: { variantId: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(file: File) {
    const form = { reset: () => { if (input.current) input.current.value = ""; } };
    setName(file.name);
    if (file.size > 100 * 1024 * 1024) return setMsg({ error: "PDF до 100 МБ" });
    setMsg({}); setProgress(0);
    const done = (ok: string) => { setProgress(null); setMsg({ ok }); form.reset(); router.refresh(); };
    // запасний шлях: частинами по 3 МБ через сервер (працює й без Supabase Storage)
    const chunked = async () => {
      const CHUNK = 3 * 1024 * 1024, total = Math.max(1, Math.ceil(file.size / CHUNK));
      const upload = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      for (let i = 0; i < total; i++) {
        const fd = new FormData();
        fd.set("kind", "pdf_chunk"); fd.set("id", variantId); fd.set("upload", upload); fd.set("index", String(i)); fd.set("total", String(total));
        fd.set("file", new File([file.slice(i * CHUNK, (i + 1) * CHUNK)], "part.bin", { type: "application/octet-stream" }));
        let r: Response | null = null;
        for (let attempt = 0; attempt < 3 && !r?.ok; attempt++) r = await fetch("/api/admin/upload", { method: "POST", body: fd }).catch(() => null);
        if (!r?.ok) { const j = r ? await r.json().catch(() => ({})) : {}; setProgress(null); setMsg({ error: j.error ?? "Помилка завантаження. Перевірте інтернет і спробуйте ще раз." }); return; }
        setProgress(Math.round(((i + 1) / total) * 100));
      }
      done(`Завантажено (${(file.size / 1048576).toFixed(1)} МБ)`);
    };
    const start = await pdfUploadStartAction(variantId).catch(() => ({ error: "start" }));
    if ("error" in start || start.mode === "server") return chunked();
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
    if (!okPut) { setProgress(0); return chunked(); } // сховище Supabase не прийняло файл — частинами через сервер
    const fin: { ok?: string; error?: string } = await pdfUploadFinishAction(variantId, start.key).catch(() => ({ error: "Помилка перевірки файлу" }));
    if (fin.ok) return done(fin.ok);
    setProgress(null);
    setMsg(fin);
  }

  const busy = progress !== null;
  return (
    <div className="mt-3">
      <input ref={input} id={`pdf-${variantId}`} type="file" name="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={busy} aria-busy={busy} onClick={() => input.current?.click()}>
        {busy ? `Завантаження… ${progress}%` : "📄 Вибрати PDF і завантажити"}
      </button>
      {busy && <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10" aria-hidden="true"><div className="h-full bg-plum-700 transition-[width]" style={{ width: `${progress}%` }} /></div>}
      <p aria-live="polite" className="mt-2 text-sm">
        {name && !msg.ok && !msg.error && <span className="text-ink-soft">{name}</span>}
        {msg.ok && <span className="font-semibold text-plum-700">✓ {msg.ok}{name ? ` — ${name}` : ""}</span>}
        {msg.error && <span className="err">{msg.error}</span>}
      </p>
    </div>
  );
}
