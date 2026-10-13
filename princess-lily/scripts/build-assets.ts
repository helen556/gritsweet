/**
 * Генерує оптимізовані AVIF/WebP у public/media з оригіналів у assets-src.
 * Оригінали не змінюються. Запуск: npm run assets:build
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
  // фото книжок на столі (атмосферний блок): assets-src/books-table.(jpg|png|webp)
  const table = ["jpg", "jpeg", "png", "webp"].map((e) => path.join(SRC, `books-table.${e}`)).find((f) => fs.existsSync(f));
  if (table) manifest["books-table"] = await img(table, "books-table", [640, 1024, 1600, 2200], 82);
  fs.writeFileSync(path.resolve("src/lib/media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.resolve("src/lib/media-extra.json"), JSON.stringify(await extras(), null, 2) + "\n");
}

type Img = { width: number; height: number; widths: number[] };
async function img(input: string, name: string, targets: number[], q = 80): Promise<Img> {
  const meta = await sharp(input).metadata();
  const widths = targets.filter((w) => w <= (meta.width ?? w));
  if (!widths.length) widths.push(meta.width!);
  for (const w of widths) {
    await sharp(input).rotate().resize({ width: w }).avif({ quality: Math.round(q * 0.72), effort: 5 }).toFile(path.join(OUT, `${name}-${w}.avif`));
    await sharp(input).rotate().resize({ width: w }).webp({ quality: q }).toFile(path.join(OUT, `${name}-${w}.webp`));
  }
  return { width: meta.width!, height: meta.height!, widths };
}
const IMG_RE = /\.(jpe?g|png|webp)$/i;
const slugOk = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/**
 * Необов'язкові матеріали (додаються, коли надані):
 *  - assets-src/covers/<slug>-uk.jpg, <slug>-en.jpg — обкладинки мовних версій (підв'язуються до книжок у db:setup)
 *  - assets-src/spreads/<slug>-01.jpg (… -02, або <slug>-01-uk.jpg) — СПРАВЖНІ розвороти для «Книжка зсередини»
 *  - assets-src/hero-desktop.mp4, assets-src/hero-mobile.mp4 — відео першого екрана; копіюються БЕЗ перекодування
 */
async function extras() {
  const covers: Record<string, Partial<Record<"uk" | "en", { base: string } & Img>>> = {};
  const cdir = path.join(SRC, "covers");
  if (fs.existsSync(cdir)) for (const f of fs.readdirSync(cdir).filter((x) => IMG_RE.test(x))) {
    const m = /^(.+)-(uk|en)\.[a-z]+$/i.exec(f);
    if (!m || !slugOk(m[1])) { console.warn("пропущено (назва має бути <slug>-uk.jpg / <slug>-en.jpg):", f); continue; }
    const name = `cover-${m[1]}-${m[2]}`;
    (covers[m[1]] ??= {})[m[2] as "uk" | "en"] = { base: `/media/${name}`, ...(await img(path.join(cdir, f), name, [360, 640, 960, 1254])) };
  }
  const spreads: Record<string, ({ base: string; locale: "uk" | "en" | null } & Img)[]> = {};
  const sdir = path.join(SRC, "spreads");
  if (fs.existsSync(sdir)) for (const f of fs.readdirSync(sdir).filter((x) => IMG_RE.test(x)).sort()) {
    const m = /^(.+)-(\d{2})(?:-(uk|en))?\.[a-z]+$/i.exec(f);
    if (!m || !slugOk(m[1])) { console.warn("пропущено (назва має бути <slug>-01.jpg):", f); continue; }
    const name = `spread-${m[1]}-${m[2]}${m[3] ? `-${m[3]}` : ""}`;
    (spreads[m[1]] ??= []).push({ base: `/media/${name}`, locale: (m[3] as "uk" | "en") ?? null, ...(await img(path.join(sdir, f), name, [640, 1280, 1920], 84)) });
  }
  const hero: Record<string, { src: string; width: number; height: number; duration: number; poster: Img & { base: string } }> = {};
  for (const kind of ["desktop", "mobile"] as const) {
    const f = path.join(SRC, `hero-${kind}.mp4`);
    if (!fs.existsSync(f)) continue;
    const out = path.join(OUT, `hero-${kind}.mp4`);
    fs.copyFileSync(f, out); // без перекодування й погіршення якості
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration:format=duration", "-of", "json", f]).toString());
    const st = probe.streams[0];
    // перший кадр у повній якості — заставка на час завантаження / без автозапуску
    const png = path.join(OUT, `.hero-${kind}-first.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-frames:v", "1", png]);
    const poster = { base: `/media/hero-${kind}-poster`, ...(await img(png, `hero-${kind}-poster`, kind === "mobile" ? [540, 828, 1080] : [960, 1440, 1920, 2560], 86)) };
    fs.rmSync(png);
    hero[kind] = { src: `/media/hero-${kind}.mp4`, width: st.width, height: st.height, duration: Number(st.duration ?? probe.format.duration), poster };
    console.log(`hero-${kind}: ${st.width}×${st.height}, ${hero[kind].duration.toFixed(2)} с (скопійовано без змін)`);
  }
  return { covers, spreads, hero };
}
main();
