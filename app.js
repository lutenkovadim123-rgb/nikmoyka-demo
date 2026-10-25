/* Автомойка на Никольской — v3: класс авто с подсказками моделей, каталог-корзина, запись, быстрая заявка, просмотр работ.
   Без анимаций прокрутки и без внешних библиотек. Демо: записи хранятся только в этом браузере. */
(function () {
  'use strict';
  var D = window.NIK_DATA, V = window.NIK_VENUES;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rub = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; };
  function hrs(h) {
    if (h >= 12) { var d = Math.ceil(h / 10); return d + ' ' + plural(d, 'день', 'дня', 'дней'); }
    var m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
    return (hh ? hh + ' ч' : '') + (mm ? (hh ? ' ' : '') + mm + ' мин' : '');
  }
  function plural(n, a, b, c) { return n % 10 === 1 && n % 100 !== 11 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var NIK = window.NIK = { esc: esc, rub: rub, hrs: hrs, plural: plural, store: store };

  /* ---------- режим работы ---------- */
  function msk() { var d = new Date(); return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000); }
  (function status() {
    var t = msk(), m = t.getHours() * 60 + t.getMinutes(), open = m >= 540 && m < 1260;
    var txt = open ? 'Сейчас открыто · до 21:00' : 'Сейчас закрыто · откроемся в 9:00';
    $$('[data-status]').forEach(function (el) { el.textContent = txt; el.classList.toggle('is-open', open); });
  })();

  /* ---------- меню ---------- */
  var menu = $('#menu');
  function setMenu(on) {
    if (!menu) return;
    menu.classList.toggle('open', on); menu.setAttribute('aria-hidden', String(!on));
    document.documentElement.classList.toggle('lock', on || sheetOpen);
    $$('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', String(on)); });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-menu]')) { setMenu(true); return; }
    if (e.target.closest('[data-menu-close]') || (menu && menu.classList.contains('open') && e.target.closest('#menu a'))) setMenu(false);
  });

  /* ---------- акции октября ---------- */
  var PROMO = { until: new Date('2026-10-31T23:59:59+03:00'), pct: { 'dry-complex': 20, 'dry-plus': 20, 'ppf-zones': 15, 'ppf-full': 15 } };
  var promoOn = new Date() <= PROMO.until;
  $$('[data-until]').forEach(function (el) { if (new Date() > new Date(el.dataset.until)) el.hidden = true; });
  function pct(id) { return promoOn ? PROMO.pct[id] || 0 : 0; }

  /* ---------- класс и корзина ---------- */
  var KINDS = ['sedan', 'sport', 'crossover', 'suv'];
  var EX = ['Kia Rio, Toyota Camry, BMW 3', 'Mercedes S, BMW 7, Porsche Panamera', 'Kia Sportage, BMW X3, Mercedes GLC', 'Mercedes GLS / G, BMW X5–X7, Land Cruiser'];
  var cls = store.get('nik:cls', null);
  var cart = new Map(store.get('nik:cart', []));
  var byId = {}; D.services.forEach(function (s) { byId[s.id] = s; });
  var pkgNames = {}; D.services.forEach(function (s) { if (!s.items) pkgNames[s.name] = 1; });
  function C() { return cls == null ? 0 : cls; }
  function save() { store.set('nik:cart', Array.from(cart.entries())); }
  function line(key) {
    var p = key.split(':'), s = byId[p[0]]; if (!s) return null;
    if (p.length > 1) { var it = s.items[+p[1]]; return it ? { key: key, name: it.name, p: it.p, h: 0.25, off: 0 } : null; }
    return { key: key, name: s.name, p: s.p, h: s.h, off: pct(s.id) };
  }
  function price(l) { return l.p[C()] * (1 - l.off / 100); }
  function lines() { var o = []; cart.forEach(function (_, k) { var l = line(k); if (l) o.push(l); }); return o; }
  function total() { return lines().reduce(function (s, l) { return s + price(l); }, 0); }
  function hours() {
    var ls = lines(); if (!ls.length) return 0;
    var main = ls.filter(function (l) { return l.h >= 1; }), opts = ls.filter(function (l) { return l.h < 1; });
    var h = main.reduce(function (s, l) { return s + l.h; }, 0) + opts.length * 0.25;
    return Math.max(1, Math.round(h * 2) / 2);
  }
  NIK.cart = { lines: lines, total: total, hours: hours, has: function (k) { return cart.has(k); } };
  function toggle(k) { var on = !cart.has(k); if (on) cart.set(k, 1); else cart.delete(k); save(); refresh(); feel(on); }
  // тихий отклик на отметку услуги: вибрация (Android), системный «тик» переключателя (iOS 18+), едва слышный щелчок
  var hapt = null, actx = null;
  function feel(on) {
    try { if (navigator.vibrate) navigator.vibrate(on ? 8 : 4); } catch (e) {}
    try {
      if (!navigator.vibrate && /iphone|ipad/i.test(navigator.userAgent)) {
        if (!hapt) { hapt = document.createElement('label'); hapt.setAttribute('aria-hidden', 'true'); hapt.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9px'; hapt.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(hapt); }
        hapt.click();
      }
    } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      actx = actx || new AC(); if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(on ? 1320 : 880, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.06);
    } catch (e) {}
  }
  function setClass(i) { cls = i; store.set('nik:cls', i); refresh(); }
  NIK.setClass = setClass;

  /* ---------- значки услуг ---------- */
  var IC = {
    wash: '<path d="M7 16h10M5 13l1.6-4.2A2 2 0 0 1 8.5 7.5h7a2 2 0 0 1 1.9 1.3L19 13v4H5z"/><path d="M8 4v.5M12 3v1M16 4v.5"/>',
    interior: '<path d="M7 20v-3h10v3M8 17V6a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v7h3a2 2 0 0 1 2 2v2"/>',
    dry: '<path d="M9 3h5v4H9zM8 7h7l1 3v10H7V10z"/><path d="M17 4h3M17 7l2.5-1.5"/>',
    protect: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    detailing: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'
  };
  function icon(cat) { return '<span class="svc__ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[cat] || IC.wash) + '</svg></span>'; }

  /* ---------- строки каталога ---------- */
  function priceHtml(s) {
    var off = pct(s.id), base = s.p[C()];
    return '<span class="svc__p"><b>от ' + rub(base * (1 - off / 100)) + '</b>' + (off ? '<s>' + rub(base) + '</s>' : '') + '<span>≈ ' + hrs(s.h) + '</span></span>';
  }
  function row(s) {
    if (s.items) {
      var n = s.items.filter(function (it) { return !pkgNames[it.name]; }).length;
      var picked = s.items.some(function (_, i) { return cart.has(s.id + ':' + i); });
      return '<div class="opts' + (picked ? ' opts--on' : '') + '"><div class="svc svc--head">' + icon(s.cat) +
        '<span class="svc__n"><b>' + esc(s.name) + '</b><span>Отметьте нужное · ' + n + ' ' + plural(n, 'позиция', 'позиции', 'позиций') + '</span></span>' + priceHtml(s) + '</div>' +
        '<div class="opts__list">' + s.items.map(function (it, i) {
          if (pkgNames[it.name]) return '';
          var k = s.id + ':' + i;
          return '<button class="opt" type="button" data-key="' + k + '" aria-pressed="' + cart.has(k) + '"><span>' + esc(it.name) + '</span><b>от ' + rub(it.p[C()]) + '</b><i></i></button>';
        }).join('') + '</div></div>';
    }
    var off = pct(s.id);
    return '<button class="svc" type="button" data-key="' + s.id + '" aria-pressed="' + cart.has(s.id) + '">' + icon(s.cat) +
      '<span class="svc__n"><b>' + esc(s.name) + '</b><span>' + esc(s.note) + '</span>' + (off ? '<em class="tag">−' + off + '% до 31 октября</em>' : '') + '</span>' + priceHtml(s) + '</button>';
  }
  function inCat(cat) { return function (s) { return cat === 'all' || s.cat === cat; }; }
  function list(cat) { return D.services.filter(inCat(cat)).map(row).join(''); }
  // «Все услуги» на странице услуг — весь перечень с подзаголовками категорий
  function listGrouped(cat) {
    if (cat !== 'all') return list(cat);
    return Object.keys(D.cats).map(function (k) { return '<p class="svcs__h">' + esc(D.cats[k]) + '</p>' + list(k); }).join('');
  }
  function picked(s) { return s.items ? s.items.some(function (_, i) { return cart.has(s.id + ':' + i); }) : cart.has(s.id); }

  /* ---------- выбор класса и поиск модели ---------- */
  var BRAND = { 'мерседес': 'mercedes', 'мерс': 'mercedes', 'бмв': 'bmw', 'ауди': 'audi', 'тойота': 'toyota', 'лексус': 'lexus', 'киа': 'kia', 'хендай': 'hyundai', 'хундай': 'hyundai', 'хёндай': 'hyundai', 'порше': 'porsche', 'порш': 'porsche', 'рендж': 'range rover', 'рейндж': 'range rover', 'ленд': 'land rover', 'лэнд': 'land rover', 'фольксваген': 'volkswagen', 'шкода': 'skoda', 'мазда': 'mazda', 'ниссан': 'nissan', 'вольво': 'volvo', 'тесла': 'tesla', 'мини': 'mini', 'хавал': 'haval', 'хавейл': 'haval', 'чери': 'chery', 'джили': 'geely', 'генезис': 'genesis', 'инфинити': 'infiniti', 'кадиллак': 'cadillac', 'бентли': 'bentley', 'ламборгини': 'lamborghini', 'феррари': 'ferrari', 'майбах': 'maybach', 'гелик': 'g-class', 'гелендваген': 'g-class', 'крузак': 'land cruiser', 'камри': 'camry', 'солярис': 'solaris', 'рио': 'rio', 'поло': 'polo', 'зикр': 'zeekr', 'лисян': 'li auto', 'танк': 'tank', 'роллс': 'rolls-royce', 'ягуар': 'jaguar', 'мазерати': 'maserati', 'чанган': 'changan', 'эксид': 'exeed', 'омода': 'omoda' };
  var MODELS = [];
  D.models.forEach(function (m) { m[2].forEach(function (mod) { var label = m[1] + (mod === '*' ? '' : ' ' + mod); MODELS.push({ cls: { I: 0, II: 1, III: 2, IV: 3 }[m[0]], label: label, key: norm(label + (m[1] === 'Mercedes-Benz' ? ' mercedes' : '')) }); }); });
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); }
  function find(q) {
    q = norm(q); if (q.length < 2) return [];
    Object.keys(BRAND).forEach(function (ru) { q = q.replace(new RegExp('(^| )' + ru + '[а-я]*', 'g'), '$1' + BRAND[ru]); });
    // кириллица, похожая на латиницу, в коротких словах и с цифрами: «х5» → «x5», «глс» остаётся брендом
    var LAT = { 'а': 'a', 'в': 'b', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'ц': 'c', 'л': 'l', 'г': 'g', 'з': 'z', 'и': 'i', 'д': 'd', 'ф': 'f', 'ш': 'sh', 'ю': 'yu', 'я': 'ya', 'б': 'b', 'п': 'p', 'й': 'y', 'ь': '', 'ы': 'y', 'ч': 'ch', 'ж': 'zh', 'э': 'e' };
    q = q.split(' ').map(function (w) { return /[а-я]/.test(w) && (w.length <= 3 || /\d/.test(w)) ? w.replace(/[а-я]/g, function (c) { return LAT[c] != null ? LAT[c] : c; }) : w; }).join(' ');
    var words = q.split(' ');
    return MODELS.map(function (m) {
      var sc = 0; words.forEach(function (w) { var i = (' ' + m.key).indexOf(' ' + w); if (i >= 0) sc += 2; else if (m.key.indexOf(w) >= 0) sc += 1; else sc -= 3; });
      return { m: m, sc: sc };
    }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc || a.m.label.length - b.m.label.length; }).slice(0, 6).map(function (x) { return x.m; });
  }
  function classCards(row) {
    return '<div class="classes' + (row ? ' classes--row' : '') + '">' + D.classes.map(function (c, i) {
      return '<button class="classbtn" type="button" data-cls="' + i + '" aria-pressed="' + (cls === i) + '"><b>' + esc(c[1]) + '</b><span>' + EX[i] + '</span><i style="--m:url(media/body/' + KINDS[i] + '.webp)"></i></button>';
    }).join('') + '</div>';
  }
  function finderHtml(val) {
    return '<div class="finder"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' +
      '<input type="text" inputmode="search" autocomplete="off" enterkeyhint="search" placeholder="Например, Mercedes S или BMW X5" aria-label="Марка и модель" value="' + esc(val || '') + '" data-finder><ul class="sugg" hidden role="listbox"></ul></div>';
  }
  // подсказки; onPick(класс, название)
  function bindFinder(root, onPick) {
    $$('[data-finder]', root).forEach(function (inp) {
      var ul = inp.nextElementSibling, res = [], cur = -1;
      function draw() {
        if (!inp.value.trim() || norm(inp.value).length < 2) { ul.hidden = true; return; }
        res = find(inp.value); cur = res.length ? 0 : -1; ul.hidden = false;
        ul.innerHTML = res.length ? res.map(function (m, i) { return '<li><button type="button" role="option" data-i="' + i + '" class="' + (i === cur ? 'on' : '') + '">' + esc(m.label) + '<small>' + esc(D.classes[m.cls][1]) + '</small></button></li>'; }).join('')
          : '<li class="none">Не нашли модель — выберите класс ниже, мастер уточнит при приёмке.</li>';
      }
      inp.addEventListener('input', draw);
      inp.addEventListener('keydown', function (e) {
        if (ul.hidden || !res.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cur = (cur + (e.key === 'ArrowDown' ? 1 : res.length - 1)) % res.length; $$('button', ul).forEach(function (b, i) { b.classList.toggle('on', i === cur); }); }
        if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); pick(res[cur]); }
        if (e.key === 'Escape') ul.hidden = true;
      });
      ul.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      ul.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) pick(res[+b.dataset.i]); });
      inp.addEventListener('blur', function () { setTimeout(function () { ul.hidden = true; }, 120); });
      function pick(m) { inp.value = m.label; ul.hidden = true; inp.blur(); onPick(m.cls, m.label); }
    });
  }

  /* ---------- страница «Услуги» ---------- */
  var page = $('[data-catalog-page]'), pcat = 'all';
  // services.html#wash — сразу открыта нужная категория
  function hashCat() { var h = location.hash.slice(1); return D.cats[h] ? h : null; }
  if (page && hashCat()) pcat = hashCat();
  if (page) {
    page.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pcat]'); if (!b) return;
      pcat = b.dataset.pcat; renderPage();
      try { history.replaceState(null, '', pcat === 'all' ? location.pathname : '#' + pcat); } catch (x) {}
      var top = $('#catalogTop'); if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView();
    });
    window.addEventListener('hashchange', function () { if (hashCat()) { pcat = hashCat(); renderPage(); } });
  }
  function renderPage() {
    if (!page) return;
    var cb = $('#classCards'); if (cb) cb.innerHTML = classCards(true);
    var box = $('#catalog'); if (box) box.innerHTML = listGrouped(pcat);
    $$('[data-pcat]', page).forEach(function (b) { var on = b.dataset.pcat === pcat; b.setAttribute('aria-pressed', String(on)); if (on && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = b.offsetLeft - 16; });
    var lab = $('#classLabel'); if (lab) lab.textContent = cls == null ? 'Цены для седана. Выберите класс, чтобы увидеть свои.' : 'Цены «от» для класса: ' + D.classes[cls][1] + '.';
  }
  if (page) {
    var f = $('#pageFinder'); if (f) { f.innerHTML = finderHtml(store.get('nik:car', '')); bindFinder(f, function (c, label) { store.set('nik:car', label); setClass(c); }); }
  }
  var bar = $('#cartbar');
  function renderBar() {
    if (!bar) return;
    var n = cart.size; bar.classList.toggle('on', n > 0 && !sheetOpen);
    $('#cartbarSum').innerHTML = n + ' ' + plural(n, 'услуга', 'услуги', 'услуг') + ' · ≈ ' + hrs(hours()) + '<b>от ' + rub(total()) + '</b>';
  }
  function badges() { $$('[data-cartcount]').forEach(function (b) { b.textContent = cart.size; b.hidden = !cart.size; }); }
  function refresh() { renderPage(); renderBar(); badges(); if (sheetOpen) render(); }

  document.addEventListener('click', function (e) {
    var k = e.target.closest('[data-key]'); if (k) { toggle(k.dataset.key); return; }
    var c = e.target.closest('[data-cls]'); if (c && !c.closest('#sheet')) { setClass(+c.dataset.cls); return; }
  });

  /* ---------- окно записи ---------- */
  var sheet = $('#sheet'), body = $('#sheetBody'), foot = $('#sheetFoot'), sheetOpen = false, lastFocus = null;
  var B = { mode: 'book', step: 0, cat: 'all', day: null, time: null, name: store.get('nik:name', ''), phone: store.get('nik:phone', ''), car: store.get('nik:car', ''), note: '', consent: false, errs: {} };
  var STEPS = { book: ['class', 'services', 'time', 'contacts', 'done'], quick: ['quick', 'qdone'], mine: ['mine'] };
  var DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayLabel(s) { var d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + DAYS[d.getDay()]; }
  function busy(day, t) { var h = 0, s = day + t; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000; return h < 280; }
  function endTime(t, h) { var p = t.split(':'), m = +p[0] * 60 + +p[1] + Math.round(h * 60); return m >= 21 * 60 ? null : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function slots(day) {
    var h = hours() || 1, out = [], now = new Date(), last = h >= 11 ? 12 : 21 - h;
    for (var m = 540; m <= last * 60; m += 30) { var t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + (m % 60 ? '30' : '00'); out.push({ t: t, off: new Date(day + 'T' + t + ':00') - now < 3600e3 || busy(day, t) }); }
    return out;
  }
  function open(mode) {
    setMenu(false);
    B.mode = mode === 'cart' ? 'book' : mode; B.errs = {};
    B.step = mode === 'cart' && cls != null ? 1 : 0; if (mode === 'cart') B.cat = 'all';
    if (B.mode === 'book') { B.time = null; if (!B.day) B.day = ymd(new Date()); }
    lastFocus = document.activeElement; sheetOpen = true;
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); document.documentElement.classList.add('lock');
    render(); renderBar();
    setTimeout(function () { var x = $('.x', sheet); if (x) x.focus({ preventScroll: true }); }, 50);
  }
  NIK.open = open;
  function close() {
    sheetOpen = false; B.shown = null; sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('lock'); renderBar(); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (B.done) { B.done = false; B.step = 0; document.dispatchEvent(new CustomEvent('nik:booked')); }
  }
  if (sheet) {
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      if (e.target.closest('.sheet__back')) { B.step = Math.max(0, B.step - 1); render(); return; }
      var c = e.target.closest('[data-cls]'); if (c) { setClass(+c.dataset.cls); B.step = 1; render(); body.scrollTop = 0; return; }
      var ch = e.target.closest('[data-scat]'); if (ch) { B.cat = ch.dataset.scat; render(); return; }
    });
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); open(o.dataset.open); return; }
    var p = e.target.closest('[data-promo]'); if (p) { e.preventDefault(); p.dataset.promo.split(',').forEach(function (k) { cart.set(k, 1); }); save(); refresh(); B.cat = byId[p.dataset.promo.split(',')[0]].cat; open('book'); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (sheetOpen) close(); else if (menu && menu.classList.contains('open')) setMenu(false); else closeLb();
  });
  function render() {
    var st = STEPS[B.mode], s = st[B.step];
    $('#steps').innerHTML = B.mode === 'book' ? st.slice(0, -1).map(function (_, i) { return '<i class="' + (i <= B.step ? 'on' : '') + '"></i>'; }).join('') : '';
    $('#steps').hidden = B.mode !== 'book' || s === 'done';
    $('.sheet__back', sheet).hidden = !(B.mode === 'book' && B.step > 0 && s !== 'done');
    $('#sheetTitle').textContent = { book: 'Запись', quick: 'Быстрая запись', mine: 'Мои записи' }[B.mode];
    var fn = ({ class: stClass, services: stServices, time: stTime, contacts: stContacts, done: stDone, quick: stQuick, qdone: stQdone, mine: stMine })[s]; fn(); B.shown = sheetOpen ? s : null;
  }
  function sum() { var n = cart.size; return n ? '<span class="sheet__sum">' + n + ' ' + plural(n, 'услуга', 'услуги', 'услуг') + ' · ≈ ' + hrs(hours()) + '<b>от ' + rub(total()) + '</b></span>' : ''; }
  function footer(label, ok, withSum, fn) {
    foot.innerHTML = (withSum ? sum() : '') + '<button class="btn btn--copper" type="button" id="bNext"' + (ok ? '' : ' disabled') + '>' + label + '</button>';
    $('#bNext').onclick = fn;
  }
  function stClass() {
    body.innerHTML = '<div><h3>Какой у вас автомобиль?</h3><p class="note" style="margin-top:6px">От класса зависит цена. Определим его по модели.</p></div>' + finderHtml(B.car) +
      '<p class="note">Или выберите класс сами</p>' + classCards(false) + '<p class="note">Класс уточняет мастер при приёмке автомобиля.</p>';
    bindFinder(body, function (c, label) { B.car = label; store.set('nik:car', label); setClass(c); B.step = 1; render(); body.scrollTop = 0; });
    foot.innerHTML = cls != null ? sum() + '<button class="btn btn--ghost" type="button" id="bNext">Дальше: ' + esc(D.classes[cls][1]) + '</button>' : '<span class="sheet__sum">Шаг 1 из 4 · класс автомобиля</span>';
    var n = $('#bNext'); if (n) n.onclick = function () { B.step = 1; render(); };
  }
  // выбранные услуги — первыми; порядок фиксируется при входе на шаг, чтобы строки не прыгали при отметке
  function bookList() {
    var all = D.services.filter(inCat(B.cat)), sel = all.filter(function (s) { return B.firstIds[s.id]; }), rest = all.filter(function (s) { return !B.firstIds[s.id]; });
    if (!sel.length) return rest.map(row).join('');
    return '<p class="svcs__h">Вы выбрали</p>' + sel.map(row).join('') + (rest.length ? '<p class="svcs__h">Остальные услуги</p>' + rest.map(row).join('') : '');
  }
  function stServices() {
    if (B.shown !== 'services') { B.firstIds = {}; D.services.forEach(function (s) { if (picked(s)) B.firstIds[s.id] = 1; }); }
    var cats = [['all', 'Все услуги']].concat(Object.keys(D.cats).map(function (k) { return [k, D.cats[k]]; }));
    body.innerHTML = '<div><h3>Что делаем?</h3><p class="note" style="margin-top:6px">' + esc(D.classes[C()][1]) + ' · цены «от» · можно выбрать несколько</p></div>' +
      '<div class="chips" role="group" aria-label="Категория">' + cats.map(function (c) { return '<button class="chip" type="button" data-scat="' + c[0] + '" aria-pressed="' + (B.cat === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div class="svcs">' + bookList() + '</div>';
    footer('Выбрать время', cart.size > 0, true, function () { if (cart.size) { B.step = 2; render(); body.scrollTop = 0; } });
  }
  function stTime() {
    var days = [], d0 = new Date(); for (var i = 0; i < 14; i++) { var d = new Date(d0); d.setDate(d0.getDate() + i); days.push(d); }
    var sl = slots(B.day); if (B.time && !sl.some(function (s) { return s.t === B.time && !s.off; })) B.time = null;
    var h = hours(), end = B.time ? endTime(B.time, h) : null;
    body.innerHTML = '<h3>Когда удобно?</h3><div><p class="lbl">День</p><div class="days">' + days.map(function (d) {
      var k = ymd(d); return '<button class="day" type="button" data-day="' + k + '" aria-pressed="' + (k === B.day) + '" aria-label="' + dayLabel(k) + '"><small>' + DAYS[d.getDay()] + '</small><b>' + d.getDate() + '</b></button>';
    }).join('') + '</div></div><div><p class="lbl">Заезд · ' + dayLabel(B.day) + '</p><div class="times">' + sl.map(function (s) {
      return '<button class="time" type="button" data-time="' + s.t + '"' + (s.off ? ' disabled' : '') + ' aria-pressed="' + (s.t === B.time) + '">' + s.t + '</button>';
    }).join('') + '</div></div>' + (sl.every(function (s) { return s.off; }) ? '<p class="note">На этот день мест нет — выберите другой.</p>' : '') +
      (B.time ? '<div class="ready"><span>Работа займёт ≈ ' + hrs(h) + '</span><b>' + (end ? 'Готово примерно к ' + end : 'Машина останется в паркинге до завтра') + '</b></div>' : '') +
      '<p class="demo">Демо-расписание: занятость условная. В рабочей версии — реальные свободные окна по трём постам.</p>';
    footer('Дальше', !!B.time, true, function () { if (B.time) { B.step = 3; render(); body.scrollTop = 0; } });
    $$('[data-day]', body).forEach(function (b) { b.onclick = function () { B.day = b.dataset.day; B.time = null; render(); }; });
    $$('[data-time]', body).forEach(function (b) { b.onclick = function () { B.time = b.dataset.time; render(); }; });
  }
  function digits(s) { var d = s.replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); if (d[0] === '9') d = '7' + d; return d.slice(0, 11); }
  function fmt(s) { var d = digits(s); if (!d) return ''; var o = '+7'; if (d.length > 1) o += ' ' + d.slice(1, 4); if (d.length > 4) o += ' ' + d.slice(4, 7); if (d.length > 7) o += '-' + d.slice(7, 9); if (d.length > 9) o += '-' + d.slice(9, 11); return o; }
  function fields(withCar) {
    var e = B.errs;
    return '<div class="field"><label for="fName">Имя</label><input id="fName" autocomplete="given-name" value="' + esc(B.name) + '">' + (e.name ? '<span class="err">' + e.name + '</span>' : '') + '</div>' +
      '<div class="field"><label for="fPhone">Телефон</label><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(B.phone) + '">' + (e.phone ? '<span class="err">' + e.phone + '</span>' : '') + '</div>' +
      (withCar ? '<div class="field"><label for="fCar">Машина</label><input id="fCar" value="' + esc(B.car) + '" placeholder="Марка и модель"></div><div class="field"><label for="fNote">Комментарий</label><textarea id="fNote" placeholder="Необязательно">' + esc(B.note) + '</textarea></div>' : '') +
      '<label class="check"><input id="fConsent" type="checkbox"' + (B.consent ? ' checked' : '') + '><span>Согласен на обработку персональных данных по <a href="route.html#privacy">политике</a>.' + (e.consent ? ' <b class="err">' + e.consent + '</b>' : '') + '</span></label>';
  }
  function bindFields() {
    var ph = $('#fPhone'); ph.addEventListener('input', function () { ph.value = fmt(ph.value); B.phone = ph.value; });
    $('#fName').oninput = function (ev) { B.name = ev.target.value; };
    var fc = $('#fCar'); if (fc) fc.oninput = function (ev) { B.car = ev.target.value; };
    var fn = $('#fNote'); if (fn) fn.oninput = function (ev) { B.note = ev.target.value; };
    $('#fConsent').onchange = function (ev) { B.consent = ev.target.checked; };
  }
  function check() {
    var e = {};
    if (B.name.trim().length < 2) e.name = 'Напишите имя.';
    if (digits(B.phone).length !== 11) e.phone = 'Нужен номер из 11 цифр, например +7 925 034-44-42.';
    if (!B.consent) e.consent = 'Отметьте согласие.';
    B.errs = e; return !Object.keys(e).length;
  }
  function stContacts() {
    body.innerHTML = '<h3>Контакты</h3><div class="summary"><div><span>Когда</span><b>' + dayLabel(B.day) + ', ' + B.time + '</b></div><div><span>Услуги</span><b>' + cart.size + ' · от ' + rub(total()) + '</b></div><div><span>Займёт</span><b>≈ ' + hrs(hours()) + '</b></div></div>' + fields(true);
    bindFields();
    footer('Записаться', true, false, function () {
      if (!check()) { render(); return; }
      store.set('nik:name', B.name.trim()); store.set('nik:phone', B.phone);
      var h = hours(), rec = { id: Date.now(), code: String(1000 + Math.floor(Math.random() * 9000)), day: B.day, time: B.time, end: endTime(B.time, h), h: h,
        items: lines().map(function (l) { return l.name; }), total: total(), cls: C(), name: B.name.trim(), phone: digits(B.phone), car: B.car };
      var all = store.get('nik:bookings', []); all.push(rec); store.set('nik:bookings', all);
      B.last = rec; B.done = true; cart.clear(); save(); badges(); B.step = 4; render(); body.scrollTop = 0;
    });
  }
  function leisure(h, n) {
    var p = V.plan(h);
    return '<div><p class="lbl">Пока мы работаем — в Никольской Плазе</p><ul class="plan__list">' + p.items.slice(0, n || 4).map(function (it) {
      return '<li><img src="places/' + it.img + '.webp" alt="" loading="lazy" width="44" height="44"><div><b>' + esc(it.label) + ': ' + esc(it.name) + '</b><span>' + esc(it.where) + '</span></div></li>';
    }).join('') + '</ul></div>';
  }
  NIK.leisure = leisure;
  function stDone() {
    var r = B.last;
    body.innerHTML = '<span class="okmark"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><h3>Вы записаны</h3><p class="note" style="margin-top:6px">Код записи <b style="color:var(--copper-hi)">' + r.code + '</b> · администратор подтвердит по телефону</p></div>' +
      '<div class="summary"><div><span>Заезд</span><b>' + dayLabel(r.day) + ', ' + r.time + '</b></div>' + r.items.map(function (n) { return '<div><span>' + esc(n) + '</span></div>'; }).join('') + '<div><span>Итого</span><b>от ' + rub(r.total) + '</b></div></div>' +
      '<div class="ready"><span>Мойка займёт ≈ ' + hrs(r.h) + '</span><b>' + (r.end ? 'Машина будет готова примерно к ' + r.end : 'Машина останется в паркинге до завтра') + '</b><span>Парковка бесплатна · Никольская, 10, паркинг −3 этаж · въезд с Большого Черкасского</span></div>' +
      '<div class="remind"><button class="btn btn--ghost btn--sm" type="button" data-ics="' + r.id + '">Добавить в календарь</button><a class="tg" href="https://t.me/carwash_na_nikolskoy" target="_blank" rel="noopener">Написать в Telegram</a></div>' +
      leisure(r.h) + '<p class="demo">Это демонстрация: запись сохранена только в этом браузере и никуда не отправлена. В рабочей версии напомним СМС или в Telegram за день до визита.</p>';
    foot.innerHTML = '<a class="btn btn--ghost" href="park.html">Весь досуг</a><button class="btn btn--copper" type="button" data-close>Готово</button>';
  }
  function stQuick() {
    body.innerHTML = '<div><h3>Оставьте номер — мы перезвоним</h3><p class="note" style="margin-top:6px">Администратор свяжется с вами, подберёт услугу и удобное время.</p></div>' + fields(false);
    bindFields();
    footer('Жду звонка', true, false, function () {
      if (!check()) { render(); return; }
      store.set('nik:name', B.name.trim()); store.set('nik:phone', B.phone);
      var all = store.get('nik:requests', []); all.push({ id: Date.now(), name: B.name.trim(), phone: digits(B.phone) }); store.set('nik:requests', all);
      B.step = 1; render();
    });
  }
  function stQdone() {
    var t = msk(), m = t.getHours() * 60 + t.getMinutes(), open = m >= 540 && m < 1245;
    body.innerHTML = '<span class="okmark"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><h3>Спасибо, ' + esc(B.name.trim()) + '!</h3><p class="note" style="margin-top:6px">' + (open ? 'Администратор перезвонит в течение 15 минут.' : 'Мы работаем с 9:00 до 21:00 — перезвоним утром.') + '</p></div>' +
      '<div class="summary"><div><span>Телефон</span><b>' + esc(B.phone) + '</b></div></div><p class="note">Не хотите ждать? Позвоните: <a href="tel:+74955320977">+7 495 532-09-77</a> или <a href="tel:+79250344442">+7 925 034-44-42</a>.</p>' +
      '<p class="demo">Демо: заявка сохранена только в этом браузере.</p>';
    foot.innerHTML = '<button class="btn btn--copper" type="button" data-close>Готово</button>';
  }
  function stMine() {
    var all = store.get('nik:bookings', []).filter(function (r) { return new Date(r.day + 'T' + r.time) > new Date(Date.now() - 3 * 3600e3); });
    body.innerHTML = all.length ? '<div class="mine">' + all.map(function (r) {
      return '<div class="mine__item"><b>' + dayLabel(r.day) + ', ' + r.time + '</b><span>' + esc(r.items.join(', ')) + '</span><span>Код ' + r.code + ' · от ' + rub(r.total) + ' · ≈ ' + hrs(r.h) + '</span>' +
        '<div class="remind"><button class="btn btn--copper btn--sm" type="button" data-ics="' + r.id + '">Напомнить: в календарь</button><button class="btn btn--ghost btn--sm" type="button" data-cancel="' + r.id + '">Отменить</button></div></div>';
    }).join('') + '</div><p class="note">Календарь телефона напомнит за день и за 2 часа до визита. В рабочей версии — ещё и СМС или сообщение в Telegram, а найти записи можно будет по телефону с любого устройства.</p>' : '<p class="note">На этом устройстве записей нет.</p>';
    foot.innerHTML = '<button class="btn btn--copper" type="button" data-open="book">Новая запись</button>';
    $$('[data-cancel]', body).forEach(function (b) {
      b.onclick = function () {
        if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Точно отменить? Нажмите ещё раз'; return; }
        store.set('nik:bookings', store.get('nik:bookings', []).filter(function (r) { return String(r.id) !== b.dataset.cancel; })); render(); document.dispatchEvent(new CustomEvent('nik:booked'));
      };
    });
  }

  /* ---------- напоминание о визите ---------- */
  // Файл .ics: телефон сам напомнит за день и за 2 часа. СМС и Telegram — из рабочей версии с сервером.
  function ics(rec) {
    var d = rec.day.replace(/-/g, ''), t = rec.time.replace(':', '') + '00', e = (rec.end || '21:00').replace(':', '') + '00';
    var txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nikmoyka//demo//RU', 'BEGIN:VEVENT', 'UID:' + rec.id + '@nikmoyka', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;TZID=Europe/Moscow:' + d + 'T' + t, 'DTEND;TZID=Europe/Moscow:' + d + 'T' + e, 'SUMMARY:Мойка на Никольской: ' + (rec.items[0] || 'запись'),
      'LOCATION:Москва\\, Никольская ул.\\, 10\\, паркинг −3 этаж (въезд с Большого Черкасского пер.)', 'DESCRIPTION:Код записи ' + rec.code + '. Телефон +7 495 532-09-77',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра мойка на Никольской', 'TRIGGER:-P1D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Через 2 часа мойка на Никольской', 'TRIGGER:-PT2H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = 'nikmoyka-' + rec.day + '.ics';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function upcoming() {
    var now = Date.now();
    return store.get('nik:bookings', []).filter(function (r) { return new Date(r.day + 'T' + (r.end || r.time) + ':00').getTime() > now; })
      .sort(function (a, b) { return (a.day + a.time) < (b.day + b.time) ? -1 : 1; });
  }
  NIK.upcoming = upcoming;
  function visit() {
    var old = $('.visit'); if (old) old.remove();
    var r = upcoming()[0]; if (!r || store.get('nik:visitHidden', 0) === r.id || $('[data-admin]')) return;
    var el = document.createElement('div'); el.className = 'visit'; el.setAttribute('role', 'status');
    var soon = new Date(r.day + 'T' + r.time + ':00') - Date.now() < 36 * 3600e3;
    el.innerHTML = '<span><b>' + (soon ? 'Скоро ваша запись' : 'Ваша запись') + ' · ' + dayLabel(r.day) + ', ' + r.time + '</b><small>' + esc(r.items[0] || 'Мойка') + ' · ≈ ' + hrs(r.h) + ' · код ' + r.code + '</small></span>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-open="mine">Мои записи</button><button class="x" type="button" aria-label="Скрыть напоминание">✕</button>';
    $('.x', el).onclick = function () { store.set('nik:visitHidden', r.id); el.remove(); };
    document.body.appendChild(el);
  }
  document.addEventListener('nik:booked', visit);
  document.addEventListener('click', function (e) { var c = e.target.closest('[data-ics]'); if (c) { var r = store.get('nik:bookings', []).filter(function (x) { return String(x.id) === c.dataset.ics; })[0]; if (r) ics(r); } });

  /* ---------- видео работ: грузятся и играют, только когда видны ---------- */
  // подписи этапов поверх видео въезда
  function chapters(v) {
    var cap = v.parentNode.querySelector('.entrance__cap'); if (!cap || !v.dataset.chapters) return;
    var ch = v.dataset.chapters.split('|').map(function (x) { var i = x.indexOf(':'); return [+x.slice(0, i), x.slice(i + 1)]; }), cur = '';
    v.addEventListener('timeupdate', function () { var t = v.currentTime, n = ch[0][1]; ch.forEach(function (c) { if (t >= c[0]) n = c[1]; }); if (n !== cur) { cur = n; cap.textContent = n; } });
  }
  // «Сегодня свободно с …» под кнопкой записи (демо-расписание; в рабочей версии — свободные окна Core12)
  (function () {
    var el = $('[data-free]'); if (!el) return;
    var d = new Date(), today = ymd(d), t = slots(today).filter(function (x) { return !x.off; })[0], lbl = 'Сегодня';
    if (!t) { d.setDate(d.getDate() + 1); t = slots(ymd(d)).filter(function (x) { return !x.off; })[0]; lbl = 'Завтра'; }
    if (!t) return;
    el.innerHTML = '<button type="button" data-open="book"><i></i>' + lbl + ' свободно с ' + t.t + '</button>'; 
  })();
  var vids = $$('.work--video video, .entrance video'), still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.dataset.ok) { $$('source', v).forEach(function (s) { s.src = s.dataset.src; }); v.load(); v.dataset.ok = 1; }
          if (!still || v.closest('.entrance')) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        } else v.pause();
      });
    }, { threshold: 0.4 });
    vids.forEach(function (v) { vio.observe(v); chapters(v); v.closest('.work, .entrance').addEventListener('click', function () { if (!v.dataset.ok) { $$('source', v).forEach(function (s) { s.src = s.dataset.src; }); v.load(); v.dataset.ok = 1; } if (v.paused) v.play(); else v.pause(); }); });
  }

  /* ---------- просмотр работ ---------- */
  var lb = null, lbList = [], lbI = 0;
  function showLb() {
    var it = lbList[lbI]; if (!it) return;
    $('img', lb).src = it.dataset.full; $('img', lb).alt = it.dataset.cap || '';
    $('.lightbox__cap b', lb).textContent = it.dataset.cap || ''; $('.lightbox__cap span', lb).textContent = it.dataset.sub || '';
    $('.lightbox__count', lb).textContent = (lbI + 1) + ' / ' + lbList.length;
  }
  function closeLb() { if (lb && lb.classList.contains('open')) { lb.classList.remove('open'); document.documentElement.classList.remove('lock'); } }
  document.addEventListener('click', function (e) {
    var w = e.target.closest('[data-full]'); if (!w) return;
    if (!lb) {
      lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Фото работы');
      lb.innerHTML = '<div class="lightbox__bar"><span class="lightbox__count"></span><button class="x" type="button" aria-label="Закрыть">✕</button></div><div class="lightbox__img"><img alt=""></div><div class="lightbox__cap"><b></b><span></span></div>' +
        '<button class="lightbox__nav lightbox__nav--p" type="button" aria-label="Предыдущее">‹</button><button class="lightbox__nav lightbox__nav--n" type="button" aria-label="Следующее">›</button>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (ev) {
        if (ev.target.closest('.x') || ev.target === lb || ev.target.classList.contains('lightbox__img')) closeLb();
        else if (ev.target.closest('.lightbox__nav--p')) { lbI = (lbI + lbList.length - 1) % lbList.length; showLb(); }
        else if (ev.target.closest('.lightbox__nav--n')) { lbI = (lbI + 1) % lbList.length; showLb(); }
      });
      var x0 = null; lb.addEventListener('pointerdown', function (ev) { x0 = ev.clientX; });
      lb.addEventListener('pointerup', function (ev) { if (x0 == null) return; var dx = ev.clientX - x0; x0 = null; if (Math.abs(dx) > 50) { lbI = (lbI + (dx < 0 ? 1 : lbList.length - 1)) % lbList.length; showLb(); } });
    }
    lbList = $$('[data-full]', w.closest('[data-gallery]') || document); lbI = lbList.indexOf(w);
    lb.classList.add('open'); document.documentElement.classList.add('lock'); showLb(); $('.x', lb).focus({ preventScroll: true });
  });
  $$('[data-scroll]').forEach(function (b) {
    b.addEventListener('click', function () { var t = $(b.dataset.scroll); t.scrollBy({ left: (b.dataset.dir === 'p' ? -1 : 1) * t.clientWidth * 0.9, behavior: 'smooth' }); });
  });

  refresh(); visit();
  // переход по якорю после отрисовки каталога и шрифтов: страница встаёт ровно на нужный раздел
  // «Яндекс Навигатор»: на телефоне открываем приложение, если его нет — маршрут в Яндекс Картах
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-navi]'); if (!a || !/android|iphone|ipad|ipod/i.test(navigator.userAgent)) return;
    e.preventDefault(); var t0 = Date.now(); location.href = a.dataset.navi;
    setTimeout(function () { if (!document.hidden && Date.now() - t0 < 2500) location.href = a.href; }, 1400);
  });
  function goHash() { var h = decodeURIComponent(location.hash.slice(1)); var el = h && (document.getElementById(h) || (D.cats[h] && document.getElementById('catalogTop'))); if (el) el.scrollIntoView(); }
  NIK.goHash = goHash;
  if (location.hash) { goHash(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(goHash); window.addEventListener('load', function () { setTimeout(goHash, 0); }); }
})();
