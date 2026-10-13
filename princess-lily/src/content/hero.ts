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
type Still = { base: string; widths: number[]; width: number; height: number };
export type HeroVideo = {
  src: string; type: string; width: number; height: number; duration: number;
  /** Джерела в порядку переваги: оригінал (напр. HEVC) → сумісні копії. Браузер бере перше, яке підтримує. */
  sources?: { src: string; type: string }[];
  /** Заставка (кадр із персонажами) */
  poster: Still;
  /** Перший кадр — шар для м'якого стику повтору, якщо заставка взята з середини ролика */
  first?: Still | null;
  focus: string; text: "left" | "right" | "center" | "bottom";
};

type Extra = { hero?: Partial<Record<"desktop" | "mobile", { src: string; width: number; height: number; duration: number; sources?: { src: string; type: string }[]; poster: Still; first?: Still | null }>> };
const ex = extra as unknown as Extra;
const hs = manifest["hero-start"];

/** Поточний погоджений ролик (горизонтальний) — запасний варіант, доки не додано нові файли. */
const LEGACY: HeroVideo = {
  src: "/media/hero-final.mp4", type: "video/mp4", width: 910, height: 512, duration: 8,
  poster: { base: "/media/hero-start", widths: hs.widths, width: hs.width, height: hs.height },
  focus: "50% 50%", text: "left",
};

export const HERO = {
  // Комп'ютер (hero-desktop.mp4, 910×476 — надане «Browser hero», знизу обрізано 36 px зі знаком KlingAI):
  // голови персонажів біля верхнього краю, тож при обрізанні cover зберігаємо верх (20%); текст — ліворуч.
  desktop: ex.hero?.desktop ? { ...ex.hero.desktop, type: "video/mp4", focus: "50% 20%", text: "left" as const } : LEGACY,
  // Телефон (hero-mobile.mov, 1214×2160): Лілі в центрі, родина йде стежкою; голови у верхній половині кадру,
  // тож назва, вступ і кнопка — внизу, на стежці (text: "bottom"); вузька смужка обрізається порівну з боків.
  mobile: ex.hero?.mobile ? { ...ex.hero.mobile, type: "video/mp4", focus: "50% 30%", text: "bottom" as const } : null,
  /** Легкіша WebM-копія лише для старого ролика (нові відео віддаються як є, без перекодування). */
  legacyWebm: ex.hero?.desktop ? null : "/media/hero-final.webm",
  /** Повтор: м'яке розчинення в перший кадр перед повтором (мс). */
  seamMs: 700,
};
/** Медіазапит телефонного відео (вертикальні екрани). */
export const MOBILE_QUERY = "(max-aspect-ratio: 4/5)";
