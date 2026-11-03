// Кошик і форма замовлення лендінгу ВІНОР. Дані (товари, ціни, тексти) — у window.VINOR на кожній сторінці.
(function () {
  var V = window.VINOR;
  var uk = V.lang === 'uk';
  var T = uk ? {
    empty: 'Кошик порожній — додайте стіки з лінійки або набір вище.',
    total: 'Разом', less: 'Менше', more: 'Більше', remove: 'Прибрати',
    phone: 'Вкажіть телефон, щоб ми могли з вами зв’язатися.',
    subject: 'Замовлення з сайту ВІНОР',
    fName: 'Ім’я', fPhone: 'Телефон', fCompany: 'Компанія', fType: 'Цікавить', fOrder: 'Замовлення', fNone: 'кошик порожній'
  } : {
    empty: 'Your cart is empty — add sticks from the range or a set above.',
    total: 'Total', less: 'Less', more: 'More', remove: 'Remove',
    phone: 'Please enter a phone number so we can reach you.',
    subject: 'Order from the VINOR website',
    fName: 'Name', fPhone: 'Phone', fCompany: 'Company', fType: 'Interested in', fOrder: 'Order', fNone: 'cart is empty'
  };
  var EMAIL = 'vinorcompany@gmail.com';
  var fmt = uk ? function (n) { return Math.round(n) + ' грн'; } : function (n) { return '€' + n.toFixed(2); };
  var cart = {};
  try { cart = JSON.parse(sessionStorage.getItem('vinor-cart-' + V.lang)) || {}; } catch (e) {}

  function calc() {
    var sticks = 0, litres = 0, count = 0;
    V.products.forEach(function (p) {
      var q = cart[p.id] || 0;
      sticks += q * p.sticks; count += q;
      if (p.bottle) litres += q * p.litres;
    });
    var thr = V.thr;
    var tier = sticks >= thr[2] ? 2 : sticks >= thr[1] ? 1 : sticks >= thr[0] ? 0 : -1;
    var priceOf = function (p) { return p.bottle ? (litres >= 20 ? p.w : p.retail) : ((tier >= 0 && p.t) ? p.t[tier] : p.retail); };
    var lines = V.products.filter(function (p) { return cart[p.id]; }).map(function (p) {
      return { id: p.id, name: p.name, qty: cart[p.id], sum: priceOf(p) * cart[p.id] };
    });
    var total = lines.reduce(function (a, l) { return a + l.sum; }, 0);
    var tierNote = tier >= 0 ? V.tierOn.replace('{t}', thr[tier].toLocaleString(uk ? 'uk-UA' : 'en-GB')) : V.tierOff;
    return { lines: lines, total: total, count: count, note: tierNote + (litres >= 20 ? ' ' + V.bottleNote : '') };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var BTN = 'width: 36px; height: 36px; border: 1px solid #D9D1C2; border-radius: 10px; background: #FFFFFF; color: #1E1B16; font-size: 18px; font-family: Manrope, Arial, sans-serif; cursor: pointer';
  var box = document.getElementById('vn-cart');

  function render() {
    var c = calc();
    document.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = c.count; });
    if (!c.lines.length) {
      box.innerHTML = '<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6B6457">' + T.empty + '</p>';
    } else {
      box.innerHTML = c.lines.map(function (l) {
        return '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid #E8E2D6">' +
          '<span style="flex: 1 1 120px; font-size: 15px; font-weight: 600">' + esc(l.name) + '</span>' +
          '<div style="display: flex; align-items: center; gap: 6px">' +
          '<button type="button" aria-label="' + T.less + '" data-dec="' + l.id + '" style="' + BTN + '">−</button>' +
          '<span style="min-width: 32px; text-align: center; font-size: 15px; font-weight: 700">' + l.qty + '</span>' +
          '<button type="button" aria-label="' + T.more + '" data-inc="' + l.id + '" style="' + BTN + '">+</button>' +
          '<button type="button" aria-label="' + T.remove + '" data-del="' + l.id + '" style="' + BTN + '">×</button>' +
          '</div>' +
          '<span style="min-width: 96px; text-align: right; font-size: 15px; font-weight: 700">' + fmt(l.sum) + '</span></div>';
      }).join('') +
        '<div style="display: flex; justify-content: space-between; gap: 12px; padding-top: 12px; font-size: 18px; font-weight: 700"><span>' + T.total + '</span><span style="color: #B8892E">' + fmt(c.total) + '</span></div>' +
        '<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6B6457">' + esc(c.note) + '</p>';
    }
    try { sessionStorage.setItem('vinor-cart-' + V.lang, JSON.stringify(cart)); } catch (e) {}
  }

  function setQty(id, q) {
    if (q <= 0) delete cart[id]; else cart[id] = q;
    document.getElementById('vn-thanks').hidden = true;
    render();
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var d = b.dataset;
    if (d.add) {
      setQty(d.add, (cart[d.add] || 0) + 1);
      var label = b.textContent;
      b.textContent = '✓';
      setTimeout(function () { b.textContent = label; }, 700);
    }
    else if (d.inc) setQty(d.inc, cart[d.inc] + 1);
    else if (d.dec) setQty(d.dec, cart[d.dec] - 1);
    else if (d.del) setQty(d.del, 0);
  });

  var form = document.getElementById('vn-form');
  var err = document.createElement('p');
  err.className = 'vn-err'; err.hidden = true; err.setAttribute('role', 'alert'); err.textContent = T.phone;
  var submitBtn = document.getElementById('vn-submit');
  submitBtn.parentNode.insertBefore(err, submitBtn);
  document.getElementById('f-phone').addEventListener('input', function () { err.hidden = true; });

  function submit(e) {
    if (e) e.preventDefault();
    var val = function (id) { return document.getElementById(id).value.trim(); };
    var phone = val('f-phone');
    if (phone.replace(/\D/g, '').length < 9) {
      err.hidden = false;
      document.getElementById('f-phone').focus();
      return;
    }
    err.hidden = true;
    var c = calc();
    var order = c.lines.length
      ? c.lines.map(function (l) { return '• ' + l.name + ' × ' + l.qty + ' = ' + fmt(l.sum); }).join('\n') + '\n' + T.total + ': ' + fmt(c.total)
      : T.fNone;
    var text = [
      T.fName + ': ' + val('f-name'),
      T.fPhone + ': ' + phone,
      T.fCompany + ': ' + val('f-company'),
      T.fType + ': ' + val('f-type'),
      '',
      T.fOrder + ':',
      order
    ].join('\n');
    window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(T.subject) + '&body=' + encodeURIComponent(text);
    document.getElementById('vn-thanks').hidden = false;
  }

  form.addEventListener('submit', submit);
  submitBtn.addEventListener('click', submit);
  document.getElementById('vn-reset').addEventListener('click', function () {
    cart = {};
    form.reset();
    render();
    document.getElementById('vn-thanks').hidden = true;
  });

  render();
})();
