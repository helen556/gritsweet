/** Meta Pixel ID (не секрет; надає таргетологиня). Порожньо — піксель не завантажується взагалі. */
export const metaPixelId = () => (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim().replace(/\D/g, "");
/** Conversions API (сервер → Meta): лише коли задано і піксель, і токен доступу. */
export const metaCapiConfigured = () => !!metaPixelId() && !!process.env.META_CAPI_ACCESS_TOKEN;
