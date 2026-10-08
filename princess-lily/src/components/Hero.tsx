"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Picture from "./Picture";
import StardustIntro from "./effects/StardustIntro";
import { Sprig } from "./Leaves";
import manifest from "@/lib/media-manifest.json";

type T = { title: string; slogan: string; ageLine: string; cta: string; secondary: string; pause: string; play: string; replay: string; videoLabel: string; posterAlt: string };
type State = "idle" | "playing" | "paused" | "ended" | "blocked";

// Той самий погоджений монтаж: WebM (VP9, легший) + оригінальний MP4 як запасний варіант
const SOURCES = [{ src: "/media/hero-final.webm", type: "video/webm" }, { src: "/media/hero-final.mp4", type: "video/mp4" }];

/**
 * Hero: muted + playsInline, autoplay якщо дозволено, один програш → лишається останній кадр (без петлі й стрибка назад).
 * reduced-motion / Save-Data → постер без autoplay. Помилка/блок autoplay → hero-start + кнопка відтворення.
 * Відео 16:9 без обрізання (герої рухаються справа до центру); на мобільному — окремий блок, текст нижче.
 */
export default function Hero({ lang, t }: { lang: "uk" | "en"; t: T }) {
  const vref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("idle");
  const [shown, setShown] = useState(false); // відео видно (є кадр)
  const [src, setSrc] = useState(false);
  const hs = manifest["hero-start"];
  // LCP: постер hero завантажується з найвищим пріоритетом
  preload(`/media/hero-start-${hs.widths[1]}.avif`, {
    as: "image", type: "image/avif", fetchPriority: "high",
    imageSrcSet: hs.widths.map((w) => `/media/hero-start-${w}.avif ${w}w`).join(", "), imageSizes: "(min-width: 1024px) 640px, 100vw",
  });

  useEffect(() => {
    const n = navigator as Navigator & { connection?: { saveData?: boolean } };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || n.connection?.saveData) { setState("paused"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    // Відео підвантажуємо після гідратації, щоб постер лишався LCP-елементом
    setSrc(true);
  }, []);

  useEffect(() => {
    const v = vref.current;
    if (!v || !src) return;
    v.muted = true;
    v.load();
    const p = v.play();
    if (p) p.then(() => setState("playing")).catch(() => setState("blocked"));
  }, [src]);

  const play = () => {
    const v = vref.current!;
    if (!src) { setSrc(true); return; }
    if (state === "ended") v.currentTime = 0;
    v.muted = true;
    v.play().then(() => setState("playing")).catch(() => setState("blocked"));
  };
  const pause = () => { vref.current?.pause(); setState("paused"); };

  const control = state === "playing"
    ? { label: t.pause, icon: <path d="M8 6v12M16 6v12" /> }
    : state === "ended"
      ? { label: t.replay, icon: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /> }
      : state === "idle" ? null : { label: t.play, icon: <path d="M8 5l11 7-11 7V5Z" /> };
  const onControl = () => (state === "playing" ? pause() : play());

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <Sprig className="pointer-events-none absolute -left-6 top-24 hidden h-56 w-32 text-moss-500 lg:block" parallax={0.04} />
      <Sprig className="pointer-events-none absolute -right-4 bottom-0 hidden h-44 w-24 text-moss-500/80 lg:block" flip parallax={-0.03} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-0 pb-10 pt-0 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pb-16 lg:pt-14">
        <div className="hero-media relative order-1 lg:order-2">
          <div className="relative aspect-video w-full overflow-hidden bg-moss-100 shadow-[0_30px_60px_-30px_rgba(38,61,45,.55)] sm:rounded-[2rem]">
            <Picture base="/media/hero-start" widths={hs.widths} width={hs.width} height={hs.height} alt={t.posterAlt}
              sizes="(min-width: 1024px) 640px, 100vw" priority className="absolute inset-0" imgClassName="h-full w-full object-cover" />
            <video
              ref={vref} muted playsInline preload="none" disablePictureInPicture aria-label={t.videoLabel}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-0"}`}
              onPlaying={() => { setShown(true); setState("playing"); }}
              onEnded={() => setState("ended")}
              onError={() => { setShown(false); setState("blocked"); }}
            >
              {src && SOURCES.map((s, i) => (
                <source key={s.type} src={s.src} type={s.type} onError={i === SOURCES.length - 1 ? () => { setShown(false); setState("blocked"); } : undefined} />
              ))}
            </video>
            <StardustIntro />
            {control && (
              <button type="button" onClick={onControl}
                className="btn btn-ghost btn-sm absolute bottom-3 left-3 z-30 !min-h-11 !min-w-11 !p-0 sm:bottom-4 sm:left-4" aria-label={control.label} title={control.label}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{control.icon}</svg>
              </button>
            )}
          </div>
        </div>
        <div className="hero-copy order-2 px-4 sm:px-0 lg:order-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.ageLine}</p>
          <h1 id="hero-title" className="mt-3 text-[2.6rem] text-moss-900 sm:text-6xl lg:text-[4.2rem]">{t.title}</h1>
          <p className="mt-4 font-display text-2xl italic text-ink-soft sm:text-3xl">{t.slogan}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${lang}/books`} className="btn btn-primary" onPointerDown={sparkle}>{t.cta}</Link>
            <Link href={`/${lang}#series`} className="btn btn-ghost">{t.secondary}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** На touch — короткий делікатний блиск на головному CTA (без стеження за пальцем). */
function sparkle(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType === "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = e.currentTarget;
  el.classList.remove("sparkle");
  void el.offsetWidth;
  el.classList.add("sparkle");
}
