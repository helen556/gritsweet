"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Picture from "./Picture";
import StardustIntro from "./effects/StardustIntro";
import manifest from "@/lib/media-manifest.json";

type T = { title: string; slogan: string; cta: string; pause: string; play: string; replay: string; videoLabel: string; posterAlt: string };
type State = "idle" | "playing" | "paused" | "ended" | "blocked";

/**
 * Медіа hero змінюється в одному місці. Новий ролик: замінити файли тут (і постер у scripts/build-assets.ts),
 * потім перевірити кадрування на 360×800 / 390×844 / landscape / 1440×900.
 * Зараз — погоджений монтаж hero-final (WebM VP9 — легша копія того самого відео, MP4 — оригінал).
 */
const SOURCES = [{ src: "/media/hero-final.webm", type: "video/webm" }, { src: "/media/hero-final.mp4", type: "video/mp4" }];

/**
 * Повноекранний hero (100svh, fallback 100vh) на desktop і mobile.
 * - Горизонтальні екрани: відео cover, прив'язане до правого нижнього кута — знак Kling ніколи не обрізається.
 * - Вертикальні екрани (≤ 4:5): позаду розмитий статичний постер, попереду чітке відео contain без обрізання
 *   (Лілі, її рука та родина завжди в кадрі), м'які градієнтні краї; назва на хмаринці зверху, CTA знизу.
 * - Один програш, далі останній кадр; пауза/повтор; reduced-motion/Save-Data — постер без autoplay; помилка — постер + «Відтворити».
 */
export default function Hero({ lang, t }: { lang: "uk" | "en"; t: T }) {
  const vref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("idle");
  const [shown, setShown] = useState(false);
  const [src, setSrc] = useState(false);
  const hs = manifest["hero-start"];
  preload(`/media/hero-start-${hs.widths[1]}.avif`, {
    as: "image", type: "image/avif", fetchPriority: "high",
    imageSrcSet: hs.widths.map((w) => `/media/hero-start-${w}.avif ${w}w`).join(", "), imageSizes: "100vw",
  });

  useEffect(() => {
    const n = navigator as Navigator & { connection?: { saveData?: boolean } };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || n.connection?.saveData) { setState("paused"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    setSrc(true); // відео підвантажуємо після гідратації, постер лишається LCP
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
    <section className="hero relative isolate -mt-16 overflow-hidden bg-moss-100" aria-labelledby="hero-title">
      {/* Розмитий фон — лише для вертикальних екранів (статичний крихітний постер, без важкого blur відео) */}
      <div className="hero-backdrop" aria-hidden="true" />
      <div className="hero-stage hero-media">
        <Picture base="/media/hero-start" widths={hs.widths} width={hs.width} height={hs.height} alt={t.posterAlt}
          sizes="100vw" priority className="absolute inset-0" imgClassName="hero-fit h-full w-full" />
        <video
          ref={vref} muted playsInline preload="none" disablePictureInPicture aria-label={t.videoLabel}
          className={`hero-fit absolute inset-0 h-full w-full transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-0"}`}
          onPlaying={() => { setShown(true); setState("playing"); }}
          onEnded={() => setState("ended")}
        >
          {src && SOURCES.map((s, i) => (
            <source key={s.type} src={s.src} type={s.type} onError={i === SOURCES.length - 1 ? () => { setShown(false); setState("blocked"); } : undefined} />
          ))}
        </video>
      </div>
      {/* Тонкий локальний градієнт для контрасту тексту, не затемнює всю сцену */}
      <div className="hero-scrim" aria-hidden="true" />
      <StardustIntro />

      <div className="hero-copy">
        <div className="hero-cloud-wrap">
          <div className="hero-cloud" aria-hidden="true"><span /><span /><span /></div>
          <div className="hero-sparkles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <h1 id="hero-title" className="hero-title">{t.title}</h1>
          <p className="hero-slogan">{t.slogan}</p>
        </div>
        <Link href={`/${lang}/books`} className="btn btn-primary hero-cta" onPointerDown={sparkle}>{t.cta}</Link>
      </div>

      {control && (
        <button type="button" onClick={onControl} className="btn btn-ghost btn-sm hero-control !min-h-11 !min-w-11 !p-0" aria-label={control.label} title={control.label}>
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
