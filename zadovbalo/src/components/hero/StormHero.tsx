"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { ScenePoster } from "./ScenePoster";
import { SceneVideo } from "./SceneVideo";
import { useVideoAllowed } from "./useVideoAllowed";
import type { HeroScene } from "./media";

/** Відео не конкурує з критичними ресурсами: чекаємо `load` і вільну хвилину браузера. */
function usePageLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let idle = 0;
    const ready = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => setLoaded(true), { timeout: 1500 });
    };
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => {
      window.removeEventListener("load", ready);
      (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
  }, []);
  return loaded;
}

const CROSSFADE = { duration: 2.4, ease: [0.22, 0.61, 0.36, 1] } as const;

/**
 * Кінематографічний фон усього досвіду.
 * storm — гроза з блискавками; calm — хмари розходяться, світліше, але все ще глибоко й прохолодно.
 * `still` — без руху (кризовий екран): лише постер.
 */
export function StormHero({ scene, still = false }: { scene: HeroScene; still?: boolean }) {
  const pageLoaded = usePageLoaded();
  const videoAllowed = useVideoAllowed() && !still && pageLoaded;
  const calm = scene === "calm";
  // Спокійну сцену починаємо вантажити, щойно гроза на екрані: до натискання «Почати» вона вже буде готова.
  const [warmCalm, setWarmCalm] = useState(false);
  useEffect(() => {
    if (!videoAllowed || warmCalm) return;
    const id = window.setTimeout(() => setWarmCalm(true), 2500);
    return () => window.clearTimeout(id);
  }, [videoAllowed, warmCalm]);

  return (
    <div aria-hidden className="fixed inset-0 overflow-hidden bg-abyss">
      {/* Гроза */}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: calm ? 0 : 1 }} transition={CROSSFADE}>
        <ScenePoster scene="storm" eager />
        {videoAllowed && <SceneVideo scene="storm" playing={!calm} preload="auto" />}
      </motion.div>

      {/* Після «Почати»: хмари розходяться */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        initial={false}
        animate={{ opacity: calm ? 1 : 0, scale: calm ? 1 : 1.06 }}
        transition={{ opacity: CROSSFADE, scale: { duration: 6, ease: [0.16, 1, 0.3, 1] } }}
      >
        <ScenePoster scene="calm" />
        {videoAllowed && (warmCalm || calm) && <SceneVideo scene="calm" playing={calm} preload="auto" />}
      </motion.div>

      {/* Холодний тон поверх теплих блискавок: тримає палітру в синьо-сталевому */}
      <div className="absolute inset-0 bg-[#0b2232] mix-blend-color opacity-35" />

      {/* Темрява: в грозі щільніша, після «Почати» слабшає — але не до ясного дня */}
      <motion.div
        className="absolute inset-0 bg-abyss"
        initial={false}
        animate={{ opacity: calm ? 0.3 : 0.42 }}
        transition={CROSSFADE}
      />

      {/* Віньєтка і підкладка під текст */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_42%,transparent_35%,rgb(12_13_14/0.8)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-abyss/90 via-abyss/35 to-transparent" />

      {/* Плівкове зерно */}
      <div className="film-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
    </div>
  );
}
