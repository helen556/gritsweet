// Одноразова підготовка стартових відгуків: оригінал → приватне сховище,
// анонімізована копія (нік + аватар запікселено в самому файлі) → публічна папка.
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import fs from "node:fs";
import path from "node:path";

type R = { file: string; id: string; alt: string; mask: [number, number, number, number][]; publish: boolean; order: number };
// mask: [x, y, w, h] у частках ширини/висоти
const items: R[] = [
  { file: "IMG_8904.jpeg", id: "rev-01", alt: "Скриншот відгуку: білий торт до хрестин; клієнтка пише про ніжний бісквіт, збалансований крем і оформлення в тематиці.", mask: [[0.07, 0.05, 0.32, 0.06]], publish: true, order: 0 },
  { file: "IMG_8900.jpeg", id: "rev-02", alt: "Скриншот відгуку: торт у стилі Minecraft; подяка за дуже гарний і неймовірно смачний тортик.", mask: [[0.06, 0.17, 0.27, 0.06]], publish: true, order: 1 },
  { file: "IMG_8901.jpeg", id: "rev-02b", alt: "Продовження попереднього відгуку: розріз торта, слова про творожний крем, пропитаний бісквіт і начинку.", mask: [[0.03, 0.02, 0.25, 0.06]], publish: true, order: 2 },
  { file: "IMG_8903.jpeg", id: "rev-03", alt: "Скриншот відгуку: коробка червоних капкейків із написами; «Дякуємо! Нам було смачно».", mask: [[0.10, 0.02, 0.33, 0.06]], publish: true, order: 3 },
  { file: "IMG_8902.jpeg", id: "rev-04", alt: "Скриншот відгуку: рулет із полуницею на тарілці; клієнтка рекомендує десерти.", mask: [[0.10, 0.01, 0.37, 0.06]], publish: true, order: 4 },
  { file: "IMG_8905.jpeg", id: "rev-05", alt: "Скриншот відгуку: рожевий десерт-куля з ведмедиком; «Як це гарно, шкода навіть їсти».", mask: [[0.09, 0.10, 0.33, 0.07]], publish: true, order: 5 },
  { file: "IMG_8899.jpeg", id: "rev-06", alt: "Скриншот відгуку: чорний тематичний торт із черепом і вороном; подяка за торт.", mask: [[0.12, 0.155, 0.34, 0.06]], publish: true, order: 6 },
  { file: "IMG_8895.jpeg", id: "rev-07", alt: "Скриншот відгуку: букет із крему зі стрічкою; «Створює таку смачну красу».", mask: [[0.11, 0.12, 0.32, 0.06], [0.46, 0.72, 0.42, 0.05]], publish: false, order: 7 },
  { file: "IMG_8894.jpeg", id: "rev-08", alt: "Скриншот відгуку: торт із червоними написами; подяка за роботу.", mask: [[0.11, 0.12, 0.32, 0.05]], publish: false, order: 8 },
  { file: "IMG_8897.jpeg", id: "rev-09", alt: "Фото клієнта: блакитний торт і розріз; підпис Дар’ї «Дякую за ваші фото».", mask: [], publish: false, order: 9 },
  { file: "IMG_8898.jpeg", id: "rev-10", alt: "Чернетка: скриншот із дитиною — потрібен дозвіл на публікацію.", mask: [], publish: false, order: 10 },
  { file: "IMG_8896.jpeg", id: "rev-11", alt: "Чернетка: фото дитини з тортом — потрібен дозвіл на публікацію.", mask: [], publish: false, order: 11 },
];

async function pixelate(src: Sharp, w: number, h: number, masks: [number, number, number, number][]) {
  const base = await src.clone().toBuffer();
  const overlays: OverlayOptions[] = [];
  for (const [x, y, mw, mh] of masks) {
    const left = Math.round(x * w), top = Math.round(y * h), width = Math.round(mw * w), height = Math.round(mh * h);
    const small = await sharp(base).extract({ left, top, width, height }).resize(Math.max(4, Math.round(width / 28)), Math.max(4, Math.round(height / 28)), { kernel: "nearest" }).toBuffer();
    const region = await sharp(small).resize(width, height, { kernel: "nearest" }).blur(1.2).toBuffer();
    overlays.push({ input: region, left, top });
  }
  return sharp(base).composite(overlays);
}

(async () => {
  const out: { id: string; private_path: string; public_path: string | null; alt: string; is_published: number; consent_checked: number; sort_order: number; width: number; height: number }[] = [];
  for (const it of items) {
    const srcPath = path.join("/mnt/user-data/uploads", it.file);
    const meta = await sharp(srcPath).metadata();
    const w = Math.min(1200, meta.width!); 
    const base = sharp(srcPath).rotate().resize({ width: w, withoutEnlargement: true });
    const info = await base.clone().toBuffer({ resolveWithObject: true });
    await sharp(info.data).webp({ quality: 84 }).toFile(`storage/private/reviews/${it.id}.webp`);
    let publicPath: string | null = null;
    if (it.publish) {
      const anon = await pixelate(sharp(info.data), info.info.width, info.info.height, it.mask);
      await anon.webp({ quality: 84 }).toFile(`public/uploads/reviews/${it.id}.webp`);
      publicPath = `/uploads/reviews/${it.id}.webp`;
    }
    out.push({ id: it.id, private_path: `${it.id}.webp`, public_path: publicPath, alt: it.alt, is_published: it.publish ? 1 : 0, consent_checked: it.publish ? 1 : 0, sort_order: it.order, width: info.info.width, height: info.info.height });
  }
  fs.writeFileSync("src/db/reviews-seed.json", JSON.stringify(out, null, 2));
  console.log("done", out.length);
})();
