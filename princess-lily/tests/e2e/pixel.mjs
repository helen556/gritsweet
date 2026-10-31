/**
 * Meta Pixel: згода, події та відсутність дублів (fbevents.js підмінено заглушкою, що записує виклики).
 *   DATABASE_URL=file:./data/demo.db PAYMENT_MODE=provider PAYMENT_PROVIDER=test PAYMENT_WEBHOOK_SECRET=dev_only \
 *     EMAIL_PROVIDER=outbox NEXT_PUBLIC_META_PIXEL_ID=1234567890 npm run dev
 *   node tests/e2e/pixel.mjs
 */
import { chromium } from "playwright";
import Database from "better-sqlite3";
{ const d = new Database("data/demo.db"); d.prepare("update product_variants set stock = 5 where id = 'var_demo_uk_print'").run(); d.prepare("delete from rate_limits").run(); d.close(); }
const B = process.env.BASE_URL ?? "http://localhost:3000";
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`);
const STUB = `window.__px=window.__px||[];(function(){var f=window.fbq;var rec=function(){window.__px.push(Array.prototype.slice.call(arguments))};(f.queue||[]).forEach(function(a){rec.apply(null,a)});f.callMethod=rec;})();`;

  const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 860 } });
  let fbRequests = 0;
  await ctx.route('https://connect.facebook.net/**', (r) => { fbRequests++; r.fulfill({ contentType: 'application/javascript', body: STUB }); });
  const pg = await ctx.newPage();
  const px = () => pg.evaluate(() => (window.__px || []).filter((a) => a[0] === 'track').map((a) => a[1]));
  await pg.goto(B + '/uk', { waitUntil: 'networkidle' });
  ok('banner shown before consent', await pg.getByRole('button', { name: 'Дозволити' }).isVisible());
  ok('no pixel script before consent', fbRequests === 0);
  await pg.getByRole('button', { name: 'Відхилити' }).click();
  await pg.goto(B + '/uk/books/demo-book', { waitUntil: 'networkidle' });
  ok('declined: still no pixel', fbRequests === 0 && !(await pg.getByRole('button', { name: 'Дозволити' }).isVisible()));
  // змінити рішення у футері
  await pg.getByRole('button', { name: 'Налаштування cookie' }).click();
  await pg.getByRole('button', { name: 'Дозволити' }).click();
  await pg.waitForTimeout(400);
  ok('consent → script loaded once', fbRequests === 1);
  let ev = await px();
  ok('PageView + ViewContent after consent on product page', ev.includes('PageView') && ev.includes('ViewContent'), JSON.stringify(ev));
  const vc = await pg.evaluate(() => window.__px.find((a) => a[1] === 'ViewContent')[2]);
  ok('ViewContent: id, name, value, UAH', vc.content_ids[0] === 'prd_demo' && vc.currency === 'UAH' && typeof vc.value === 'number' && !!vc.content_name, JSON.stringify(vc));
  await pg.getByText('Українська', { exact: true }).first().click();
  await pg.getByText('Друкована книжка', { exact: true }).click();
  await pg.getByRole('button', { name: 'Додати в кошик' }).click();
  ev = await px();
  const atc = await pg.evaluate(() => window.__px.find((a) => a[1] === 'AddToCart')[2]);
  ok('AddToCart with real price', atc && atc.value === 380.5 && atc.currency === 'UAH' && atc.content_ids[0] === 'prd_demo', JSON.stringify(atc));
  await pg.goto(B + '/uk/checkout', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
  ev = await px();
  ok('InitiateCheckout once', ev.filter((e) => e === 'InitiateCheckout').length === 1, JSON.stringify(ev));
  ok('no Purchase before payment', !ev.includes('Purchase'));
  await pg.getByRole('textbox', { name: 'Email', exact: true }).fill('px@example.com'); await pg.getByRole('textbox', { name: 'Ім’я', exact: true }).fill('Олена'); await pg.getByRole('textbox', { name: 'Прізвище', exact: true }).fill('Тестова');
  await pg.getByLabel('Телефон').fill('+380 50 123 45 67'); await pg.getByLabel('Місто або населений пункт').fill('Київ'); await pg.getByLabel('Відділення або поштомат').fill('Відділення №1');
  await pg.getByRole('button', { name: 'Перейти до оплати' }).click();
  await pg.waitForURL(/test-checkout/);
  const ret = new URL(pg.url()).searchParams.get('return');
  const pre = await ctx.newPage();
  await pre.goto(ret, { waitUntil: 'networkidle' }); await pre.waitForTimeout(400);
  ok('order page before payment: no Purchase', !(await pre.evaluate(() => (window.__px || []).some((a) => a[1] === 'Purchase'))));
  await pre.close();
  await pg.getByRole('button', { name: 'Імітувати успішну оплату' }).click();
  await pg.waitForURL(/\/uk\/order\//); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(400);
  const pur = await pg.evaluate(() => window.__px.filter((a) => a[1] === 'Purchase'));
  ok('Purchase exactly once after confirmed payment', pur.length === 1, JSON.stringify(pur[0]?.slice(2)));
  ok('Purchase has eventID for CAPI dedup', /^purchase-ord_/.test(pur[0]?.[3]?.eventID ?? ''));
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(400);
  ok('reload: Purchase not repeated', (await pg.evaluate(() => window.__px.filter((a) => a[1] === 'Purchase').length)) === 0);
  await br.close();
  console.log(res.join('\n')); console.log(`\n${res.filter((r) => r.startsWith('PASS')).length}/${res.length} passed`);

if (res.some((r) => r.startsWith('FAIL'))) process.exit(1);
