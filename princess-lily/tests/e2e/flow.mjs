/**
// перед запуском: демо-залишок друку відновлюється, щоб сценарій був відтворюваним
 * Наскрізна перевірка на локальному dev-сервері з демо-БД і тестовим провайдером:
 *   DATABASE_URL=file:./data/demo.db PAYMENT_MODE=provider PAYMENT_PROVIDER=test PAYMENT_WEBHOOK_SECRET=… EMAIL_PROVIDER=outbox npm run dev
 *   node tests/e2e/flow.mjs [screenshotsDir]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "test-results/e2e";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
// демо-БД: відновити залишок друку й ліміти (лише локальна demo.db)
{ const { default: Database } = await import("better-sqlite3"); const d = new Database("data/demo.db"); d.prepare("update product_variants set stock = 5 where id = 'var_demo_uk_print'").run(); d.prepare("delete from rate_limits").run(); d.close(); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// ---------- Покупка: змішаний кошик ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/uk/books/demo-book`);
check("до вибору варіанта покупка неактивна", await page.getByRole("button", { name: "Купити зараз" }).isDisabled());
await page.getByText("Українська", { exact: true }).first().click();
await page.getByText("Друкована книга", { exact: true }).click();
check("ціна оновлюється за варіантом (друк 380,50)", (await page.locator("main").innerText()).includes("380,50 грн"));
await page.getByRole("button", { name: "Додати в кошик" }).click();
check("підтвердження додавання з кількістю в кошику", await page.getByText("У кошику: 1").isVisible());
await page.getByText("Електронна книга (PDF)", { exact: true }).click();
await page.getByRole("button", { name: "Додати в кошик" }).click();
// «Купити зараз» — лише ця книжка, кошик не змінюється
await page.getByRole("button", { name: "Купити зараз" }).click();
await page.waitForURL(/checkout\?buy=/);
await page.getByText("Швидка покупка").waitFor();
const buyText = await page.locator("aside").innerText();
check("«Купити зараз»: у підсумку лише обрана книжка (199 грн)", buyText.includes("199 грн") && !buyText.includes("380,50"));
const cartAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("pl_cart_v1")).length);
check("«Купити зараз» не змінює кошик (2 рядки)", cartAfter === 2);
await page.goto(`${BASE}/uk/cart`);
await page.getByText("Разом за книжки").waitFor();
const cartText = await page.locator("main").innerText();
check("кошик: окремі рядки PDF і друк", cartText.includes("Друкована книга · Українська") && cartText.includes("Електронна книга (PDF) · Українська"));
check("кошик: серверна сума 199 + 380,50", cartText.includes("579,50 грн"));
await page.screenshot({ path: path.join(OUT, "cart-desktop.png"), fullPage: true });

// підміна ціни в localStorage нічого не дає (зберігаються лише id/кількість)
await page.evaluate(() => { const c = JSON.parse(localStorage.getItem("pl_cart_v1")); c[0].priceMinor = 1; localStorage.setItem("pl_cart_v1", JSON.stringify(c)); });
await page.goto(`${BASE}/uk/checkout`);
await page.getByLabel("Email").waitFor();
check("checkout: поля доставки є для друку", await page.getByLabel("Відділення або поштомат").isVisible());
await page.getByRole("button", { name: "Перейти до оплати" }).click();
check("checkout: валідація порожніх полів", await page.getByText("Вкажіть коректний email.").isVisible());
await page.getByLabel("Email").fill("parent@example.com");
await page.getByLabel("Ім’я", { exact: true }).fill("Олена");
await page.getByLabel("Прізвище", { exact: true }).fill("Тестова");
await page.getByLabel("Телефон").fill("+380 50 123 45 67");
await page.getByLabel("Місто або населений пункт").fill("Київ");
await page.getByLabel("Відділення або поштомат").fill("Відділення №1");
check("checkout: сума з сервера не змінена підміною", (await page.locator("aside").innerText()).includes("579,50 грн"));
await page.screenshot({ path: path.join(OUT, "checkout-desktop.png"), fullPage: true });
await page.getByRole("button", { name: "Перейти до оплати" }).click();
await page.waitForURL(/test-checkout/);
check("перехід на (тестову) сторінку оплати після збереження замовлення", page.url().includes("/api/payments/test-checkout"));

// success URL сам по собі нічого не дає: відкриваємо сторінку статусу ДО оплати
const returnUrl = new URL(page.url()).searchParams.get("return");
const pre = await ctx.newPage();
await pre.goto(returnUrl);
check("статус до оплати: «Очікує оплату» (success URL не підтверджує оплату)", (await pre.locator("main").innerText()).includes("Очікує оплату"));
await pre.close();

await page.getByRole("button", { name: "Імітувати успішну оплату" }).click();
await page.waitForURL(/\/uk\/order\//);
const orderText = await page.locator("main").innerText();
check("статус після підписаного вебхука: Оплачено", orderText.includes("Оплачено"));
check("PDF: посилання надіслано на email", orderText.includes("Посилання надіслано на email"));
check("доставка: готуємо до відправлення", orderText.includes("Готуємо до відправлення"));
await page.screenshot({ path: path.join(OUT, "order-paid-desktop.png"), fullPage: true });
const orderUrl = page.url();

// лист в outbox → посилання на завантаження
const outbox = path.resolve("storage/outbox");
const latest = fs.readdirSync(outbox).map((f) => path.join(outbox, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const link = /href="([^"]+\/api\/download\/[^"]+)"/.exec(fs.readFileSync(latest, "utf8"))?.[1];
check("лист містить посилання на PDF", !!link);
const d1 = await fetch(link);
check("завантаження PDF: 200 application/pdf, no-store", d1.status === 200 && d1.headers.get("content-type") === "application/pdf" && d1.headers.get("cache-control").includes("no-store"));
for (let i = 0; i < 4; i++) await fetch(link);
check("ліміт завантажень → 410", (await fetch(link)).status === 410);
check("вигаданий токен → 404", (await fetch(`${BASE}/api/download/${"x".repeat(43)}`)).status === 404);

// вебхук з невірним підписом
const wh = await fetch(`${BASE}/api/payments/webhook/test`, { method: "POST", headers: { "x-signature": "00".repeat(32) }, body: JSON.stringify({ event_id: "e", order_id: "o", amount_minor: 1, currency: "UAH", status: "success" }) });
check("вебхук з невірним підписом → 401", wh.status === 401);
check("вебхук невідомого провайдера → 404", (await fetch(`${BASE}/api/payments/webhook/liqpay`, { method: "POST", body: "{}" })).status === 404);

// ---------- Адмінка ----------
const anon = await fetch(`${BASE}/admin/orders`, { redirect: "manual" });
check("адмінка без входу → редірект на логін", [303, 307, 302].includes(anon.status) || (anon.status === 200 && (await anon.text()).includes("Вхід в адмінку")));
const up = await fetch(`${BASE}/api/admin/upload`, { method: "POST", body: new FormData() });
check("API завантаження без входу → 401", up.status === 401);
const admin = await ctx.newPage();
await admin.goto(`${BASE}/admin/login`);
await admin.getByLabel("Email").fill("owner@example.com");
await admin.getByLabel("Пароль").fill("wrong-password-123");
await admin.getByRole("button", { name: "Увійти" }).click();
check("логін: невірний пароль відхилено", await admin.getByText("Невірний email або пароль.").waitFor({ timeout: 20000 }).then(() => true, () => false));
await admin.getByLabel("Пароль").fill(process.env.ADMIN_PASSWORD ?? "Garden-Path-Lantern-2026");
await admin.getByRole("button", { name: "Увійти" }).click();
await admin.waitForURL(`${BASE}/admin`, { timeout: 60000 });
await admin.screenshot({ path: path.join(OUT, "admin-dashboard.png"), fullPage: true });
await admin.goto(`${BASE}/admin/orders`);
const table = await admin.locator("table").innerText();
check("CRM: замовлення в таблиці з ім’ям, змішаним типом і сумою", table.includes("Олена Тестова") && table.includes("Змішане") && table.includes("579,50 грн"));
await admin.screenshot({ path: path.join(OUT, "admin-crm-table.png"), fullPage: true });
const xl = await admin.request.get(`${BASE}/admin/orders-export?format=xlsx&kind=mixed`);
check("експорт Excel (адмін): 200, .xlsx", xl.status() === 200 && (xl.headers()["content-type"] ?? "").includes("spreadsheetml") && (await xl.body()).subarray(0, 2).toString() === "PK");
const pd = await admin.request.get(`${BASE}/admin/orders-export?format=pdf`);
check("експорт PDF (адмін): 200, %PDF", pd.status() === 200 && (await pd.body()).subarray(0, 5).toString() === "%PDF-");
check("експорт без входу → 401", (await fetch(`${BASE}/admin/orders-export?format=xlsx`)).status === 401);
check("квитанція без входу → 401", (await fetch(`${BASE}/admin/receipt/rcp_x`)).status === 401);
await admin.locator("main table a[href^='/admin/orders/ord_']").first().click();
await admin.getByText("Доставка (Нова пошта)").waitFor();
await admin.getByLabel("Статус", { exact: true }).selectOption("shipped");
await admin.getByLabel("ТТН (номер накладної)").fill("20450012345678");
await admin.getByRole("button", { name: "Зберегти доставку" }).click();
await admin.getByText("Доставку оновлено").waitFor();
await admin.screenshot({ path: path.join(OUT, "admin-order.png"), fullPage: true });
await page.goto(orderUrl);
check("покупець бачить ТТН після введення адміністратором", (await page.locator("main").innerText()).includes("20450012345678"));
const ordText2 = await page.locator("main").innerText();
check("статус оплати й доставки окремо (Оплачено + Відправлено)", ordText2.includes("Оплачено") && ordText2.includes("Відправлено"));

// ---------- Контактна форма ----------
await page.goto(`${BASE}/en/contacts`);
await page.getByLabel("Name").fill("Test Parent");
await page.getByLabel("Email").fill("p@example.com");
await page.getByLabel("Message").fill("Hello! Where is my book? (e2e)");
await page.getByRole("button", { name: "Send" }).click();
check("контактна форма: підтвердження після збереження", await page.getByText("Your message has been saved").waitFor({ timeout: 20000 }).then(() => true, () => false));
await admin.goto(`${BASE}/admin/messages`);
check("звернення видно в адмінці", (await admin.locator("main").innerText()).includes("Where is my book? (e2e)"));

// ---------- Мови ----------
await page.goto(`${BASE}/uk/books/demo-book?x=1`);
await page.getByRole("link", { name: "EN" }).click();
await page.waitForURL(/\/en\/books\/demo-book/);
check("перемикач мови зберігає сторінку й параметри", page.url().endsWith("/en/books/demo-book?x=1"));
await page.goto(`${BASE}/en/books/yak-lili-vchyla-bublyka`);
const enBook = await page.locator("main").innerText();
check("EN-сторінка: українська обкладинка з позначкою, Coming soon", enBook.includes("Original Ukrainian title") && enBook.includes("Coming soon"));
const html = await (await fetch(`${BASE}/en/books/yak-lili-vchyla-bublyka`)).text();
check("hreflang uk/en і canonical", html.includes('hrefLang="uk"') && html.includes('rel="canonical"'));
check("немає Schema Product для товару без ціни", !html.includes('"@type":"Product"'));
check("404 для невідомої сторінки", (await fetch(`${BASE}/uk/no-such-page`)).status === 404);
await page.goto(`${BASE}/uk/no-such-page`);
await page.screenshot({ path: path.join(OUT, "404.png") });
await ctx.close();

// ---------- Мобільний ----------
const m = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await m.newPage();
for (const p of ["/uk", "/uk/books", "/uk/books/demo-book", "/uk/contacts", "/en"]) {
  await mp.goto(`${BASE}${p}`);
  const ov = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`360px без горизонтального скролу: ${p}`, ov <= 0, `overflow=${ov}`);
}
await mp.goto(`${BASE}/uk/books/demo-book`);
await mp.getByText("Друкована книга", { exact: true }).click();
await mp.getByRole("button", { name: "Додати в кошик" }).click();
await mp.goto(`${BASE}/uk/checkout`);
await mp.getByLabel("Email").waitFor();
await mp.screenshot({ path: path.join(OUT, "checkout-mobile.png"), fullPage: true });
check("touch: курсорний слід вимкнений", await mp.evaluate(() => [...document.querySelectorAll("canvas")].every((c) => getComputedStyle(c).display === "none" || c.closest(".hero-media"))));
await m.close();

// ---------- reduced motion ----------
const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const rp = await rm.newPage();
await rp.goto(`${BASE}/uk`);
await rp.waitForTimeout(1500);
const st = await rp.evaluate(() => ({ playing: (() => { const v = document.querySelector("video"); return v && !v.paused; })(), canvases: [...document.querySelectorAll("canvas")].filter((c) => getComputedStyle(c).display !== "none").length, btn: !!document.querySelector('button[aria-label="Відтворити"]') }));
check("reduced-motion: відео не стартує, без пилу/сліду, є кнопка відтворення", !st.playing && st.canvases === 0 && st.btn, JSON.stringify(st));
await rm.close();

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
