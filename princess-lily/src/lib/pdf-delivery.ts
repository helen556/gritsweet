import "server-only";
import PDFDocument from "pdfkit";
import path from "node:path";
import { db } from "@/db";
import { BUNDLE_CONTENTS } from "./book-specs";
import { formatMinor } from "./money";
import { kyiv } from "./crm";
import { getSettings } from "./settings";

export type PdfFile = { itemId: string; title: string; locale: "uk" | "en"; key: string | null; /** книжка з електронного комплекту */ bundle: boolean };

/**
 * Які PDF отримує покупець: для кожної PDF-позиції — файл її варіанта; для електронного комплекту —
 * PDF кожної книжки комплекту тією ж мовою. key = null — файл ще не завантажено в адмінці.
 */
export async function pdfFilesForOrder(orderId: string): Promise<PdfFile[]> {
  const order = await db.selectFrom("orders").select(["site_locale"]).where("id", "=", orderId).executeTakeFirst();
  const items = await db.selectFrom("order_items").selectAll().where("order_id", "=", orderId).where("format", "=", "pdf").execute();
  const out: PdfFile[] = [];
  for (const it of items) {
    const parts = BUNDLE_CONTENTS[it.product_id];
    if (!parts) {
      const v = await db.selectFrom("product_variants").select("private_pdf_key").where("id", "=", it.variant_id).executeTakeFirst();
      out.push({ itemId: it.id, title: it.title_snapshot, locale: it.book_locale, key: v?.private_pdf_key ?? null, bundle: false });
      continue;
    }
    for (const pid of parts) {
      const [v, tr] = await Promise.all([
        db.selectFrom("product_variants").select("private_pdf_key").where("product_id", "=", pid).where("book_locale", "=", it.book_locale).where("format", "=", "pdf").executeTakeFirst(),
        db.selectFrom("product_translations").select("title").where("product_id", "=", pid).where("locale", "=", order?.site_locale ?? "uk").executeTakeFirst(),
      ]);
      out.push({ itemId: it.id, title: tr?.title ?? pid, locale: it.book_locale, key: v?.private_pdf_key ?? null, bundle: true });
    }
  }
  return out;
}

/** Ім'я файлу у вкладенні: «Lili-yde-do-likarya-UA.pdf» (латиницею — без проблем у поштових клієнтах). */
export function attachmentName(title: string, locale: string) {
  const m: Record<string, string> = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ю: "iu", я: "ia", ь: "", "’": "", "'": "" };
  const base = title.split("").map((c) => { const l = c.toLowerCase(); const t = m[l]; return t === undefined ? c : c === l ? t : t.charAt(0).toUpperCase() + t.slice(1); }).join("")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "book";
  return `${base}-${locale === "en" ? "EN" : "UA"}.pdf`;
}

const FONT = path.join(process.cwd(), "assets-fonts", "DejaVuSans.ttf");
const FONT_B = path.join(process.cwd(), "assets-fonts", "DejaVuSans-Bold.ttf");

/**
 * Квитанція про оплату для листа. Для оплат через еквайринг monobank — квитанція банку (API), інакше —
 * «Підтвердження оплати» з даними продавця й складом замовлення. Це не фіскальний чек.
 */
export async function paymentReceipt(orderId: string): Promise<{ filename: string; content: Buffer } | null> {
  const o = await db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!o || o.payment_status !== "paid") return null;
  if (o.payment_provider === "mono" && o.payment_reference && process.env.MONOBANK_TOKEN) {
    try {
      const r = await fetch(`https://api.monobank.ua/api/merchant/invoice/receipt?invoiceId=${encodeURIComponent(o.payment_reference)}`, { headers: { "X-Token": process.env.MONOBANK_TOKEN }, signal: AbortSignal.timeout(10_000) });
      const j = r.ok ? ((await r.json()) as { file?: string }) : null;
      const buf = j?.file ? Buffer.from(j.file, "base64") : null;
      if (buf && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { filename: `Receipt-${o.number}.pdf`, content: buf };
    } catch { /* квитанція банку недоступна — надсилаємо власне підтвердження */ }
  }
  return { filename: `Payment-${o.number}.pdf`, content: await paymentConfirmationPdf(orderId) };
}

export async function paymentConfirmationPdf(orderId: string): Promise<Buffer> {
  const o = (await db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst())!;
  const items = await db.selectFrom("order_items").selectAll().where("order_id", "=", orderId).execute();
  const s = await getSettings();
  const uk = o.site_locale !== "en";
  const seller = (uk ? s.seller_details_uk : s.seller_details_en) || s.seller_details_uk;
  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `${uk ? "Підтвердження оплати" : "Payment confirmation"} ${o.number}` } });
  doc.registerFont("r", FONT); doc.registerFont("b", FONT_B);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const green = "#263d2d", soft = "#57534a";
  doc.font("b").fontSize(18).fillColor(green).text(uk ? "Підтвердження оплати" : "Payment confirmation");
  doc.font("r").fontSize(11).fillColor(soft).text(`${uk ? "Замовлення" : "Order"} ${o.number} · ${uk ? "оплачено" : "paid"} ${kyiv(o.paid_at)} (${uk ? "Київ" : "Kyiv time"})`);
  doc.moveDown();
  if (seller) { doc.font("b").fontSize(11).fillColor(green).text(uk ? "Продавець" : "Seller"); doc.font("r").fillColor("#2a2924").text(seller); doc.moveDown(0.6); }
  doc.font("b").fillColor(green).text(uk ? "Покупець" : "Customer");
  doc.font("r").fillColor("#2a2924").text(`${[o.last_name, o.first_name].filter(Boolean).join(" ") || o.name}\n${o.email}${o.phone ? `\n${o.phone}` : ""}`);
  doc.moveDown(0.6);
  doc.font("b").fillColor(green).text(uk ? "Склад замовлення" : "Items");
  doc.font("r").fillColor("#2a2924");
  for (const i of items) {
    const fmt = i.format === "pdf" ? (uk ? "електронна (PDF)" : "digital (PDF)") : (uk ? "друкована" : "printed");
    const lang = i.book_locale === "uk" ? (uk ? "українська" : "Ukrainian") : (uk ? "англійська" : "English");
    doc.text(`${i.title_snapshot} — ${fmt}, ${lang} × ${i.quantity}: ${formatMinor(i.line_total_minor, uk ? "uk" : "en")}`);
  }
  doc.moveDown(0.4).font("b").text(`${uk ? "Сплачено" : "Paid"}: ${formatMinor(o.total_minor, uk ? "uk" : "en")}`);
  doc.moveDown(1.2).font("r").fontSize(9).fillColor(soft).text(uk ? "Документ підтверджує отримання оплати за замовленням і не є фіскальним чеком." : "This document confirms that payment for the order was received; it is not a fiscal receipt.");
  doc.end();
  return done;
}

/** Текст листа з PDF (від авторки). links — запасний варіант, коли файли завеликі для вкладення. */
export function pdfEmailText(locale: "uk" | "en", number: string, links: { title: string; url: string }[] | null, expires?: string) {
  if (locale === "en") {
    const lines = [
      "Hello!",
      "",
      links ? "Thank you for your purchase and your trust 🤍 Your PDF book about Lily is ready to download:" : "Thank you for your purchase and your trust 🤍 Your PDF book about Lily is attached.",
      ...(links ? ["", ...links.map((l) => `${l.title}: ${l.url}`), "", `(Personal links, valid until ${expires}.)`] : []),
      "You can read it on screen or print it out. I hope this story brings you warm moments together and helps your little one take one more small step.",
      "",
      "If you have any trouble opening the file, just reply to this email and I’ll help.",
      "I’d love to hear how you and your little one liked the story!",
      "",
      "With love,",
      "Elizaveta Dyachenko",
      "Author of the Princess Lily Stories",
      "",
      `Order ${number}. The payment receipt is attached.`,
    ];
    return { subject: `Your PDF book about Lily — order ${number}`, lines };
  }
  const lines = [
    "Вітаю!",
    "",
    links ? "Дякую за покупку та довіру 🤍 Ваша PDF-книжка про Лілі готова до завантаження:" : "Дякую за покупку та довіру 🤍 У вкладенні — ваша PDF-книжка про Лілі.",
    ...(links ? ["", ...links.map((l) => `${l.title}: ${l.url}`), "", `(Особисті посилання, діють до ${expires}.)`] : []),
    "Її можна читати з екрана або роздрукувати. Сподіваюся, ця історія подарує вам теплі хвилини разом і допоможе зробити ще один маленький крок.",
    "",
    "Якщо виникнуть труднощі з відкриттям файлу, напишіть мені у відповідь — я допоможу.",
    "Буду рада, якщо поділитеся, як вам і малюку історія!",
    "",
    "З любов’ю",
    "Єлизавета Дяченко",
    "Авторка історій про Лілі",
    "",
    `Замовлення ${number}. Квитанція про оплату — у вкладенні.`,
  ];
  return { subject: `Ваша PDF-книжка про Лілі — замовлення ${number}`, lines };
}
