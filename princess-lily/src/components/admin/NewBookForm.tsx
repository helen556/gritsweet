"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBookDraftAction } from "@/app/admin/actions";

/** Великі фото стискаються в браузері (JPEG ≤ 2400 px), щоб пройти ліміт запиту сервера (~4.5 МБ). */
async function shrink(file: File): Promise<File> {
  if (file.size < 3.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    return b ? new File([b], "cover.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

/** «Додати книжку»: назви, (необов'язково) адреса сторінки та обкладинки UA/EN — одним кроком. */
export default function NewBookForm() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    // у дію сервера — лише текстові поля (файли обкладинок ідуть окремими запитами нижче)
    const all = new FormData(form), fd = new FormData();
    for (const k of ["title", "title_en", "slug"]) fd.set(k, String(all.get(k) ?? ""));
    setError(""); setBusy("Створюємо книжку…");
    const r = await createBookDraftAction(fd).catch(() => ({ error: "Не вдалося створити книжку" }) as { id?: string; error?: string });
    if (!r.id) { setBusy(""); setError(r.error ?? "Помилка"); return; }
    for (const loc of ["uk", "en"] as const) {
      const f = (form.elements.namedItem(`cover_${loc}`) as HTMLInputElement | null)?.files?.[0];
      if (!f) continue;
      setBusy(`Завантажуємо обкладинку ${loc === "uk" ? "UA" : "EN"}…`);
      const up = new FormData();
      up.set("kind", "cover"); up.set("id", r.id); up.set("locale", loc); up.set("file", await shrink(f));
      const res = await fetch("/api/admin/upload", { method: "POST", body: up }).catch(() => null);
      if (!res?.ok) { const j = res ? await res.json().catch(() => ({})) : {}; setError(`Книжку створено, але обкладинку ${loc === "uk" ? "UA" : "EN"} не завантажено: ${(j as { error?: string }).error ?? "помилка"}. Додайте її на сторінці книжки.`); }
    }
    router.push(`/admin/products/${r.id}`);
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:max-w-md">
      <div className="field"><label htmlFor="np-title">Назва українською</label><input id="np-title" name="title" required className="input" /></div>
      <div className="field"><label htmlFor="np-title-en">Назва англійською (якщо є)</label><input id="np-title-en" name="title_en" className="input" /></div>
      <div className="field"><label htmlFor="np-cover-uk">Обкладинка UA (JPG, PNG або WebP)</label><input id="np-cover-uk" name="cover_uk" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full min-w-0 text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-moss-100 file:px-4 file:font-semibold" /></div>
      <div className="field"><label htmlFor="np-cover-en">Обкладинка EN (якщо є)</label><input id="np-cover-en" name="cover_en" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full min-w-0 text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-moss-100 file:px-4 file:font-semibold" /></div>
      <details className="text-sm"><summary className="cursor-pointer text-ink-soft">Адреса сторінки (необов’язково)</summary>
        <div className="field mt-2"><label htmlFor="np-slug">Латиницею, через дефіс. Порожньо — створиться з назви.</label><input id="np-slug" name="slug" pattern="[a-z0-9-]+" placeholder="lili-..." className="input" /></div>
      </details>
      <button className="btn btn-primary justify-self-start" disabled={!!busy}>{busy || "Створити книжку"}</button>
      <p aria-live="polite" className="text-sm">{error && <span className="err">{error}</span>}</p>
    </form>
  );
}
