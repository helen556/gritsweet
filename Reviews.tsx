"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type PublicReview = { id: string; src: string; alt: string; width: number; height: number };

/** Карусель скриншотів відгуків: свайп (нативний scroll-snap), кнопки, індикатор, лайтбокс. Без автопрокрутки. */
export function Reviews({ items }: { items: PublicReview[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const onScroll = useCallback(() => {
    const el = track.current; if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const left = el.scrollLeft + 8;
    let idx = 0;
    for (let i = 0; i < cards.length; i++) if (cards[i].offsetLeft <= left) idx = i;
    setActive(idx);
  }, []);
  useEffect(() => { const el = track.current; if (!el) return; el.addEventListener("scroll", onScroll, { passive: true }); return () => el.removeEventListener("scroll", onScroll); }, [onScroll]);

  const go = (i: number) => {
    const el = track.current; if (!el) return;
    const card = el.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: card.offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  if (items.length === 0) return null;
  return (
    <div>
      <ul ref={track} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0" aria-label="Відгуки клієнтів" aria-live="polite">
        {items.map((r, i) => (
          <li key={r.id} className="w-[82%] shrink-0 snap-start sm:w-[60%] md:w-[calc((100%-2rem)/3)]">
            <button type="button" onClick={() => setOpen(i)} aria-label={`Відкрити відгук ${i + 1} з ${items.length} у збільшеному вигляді`}
              className="block w-full overflow-hidden rounded-[1.25rem] border border-caramel/40 bg-choco p-2 shadow-[var(--shadow-warm)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-caramel">
              <img src={r.src} alt={r.alt} width={r.width} height={r.height} loading="lazy" decoding="async" className="h-auto w-full rounded-[0.9rem] bg-milk" style={{ aspectRatio: `${r.width} / ${r.height}` }} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Слайди">
          {items.map((r, i) => <button key={r.id} type="button" role="tab" aria-selected={i === active} aria-label={`Відгук ${i + 1}`} onClick={() => go(i)} className={`h-2.5 rounded-full transition-all ${i === active ? "w-6 bg-cherry" : "w-2.5 bg-cream/40"}`} />)}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline !min-h-11 !px-4 text-cream" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Попередній відгук">‹ Назад</button>
          <button type="button" className="btn btn-outline !min-h-11 !px-4 text-cream" onClick={() => go(active + 1)} disabled={active >= items.length - 1} aria-label="Наступний відгук">Далі ›</button>
        </div>
      </div>
      {open !== null && <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </div>
  );
}

export function Lightbox({ items, index, onClose, onIndex }: { items: PublicReview[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "Tab" && dialog.current) {
        const f = Array.from(dialog.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [index, items.length, onClose, onIndex]);
  const r = items[index];
  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={`Відгук ${index + 1} з ${items.length}`} className="fixed inset-0 z-50 flex flex-col bg-cocoa/95 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex items-center justify-between text-cream">
        <span className="text-sm">{index + 1} / {items.length}</span>
        <button ref={closeBtn} type="button" onClick={onClose} className="btn btn-outline !min-h-11 !px-4 text-cream" aria-label="Закрити">Закрити ✕</button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-3" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <img src={r.src} alt={r.alt} className="max-h-full max-w-full rounded-xl object-contain" style={{ aspectRatio: `${r.width} / ${r.height}` }} />
      </div>
      <div className="flex justify-center gap-2">
        <button type="button" className="btn btn-outline !min-h-11 text-cream" disabled={index === 0} onClick={() => onIndex(index - 1)}>‹ Назад</button>
        <button type="button" className="btn btn-outline !min-h-11 text-cream" disabled={index >= items.length - 1} onClick={() => onIndex(index + 1)}>Далі ›</button>
      </div>
    </div>
  );
}
