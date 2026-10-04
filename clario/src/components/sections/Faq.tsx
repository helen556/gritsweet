"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";
import type { Dictionary } from "@/content/dictionaries";
import { Reveal } from "@/components/motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Faq({ t }: { t: Dictionary["faq"] }) {
  const [open, setOpen] = useState<number | null>(0);
  const uid = useId();

  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-white">
      <div className="container-x section-y grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="faq-title" className="h-section mt-6">{t.title}</h2>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-8">
          <ul className="border-t border-graphite-800/10">
            {t.items.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q} className="border-b border-graphite-800/10">
                  <h3>
                    <button
                      type="button"
                      id={`${uid}-q${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`${uid}-a${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="group flex w-full items-center justify-between gap-6 py-7 text-left text-[1.12rem] font-medium tracking-[-0.01em] transition-colors duration-500 hover:text-ice-700 sm:text-[1.2rem]"
                    >
                      {item.q}
                      <span
                        aria-hidden="true"
                        className={`relative grid size-10 shrink-0 place-items-center rounded-full border transition-[transform,background-color,border-color] duration-500 ease-[var(--ease-out-expo)] ${
                          isOpen ? "rotate-45 border-ice-200 bg-ice-50" : "border-graphite-800/15 group-hover:border-ice-300"
                        }`}
                      >
                        <span className="absolute h-px w-3.5 bg-graphite-800" />
                        <span className="absolute h-3.5 w-px bg-graphite-800" />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`${uid}-a${i}`}
                        role="region"
                        aria-labelledby={`${uid}-q${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.6, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pr-14 pb-8 leading-relaxed text-graphite-600">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
