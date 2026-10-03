import { getImageProps } from "next/image";
import { HERO_MEDIA, LANDSCAPE, type HeroScene } from "./media";

/**
 * Art direction: портретний кадр для телефонів, горизонтальний — для планшетів/десктопа.
 * Постер грози — LCP-елемент першого екрана, тому eager + fetchPriority="high".
 */
export function ScenePoster({ scene, eager = false }: { scene: HeroScene; eager?: boolean }) {
  const common = { alt: "", sizes: "100vw", quality: 75 } as const;
  const {
    props: { srcSet: landscape },
  } = getImageProps({ ...common, src: HERO_MEDIA[scene].poster.landscape, width: 1280, height: 720 });
  const { props: portrait } = getImageProps({ ...common, src: HERO_MEDIA[scene].poster.portrait, width: 540, height: 760 });

  return (
    <picture>
      <source media={LANDSCAPE} srcSet={landscape} sizes="100vw" />
      <img
        {...portrait}
        alt=""
        aria-hidden
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  );
}
