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
 *  - assets-src/hero-desktop.(mp4|mov), assets-src/hero-mobile.(mp4|mov) — відео першого екрана (див. heroVideo)
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
  const prev = (() => { try { return JSON.parse(fs.readFileSync(path.resolve("src/lib/media-extra.json"), "utf8")).hero ?? {}; } catch { return {}; } })();
  const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(SRC, "hero.json"), "utf8")) as Record<string, { posterAt?: number }>; } catch { return {}; } })();
  const hero: Record<string, HeroOut> = {};
  for (const kind of ["desktop", "mobile"] as const) {
    const f = ["mp4", "mov", "m4v"].map((e) => path.join(SRC, `hero-${kind}.${e}`)).find((x) => fs.existsSync(x));
    if (!f) {
      // оригінали відео не зберігаються в git — лишаємо вже згенеровані файли, якщо вони є
      if (prev[kind] && fs.existsSync(path.join(OUT, path.basename(prev[kind].src)))) hero[kind] = prev[kind];
      continue;
    }
    hero[kind] = await heroVideo(f, kind, cfg[kind]?.posterAt ?? 0);
  }
  return { covers, spreads, hero };
}
type HeroOut = { src: string; width: number; height: number; duration: number; sources: { src: string; type: string }[];
  poster: Img & { base: string }; first: (Img & { base: string }) | null };

/**
 * Відео першого екрана: оригінал лише перепаковується в MP4 (-c copy, faststart) — БЕЗ перекодування й втрати якості.
 * Якщо оригінал не H.264 (напр. HEVC з iPhone), додаються сумісні копії для браузерів без цього кодека:
 * H.264 (CRF 17, та сама роздільність і частота кадрів) і VP9 WebM. Браузер бере перше джерело, яке підтримує, тож
 * Safari/iOS і більшість Android отримують оригінал.
 * Заставка — кадр posterAt (assets-src/hero.json), окремо зберігається перший кадр для м'якого стику повтору.
 */
async function heroVideo(f: string, kind: "desktop" | "mobile", posterAt: number): Promise<HeroOut> {
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,duration:format=duration", "-of", "json", f]).toString());
  const st = probe.streams[0];
  const codec: string = st.codec_name;
  const name = `hero-${kind}`;
  const out = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-map", "0:v:0", "-c", "copy", ...(codec === "hevc" ? ["-tag:v", "hvc1"] : []), "-movflags", "+faststart", out]);
  const sources = [{ src: `/media/${name}.mp4`, type: codec === "hevc" ? 'video/mp4; codecs="hvc1"' : "video/mp4" }];
  if (codec !== "h264") {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-map", "0:v:0", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, `${name}-h264.mp4`)]);
    sources.push({ src: `/media/${name}-h264.mp4`, type: "video/mp4" });
  }
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-map", "0:v:0", "-c:v", "libvpx-vp9", "-crf", "24", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", path.join(OUT, `${name}.webm`)]);
  sources.push({ src: `/media/${name}.webm`, type: "video/webm" });
  const widths = kind === "mobile" ? [540, 828, 1080] : [960, 1440, 1920, 2560];
  const still = async (at: number, base: string) => {
    const png = path.join(OUT, `.${base}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at), "-i", f, "-frames:v", "1", png]);
    const r = { base: `/media/${base}`, ...(await img(png, base, widths, 86)) };
    fs.rmSync(png);
    return r;
  };
  const poster = await still(posterAt, `${name}-poster`);
  const first = posterAt > 0 ? await still(0, `${name}-first`) : null;
  const duration = Number(st.duration ?? probe.format.duration);
  console.log(`${name}: ${codec} ${st.width}×${st.height}, ${duration.toFixed(2)} с — оригінал без перекодування + ${sources.length - 1} сумісн. копії`);
  return { src: sources[0].src, width: st.width, height: st.height, duration, sources, poster, first };
}

main();
