"use client";

import { getImageProps } from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import poster from "@/assets/hero-poster.webp";
import posterPortrait from "@/assets/hero-poster-portrait.webp";
import type { Dictionary } from "@/content/dictionaries";
import { BookButton } from "@/components/booking/BookingProvider";
import { btn } from "@/components/ui";

const EASE = [0.16, 1, 0.3, 1] as const;

// Portrait phones/tablets get a native 1080×1920 vertical crop instead of an upscaled landscape frame
const PORTRAIT = "(orientation: portrait) and (max-width: 1023px)";

const HIRES = "(min-width: 1280px) and (min-resolution: 1.5dppx), (min-width: 2400px)";
const MIDRES = "(min-width: 1600px), (min-width: 900px) and (min-resolution: 1.5dppx)";

const posterCommon = { alt: "", fill: true, sizes: "100vw", quality: 92, priority: true, placeholder: "blur" } as const;
const { props: { srcSet: posterPortraitSet } } = getImageProps({ ...posterCommon, src: posterPortrait });
const { props: posterProps } = getImageProps({ ...posterCommon, src: poster });

type Props = { t: Dictionary["hero"]; cta: Dictionary["cta"]; scrollLabel: string };

export function Hero({ t, cta, scrollLabel }: Props) {
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [playVideo, setPlayVideo] = useState(false);
  const [ready, setReady] = useState(false);

  // Skip the video for reduced motion or data-saver; the poster stays as the background.
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const allow = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !conn?.saveData;
    const id = window.requestAnimationFrame(() => setPlayVideo(allow));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Pause when the hero is off screen
  useEffect(() => {
    const v = video.current;
    if (!playVideo || !v) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, [playVideo]);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const enter = (from: { x?: number; y?: number }, delay: number) => ({
    initial: { opacity: 0, ...from, filter: "blur(10px)" },
    animate: { opacity: 1, x: 0, y: 0, filter: "blur(0px)" },
    transition: { duration: 1.5, ease: EASE, delay },
  });

  return (
    <section ref={section} id="top" aria-labelledby="hero-title" className="on-dark relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-graphite-900 text-white">
      {/* Media */}
      <motion.div className="absolute inset-0 -z-10" style={reduce ? undefined : { y: mediaY }} aria-hidden="true">
        <div className="absolute inset-0">
          <picture>
            <source media={PORTRAIT} srcSet={posterPortraitSet} sizes="100vw" />
            {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative, alt="" comes from posterProps */}
            <img {...posterProps} className="object-cover" />
          </picture>
          {playVideo && (
            <video
              ref={video}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-out ${ready ? "opacity-100" : "opacity-0"}`}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onPlaying={() => setReady(true)}
            >
              {/* Native vertical crop for portrait screens; native 3412×1920 for retina desktops; 1440p / 1080p otherwise */}
              <source src="/media/hero-v2-portrait.webm" type="video/webm" media={PORTRAIT} />
              <source src="/media/hero-v2-portrait.mp4" type="video/mp4" media={PORTRAIT} />
              <source src="/media/hero-v2-1920p.webm" type="video/webm" media={HIRES} />
              <source src="/media/hero-v2-1920p.mp4" type="video/mp4" media={HIRES} />
              <source src="/media/hero-v2-1440p.webm" type="video/webm" media={MIDRES} />
              <source src="/media/hero-v2-1440p.mp4" type="video/mp4" media={MIDRES} />
              <source src="/media/hero-v2-1080p.webm" type="video/webm" />
              <source src="/media/hero-v2-1080p.mp4" type="video/mp4" />
            </video>
          )}
        </div>
      </motion.div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(21_24_26/0.55)_0%,rgb(21_24_26/0.12)_28%,rgb(21_24_26/0.25)_55%,rgb(21_24_26/0.82)_100%)] lg:bg-[linear-gradient(90deg,rgb(21_24_26/0.72)_0%,rgb(21_24_26/0.35)_45%,rgb(21_24_26/0.15)_70%,rgb(21_24_26/0.45)_100%),linear-gradient(180deg,rgb(21_24_26/0.45)_0%,rgb(21_24_26/0)_25%,rgb(21_24_26/0)_55%,rgb(21_24_26/0.75)_100%)]"
      />

      {/* Content */}
      <motion.div style={reduce ? undefined : { y: contentY, opacity: contentOpacity }} className="container-x mt-auto pt-36 pb-20 sm:pb-24 lg:pb-28">
        <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-12">
          <motion.h1
            id="hero-title"
            {...enter({ x: -70 }, 0.35)}
            className="text-[clamp(2.9rem,8.2vw,6.6rem)] leading-[0.98] font-light tracking-[-0.032em] lg:col-span-7"
          >
            {t.title}
          </motion.h1>

          <div className="lg:col-span-4 lg:col-start-9 lg:pb-3">
            <motion.p {...enter({ x: 70 }, 0.6)} className="max-w-md text-[1.08rem] leading-relaxed text-white/85 sm:text-[1.15rem]">
              {t.text}
            </motion.p>
            <motion.div {...enter({ y: 36 }, 0.95)} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <BookButton className={`${btn.primaryLight} h-14 px-9`}>{cta.primary}</BookButton>
              <a href="#about" className={`${btn.secondaryLight} h-14 px-9`}>
                {cta.secondary}
              </a>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <motion.a
        href="#about"
        aria-label={scrollLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
        className="absolute bottom-7 left-1/2 hidden h-11 w-7 -translate-x-1/2 rounded-full border border-white/40 lg:block"
      >
        <motion.span
          className="absolute top-2 left-1/2 h-2 w-[2px] -translate-x-1/2 rounded bg-white"
          animate={reduce ? undefined : { y: [0, 14, 14], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.a>
    </section>
  );
}
