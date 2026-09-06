"use client";
import { useState } from "react";
import { Lightbox, type PublicReview } from "./Reviews";

/** Галерея «Мої роботи»: сітка з лайтбоксом. */
export function Works({ items }: { items: PublicReview[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="Мої роботи">
        {items.map((it, i) => (
          <li key={it.id} className={i % 7 === 0 ? "col-span-2 row-span-2" : ""}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Відкрити фото: ${it.alt}`} className="group block h-full w-full overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-cream)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-caramel">
              <img src={it.src} alt={it.alt} loading="lazy" decoding="async" className="work-img h-full w-full object-cover" style={{ aspectRatio: i % 7 === 0 ? "1 / 1" : "4 / 5" }} />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </>
  );
}
