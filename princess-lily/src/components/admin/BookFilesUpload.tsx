"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadBookPdf } from "./upload-book-pdf";
import { matchBookFile } from "@/lib/pdf-match";

/** PDF з ZIP-архіву (розпаковка в браузері; службові файли macOS пропускаються). */
async function pdfsFromZip(zip: File): Promise<File[]> {
  const { unzip } = await import("fflate");
  const data = new Uint8Array(await zip.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((res, rej) => unzip(data, { filter: (f) => /\.pdf$/i.test(f.name) && !/(^|\/)(__MACOSX|\._)/.test(f.name) }, (err, out) => (err ? rej(err) : res(out))));
  return Object.entries(entries).map(([name, bytes]) => new File([bytes as BlobPart], name.split("/").pop()!, { type: "application/pdf" }));
}

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
  /** Кнопка рядка: PDF або ZIP (з архіву береться PDF саме цієї книжки й мови). */
  async function onPickOne(row: BookFileRow, f: File) {
    if (!(/\.zip$/i.test(f.name) || f.type.includes("zip"))) return run([{ row, file: f }]);
    setBusy(true);
    let pdfs: File[] = [];
    try { pdfs = await pdfsFromZip(f); } catch { /* нижче — помилка */ }
    const own = pdfs.filter((p) => { const m = matchBookFile(p.name); return m?.productId === row.productId && m.locale === row.locale; });
    const file = own.length === 1 ? own[0] : pdfs.length === 1 ? pdfs[0] : undefined;
    if (file) return run([{ row, file }]);
    setBusy(false);
    set(row.variantId, { error: pdfs.length ? `В архіві ${f.name} немає файлу саме цієї книжки — скористайтеся великою кнопкою вгорі` : `Не вдалося розпакувати ${f.name}` });
  }
  async function onPickMany(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!picked.length) return;
    setBusy(true);
    const files: File[] = [];
    const bad: string[] = [];
    for (const f of picked) {
      if (/\.zip$/i.test(f.name) || f.type.includes("zip")) {
        try { files.push(...(await pdfsFromZip(f))); } catch { bad.push(`${f.name} (не вдалося розпакувати)`); }
      } else files.push(f);
    }
    const pairs: { row: BookFileRow; file: File }[] = [];
    const miss: string[] = [];
    for (const f of files) {
      const m = matchBookFile(f.name);
      const row = m && rows.find((r) => r.productId === m.productId && r.locale === m.locale);
      if (row) pairs.push({ row, file: f }); else miss.push(f.name);
    }
    setUnknown([...miss, ...bad]);
    if (pairs.length) await run(pairs); else setBusy(false);
  }

  return (
    <div className="space-y-5">
      <label className={`btn btn-primary w-full cursor-pointer py-4 text-lg ${busy ? "pointer-events-none opacity-70" : ""}`}>
        <input type="file" accept="application/pdf,.pdf,application/zip,.zip" multiple className="sr-only" onChange={(e) => void onPickMany(e)} disabled={busy} />
        {busy ? "Завантаження… не закривайте сторінку" : "📚 Вибрати PDF або ZIP (кілька одразу)"}
      </label>
      <p className="text-sm text-ink-soft">Можна вибрати ZIP-архіви з книжками (розпаковувати не треба) або кілька PDF одразу: на iPhone у вікні вибору натисніть «Вибрати» вгорі й позначте файли.
        Сайт сам визначить книжку й мову за назвою файлу. Якщо файл не розпізнано — завантажте його кнопкою «Вибрати» у потрібному рядку.</p>
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
                <input type="file" accept="application/pdf,.pdf,application/zip,.zip" className="sr-only" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onPickOne(r, f); }} />
                {r.uploaded || s.ok ? "Замінити" : "Вибрати"}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
