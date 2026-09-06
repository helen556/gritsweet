import type { Kysely } from "kysely";
import type { Database, PriceType, Unit } from "./types";
import { newId } from "@/lib/ids";
import bcrypt from "bcryptjs";
import reviewsSeed from "./reviews-seed.json";
import worksSeed from "./works-seed.json";
import { COMPOSITION } from "@/lib/options";

const K = (uah: number) => Math.round(uah * 100);

type P = { name: string; type: PriceType; min?: number; max?: number; unit?: Unit; minQty?: number; fillings?: string[]; size?: string; desc?: string; image?: string };

const cakes: P[] = [
  { name: "Рафаело", type: "FIXED", min: 1200 },
  { name: "Ферерро Роше", type: "FIXED", min: 1200 },
  { name: "Мега шоколад", type: "FIXED", min: 1150 },
  { name: "Снікерс", type: "RANGE", min: 1050, max: 1100 },
  { name: "Баунті", type: "FIXED", min: 1150 },
  { name: "Орео", type: "FIXED", min: 1100 },
  { name: "Вишневий оксамит / червоний оксамит", type: "RANGE", min: 1040, max: 1080 },
  { name: "Лимон-малина", type: "FIXED", min: 1080 },
  { name: "Фісташка-малина", type: "RANGE", min: 1080, max: 1150 },
  { name: "Шоколад-вишня / малина", type: "RANGE", min: 1030, max: 1100 },
  { name: "Ванільна ягода", type: "RANGE", min: 1000, max: 1030 },
  { name: "Маковий з лимоном та малиною", type: "RANGE", min: 1020, max: 1050 },
  { name: "Шоколад-лимон-смородина", type: "RANGE", min: 1040, max: 1080 },
  { name: "Полуничний рай", type: "RANGE", min: 1030, max: 1060 },
  { name: "Полуниця-банан", type: "RANGE", min: 1020, max: 1060 },
  { name: "Мілка", type: "FIXED", min: 1150 },
  { name: "Полуничний лимонад", type: "FIXED", min: 1080 },
  { name: "Київський", type: "FIXED", min: 1350 },
  { name: "Медовик", type: "FIXED", min: 900 },
  { name: "Наполеон", type: "FIXED", min: 900 },
  { name: "Молочна дівчинка", type: "FROM", min: 1000 },
];
const cupcakeFillings = ["полуниця", "вишня", "малина", "карамель", "солона карамель із горішками", "солона карамель без горішків", "лимон", "апельсин"];
const cupcakes: P[] = ([
  { name: "Ванільні", type: "FIXED", min: 115 },
  { name: "Шоколадні", type: "FIXED", min: 130 },
  { name: "Лимонні", type: "FIXED", min: 130 },
  { name: "Червоний оксамит", type: "FIXED", min: 130 },
  { name: "Бананові", type: "FIXED", min: 130 },
  { name: "Макові", type: "FIXED", min: 130 },
] as P[]).map((c) => ({ ...c, fillings: cupcakeFillings }));

const slugify = (s: string) =>
  s.toLowerCase().replace(/[\/]/g, "-").replace(/[^a-zа-яіїєґ0-9]+/gi, "-").replace(/^-|-$/g, "") + "-" + newId().slice(0, 4);

export async function seed(db: Kysely<Database>) {
  const hasCats = await db.selectFrom("categories").select("id").executeTakeFirst();
  if (!hasCats) {
    const cats: { slug: string; name: string; unit: Unit; description: string; image?: string; products: P[] }[] = [
      { slug: "torty", name: "Торти", unit: "KG", description: "Ціна за кілограм. Звичайний торт — від 1 кг.", image: "/images/cherry-cake.jpg",
        products: cakes.map((c) => ({ ...c, unit: "KG", minQty: 1000 })) },
      { slug: "bento", name: "Бенто", unit: "KG", description: "Маленький торт зазвичай близько 0,5 кг. Точна вага та ціна узгоджуються індивідуально.",
        products: [{ name: "Бенто-торт", type: "ASK", unit: "KG", desc: "Смак і вагу узгодимо в переписці." }] },
      { slug: "kapkeiky", name: "Капкейки", unit: "PIECE", description: "Ціна за штуку. Начинка на вибір.", products: cupcakes.map((c) => ({ ...c, unit: "PIECE" })) },
      { slug: "zefir", name: "Зефір", unit: "PIECE", description: "Домашній зефір.", image: "/images/sphere-butterflies.jpg",
        products: [{ name: "Зефірні завитки", type: "FIXED", min: 60, unit: "PIECE", desc: "Смак на вибір — напишіть побажання в заявці." }] },
      { slug: "zefirni-kvity", name: "Зефірні квіти", unit: "BOX", description: "Квіткові коробочки та маленькі букети із зефіру.", image: "/images/pink-box.jpg",
        products: [
          { name: "Квіти в коробочці 15 × 15 см", type: "FIXED", min: 370, unit: "BOX", size: "15 × 15 см", image: "/images/small-box.jpg" },
          { name: "Квіти в коробочці 17 × 17 см", type: "FIXED", min: 430, unit: "BOX", size: "17 × 17 см", image: "/images/small-box.jpg" },
          { name: "Квіти в коробочці 27 × 15 см", type: "FIXED", min: 630, unit: "BOX", size: "27 × 15 см", image: "/images/pink-box.jpg" },
          { name: "Маленький букет, діаметр 12 см", type: "RANGE", min: 350, max: 400, unit: "BOUQUET", size: "діаметр 12 см", minQty: 2, desc: "Замовлення від 2 букетів." },
          { name: "Маленький букет, діаметр 15 см", type: "RANGE", min: 550, max: 600, unit: "BOUQUET", size: "діаметр 15 см", image: "/images/autumn-bowl.jpg" },
        ] },
    ];
    let ci = 0;
    for (const c of cats) {
      const categoryId = newId();
      await db.insertInto("categories").values({ id: categoryId, slug: c.slug, name: c.name, unit: c.unit, description: c.description, image_path: c.image ?? null, sort_order: ci++ }).execute();
      let pi = 0;
      for (const p of c.products) {
        await db.insertInto("products").values({
          id: newId(), category_id: categoryId, slug: slugify(p.name), name: p.name, description: p.desc ?? "",
          unit: p.unit ?? c.unit, price_type: p.type, price_min: p.min != null ? K(p.min) : null, price_max: p.max != null ? K(p.max) : null,
          min_qty: p.minQty ?? null, fillings: JSON.stringify(p.fillings ?? []), size_label: p.size ?? null, image_path: p.image ?? null, sort_order: pi++,
        }).execute();
      }
    }
  }

  const defaults: Record<string, string> = {
    brand_name: "Grid Sweet Life",
    owner_name: "Дар’я",
    city: "Кропивницький",
    phone: "+380950291214",
    instagram_url: "https://www.instagram.com/grid_sweet_life/",
    hero_title: "Для моментів, які хочеться смакувати",
    hero_subtitle: "Авторські торти та зефірні квіти у Кропивницькому. Кожне замовлення — вручну, під вашу подію.",
    lead_days: "7",
    cupcake_min_batch: "",
    about_text: `Мене звати Дар’я. І я хочу, щоб вам було смачно й тепло.

Коли ви пишете мені про торт, я хочу знати трохи більше, ніж вагу та начинку. Для кого він? Що любить ця людина? Які слова ви хочете написати зверху — смішні, ніжні чи ті, які вголос сказати найважче?

Бо за коротким “можна замовити?” є хтось, кого ви хочете порадувати.

Мені подобається думати про мить, коли ви відкриєте коробку. Покличете близьких подивитися. Поправите свічку, перш ніж запалити. А потім хтось відріже перший шматочок — і розмова ненадовго стихне, бо всі куштуватимуть.

Саме для цієї миті я й працюю. Формую пелюстки зефірних квітів, підбираю поєднання смаків, придивляюся до маленьких деталей. Мені важливо, щоб після гарного першого враження було просте, щире: “Як же смачно. Можна ще трішечки?”

Я не сидітиму з вами за святковим столом. Але мені дуже дорого, що там буде щось, зроблене моїми руками.

Дякую, що дозволяєте мені так тихенько бути частиною вашого щастя.`,
    about_photo: "",
    order_terms: `Заявка на сайті — це не підтверджене замовлення. Після отримання заявки Дар’я зв’яжеться з вами, щоб узгодити деталі, дату й остаточну вартість.

Замовляти бажано щонайменше за тиждень. Термінові замовлення потребують окремого погодження.

Орієнтовна вартість у конструкторі не включає декор і доставку. Декор розраховується індивідуально для кожного замовлення.

Доставка — таксі, вартість узгоджується окремо.`,
    faq: JSON.stringify([
      { q: "Чи є заявка на сайті замовленням?", a: "Ні. Заявка — це побажання. Замовлення вважається прийнятим лише після підтвердження Дар’єю." },
      { q: "За скільки днів потрібно замовляти?", a: "Бажано щонайменше за тиждень. Якщо часу менше — напишіть, і ми окремо погодимо, чи це можливо." },
      { q: "Що входить у орієнтовну вартість?", a: "Ціна десерту за вагою або кількістю. Декор і доставка рахуються окремо." },
      { q: "Як отримати замовлення?", a: "Доставка таксі (вартість узгоджується окремо) або інший спосіб отримання, який ми погодимо в переписці." },
    ]),
  };
  for (const [key, value] of Object.entries(defaults)) {
    const exists = await db.selectFrom("settings").select("key").where("key", "=", key).executeTakeFirst();
    if (!exists) await db.insertInto("settings").values({ key, value }).execute();
  }

  await seedBento(db);

  const hasWorks = await db.selectFrom("photos").select("id").where("path", "like", "/uploads/works/%").executeTakeFirst();
  if (!hasWorks) {
    let i = 0;
    for (const w of worksSeed) await db.insertInto("photos").values({ id: newId(), path: w.path, alt: w.alt, in_gallery: 1, sort_order: i++, width: w.w, height: w.h }).execute();
    await db.insertInto("photos").values({ id: newId(), path: "/uploads/works/dariya.webp", alt: "Дар’я з букетом зефірних квітів", in_gallery: 0, sort_order: 99, width: 1200, height: 1743 }).execute();
    await db.updateTable("settings").set({ value: "/uploads/works/dariya.webp" }).where("key", "=", "about_photo").execute();
    await db.updateTable("categories").set({ image_path: "/uploads/works/zephyr-animals.webp" }).where("slug", "=", "zefir").execute();
    await db.updateTable("categories").set({ image_path: "/uploads/works/bento-cat.webp" }).where("slug", "=", "bento").execute();
    await db.updateTable("categories").set({ image_path: "/uploads/works/mini-pavlova.webp" }).where("slug", "=", "kapkeiky").execute();
    await db.updateTable("categories").set({ image_path: "/uploads/works/pink-bouquet.webp" }).where("slug", "=", "zefirni-kvity").execute();
  }

  const hasReviews = await db.selectFrom("reviews").select("id").executeTakeFirst();
  if (!hasReviews) {
    for (const r of reviewsSeed) await db.insertInto("reviews").values(r).execute();
  }

  const admin = await db.selectFrom("admin_users").select("id").executeTakeFirst();
  if (!admin) {
    const email = process.env.ADMIN_EMAIL;
    const pw = process.env.ADMIN_INITIAL_PASSWORD;
    if (email && pw) {
      await db.insertInto("admin_users").values({ id: newId(), email: email.toLowerCase(), password_hash: await bcrypt.hash(pw, 12), reset_token_hash: null, reset_token_expiry: null }).execute();
      console.log(`Створено адміністратора ${email}. Змініть пароль після першого входу.`);
    } else {
      console.warn("ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD не задані — адміністратора не створено.");
    }
  }
}

const BENTO_COMBOS: [string, string][] = [
  ["Ваніль · полуниця · білий шоколад", "ванільний бісквіт, полуничний конфітюр, мус з білого шоколаду"],
  ["Шоколад · вишня · чорний шоколад", "шоколадний бісквіт, вишневий конфітюр, мус з чорного шоколаду"],
  ["Лимон · лимонний курд · білий шоколад", "лимонний бісквіт, лимонний курд, мус з білого шоколаду"],
  ["Червоний оксамит · малина · білий шоколад", "бісквіт червоний оксамит, малиновий конфітюр, мус з білого шоколаду"],
  ["Мак · лимонний курд · малина", "маковий бісквіт, лимонний курд, малиновий конфітюр"],
  ["Морква · апельсиновий курд · фундук", "морквяний бісквіт, апельсиновий курд, хрусткий прошарок з фундука"],
  ["Горіх · солона карамель з фундуком · молочний шоколад", "горіховий бісквіт, солона карамель з фундуком, мус з молочного шоколаду"],
  ["Мигдаль-кокос · кокосовий мус · мигдаль", "мигдалево-кокосовий бісквіт, кокосовий мус, хрусткий прошарок з мигдалю"],
  ["Шпинат · чорна смородина · білий шоколад", "шпинатний бісквіт, конфітюр із чорної смородини, мус з білого шоколаду"],
  ["М’ята · м’ятний мус · чорний шоколад", "м’ятний бісквіт, м’ятний мус, хрусткий прошарок з чорного шоколаду"],
  ["Мед · карамель · арахіс", "медовий бісквіт, звичайна карамель, хрусткий прошарок з арахісу"],
  ["Шоколад · банан · карамель", "шоколадний бісквіт, банановий мус, карамель з бананом"],
  ["Ваніль · персик · персиковий мус", "ванільний бісквіт, персиковий конфітюр, персиковий мус"],
  ["Шоколад · солона карамель з арахісом · вафля", "шоколадний бісквіт, солона карамель з арахісом, хрустка вафля"],
  ["Ваніль · лісова ягода · ягідний мус", "ванільний бісквіт, конфітюр із лісових ягід, ягідний мус"],
  ["Лимон · чорна смородина", "лимонний бісквіт, конфітюр із чорної смородини"],
  ["Шоколад · малина · молочний шоколад", "шоколадний бісквіт, малиновий конфітюр, мус з молочного шоколаду"],
  ["Червоний оксамит · вишня · білий шоколад", "бісквіт червоний оксамит, вишневий конфітюр, мус з білого шоколаду"],
  ["Горіх · апельсиновий курд · чорний шоколад", "горіховий бісквіт, апельсиновий курд, мус з чорного шоколаду"],
  ["Мигдаль-кокос · полуничний мус · білий шоколад", "мигдалево-кокосовий бісквіт, полуничний мус, хрусткий прошарок з білого шоколаду"],
  ["Мед · вишня · чорний шоколад", "медовий бісквіт, вишневий конфітюр, мус з чорного шоколаду"],
  ["Мак · апельсиновий курд · білий шоколад", "маковий бісквіт, апельсиновий курд, мус з білого шоколаду"],
];

/** 20+ поєднань бенто + бенто/торт за власним складом. Виконується один раз. */
async function seedBento(db: Kysely<Database>) {
  const cat = await db.selectFrom("categories").select("id").where("slug", "=", "bento").executeTakeFirst();
  if (!cat) return;
  const already = await db.selectFrom("products").select("id").where("category_id", "=", cat.id).where("name", "like", "% · %").executeTakeFirst();
  if (already) return;
  // стара єдина позиція — в архів, старі заявки не руйнуються
  await db.updateTable("products").set({ is_archived: 1, is_visible: 0 }).where("category_id", "=", cat.id).where("name", "=", "Бенто-торт").execute();
  const options = JSON.stringify(COMPOSITION);
  let i = 0;
  await db.insertInto("products").values({
    id: newId(), category_id: cat.id, slug: slugify("Бенто за вашим складом"), name: "Бенто за вашим складом",
    description: "Оберіть бісквіт і начинки самі — Дар’я підкаже, як вони поєднуються.", unit: "KG", price_type: "ASK", price_min: null, price_max: null, min_qty: null, fillings: "[]", options, size_label: null, image_path: "/uploads/works/bento-cat.webp", sort_order: i++,
  }).execute();
  for (const [name, desc] of BENTO_COMBOS) {
    await db.insertInto("products").values({
      id: newId(), category_id: cat.id, slug: slugify(name), name, description: `Приклад поєднання: ${desc}. Склад можна змінити в заявці.`,
      unit: "KG", price_type: "ASK", price_min: null, price_max: null, min_qty: null, fillings: "[]", options, size_label: null, image_path: null, sort_order: i++,
    }).execute();
  }
  const cakes = await db.selectFrom("categories").select("id").where("slug", "=", "torty").executeTakeFirst();
  if (cakes) {
    const ex = await db.selectFrom("products").select("id").where("category_id", "=", cakes.id).where("name", "=", "Торт за вашим складом").executeTakeFirst();
    if (!ex) await db.insertInto("products").values({
      id: newId(), category_id: cakes.id, slug: slugify("Торт за вашим складом"), name: "Торт за вашим складом",
      description: "Оберіть бісквіт і начинки — вартість за кг Дар’я підтвердить після узгодження складу.", unit: "KG", price_type: "ASK", price_min: null, price_max: null, min_qty: 1000, fillings: "[]", options, size_label: null, image_path: null, sort_order: 99,
    }).execute();
  }
}
