/** Hero-медіа. Генерується скриптом scripts/encode-hero.sh. */
export type HeroScene = "storm" | "calm";

export const HERO_MEDIA: Record<HeroScene, {
  poster: { portrait: string; landscape: string };
  video: { portrait: { webm: string; mp4: string }; landscape: { webm: string; mp4: string } };
}> = {
  storm: {
    poster: { portrait: "/media/hero/storm-portrait.webp", landscape: "/media/hero/storm-landscape.webp" },
    video: {
      portrait: { webm: "/media/hero/storm-portrait.webm", mp4: "/media/hero/storm-portrait.mp4" },
      landscape: { webm: "/media/hero/storm-landscape.webm", mp4: "/media/hero/storm-landscape.mp4" },
    },
  },
  calm: {
    poster: { portrait: "/media/hero/calm-portrait.webp", landscape: "/media/hero/calm-landscape.webp" },
    video: {
      portrait: { webm: "/media/hero/calm-portrait.webm", mp4: "/media/hero/calm-portrait.mp4" },
      landscape: { webm: "/media/hero/calm-landscape.webm", mp4: "/media/hero/calm-landscape.mp4" },
    },
  },
};

export const LANDSCAPE = "(orientation: landscape)";
