import type { SpecRow } from "@/lib/book-specs";

/**
 * «Характеристики книжки». Обкладинка (глянцева) стосується лише друкованої книжки: при виборі PDF рядок
 * прихований, до вибору формату — з позначкою «лише для друкованої версії».
 */
export default function BookSpecs({ rows, t, format }: { rows: SpecRow[]; t: { title: string; printOnlyNote: string }; format: "pdf" | "print" | null }) {
  const visible = rows.filter((r) => !r.printOnly || format !== "pdf");
  return (
    <section aria-labelledby="specs-h" className="card mt-6 p-5 sm:p-6">
      <h2 id="specs-h" className="text-2xl text-plum-900">{t.title}</h2>
      <dl className="mt-3 divide-y divide-black/8 text-[1.02rem]">
        {visible.map((r) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-x-4 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <dt className="text-ink-soft">{r.label}</dt>
            <dd className="break-words font-medium text-ink">
              {r.value}
              {r.printOnly && format == null && <span className="block text-sm font-normal text-ink-soft">{t.printOnlyNote}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
