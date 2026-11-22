/**
 * Сторінка замовлення сама підхоплює підтвердження оплати (без «Оновити»), і тоді ж один раз спрацьовує Purchase.
 *   той самий dev-сервер, що й для pixel.mjs (PAYMENT_MODE=provider PAYMENT_PROVIDER=test NEXT_PUBLIC_META_PIXEL_ID=…)
 *   node tests/e2e/order-autorefresh.mjs
 */
import { chromium } from "playwright";
import Database from "better-sqlite3";
{ const d = new Database("data/demo.db"); d.prepare("delete from rate_limits").run(); d.close(); }
const B = process.env.BASE_URL ?? "http://localhost:3000";
const res = []; const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n} ${x}`);
const STUB = `window.__px=window.__px||[];(function(){var f=window.fbq;var rec=function(){window.__px.push(Array.prototype.slice.call(arguments))};(f.queue||[]).forEach(function(a){rec.apply(null,a)});f.callMethod=rec;})();`;
const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await br.newContext();
await ctx.route("https://connect.facebook.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: STUB }));
const pg = await ctx.newPage();
await pg.goto(B + "/uk/books/demo-book", { waitUntil: "networkidle" });
const allow = pg.getByRole("button", { name: "Дозволити" });
if (await allow.isVisible()) await allow.click();
await pg.getByText("Українська", { exact: true }).first().click();
await pg.locator("label.chip").filter({ hasText: "PDF" }).first().click();
await pg.getByRole("button", { name: "Купити зараз" }).click();
await pg.waitForURL(/checkout/);
await pg.getByRole("textbox", { name: "Email", exact: true }).fill("auto@example.com"); await pg.getByRole("textbox", { name: "Ім’я", exact: true }).fill("Олена"); await pg.getByRole("textbox", { name: "Прізвище", exact: true }).fill("Тестова");
await pg.getByLabel("Телефон").fill("+380 50 123 45 67");
await pg.getByRole("button", { name: "Перейти до оплати" }).click();
await pg.waitForURL(/test-checkout/);
const ret = new URL(pg.url()).searchParams.get("return");
// покупець повернувся на сайт РАНІШЕ, ніж банк підтвердив оплату
const back = await ctx.newPage();
await back.goto(ret, { waitUntil: "networkidle" });
ok("before confirmation: waiting + auto-check note", (await back.getByText("Перевіряємо оплату автоматично").isVisible()) && !(await back.getByText("Дякуємо за покупку!").isVisible()));
// банк підтверджує оплату (у тесті — кнопка імітації на іншій вкладці)
await pg.getByRole("button", { name: "Імітувати успішну оплату" }).click();
await pg.close();
const t0 = Date.now();
await back.getByText("Дякуємо за покупку!").waitFor({ timeout: 15000 }).catch(() => {});
ok("page switched to «Дякуємо за покупку!» by itself", await back.getByText("Дякуємо за покупку!").isVisible(), `${Date.now() - t0} ms`);
await back.waitForTimeout(800);
const pur = await back.evaluate(() => (window.__px || []).filter((a) => a[1] === "Purchase"));
ok("Purchase fired once on the auto-updated page", pur.length === 1, JSON.stringify(pur[0]?.[2] ?? null));
await back.waitForTimeout(4000);
ok("no repeat Purchase while page stays open", (await back.evaluate(() => (window.__px || []).filter((a) => a[1] === "Purchase").length)) === 1);
ok("auto-check note gone after payment", !(await back.getByText("Перевіряємо оплату автоматично").isVisible()));
await br.close();
console.log(res.join("\n")); console.log(`\n${res.filter((r) => r.startsWith("PASS")).length}/${res.length} passed`);
if (res.some((r) => r.startsWith("FAIL"))) process.exit(1);
