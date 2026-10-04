// Shared class recipes for rounded, airy buttons with a soft lift and glow.
const base =
  "group/btn relative inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-7 text-[0.95rem] font-semibold tracking-[0.01em] " +
  "transition-[transform,background-color,border-color,color,box-shadow] duration-500 ease-[var(--ease-out-expo)] " +
  "hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60";

export const btn = {
  /** Main CTA on light backgrounds */
  primary: `${base} bg-graphite-800 text-white shadow-[0_10px_30px_-12px_rgb(21_24_26/0.55)] hover:bg-graphite-700 hover:shadow-[0_0_0_1px_rgb(208_221_231/0.4),0_18px_40px_-14px_rgb(70_97_122/0.65)]`,
  /** Main CTA on dark / video backgrounds */
  primaryLight: `${base} bg-white text-graphite-900 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)] hover:bg-ice-50 hover:shadow-[0_0_0_1px_rgb(255_255_255/0.6),0_14px_44px_-8px_rgb(208_221_231/0.75)]`,
  /** Secondary on light backgrounds */
  secondary: `${base} border border-graphite-800/15 bg-white/60 text-graphite-800 backdrop-blur-md hover:border-ice-300 hover:bg-white hover:shadow-[var(--shadow-glow)]`,
  /** Secondary on dark / video backgrounds */
  secondaryLight: `${base} border border-white/35 bg-white/[0.07] text-white backdrop-blur-md hover:border-white/70 hover:bg-white/[0.16] hover:shadow-[0_0_32px_-6px_rgb(208_221_231/0.55)]`,
};

