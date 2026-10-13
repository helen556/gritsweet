"use client";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import StardustIntro from "./effects/StardustIntro";
import { HERO, MOBILE_QUERY, type HeroVideo } from "@/content/hero";

type T = { title: string; slogan: string; intro: string; cta: string; pause: string; play: string; videoLabel: string; posterAlt: string };
type State = "playing" | "paused" | "blocked";
type Still = HeroVideo["poster"];

const srcset = (p: Still, ext: string) => p.widths.map((w) => `${p.base}-${w}.${ext} ${w}w`).join(", ");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const sourcesOf = (v: HeroVideo) => v.sources ?? [{ src: v.src, type: v.type }];

/**
 * Повноекранний перший екран: відео стартує одразу, ще до завантаження JS.
 * - <video> вставляється готовим HTML (muted + autoplay + playsinline як атрибути — інакше iOS не запускає автовідтворення
 *   до гідратації); браузер сам обирає джерело за <source media>: телефонне відео або для комп'ютера.
 * - Під відео — його ж перший кадр, тож поява відео непомітна (жодного «картинка → стрибок → відео»).
 * - Повтор: кінець м'яко розчиняється в перший кадр і ролик починається знову.
 * - Відео завжди стартує саме; якщо браузер заблокував автозапуск (напр. енергозбереження iOS) — запускається з першим дотиком/прокруткою.
 *   Кнопка пауза/відтворення лишається для тих, хто хоче зупинити рух.
 */
export default function Hero({ t, ctaHref }: { t: T; ctaHref: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("playing");
  const [seam, setSeam] = useState(false);
  const D = HERO.desktop, M = HERO.mobile;
  const firstD = D.first ?? D.poster, firstM = M ? (M.first ?? M.poster) : null;

  // LCP: перший кадр відповідного відео — з найвищим пріоритетом
  preload(`${firstD.base}-${firstD.widths[Math.min(1, firstD.widths.length - 1)]}.avif`, { as: "image", type: "image/avif", fetchPriority: "high", imageSrcSet: srcset(firstD, "avif"), imageSizes: "100vw", media: firstM ? "not all and " + MOBILE_QUERY : undefined });
  if (firstM) preload(`${firstM.base}-${firstM.widths[0]}.avif`, { as: "image", type: "image/avif", fetchPriority: "high", imageSrcSet: srcset(firstM, "avif"), imageSizes: "100vw", media: MOBILE_QUERY });

  const sources = [
    ...(M ? sourcesOf(M).map((s) => ({ ...s, media: MOBILE_QUERY })) : []),
    ...(HERO.legacyWebm ? [{ src: HERO.legacyWebm, type: "video/webm" }] : []),
    ...sourcesOf(D),
  ] as { src: string; type: string; media?: string }[];
  const videoHtml = `<video class="hero-fit hero-video" muted autoplay playsinline preload="auto" disablepictureinpicture aria-label="${esc(t.videoLabel)}">${
    sources.map((s) => `<source src="${esc(s.src)}" type="${esc(s.type)}"${s.media ? ` media="${esc(s.media)}"` : ""}>`).join("")}</video>`;

  const vid = () => wrap.current?.querySelector("video") ?? null;

  useEffect(() => {
    const v = vid();
    if (!v) return;
    v.muted = true;
    const onPlaying = () => { setState("playing"); setSeam(false); };
    const onTime = () => { if (v.duration && v.duration - v.currentTime < HERO.seamMs / 1000) setSeam(true); };
    const onEnded = () => { v.currentTime = 0; v.play().catch(() => setState("blocked")); };
    const onError = () => setState("blocked");
    v.addEventListener("playing", onPlaying);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.querySelector("source:last-of-type")?.addEventListener("error", onError);
    // автозапуск міг не спрацювати (режим енергозбереження iOS тощо) — пробуємо ще раз і з першою взаємодією користувача
    const kick = () => { if (v.paused && v.dataset.userPause !== "1") v.play().then(() => setState("playing")).catch(() => setState("blocked")); };
    const KICK = ["pointerdown", "touchstart", "scroll", "keydown"] as const;
    KICK.forEach((e) => window.addEventListener(e, kick, { passive: true }));
    const onVis = () => { if (document.visibilityState === "visible") kick(); };
    document.addEventListener("visibilitychange", onVis);
    kick();
    // поворот екрана: інше відео (телефон ↔ комп'ютер)
    const mq = M ? window.matchMedia(MOBILE_QUERY) : null;
    const onMq = () => { v.load(); v.play().catch(() => setState("blocked")); };
    mq?.addEventListener("change", onMq);
    return () => {
      v.removeEventListener("playing", onPlaying); v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnded);
      mq?.removeEventListener("change", onMq);
      KICK.forEach((e) => window.removeEventListener(e, kick));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [M]);

  const play = () => { const v = vid(); if (!v) return; v.muted = true; v.dataset.userPause = ""; v.play().then(() => setState("playing")).catch(() => setState("blocked")); };
  const pause = () => { const v = vid(); if (v) { v.dataset.userPause = "1"; v.pause(); } setState("paused"); };
  const control = state === "playing" ? { label: t.pause, icon: <path d="M8 6v12M16 6v12" /> } : { label: t.play, icon: <path d="M8 5l11 7-11 7V5Z" /> };
  const showStill = state !== "playing";

  return (
    <section className={`hero relative isolate -mt-16 overflow-hidden bg-plum-100 ${M ? "hero--dual" : ""} ${HERO.legacyWebm ? "hero--legacy" : ""} ${showStill ? "hero--still" : ""} ${seam ? "hero--seam" : ""}`} aria-labelledby="hero-title"
      style={{ ["--focus-d" as string]: D.focus, ["--focus-m" as string]: M?.focus ?? D.focus }}>
      <div className="hero-backdrop" aria-hidden="true" />
      <div className="hero-stage hero-media">
        {/* перший кадр відео: видно до першого кадру відтворення і під час м'якого стику повтору */}
        <picture className="absolute inset-0">
          {firstM && <source media={MOBILE_QUERY} type="image/avif" srcSet={srcset(firstM, "avif")} sizes="100vw" />}
          {firstM && <source media={MOBILE_QUERY} type="image/webp" srcSet={srcset(firstM, "webp")} sizes="100vw" />}
          <source type="image/avif" srcSet={srcset(firstD, "avif")} sizes="100vw" />
          <source type="image/webp" srcSet={srcset(firstD, "webp")} sizes="100vw" />
          <img src={`${firstD.base}-${firstD.widths[Math.min(1, firstD.widths.length - 1)]}.webp`} alt={t.posterAlt}
            width={firstD.width} height={firstD.height} fetchPriority="high" loading="eager" decoding="sync" className="hero-fit hero-poster h-full w-full" />
        </picture>
        <div ref={wrap} className="absolute inset-0" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: videoHtml }} />
        {/* кадр із персонажами — коли відео на паузі / вимкнений рух / автозапуск заблоковано */}
        <picture className="hero-still absolute inset-0">
          {M && <source media={MOBILE_QUERY} type="image/avif" srcSet={srcset(M.poster, "avif")} sizes="100vw" />}
          {M && <source media={MOBILE_QUERY} type="image/webp" srcSet={srcset(M.poster, "webp")} sizes="100vw" />}
          <source type="image/avif" srcSet={srcset(D.poster, "avif")} sizes="100vw" />
          <img src={`${D.poster.base}-${D.poster.widths[0]}.webp`} alt="" loading="lazy" className="hero-fit hero-poster h-full w-full" />
        </picture>
      </div>
      <div className="hero-scrim" aria-hidden="true" />
      <StardustIntro />

      <div className={`hero-copy hero-copy--${D.text}${M ? ` hero-copy--m-${M.text}` : ""}`}>
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

      <button type="button" onClick={() => (state === "playing" ? pause() : play())} className="btn btn-ghost btn-sm hero-control !min-h-11 !min-w-11 !p-0" aria-label={control.label} title={control.label}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{control.icon}</svg>
      </button>
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
