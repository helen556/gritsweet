"use client";
import { pdfUploadFinishAction, pdfUploadStartAction } from "@/app/admin/actions";

/**
 * Завантаження PDF книжки з браузера: прямо в Supabase Storage за підписаним посиланням, а якщо сховище
 * недоступне — частинами по 3 МБ через сервер (ліміт тіла запиту на Vercel ~4,5 МБ). Повертає текст результату.
 */
export async function uploadBookPdf(variantId: string, file: File, onProgress: (pct: number) => void): Promise<{ ok?: string; error?: string }> {
  if (file.size > 100 * 1024 * 1024) return { error: "PDF до 100 МБ" };
  const mb = `${(file.size / 1048576).toFixed(1)} МБ`;
  const chunked = async (): Promise<{ ok?: string; error?: string }> => {
    const CHUNK = 3 * 1024 * 1024, total = Math.max(1, Math.ceil(file.size / CHUNK));
    const upload = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    for (let i = 0; i < total; i++) {
      const fd = new FormData();
      fd.set("kind", "pdf_chunk"); fd.set("id", variantId); fd.set("upload", upload); fd.set("index", String(i)); fd.set("total", String(total));
      fd.set("file", new File([file.slice(i * CHUNK, (i + 1) * CHUNK)], "part.bin", { type: "application/octet-stream" }));
      let r: Response | null = null;
      for (let attempt = 0; attempt < 3 && !r?.ok; attempt++) r = await fetch("/api/admin/upload", { method: "POST", body: fd }).catch(() => null);
      if (!r?.ok) { const j = r ? await r.json().catch(() => ({})) : {}; return { error: j.error ?? "Помилка завантаження. Перевірте інтернет і спробуйте ще раз." }; }
      onProgress(Math.round(((i + 1) / total) * 100));
    }
    return { ok: `Завантажено (${mb})` };
  };
  onProgress(0);
  const start = await pdfUploadStartAction(variantId).catch(() => ({ error: "start" }));
  if ("error" in start || start.mode === "server") return chunked();
  const okPut = await new Promise<boolean>((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", start.url);
    x.setRequestHeader("content-type", "application/pdf");
    x.setRequestHeader("x-upsert", "true");
    x.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100)); };
    x.onload = () => resolve(x.status >= 200 && x.status < 300);
    x.onerror = () => resolve(false);
    x.send(file);
  });
  if (!okPut) { onProgress(0); return chunked(); } // сховище не прийняло — частинами через сервер
  const fin: { ok?: string; error?: string } = await pdfUploadFinishAction(variantId, start.key).catch(() => ({ error: "Помилка перевірки файлу" }));
  return fin;
}
