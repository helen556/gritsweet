import localFont from "next/font/local";

/**
 * Лише кирилиця + латиниця, по одному змінному файлу. Кожен набір — окрема гарнітура з unicode-range;
 * у CSS вони стоять ланцюжком (кирилиця → латиниця → підігнаний за метриками fallback), щоб не було зсуву макета.
 * Метричний fallback генерує лише латинський набір — інакше він перехопив би латинські символи.
 */
// next/font читає опції статично, тому діапазони вписані літералами.

export const displayCyr = localFont({
  src: [
    { path: "../fonts/playfair-display-cyrillic-wght-normal.woff2", weight: "400 900", style: "normal" },
    { path: "../fonts/playfair-display-cyrillic-wght-italic.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-display-cyr",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

export const displayLat = localFont({
  src: "../fonts/playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  variable: "--font-display-lat",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const sansCyr = localFont({
  src: "../fonts/inter-cyrillic-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans-cyr",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

export const sansLat = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans-lat",
  display: "swap",
  // Для першого екрана потрібні лише кириличні гліфи Inter.
  preload: false,
  adjustFontFallback: "Arial",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const fontVariables = [displayCyr.variable, displayLat.variable, sansCyr.variable, sansLat.variable].join(" ");
