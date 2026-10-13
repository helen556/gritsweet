"use client";
import { useRef, useState } from "react";

type S = { id: string; base: string; widths: number[]; width: number; height: number; alt: string };

/** Справжні розвороти книжки з можливістю збільшення (нативний <dialog>: Esc, фокус повертається). */
export default function Spreads({ items, hint, close }: { items: S[]; hint: string; close: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState<S | null>(null);
  const show = (s: S, el: HTMLButtonElement) => { opener.current = el; setOpen(s); requestAnimationFrame(() => dlg.current?.showModal()); };
  const hide = () => { dlg.current?.close(); };
  const set = (s: S, ext: string) => s.widths.map((w) => `${s.base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <>
      <ul className={`mt-8 grid gap-5 ${items.length > 1 ? "sm:grid-cols-2" : ""} ${items.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {items.map((s, i) => (
          <li key={s.id} data-reveal={i % 2 ? "right" : "left"}>
            <button type="button" onClick={(e) => show(s, e.currentTarget)} className="group block w-full overflow-hidden rounded-[1.25rem] bg-paper shadow-[0_20px_40px_-30px_rgba(38,61,45,.55)] focus-visible:outline-3" aria-label={`${s.alt || "Розворот"} — ${hint}`}>
              <picture>
                <source type="image/avif" srcSet={set(s, "avif")} sizes="(min-width: 1024px) 380px, (min-width: 640px) 46vw, 92vw" />
                { }
                <img src={`${s.base}-${s.widths[0]}.webp`} srcSet={set(s, "webp")} sizes="(min-width: 1024px) 380px, (min-width: 640px) 46vw, 92vw" alt="" width={s.width} height={s.height} loading="lazy" className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]" />
              </picture>
              <span className="block px-4 py-2 text-left text-sm text-ink-soft">🔍 {hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={dlg} onClose={() => { setOpen(null); opener.current?.focus(); }} onClick={(e) => { if (e.target === dlg.current) hide(); }}
        className="m-auto max-h-[94dvh] max-w-[96vw] overflow-auto rounded-2xl bg-paper p-0 backdrop:bg-black/60" aria-label={open?.alt || "Розворот"}>
        {open && (
          <div className="relative">
            <button type="button" onClick={hide} className="btn btn-ghost btn-sm absolute right-3 top-3 z-10" autoFocus>{close} ✕</button>
            <picture>
              <source type="image/avif" srcSet={set(open, "avif")} sizes="96vw" />
              { }
              <img src={`${open.base}-${open.widths.at(-1)}.webp`} srcSet={set(open, "webp")} sizes="96vw" alt={open.alt} width={open.width} height={open.height} className="h-auto max-h-[94dvh] w-auto max-w-[96vw] object-contain" />
            </picture>
          </div>
        )}
      </dialog>
    </>
  );
}
