"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { HERO_MEDIA, LANDSCAPE, type HeroScene } from "./media";

/**
 * Фонове відео без звуку. Рендериться лише на клієнті (muted у SSR-атрибуті ненадійний на iOS),
 * зʼявляється тільки коли реально пішли кадри — до того видно постер, тож без чорного блимання.
 * Помилка завантаження = просто лишається постер.
 */
export function SceneVideo({ scene, playing, preload }: { scene: HeroScene; playing: boolean; preload: "auto" | "metadata" }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // <source> з media, що не збігається, теж кидає `error` (так за специфікацією) — це не збій.
  // Збій — лише коли не лишилось жодного придатного джерела або впало саме відео.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const onError = (event: Event) => {
      if (event.target === video || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) setFailed(true);
    };
    video.addEventListener("error", onError, true);
    return () => video.removeEventListener("error", onError, true);
  }, []);

  // Вкладка у фоні — пауза.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    if (playing && !hidden) {
      video.play().catch(() => {
        // Автовідтворення заборонене (енергозбереження тощо) — лишаємо постер.
      });
    } else {
      video.pause();
    }
  }, [playing, hidden]);

  const src = HERO_MEDIA[scene].video;
  if (failed) return null;

  return (
    <video
      ref={ref}
      className={cn(
        "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-[var(--ease-cinema)]",
        ready ? "opacity-100" : "opacity-0",
      )}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload={preload}
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setReady(true)}
    >
      <source media={LANDSCAPE} src={src.landscape.webm} type="video/webm" />
      <source media={LANDSCAPE} src={src.landscape.mp4} type="video/mp4" />
      <source src={src.portrait.webm} type="video/webm" />
      <source src={src.portrait.mp4} type="video/mp4" />
    </video>
  );
}
