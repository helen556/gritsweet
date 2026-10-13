"use client";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import StardustIntro from "./effects/StardustIntro";
import { HERO, MOBILE_QUERY, type HeroVideo } from "@/content/hero";

type T = { title: string; slogan: string; intro: string; cta: string; pause: string; play: string; videoLabel: string; posterAlt: string };
type State = "idle" | "playing" | "paused" | "blocked";

const srcset = (p: HeroVideo["poster"], ext: string) => p.widths.map((w) => `${p.base}-${w}.${ext} ${w}w`).join(", ");

/**
 * Повноекранний перший екран із двома відео: комп'ютер / телефон (див. src/content/hero.ts).
 * - Завантажується лише відео, що відповідає екрану (рішення до встановлення src).
 * - muted + autoplay + playsInline; повтор із м'яким розчиненням у перший кадр (без різкого стрибка).
 * - Заставка — перший кадр відповідного відео (<picture> з media, браузер бере лише одну).
 * - reduced-motion / Save-Data — заставка без автозапуску й кнопка «Відтворити»; помилка/блок автозапуску — те саме.
 */
export default function Hero({ t, ctaHref }: { t: T; ctaHref: string }) {
  const vref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("idle");
  const [shown, setShown] = useState(false);
  const [seam, setSeam] = useState(false);
  const [video, setVideo] = useState<HeroVideo | null>(null);
  const D = HERO.desktop, M = HERO.mobile;

  // LCP: заставка з найвищим пріоритетом (для телефона — своя)
  preload(`${D.poster.base}-${D.poster.widths[Math.min(1, D.poster.widths.length - 1)]}.avif`, { as: "image", type: "image/avif", fetchPriority: "high", imageSrcSet: srcset(D.poster, "avif"), imageSizes: "100vw", media: M ? "not all and " + MOBILE_QUERY : undefined });
  if (M) preload(`${M.poster.base}-${M.poster.widths[0]}.avif`, { as: "image", type: "image/avif", fetchPriority: "high", imageSrcSet: srcset(M.poster, "avif"), imageSizes: "100vw", media: MOBILE_QUERY });

  const pick = () => (M && window.matchMedia(MOBILE_QUERY).matches ? M : D);

  useEffect(() => {
    const n = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || n.connection?.saveData) { setState("paused"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    setVideo(pick());
    // поворот екрана / зміна розміру — інше відео, лише якщо справді змінився тип
    if (!M) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => { setShown(false); setVideo(mq.matches ? M : D); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = vref.current;
    if (!v || !video) return;
    v.muted = true;
    v.load();
    const p = v.play();
    if (p) p.then(() => setState("playing")).catch(() => setState("blocked"));
  }, [video]);

  // М'який стик перед повтором: за ~0.5 с до кінця відео розчиняється в заставку (перший кадр), потім — з початку
  const onTime = () => {
    const v = vref.current;
    if (!v || !v.duration || seam) return;
    if (v.duration - v.currentTime < HERO.seamMs / 1000) setSeam(true);
  };
  const onEnded = () => {
    const v = vref.current!;
    v.currentTime = 0;
    v.play().catch(() => setState("blocked"));
  };
  const onPlaying = () => { setShown(true); setState("playing"); if (seam) window.setTimeout(() => setSeam(false), 60); };

  const play = () => {
    if (!video) { setVideo(pick()); return; }
    const v = vref.current!;
    v.muted = true;
    v.play().then(() => setState("playing")).catch(() => setState("blocked"));
  };
  const pause = () => { vref.current?.pause(); setState("paused"); };
  const control = state === "playing"
    ? { label: t.pause, icon: <path d="M8 6v12M16 6v12" /> }
    : state === "idle" ? null : { label: t.play, icon: <path d="M8 5l11 7-11 7V5Z" /> };

  const cur = video ?? D;
  return (
    <section className={`hero relative isolate -mt-16 overflow-hidden bg-moss-100 ${M ? "hero--dual" : "hero--legacy"}`} aria-labelledby="hero-title"
      style={{ ["--focus" as string]: cur.focus, ["--focus-d" as string]: D.focus, ["--focus-m" as string]: M?.focus ?? D.focus }}>
      <div className="hero-backdrop" aria-hidden="true" />
      <div className="hero-stage hero-media">
        <picture className="absolute inset-0">
          {M && <source media={MOBILE_QUERY} type="image/avif" srcSet={srcset(M.poster, "avif")} sizes="100vw" />}
          {M && <source media={MOBILE_QUERY} type="image/webp" srcSet={srcset(M.poster, "webp")} sizes="100vw" />}
          <source type="image/avif" srcSet={srcset(D.poster, "avif")} sizes="100vw" />
          <source type="image/webp" srcSet={srcset(D.poster, "webp")} sizes="100vw" />
          { }
          <img src={`${D.poster.base}-${D.poster.widths[Math.min(1, D.poster.widths.length - 1)]}.webp`} alt={t.posterAlt}
            width={D.poster.width} height={D.poster.height} fetchPriority="high" loading="eager" decoding="sync" className="hero-fit hero-poster h-full w-full" />
        </picture>
        <video
          ref={vref} muted playsInline autoPlay={false} preload="none" disablePictureInPicture aria-label={t.videoLabel}
          className={`hero-fit absolute inset-0 h-full w-full transition-opacity ${seam ? "duration-500" : "duration-700"} ${shown && !seam ? "opacity-100" : "opacity-0"}`}
          onPlaying={onPlaying} onTimeUpdate={onTime} onEnded={onEnded}
        >
          {video && video === D && HERO.legacyWebm && <source src={HERO.legacyWebm} type="video/webm" />}
          {video && <source src={video.src} type={video.type} onError={() => { setShown(false); setState("blocked"); }} />}
        </video>
      </div>
      <div className="hero-scrim" aria-hidden="true" />
      <StardustIntro />

      <div className={`hero-copy hero-copy--${cur.text}`}>
        <div className="hero-cloud-wrap">
          <div className="hero-cloud" aria-hidden="true"><span /><span /><span /></div>
          <div className="hero-sparkles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <h1 id="hero-title" className="hero-title">{t.title}</h1>
          <p className="hero-slogan">{t.slogan}</p>
        </div>
        <div className="hero-lower">
          <p className="hero-intro">{t.intro}</p>
          <a href={ctaHref} className="btn btn-primary hero-cta" onPointerDown={sparkle}>{t.cta}</a>
        </div>
      </div>

      {control && (
        <button type="button" onClick={() => (state === "playing" ? pause() : play())} className="btn btn-ghost btn-sm hero-control !min-h-11 !min-w-11 !p-0" aria-label={control.label} title={control.label}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{control.icon}</svg>
        </button>
      )}
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
