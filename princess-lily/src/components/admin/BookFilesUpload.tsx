"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadBookPdf } from "./upload-book-pdf";
import { matchBookFile } from "@/lib/pdf-match";

export type BookFileRow = { variantId: string; productId: string; title: string; locale: "uk" | "en"; uploaded: boolean };
type St = { pct?: number; ok?: string; error?: string; file?: string };

/** Усі PDF книжок однією кнопкою: файли розкладаються по книжках і мовах за назвами; для кожного рядка — і своя кнопка. */
export default function BookFilesUpload({ rows }: { rows: BookFileRow[] }) {
  const [st, setSt] = useState<Record<string, St>>({});
  const [unknown, setUnknown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const set = (id: string, s: St) => setSt((prev) => ({ ...prev, [id]: { ...prev[id], ...s } }));

  async function run(pairs: { row: BookFileRow; file: File }[]) {
    setBusy(true);
    for (const { row, file } of pairs) {
      set(row.variantId, { file: file.name, pct: 0, ok: undefined, error: undefined });
      const r = await uploadBookPdf(row.variantId, file, (pct) => set(row.variantId, { pct }));
      set(row.variantId, { pct: undefined, ...r });
    }
    setBusy(false);
    router.refresh();
  }
  function onPickMany(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    const pairs: { row: BookFileRow; file: File }[] = [];
    const miss: string[] = [];
    for (const f of files) {
      const m = matchBookFile(f.name);
      const row = m && rows.find((r) => r.productId === m.productId && r.locale === m.locale);
      if (row) pairs.push({ row, file: f }); else miss.push(f.name);
    }
    setUnknown(miss);
    void run(pairs);
  }

  return (
    <div className="space-y-5">
      <label className={`btn btn-primary w-full cursor-pointer py-4 text-lg ${busy ? "pointer-events-none opacity-70" : ""}`}>
        <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={onPickMany} disabled={busy} />
        {busy ? "Завантаження… не закривайте сторінку" : "📚 Вибрати всі PDF-файли одразу"}
      </label>
      <p className="text-sm text-ink-soft">У вікні вибору виділіть усі файли книжок (можна всі 10 разом). Сайт сам визначить книжку й мову за назвою файлу.
        Якщо файл не розпізнано — завантажте його кнопкою «Вибрати» у потрібному рядку.</p>
      {unknown.length > 0 && <p className="err" role="alert">Не розпізнано (завантажте в потрібний рядок вручну): {unknown.join(", ")}</p>}
      <ul className="divide-y divide-black/8 rounded-2xl border border-black/8 bg-paper">
        {rows.map((r) => {
          const s = st[r.variantId] ?? {};
          const done = s.ok || (r.uploaded && !s.error && s.pct === undefined);
          return (
            <li key={r.variantId} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-plum-700 text-white" : "bg-black/8 text-ink-soft"}`} aria-hidden="true">{done ? "✓" : "—"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title} <span className="text-ink-soft">· {r.locale === "uk" ? "українська" : "англійська"}</span></p>
                <p className="text-sm" aria-live="polite">
                  {s.pct !== undefined ? <span>Завантаження… {s.pct}% {s.file && <span className="text-ink-soft">({s.file})</span>}</span>
                    : s.error ? <span className="err">{s.error}</span>
                    : s.ok ? <span className="text-plum-700">✓ {s.ok}{s.file ? ` — ${s.file}` : ""}</span>
                    : r.uploaded ? <span className="text-plum-700">файл завантажено</span> : <span className="text-[#9a2f28]">файлу немає</span>}
                </p>
              </div>
              <label className={`btn btn-ghost btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run([{ row: r, file: f }]); }} />
                {r.uploaded || s.ok ? "Замінити" : "Вибрати"}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
