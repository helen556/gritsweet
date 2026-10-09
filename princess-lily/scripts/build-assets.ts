/**
 * Генерує оптимізовані AVIF/WebP у public/media з оригіналів у assets-src.
 * Оригінали не змінюються. Запуск: npm run assets:build
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("assets-src");
const OUT = path.resolve("public/media");

const jobs: { file: string; name: string; widths: number[] }[] = [
  { file: "book-cover-bublik.jpg", name: "cover-bublik", widths: [360, 640, 960, 1254] },
  { file: "lily-portrait.png", name: "lily-portrait", widths: [360, 640, 960] },
  { file: "characters-lineup.png", name: "characters-lineup", widths: [640, 1024, 1536] },
  { file: "hero-start.png", name: "hero-start", widths: [640, 960, 1280, 1672] },
  { file: "hero-end.png", name: "hero-end", widths: [640, 960, 1280, 1672] },
  { file: "author-liza.jpg", name: "author-liza", widths: [480, 800, 1200] },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, { width: number; height: number; widths: number[] }> = {};
  for (const j of jobs) {
    const input = path.join(SRC, j.file);
    const meta = await sharp(input).metadata();
    const widths = j.widths.filter((w) => w <= (meta.width ?? w));
    for (const w of widths) {
      await sharp(input).resize({ width: w }).avif({ quality: 55, effort: 5 }).toFile(path.join(OUT, `${j.name}-${w}.avif`));
      await sharp(input).resize({ width: w }).webp({ quality: 78 }).toFile(path.join(OUT, `${j.name}-${w}.webp`));
    }
    manifest[j.name] = { width: meta.width!, height: meta.height!, widths };
    console.log(j.name, widths.join(","));
  }
  // Open Graph: наявна обкладинка, 1200×630 з полями (contain), без обрізання назви
  await sharp(path.join(SRC, "book-cover-bublik.jpg"))
    .resize({ width: 1200, height: 630, fit: "contain", background: "#f7f2e8" })
    .jpeg({ quality: 82 })
    .toFile(path.join(OUT, "og-cover.jpg"));
  // Маленький сильно стиснутий постер для розмитого фону hero на вертикальних екранах
  await sharp(path.join(SRC, "hero-start.png")).resize({ width: 480 }).blur(14).webp({ quality: 55 }).toFile(path.join(OUT, "hero-start-blur.webp"));
  fs.writeFileSync(path.resolve("src/lib/media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}
main();
