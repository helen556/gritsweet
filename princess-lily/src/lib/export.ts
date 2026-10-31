import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "node:path";
import { kyiv, PAYMENT_LABEL, SHIPPING_LABEL, ORDER_LABEL, METHOD_LABEL, KIND_LABEL, type CrmRow } from "./crm";
import { formatMinor } from "./money";

/** Захист від формул у Excel: текст клієнта, що починається з = + - @ або табуляції, стає звичайним текстом. */
export function safeCell(v: string | null | undefined): string {
  const s = (v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

const COLS = [
  { h: "Номер", w: 13 }, { h: "Створено (Київ)", w: 17 }, { h: "Покупець", w: 22 }, { h: "Одержувач", w: 20 },
  { h: "Email", w: 26 }, { h: "Телефон", w: 16 }, { h: "Товари", w: 44 }, { h: "Тип", w: 10 }, { h: "Сума, грн", w: 11 },
  { h: "Спосіб оплати", w: 22 }, { h: "Оплата", w: 16 }, { h: "Оплачено (Київ)", w: 17 }, { h: "Доставка", w: 14 },
  { h: "Населений пункт / відділення", w: 32 }, { h: "Відправлення", w: 15 }, { h: "ТТН", w: 16 }, { h: "Статус замовлення", w: 15 },
];

function rowValues(r: CrmRow): (string | number)[] {
  return [
    r.number, kyiv(r.created_at), safeCell(r.name), safeCell(r.recipient ?? ""), safeCell(r.email), safeCell(r.phone ?? ""),
    safeCell(r.itemsText), KIND_LABEL[r.kind], r.total_minor / 100, METHOD_LABEL[r.payment_method ?? r.payment_mode] ?? r.payment_mode,
    PAYMENT_LABEL[r.payment_status] ?? r.payment_status, r.paid_at ? kyiv(r.paid_at) : "",
    r.shipping_required ? "Нова пошта" : "Не потрібна (PDF)", r.shipping_required ? safeCell(`${r.np_city ?? ""}, ${r.np_point ?? ""}`) : "",
    r.shippingStatus ? SHIPPING_LABEL[r.shippingStatus] ?? r.shippingStatus : "—", r.ttn ?? "", ORDER_LABEL[r.order_status ?? "new"],
  ];
}

export async function ordersToXlsx(rows: CrmRow[], meta: { title: string; sum: number }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Історії принцеси Лілі — адмінка";
  wb.created = new Date();
  const ws = wb.addWorksheet("Замовлення", { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = COLS.map((c) => ({ width: c.w }));
  ws.addRow([meta.title]).font = { bold: true, size: 12 };
  const head = ws.addRow(COLS.map((c) => c.h));
  head.font = { bold: true };
  head.alignment = { wrapText: true, vertical: "middle" };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEE1" } }; });
  for (const r of rows) {
    const row = ws.addRow(rowValues(r));
    row.alignment = { wrapText: true, vertical: "top" };
    // усі клітинки з текстом — саме текст (не формули)
    row.eachCell((c, i) => { if (i !== 9) c.numFmt = "@"; });
    row.getCell(9).numFmt = "#,##0.00";
  }
  const total = ws.addRow(["Разом", `${rows.length} замовл.`, "", "", "", "", "", "", meta.sum / 100]);
  total.font = { bold: true };
  total.getCell(9).numFmt = "#,##0.00";
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLS.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const FONT = path.join(process.cwd(), "assets-fonts", "DejaVuSans.ttf");
const FONT_B = path.join(process.cwd(), "assets-fonts", "DejaVuSans-Bold.ttf");

/** Читабельна PDF-таблиця: A4 landscape, перенос тексту, повтор шапки на кожній сторінці, підсумок кількості й суми. */
export async function ordersToPdf(rows: CrmRow[], meta: { title: string; sum: number }) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, info: { Title: meta.title, Author: "Історії принцеси Лілі" } });
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_B);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  // компактний набір колонок для PDF
  const cols = [
    { h: "Номер / дата (Київ)", w: 82, v: (r: CrmRow) => `${r.number}\n${kyiv(r.created_at)}` },
    { h: "Покупець / контакти", w: 140, v: (r: CrmRow) => `${r.name}${r.recipient ? `\nОдержувач: ${r.recipient}` : ""}\n${r.email}${r.phone ? `\n${r.phone}` : ""}` },
    { h: "Товари", w: 190, v: (r: CrmRow) => `${r.itemsText} [${KIND_LABEL[r.kind]}]` },
    { h: "Сума", w: 62, v: (r: CrmRow) => formatMinor(r.total_minor, "uk") },
    { h: "Оплата", w: 92, v: (r: CrmRow) => `${PAYMENT_LABEL[r.payment_status] ?? r.payment_status}\n${METHOD_LABEL[r.payment_method ?? r.payment_mode] ?? r.payment_mode}` },
    { h: "Доставка", w: 130, v: (r: CrmRow) => (r.shipping_required ? `НП: ${r.np_city ?? ""}, ${r.np_point ?? ""}` : "PDF — не потрібна") },
    { h: "Відправлення / ТТН", w: 90, v: (r: CrmRow) => (r.shippingStatus ? `${SHIPPING_LABEL[r.shippingStatus] ?? r.shippingStatus}${r.ttn ? `\n${r.ttn}` : ""}` : "—") },
  ];
  const x0 = doc.page.margins.left;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const header = () => {
    doc.font("b").fontSize(8);
    let x = x0; const y = doc.y;
    const h = Math.max(...cols.map((c) => doc.heightOfString(c.h, { width: c.w - 6 }))) + 8;
    doc.rect(x0, y, cols.reduce((a, c) => a + c.w, 0), h).fill("#e8eee1");
    doc.fillColor("#263d2d");
    for (const c of cols) { doc.text(c.h, x + 3, y + 4, { width: c.w - 6 }); x += c.w; }
    doc.y = y + h;
  };
  doc.font("b").fontSize(13).fillColor("#263d2d").text(meta.title);
  doc.font("r").fontSize(8).fillColor("#57534a").text(`Сформовано: ${kyiv(new Date().toISOString())} (Київ)`);
  doc.moveDown(0.6);
  header();
  doc.font("r").fontSize(8);
  rows.forEach((r, i) => {
    const vals = cols.map((c) => c.v(r));
    const h = Math.max(...vals.map((v, j) => doc.heightOfString(v, { width: cols[j].w - 6 }))) + 8;
    if (doc.y + h > bottom()) { doc.addPage(); header(); doc.font("r").fontSize(8); }
    const y = doc.y;
    if (i % 2) doc.rect(x0, y, cols.reduce((a, c) => a + c.w, 0), h).fill("#faf6ee");
    doc.fillColor("#2a2924");
    let x = x0;
    vals.forEach((v, j) => { doc.text(v, x + 3, y + 4, { width: cols[j].w - 6 }); x += cols[j].w; });
    doc.y = y + h;
  });
  if (doc.y + 30 > bottom()) doc.addPage();
  doc.moveDown(0.8).font("b").fontSize(10).fillColor("#263d2d")
    .text(`Разом: ${rows.length} замовл. на суму ${formatMinor(meta.sum, "uk")} (без доставки)`, x0);
  doc.end();
  return done;
}

const LANG_UK: Record<string, string> = { uk: "українська", en: "англійська" };

/**
 * Лист збірки (PDF, A4): підсумок «що зібрати» (друковані книжки за назвою й мовою, PDF до надсилання)
 * і блок на кожне замовлення — покупець, телефон, одержувач, Нова пошта, куди надіслати PDF, позиції з
 * квадратиками для позначок, коментар і рядок для ТТН. Неоплачені замовлення помітно позначено.
 */
export async function ordersToPickingPdf(rows: CrmRow[], meta: { title: string }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: meta.title, Author: "Історії принцеси Лілі" } });
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_B);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const x0 = doc.page.margins.left;
  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ink = "#2a2924", soft = "#57534a", green = "#263d2d", red = "#9a2f28";

  doc.font("b").fontSize(16).fillColor(green).text(meta.title);
  doc.font("r").fontSize(9).fillColor(soft).text(`Сформовано: ${kyiv(new Date().toISOString())} (Київ) · замовлень: ${rows.length}`);
  doc.moveDown(0.8);

  // ---- Підсумок для збірки ----
  const print = new Map<string, number>(), pdf = new Map<string, number>();
  for (const r of rows) for (const i of r.items) {
    const key = `${i.title_snapshot} — ${LANG_UK[i.book_locale] ?? i.book_locale}`;
    const m = i.format === "print" ? print : pdf;
    m.set(key, (m.get(key) ?? 0) + i.quantity);
  }
  const list = (h: string, m: Map<string, number>, box: boolean) => {
    if (!m.size) return;
    doc.font("b").fontSize(11).fillColor(green).text(h);
    doc.font("r").fontSize(10).fillColor(ink);
    for (const [k, q] of [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "uk"))) doc.text(`${box ? "☐ " : "• "}${k} × ${q}`, { indent: 6 });
    doc.moveDown(0.5);
  };
  const unpaid = rows.filter((r) => r.payment_status !== "paid").length;
  if (unpaid) doc.font("b").fontSize(10).fillColor(red).text(`Увага: ${unpaid} із ${rows.length} замовлень ще НЕ оплачені — їх позначено червоною рамкою, не відправляйте до підтвердження оплати.`).moveDown(0.5);
  list(`Друковані книжки до збірки (усього ${[...print.values()].reduce((a, b) => a + b, 0)} шт.)`, print, true);
  list("Електронні книжки (PDF) до надсилання", pdf, false);
  if (!rows.length) doc.font("r").fontSize(11).fillColor(soft).text("Немає замовлень за обраними умовами.");

  // ---- Блоки замовлень ----
  for (const r of rows) {
    const paid = r.payment_status === "paid";
    const buyer = [r.last_name, r.first_name].filter(Boolean).join(" ") || r.name;
    const lines: { t: string; b?: boolean; c?: string }[] = [];
    lines.push({ t: `Покупець: ${buyer}`, b: true });
    lines.push({ t: `Телефон: ${r.phone ?? "—"}   ·   Email: ${r.email}` });
    if (r.recipient) lines.push({ t: `Одержувач: ${r.recipient}${r.recipient_phone ? `, тел. ${r.recipient_phone}` : ""}`, b: true });
    lines.push({ t: r.shipping_required ? `Нова пошта: ${r.np_city ?? ""}, ${r.np_point ?? ""}` : "Доставка не потрібна (лише PDF)" });
    if (r.items.some((i) => i.format === "pdf")) lines.push({ t: `PDF надіслати: ${r.pdf_channel === "telegram" ? `у Telegram ${r.telegram ?? ""}` : `на email ${r.email}`}` });
    for (const i of r.items)
      lines.push({ t: `☐  ${i.format === "pdf" ? "PDF" : `${i.quantity} шт.`}  ${i.title_snapshot} — ${i.format === "pdf" ? "електронна" : "друкована"}, ${LANG_UK[i.book_locale] ?? i.book_locale}` });
    if (r.customer_note) lines.push({ t: `Коментар покупця: ${r.customer_note}`, c: soft });
    lines.push({ t: r.shipping_required ? "ТТН: ______________________     Зібрано ☐     Відправлено ☐" : "PDF надіслано ☐", c: soft });

    const head = `${r.number}   ·   ${kyiv(r.created_at)}   ·   ${formatMinor(r.total_minor, "uk")}`;
    const status = paid ? "Оплачено" : `НЕ ОПЛАЧЕНО — ${PAYMENT_LABEL[r.payment_status] ?? r.payment_status}`;
    doc.fontSize(10);
    const h = 30 + lines.reduce((a, l) => a + doc.font(l.b ? "b" : "r").heightOfString(l.t, { width: W - 16 }) + 2, 0) + 10;
    if (doc.y + h > bottom()) doc.addPage();
    const y = doc.y;
    doc.roundedRect(x0, y, W, h, 6).lineWidth(paid ? 0.8 : 1.6).strokeColor(paid ? "#c9cfc2" : red).stroke();
    doc.font("b").fontSize(12).fillColor(green).text(head, x0 + 8, y + 8, { width: W - 16, continued: false });
    doc.font("b").fontSize(10).fillColor(paid ? green : red).text(status, x0 + 8, y + 8, { width: W - 16, align: "right" });
    doc.y = y + 30;
    for (const l of lines) doc.font(l.b ? "b" : "r").fontSize(10).fillColor(l.c ?? ink).text(l.t, x0 + 8, doc.y, { width: W - 16 }).moveDown(0.1);
    doc.y = y + h + 10;
  }
  doc.end();
  return done;
}
