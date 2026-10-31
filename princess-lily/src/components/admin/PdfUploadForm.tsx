"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadBookPdf } from "./upload-book-pdf";

/**
 * Кнопка завантаження PDF однієї мовної версії книжки. Кнопка — це <label> з прихованим полем файлу:
 * на iPhone такий варіант відкриває вибір файлу надійніше, ніж програмний click(). Вибір файлу одразу запускає завантаження.
 */
export default function PdfUploadForm({ variantId }: { variantId: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [name, setName] = useState("");
  const router = useRouter();
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setName(file.name); setMsg({});
    const r = await uploadBookPdf(variantId, file, setProgress);
    setProgress(null); setMsg(r);
    if (r.ok) router.refresh();
  }
  const busy = progress !== null;
  return (
    <div className="mt-3">
      <label className={`btn btn-primary w-full cursor-pointer sm:w-auto ${busy ? "pointer-events-none opacity-70" : ""}`}>
        <input id={`pdf-${variantId}`} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onPick} disabled={busy} />
        {busy ? `Завантаження… ${progress}%` : "📄 Вибрати PDF і завантажити"}
      </label>
      {busy && <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10" aria-hidden="true"><div className="h-full bg-plum-700 transition-[width]" style={{ width: `${progress}%` }} /></div>}
      <p aria-live="polite" className="mt-2 text-sm">
        {msg.ok && <span className="font-semibold text-plum-700">✓ {msg.ok}{name ? ` — ${name}` : ""}</span>}
        {msg.error && <span className="err">{msg.error}</span>}
      </p>
    </div>
  );
}
