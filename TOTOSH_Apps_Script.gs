/**
 * TOTOSH ↔ Google Таблиця «Облік товару дитячий одяг».
 * Встановлення: Розширення → Apps Script → вставити цей код → Зберегти →
 * вгорі вибрати функцію setup → Виконати → дозволити доступ.
 * setup покаже ключ — його треба один раз додати у Vercel як SHEETS_SYNC_SECRET.
 *
 * Що робить:
 *  • при кожній зміні аркуша «Товари» і кожні 10 хв надсилає на сайт колонки
 *    A (№), C (назва), E (розмір), F (опис), O (статус), P (відправлено), T (рекомендована ціна — вона йде на сайт);
 *    закупівельні ціни й дані покупців на сайт НЕ передаються;
 *  • сайт додає нові товари, ховає продані, оновлює ціни й залишки;
 *  • продажі з сайту сайт повертає — скрипт ставить «Продано»/«Резерв», ціну (L), дату (R),
 *    «Відправлено» (P) і номер замовлення (Q, якщо порожньо). Підсумки в «Аналітиці» рахуються самі.
 */
const SITE_URL = 'https://totoshstore.com/api/sheets/sync';
const SHEET_NAME = 'Товари';
const FIRST_ROW = 6;   // перший рядок з товаром (над ним — заголовки)
const STATUS_TEXT = { in_stock: 'В наявності', sold: 'Продано', reserved: 'Резерв' };

/** Ключ зберігається у властивостях скрипта, не в коді й не в таблиці */
function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('SYNC_SECRET');
  if (!s) {
    s = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('SYNC_SECRET', s);
  }
  return s;
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert(
    'Ключ синхронізації TOTOSH',
    'Скопіюйте цей ключ і додайте у Vercel (проєкт totosh → Settings → Environment Variables) ' +
    'змінну SHEETS_SYNC_SECRET (тип Sensitive, Production):\n\n' + secret_() +
    '\n\nНікому його не пересилайте. Після додавання й оновлення сайту натисніть меню TOTOSH → «Синхронізувати з сайтом зараз».',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Показати ключ ще раз, якщо загубився */
function showKey() {
  SpreadsheetApp.getUi().alert('SHEETS_SYNC_SECRET', secret_(), SpreadsheetApp.getUi().ButtonSet.OK);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('TOTOSH')
    .addItem('Синхронізувати з сайтом зараз', 'syncNow')
    .addItem('Показати ключ синхронізації', 'showKey')
    .addToUi();
}

function onSheetEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== SHEET_NAME) return;
  Utilities.sleep(1500);   // дати дописати сусідні клітинки
  syncNow();
}

function syncNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;   // уже йде синхронізація — наступна зміна/розклад підхопить
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    const last = sh.getLastRow();
    if (last < FIRST_ROW) return;
    const values = sh.getRange(FIRST_ROW, 1, last - FIRST_ROW + 1, 25).getDisplayValues();
    const rows = [];
    const rowOf = {};
    values.forEach((r, i) => {
      if (!r[0] || !r[2]) return;
      rowOf[String(r[0]).trim()] = FIRST_ROW + i;
      rows.push({ n: r[0], name: r[2], size: r[4], desc: r[5], status: r[14], sent: r[15], price: r[19] });   // T — рекомендована ціна
    });
    const res = UrlFetchApp.fetch(SITE_URL, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + secret_() },
      payload: JSON.stringify({ rows: rows }),
    });
    if (res.getResponseCode() !== 200) {
      console.error('TOTOSH sync ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return;
    }
    const data = JSON.parse(res.getContentText());
    (data.writeback || []).forEach((w) => {
      const row = rowOf[String(w.row)];
      if (!row) return;
      sh.getRange(row, 15).setValue(STATUS_TEXT[w.status]);                    // O статус
      if (w.clear) {                                                           // замовлення скасоване
        sh.getRange(row, 12).clearContent();                                   // L ціна продажу
        sh.getRange(row, 18).clearContent();                                   // R дата
        const q = sh.getRange(row, 17);
        if (String(q.getValue()).indexOf('Сайт:') === 0) q.clearContent();     // Q — лише наш запис
        return;
      }
      if (w.price != null) sh.getRange(row, 12).setValue(w.price);
      if (w.date) {
        const p = w.date.split('.');
        sh.getRange(row, 18).setValue(new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])));
      }
      if (w.sent) sh.getRange(row, 16).setValue('Так');                        // P відправлено
      const q = sh.getRange(row, 17);
      if (!q.getValue() && w.note) q.setValue(w.note);
    });
    if ((data.created || []).length) {
      SpreadsheetApp.getActive().toast('На сайт додано нових товарів: ' + data.created.length, 'TOTOSH', 5);
    }
  } finally {
    lock.releaseLock();
  }
}
