import extra from "@/lib/media-extra.json";
import manifest from "@/lib/media-manifest.json";

/**
 * Налаштування першого екрана — в одному місці.
 * Файли: assets-src/hero-desktop.mp4 (комп'ютер) і assets-src/hero-mobile.mp4 (телефон) → `npm run assets:build`
 * (копіюються без перекодування, перший кадр стає заставкою).
 *
 * focus — object-position для кадрування (які частини кадру лишаються видимими при cover):
 *   підберіть так, щоб голови, обличчя й важливі рухи персонажів були в кадрі на 1440×900, 768×1024, 390×844, 360×800.
 * text — де розташовано назву/вступ/кнопку, щоб не перекривати персонажів.
 */
export type HeroVideo = {
  src: string; type: string; width: number; height: number; duration: number;
  poster: { base: string; widths: number[]; width: number; height: number };
  focus: string; text: "left" | "right" | "center";
};

type Extra = { hero?: Partial<Record<"desktop" | "mobile", { src: string; width: number; height: number; duration: number; poster: { base: string; widths: number[]; width: number; height: number } }>> };
const ex = extra as unknown as Extra;
const hs = manifest["hero-start"];

/** Поточний погоджений ролик (горизонтальний) — запасний варіант, доки не додано нові файли. */
const LEGACY: HeroVideo = {
  src: "/media/hero-final.mp4", type: "video/mp4", width: 910, height: 512, duration: 8,
  poster: { base: "/media/hero-start", widths: hs.widths, width: hs.width, height: hs.height },
  focus: "50% 50%", text: "left",
};

export const HERO = {
  desktop: ex.hero?.desktop ? { ...ex.hero.desktop, type: "video/mp4", focus: "50% 45%", text: "left" as const } : LEGACY,
  mobile: ex.hero?.mobile ? { ...ex.hero.mobile, type: "video/mp4", focus: "50% 38%", text: "center" as const } : null,
  /** Легкіша WebM-копія лише для старого ролика (нові відео віддаються як є, без перекодування). */
  legacyWebm: ex.hero?.desktop ? null : "/media/hero-final.webm",
  /** Повтор: м'яке розчинення в перший кадр перед повтором (мс). */
  seamMs: 520,
};
/** Медіазапит телефонного відео (вертикальні екрани). */
export const MOBILE_QUERY = "(max-aspect-ratio: 4/5)";
