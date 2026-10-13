/**
 * Повна перевірка адмінки на ширині телефона (390 px) з режимом сховища як на Vercel (файли в БД):
 *   DATABASE_URL=postgres://…/pl_admin PRIVATE_STORAGE=database npm run dev -- -p 3001   (свіжа БД після db:setup)
 *   BASE_URL=http://localhost:3001 node tests/e2e/admin.mjs [screenshotsDir]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = process.argv[2] ?? "test-results/admin";
const EMAIL = process.env.ADMIN_EMAIL ?? "owner@example.com", PASS = process.env.ADMIN_PASSWORD ?? "Garden-Path-Lantern-2026";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// ---------- Покупець: замовлення з ручною оплатою + квитанція ----------
await p.goto(`${BASE}/uk/books/lili-ide-do-likarya`);
await p.locator("label.chip", { hasText: "Українська" }).click();
await p.locator("label.chip", { hasText: "Друкована книга" }).click();
await p.getByRole("button", { name: "Купити зараз" }).click();
await p.waitForURL(/checkout/);
await p.getByLabel("Email", { exact: true }).fill("parent@example.com");
await p.getByLabel("Ім’я", { exact: true }).fill("Олена");
await p.getByLabel("Прізвище", { exact: true }).fill("Тестова");
await p.getByLabel("Телефон").fill("+380 50 123 45 67");
await p.getByLabel("Місто або населений пункт").fill("Кропивницький");
await p.getByLabel("Відділення або поштомат").fill("Відділення №6");
await p.locator("form button[type=submit], form button:not([type])").last().click();
await p.waitForURL(/order\//, { timeout: 30000 });
const orderUrl = p.url();
await p.setInputFiles("input[type=file]", "assets-src/covers/lili-ide-do-likarya-uk.png");
await p.getByRole("button", { name: /надіслати квитанцію/ }).click();
check("покупець: квитанція → «Дякуємо за покупку!»", await p.getByText("Дякуємо за покупку!").waitFor({ timeout: 30000 }).then(() => true, () => false));

// ---------- Вхід ----------
await p.goto(`${BASE}/admin/login`);
await p.getByLabel("Email", { exact: true }).fill(EMAIL);
await p.getByLabel("Пароль").fill(PASS);
await p.getByRole("button", { name: "Увійти" }).click();
await p.waitForURL(`${BASE}/admin`, { timeout: 60000 });
const dash = await p.locator("main").innerText();
check("огляд: без блоку «Стан магазину» і плашок", !dash.includes("Стан магазину") && !(await p.locator("header").innerText()).includes("Email:"));
check("огляд: замовлення чекає перевірки оплати", dash.includes("Перевірити оплату (1)"));
check("огляд: без горизонтального скролу", (await overflow()) <= 0);
await shot(p, "1-dashboard");

// ---------- Замовлення: квитанція, підтвердження, ТТН ----------
await p.goto(`${BASE}/admin/orders`);
check("CRM: таблиця з покупцем", (await p.locator("main").innerText()).includes("Олена Тестова"));
await shot(p, "2-orders");
await p.locator("main a[href^='/admin/orders/ord_']:visible").first().click();
await p.getByText("Оплату звірено — підтвердити").waitFor();
const rcp = p.locator("a[href^='/admin/receipt/']").first();
const rcpRes = await p.request.get(new URL(await rcp.getAttribute("href"), BASE).toString());
check("квитанція відкривається адміну (200, зображення)", rcpRes.status() === 200 && (rcpRes.headers()["content-type"] ?? "").startsWith("image/"));
await shot(p, "3-order");
await p.getByLabel(/Я звірив\(ла\) суму/).check();
await p.getByRole("button", { name: "Оплату звірено — підтвердити" }).click();
await p.getByText("Оплачено").first().waitFor({ timeout: 20000 });
check("підтвердження оплати → «Оплачено»", true);
await p.getByLabel("Статус", { exact: true }).selectOption("shipped");
await p.getByLabel("ТТН (номер накладної)").fill("20450099990000");
await p.getByRole("button", { name: "Зберегти доставку" }).click();
await p.getByText("Доставку оновлено").waitFor({ timeout: 20000 });
check("ТТН збережено", true);
const cust = await (await ctx.newPage());
await cust.goto(orderUrl);
const custText = await cust.locator("main").innerText();
check("покупець бачить «Оплачено» і ТТН", custText.includes("Оплату підтверджено") && custText.includes("20450099990000"));
await cust.close();

// ---------- Експорт ----------
const xl = await p.request.get(`${BASE}/admin/orders-export?format=xlsx`);
check("експорт Excel", xl.status() === 200 && (await xl.body()).subarray(0, 2).toString() === "PK");
const pd = await p.request.get(`${BASE}/admin/orders-export?format=pdf`);
check("експорт PDF", pd.status() === 200 && (await pd.body()).subarray(0, 5).toString() === "%PDF-");

// ---------- PDF без завантаженого файлу: продається, власниця надсилає вручну ----------
{
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const b2 = await c2.newPage();
  await b2.goto(`${BASE}/uk`);
  const card = await b2.locator("#catalog").innerText();
  check("картка: ціни «399 грн / друкована» і «299 грн / PDF»", card.includes("399 грн") && card.includes("/ друкована") && card.includes("299 грн") && card.includes("/ PDF"));
  await b2.screenshot({ path: path.join(OUT, "0-cards.png") });
  await b2.goto(`${BASE}/uk/books/yak-lili-vchyla-bublyka`);
  check("сторінка книжки: підказка про PDF на телефоні/планшеті", (await b2.locator("main").innerText()).includes("PDF зручно читати на телефоні"));
  await b2.locator("label.chip", { hasText: "Українська" }).click();
  await b2.locator("label.chip", { hasText: "Електронна книга (PDF)" }).click();
  await b2.getByRole("button", { name: "Купити зараз" }).click();
  await b2.waitForURL(/checkout/);
  await b2.getByLabel("Email", { exact: true }).fill("pdf-buyer@example.com");
  await b2.getByLabel("Ім’я", { exact: true }).fill("Ірина");
  await b2.getByLabel("Прізвище", { exact: true }).fill("Читачка");
  await b2.locator("label.chip", { hasText: "У Telegram" }).click();
  await b2.getByLabel("Ваш Telegram").fill("@lily_reader");
  await b2.locator("form button[type=submit], form button:not([type])").last().click();
  await b2.waitForURL(/order\//, { timeout: 30000 });
  await b2.setInputFiles("input[type=file]", "assets-src/covers/lili-ide-do-likarya-uk.png");
  await b2.getByRole("button", { name: /надіслати квитанцію/ }).click();
  await b2.getByText("Дякуємо за покупку!").waitFor({ timeout: 30000 });
  check("PDF-замовлення оформлено з квитанцією", true);
  await c2.close();
  await p.goto(`${BASE}/admin/orders`);
  await p.locator("main a[href^='/admin/orders/ord_']:visible").first().click();
  await p.getByLabel(/Я звірив\(ла\) суму/).check();
  await p.getByRole("button", { name: "Оплату звірено — підтвердити" }).click();
  await p.getByRole("button", { name: "PDF надіслано" }).waitFor({ timeout: 20000 });
  check("адмінка: PDF без файлу → надіслати вручну в Telegram покупця", (await p.locator("main").innerText()).includes("у Telegram") && (await p.locator("a[href='https://t.me/lily_reader']").count()) > 0);
  await p.getByRole("button", { name: "PDF надіслано" }).click();
  check("позначка «PDF надіслано»", await p.getByText("Позначено: PDF надіслано").waitFor({ timeout: 20000 }).then(() => true, () => false));
}

// ---------- Нова книжка з обкладинками ----------
await p.goto(`${BASE}/admin/products`);
check("товари: без горизонтального скролу", (await overflow()) <= 0);
await shot(p, "4-products");
await p.getByLabel("Назва українською").fill("Лілі та нова пригода");
await p.getByLabel("Назва англійською (якщо є)").fill("Lily and a New Adventure");
await p.setInputFiles("#np-cover-uk", "assets-src/covers/yak-lili-vchyla-bublyka-uk.png");
await p.setInputFiles("#np-cover-en", "assets-src/covers/yak-lili-vchyla-bublyka-en.png");
await p.getByRole("button", { name: "Створити книжку" }).click();
await p.waitForURL(/\/admin\/products\/prd_/, { timeout: 60000 });
await p.waitForTimeout(800);
const covers = await p.locator("main img[src*='/uploads/covers/']").count();
check("нова книжка: обидві обкладинки збережено", covers >= 2, `img=${covers}`);
const src = await p.locator("main img[src*='/uploads/covers/']").first().getAttribute("src");
const img = await p.request.get(new URL(src, BASE).toString());
check("обкладинка віддається з БД (200)", img.status() === 200 && (img.headers()["content-type"] ?? "").startsWith("image/"));
check("сторінка книжки: без горизонтального скролу", (await overflow()) <= 0);
await shot(p, "5-new-book");

// ціна друку UA, залишок, увімкнено; публікація
const printForm = p.locator("form", { has: p.locator("input[name=stock]") }).first();
await printForm.locator("input[name=price]").fill("399");
await printForm.locator("input[name=stock]").fill("7");
await printForm.locator("input[name=is_active]").check();
await printForm.getByRole("button", { name: "Зберегти варіант" }).click();
await p.waitForTimeout(1500);
await p.getByLabel("Статус", { exact: true }).selectOption("published");
await p.getByRole("button", { name: "Зберегти товар" }).click();
await p.waitForTimeout(1500);
await p.goto(`${BASE}/uk`);
const home = await p.locator("#catalog").innerText();
check("нова книжка на вітрині з ціною", home.includes("Лілі та нова пригода") && home.includes("399 грн"));
await p.goto(`${BASE}/en/books/lili-ta-nova-pryhoda`);
check("EN-сторінка нової книжки з англійською назвою", (await p.locator("main").innerText()).includes("Lily and a New Adventure"));

// ---------- Інші розділи ----------
for (const [u, t] of [["/admin/messages", "Звернення"], ["/admin/settings", "Налаштування"], ["/admin/log", "Журнал"]]) {
  const r = await p.goto(`${BASE}${u}`);
  check(`${t}: відкривається`, r.status() === 200 && (await overflow()) <= 0);
}
await shot(p, "6-settings");

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
