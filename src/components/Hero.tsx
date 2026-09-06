"use client";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

export function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  // Прогрес 0→1 поки секція прокручується (без перехоплення скролу, лише читання позиції)
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current; if (!el) return;
      const total = Math.max(1, el.offsetHeight - window.innerHeight);
      scrollYProgress.set(Math.min(1, Math.max(0, window.scrollY / total)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [reduce, scrollYProgress]);
  // Торт делікатно наближається, потім перехресно згасає у фото розрізу.
  const scale = useTransform(scrollYProgress, [0, 0.7], [1, 1.08]);
  const cakeOpacity = useTransform(scrollYProgress, [0.3, 0.7], [1, 0]);
  const sliceOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);
  const sliceScale = useTransform(scrollYProgress, [0.3, 1], [1.06, 1.12]);
  const textY = useTransform(scrollYProgress, [0, 0.35], [0, -30]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <section ref={ref} className="section-cocoa relative" style={{ height: reduce ? "auto" : "200svh" }} aria-label="Головний екран">
      <div className={`${reduce ? "relative" : "sticky top-0"} flex min-h-svh items-end overflow-hidden`}>
        <div className="absolute inset-0" aria-hidden="true">
          <motion.div style={reduce ? undefined : { scale, opacity: cakeOpacity }} className="absolute inset-0 will-change-transform">
            <picture>
              <source srcSet="/images/cherry-cake.webp" type="image/webp" />
              <img src="/images/cherry-cake.jpg" alt="" className="h-full w-full object-cover object-[50%_30%]" fetchPriority="high" />
            </picture>
          </motion.div>
          {!reduce && (
            <motion.div style={{ opacity: sliceOpacity, scale: sliceScale }} className="absolute inset-0 will-change-transform">
              <picture>
                <source srcSet="/images/cherry-slice.webp" type="image/webp" />
                <img src="/images/cherry-slice.jpg" alt="" className="h-full w-full object-cover object-[50%_40%]" loading="eager" />
              </picture>
            </motion.div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-cocoa via-cocoa/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-cocoa/30 to-transparent" />
        </div>

        <motion.div style={reduce ? undefined : { y: textY, opacity: textOpacity }} className="wrap relative pb-20 pt-32 md:pb-28">
          <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} className="max-w-2xl">
            <h1 className="text-[2.6rem] leading-[1.02] text-cream sm:text-6xl md:text-7xl">{title}</h1>
            <p className="mt-5 max-w-lg text-base text-cream/85 sm:text-lg">{subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#zamovlennia" className="btn btn-cherry">Зібрати свій торт</a>
              <a href="#kataloh" className="btn btn-outline text-cream">Переглянути десерти</a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
