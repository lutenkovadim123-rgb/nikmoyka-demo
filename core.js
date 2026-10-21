/* Общее для всех страниц: прокрутка, шапка и меню, нижняя панель, класс машины, прайс, корзина, запись с талоном. */
(function () {
  'use strict';
  var D = window.NIK_DATA;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var NIK = (window.NIK = { reduced: reduced, coarse: coarse, scroll: 0, listeners: [] });
  NIK.onScroll = function (fn) { NIK.listeners.push(fn); fn(NIK.scroll); };
  function emit(y) { NIK.scroll = y; for (var i = 0; i < NIK.listeners.length; i++) NIK.listeners[i](y); }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = NIK.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rub = NIK.rub = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; };
  var hrs = NIK.hrs = function (h) { var m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60; return (hh ? hh + ' ч' : '') + (mm ? (hh ? ' ' : '') + mm + ' мин' : ''); };
  var store = NIK.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var page = document.body.dataset.page || '';

  /* ---------- прокрутка ---------- */
  var lenis = null;
  if (!reduced && window.Lenis) {
    try {
      lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
      lenis.on('scroll', function (e) { emit(e.scroll); });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    } catch (e) { lenis = null; }
  }
  if (!lenis) window.addEventListener('scroll', function () { emit(window.scrollY); }, { passive: true });
  NIK.lenis = lenis;
  var scrollToEl = NIK.scrollToEl = function (t) { if (lenis) lenis.scrollTo(t, { offset: -72 }); else t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href'); if (id.length < 2) return;
    var t = document.querySelector(id); if (!t) return;
    e.preventDefault(); closeMenu(); scrollToEl(t);
  });

  /* ---------- шапка, статус «открыто» ---------- */
  var top = $('.top');
  NIK.onScroll(function (y) { top.classList.toggle('is-solid', page !== 'home' || y > window.innerHeight * 0.7); });
  function mskNow() { var d = new Date(); return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000); }
  (function status() {
    var n = mskNow(), m = n.getHours() * 60 + n.getMinutes(), open = m >= 540 && m < 1260;
    var txt = open ? 'Сейчас открыто · до 21:00' : 'Сейчас закрыто · откроемся в 9:00';
    $$('[data-status]').forEach(function (el) { el.textContent = txt; el.classList.toggle('is-open', open); });
  })();

  /* ---------- полноэкранное меню ---------- */
  var menu = $('#menu'), menuOpen = false, menuFocus = null;
  function openMenu() {
    if (!menu) return; menuOpen = true; menuFocus = document.activeElement;
    menu.classList.add('open'); menu.setAttribute('aria-hidden', 'false'); document.documentElement.classList.add('lock');
    if (lenis) lenis.stop();
    $$('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    setTimeout(function () { var f = $('.menu__close', menu); if (f) f.focus(); }, 50);
  }
  function closeMenu() {
    if (!menuOpen) return; menuOpen = false;
    menu.classList.remove('open'); menu.setAttribute('aria-hidden', 'true');
    if (!sheetOpen) { document.documentElement.classList.remove('lock'); if (lenis) lenis.start(); }
    $$('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (menuFocus && menuFocus.focus) menuFocus.focus();
  }
  NIK.closeMenu = closeMenu;
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-menu]')) { menuOpen ? closeMenu() : openMenu(); return; }
    if (e.target.closest('[data-menu-close]')) closeMenu();
  });
  if (menu) $$('.menu__item', menu).forEach(function (it) {
    it.addEventListener('pointerenter', function () { var p = $('#menuPreview'); if (p) p.textContent = it.dataset.hint || ''; });
  });

  /* ---------- появление блоков ---------- */
  NIK.observeRise = function (root) {
    if (reduced || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rise', root).forEach(function (el) {
      if (el.dataset.seen) return; el.dataset.seen = 1;
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('pre'); el.style.transitionDelay = ((el.dataset.d || 0) * 80) + 'ms'; io.observe(el);
      }
    });
  };

  /* ---------- тезис по словам ---------- */
  $$('.thesis p').forEach(function (thesis) {
    thesis.innerHTML = thesis.textContent.trim().split(/\s+/).map(function (w) {
      return '<span class="w' + (/экспонат|бесплатно|ваш/i.test(w) ? ' cu' : '') + '">' + w + '</span>';
    }).join(' ');
    var words = $$('.w', thesis);
    var lit = function () {
      var r = thesis.getBoundingClientRect(), vh = window.innerHeight;
      var p = reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var n = Math.round(p * words.length);
      words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    };
    NIK.onScroll(lit); window.addEventListener('resize', lit);
  });

  /* ---------- акции ---------- */
  $$('[data-until]').forEach(function (el) {
    var end = new Date(el.dataset.until + 'T23:59:59+03:00'), days = Math.ceil((end - new Date()) / 864e5);
    if (days < 0) { el.textContent = 'акция завершена'; return; }
    el.innerHTML = el.textContent + ' · осталось <b>' + days + ' ' + plural(days, 'день', 'дня', 'дней') + '</b>';
  });
  function plural(n, a, b, c) { return n % 10 === 1 && n % 100 !== 11 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c); }
  NIK.plural = plural;

  /* ---------- класс машины и корзина ---------- */
  var cls = store.get('nik:cls', 0);
  var cart = new Map(store.get('nik:cart', []));
  var byId = {}; D.services.forEach(function (s) { byId[s.id] = s; });
  var packageNames = {}; D.services.forEach(function (s) { if (!s.items) packageNames[s.name] = 1; });
  NIK.byId = byId;
  var PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';
  var SHORT = ['Седан', 'Бизнес', 'Кроссовер', 'Внедорожник'];

  function saveCart() { store.set('nik:cart', Array.from(cart.entries())); }
  function lineOf(key) {
    var parts = key.split(':'), s = byId[parts[0]];
    if (!s) return null;
    if (parts.length > 1) { var it = s.items[+parts[1]]; return it ? { name: it.name, p: it.p, h: 0.25 } : null; }
    return { name: s.name, p: s.p, h: s.h };
  }
  function cartLines() { var out = []; cart.forEach(function (_, k) { var l = lineOf(k); if (l) out.push({ key: k, name: l.name, p: l.p, h: l.h }); }); return out; }
  function cartTotal() { return cartLines().reduce(function (s, l) { return s + l.p[cls]; }, 0); }
  function cartHours() { var h = cartLines().reduce(function (s, l) { return s + l.h; }, 0); return Math.max(1, Math.round(h * 2) / 2); }
  NIK.cart = { add: function (k) { cart.set(k, 1); saveCart(); syncAdds(); updateBadges(true); }, has: function (k) { return cart.has(k); } };

  function addBtn(key, name, label) {
    var on = cart.has(key);
    return '<button class="add' + (label ? ' add--label' : '') + '" type="button" data-key="' + key + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Убрать из записи: ' : 'Добавить в запись: ') + esc(name) + '">' + PLUS + (label ? '<span>' + (on ? 'В записи' : 'В запись') + '</span>' : '') + '</button>';
  }
  function priceCells(p) {
    return '<div class="exhibit__prices">' + p.map(function (v, i) {
      return '<div class="' + (i === cls ? 'on' : '') + '" data-ci="' + i + '"><span>' + SHORT[i] + '</span><b>' + rub(v) + '</b></div>';
    }).join('') + '</div>';
  }
  var exhibitNo = 0;
  function exhibit(s) {
    exhibitNo++;
    return '<article class="exhibit rise" data-d="' + (exhibitNo % 3) + '"><div class="exhibit__top"><span class="exhibit__no">Экспонат № ' + String(D.services.indexOf(s) + 1).padStart(2, '0') + '</span><span class="exhibit__time">≈ ' + hrs(s.h) + '</span></div>' +
      '<h3>' + esc(s.name) + '</h3><p>' + esc(s.note) + '</p>' + priceCells(s.p) +
      '<div class="exhibit__foot"><span class="exhibit__from" data-p="' + s.p.join(',') + '">от ' + rub(s.p[cls]) + '</span>' + addBtn(s.id, s.name, true) + '</div></article>';
  }
  function optRows(s) {
    return s.items.map(function (it, i) {
      if (packageNames[it.name]) return '';
      return '<div class="prow prow--opt"><div class="prow__n">' + esc(it.name) + '</div><div class="prow__p" data-p="' + it.p.join(',') + '">от ' + rub(it.p[cls]) + '</div>' + addBtn(s.id + ':' + i, it.name) + '</div>';
    }).join('');
  }
  // Каталог: <div data-catalog="wash"> (раздел) или "all"
  function renderCatalogs() {
    $$('[data-catalog]').forEach(function (box) {
      var cat = box.dataset.catalog;
      var list = D.services.filter(function (s) { return cat === 'all' ? true : (cat === 'detailing-page' ? s.cat === 'detailing' : s.cat === cat); });
      var pk = list.filter(function (s) { return !s.items; }), op = list.filter(function (s) { return s.items; });
      exhibitNo = 0;
      var html = pk.length ? '<div class="exhibits">' + pk.map(exhibit).join('') + '</div>' : '';
      op.forEach(function (s) { html += '<div class="pgroup"><h3>' + esc(s.name) + ' · отдельные работы</h3>' + optRows(s) + '</div>'; });
      box.innerHTML = html;
    });
    NIK.observeRise(document);
  }
  function renderClassChips() {
    $$('[data-classchips]').forEach(function (box) {
      box.innerHTML = D.classes.map(function (c, i) {
        return '<button class="chip" type="button" data-cls="' + i + '" aria-pressed="' + (i === cls) + '">' + esc(c[1]) + '</button>';
      }).join('');
    });
  }
  function tweenPrices(from, to) {
    $$('[data-p]').forEach(function (el) {
      var arr = el.dataset.p.split(',').map(Number), a = arr[from], z = arr[to];
      if (reduced || a === z) { el.textContent = 'от ' + rub(z); return; }
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / 480), e = 1 - Math.pow(1 - k, 3);
        el.textContent = 'от ' + rub(Math.round((a + (z - a) * e) / 10) * 10);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
    $$('[data-ci]').forEach(function (c) { c.classList.toggle('on', +c.dataset.ci === to); });
  }
  function setClass(i) {
    if (i === cls) return;
    var from = cls; cls = i; store.set('nik:cls', cls);
    $$('[data-cls]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.cls === cls)); });
    tweenPrices(from, cls); updateBadges(); if (sheetOpen) renderSheet();
    document.dispatchEvent(new CustomEvent('nik:class', { detail: cls }));
  }
  NIK.getClass = function () { return cls; };
  function syncAdds() {
    $$('.add[data-key]').forEach(function (a) {
      var on = cart.has(a.dataset.key); a.setAttribute('aria-pressed', String(on));
      var s = $('span', a); if (s) s.textContent = on ? 'В записи' : 'В запись';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cls]'); if (b) { setClass(+b.dataset.cls); return; }
    var a = e.target.closest('.add[data-key]');
    if (a) { var k = a.dataset.key; if (cart.has(k)) cart.delete(k); else cart.set(k, 1); saveCart(); syncAdds(); updateBadges(true); }
  });

  // Класс по модели
  var MODELS = [];
  D.models.forEach(function (m) { m[2].forEach(function (mod) { MODELS.push({ cls: { I: 0, II: 1, III: 2, IV: 3 }[m[0]], brand: m[1].toLowerCase(), model: mod.toLowerCase(), label: m[1] + ' ' + mod }); }); });
  function norm(s) { return s.toLowerCase().replace(/[^a-zа-я0-9]+/g, ' ').trim(); }
  $$('[data-modelfind]').forEach(function (inp) {
    var hit = inp.parentElement.querySelector('small');
    inp.addEventListener('input', function () {
      var q = norm(inp.value);
      if (q.length < 2) { hit.textContent = ''; return; }
      var best = null, score = 0;
      MODELS.forEach(function (m) {
        var sc = 0, mm = norm(m.model), bb = norm(m.brand);
        if ((' ' + q + ' ').indexOf(' ' + mm + ' ') >= 0 || (mm.length > 2 && q.indexOf(mm) >= 0)) sc += 2;
        if (q.indexOf(bb) >= 0 || (bb.length > 3 && bb.indexOf(q.split(' ')[0]) === 0)) sc += 1;
        if (sc > score) { score = sc; best = m; }
      });
      if (best && score >= 2) { hit.textContent = best.label + ' → ' + D.classes[best.cls][1]; setClass(best.cls); }
      else hit.textContent = 'Не нашли — выберите класс вручную';
    });
  });

  /* ---------- значки корзины и панель на компьютере ---------- */
  var dock = $('#dock');
  function updateBadges(bump) {
    var n = cart.size;
    $$('[data-cartcount]').forEach(function (b) { b.textContent = n; b.hidden = !n; if (bump && n && !reduced) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } });
    if (dock) {
      dock.classList.toggle('on', n > 0 && !sheetOpen && !menuOpen);
      var s = $('#dockSum'); if (s) s.innerHTML = n + ' ' + plural(n, 'услуга', 'услуги', 'услуг') + ' · ≈ ' + hrs(cartHours()) + '<b>от ' + rub(cartTotal()) + '</b>';
    }
  }

  /* ---------- окно записи ---------- */
  var sheet = $('#sheet'), body = $('#sheetBody'), foot = $('#sheetFoot'), sheetOpen = false, lastFocus = null;
  var B = { mode: 'book', step: 0, day: null, time: null, name: '', phone: '', car: '', note: '', consent: false, errs: {} };
  var DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayLabel(s) { var d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + DAYS[d.getDay()]; }
  function busy(day, t) { var h = 0, s = day + t; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000; return h < 300; }
  function endTime(t, h) { var p = t.split(':'), m = +p[0] * 60 + +p[1] + Math.round(h * 60); if (m >= 21 * 60) return null; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function slots(day) {
    var h = B.mode === 'quick' ? 1 : cartHours(), out = [], now = new Date();
    var lastStart = h >= 12 ? 11 : 21 - h;
    for (var m = 9 * 60; m <= lastStart * 60; m += 30) {
      var t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + (m % 60 ? '30' : '00');
      out.push({ t: t, off: new Date(day + 'T' + t + ':00') - now < 60 * 60e3 || busy(day, t) });
    }
    return out;
  }
  function stepsOf() { return B.mode === 'quick' ? ['time', 'contacts', 'done'] : ['cart', 'time', 'contacts', 'done']; }
  function openSheet(mode) {
    closeMenu();
    B.mode = mode; B.step = 0; B.errs = {};
    if (mode !== 'mine') { B.time = null; if (!B.day) B.day = ymd(new Date()); }
    lastFocus = document.activeElement; sheetOpen = true;
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop(); document.documentElement.classList.add('lock');
    renderSheet(); updateBadges();
    setTimeout(function () { var f = $('.x', sheet); if (f) f.focus(); }, 60);
  }
  NIK.openSheet = openSheet;
  function closeSheet() {
    sheetOpen = false; sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start(); document.documentElement.classList.remove('lock');
    updateBadges(); if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', function (e) {
    var scope = sheetOpen ? sheet.querySelector('.sheet__panel') : (menuOpen ? menu : null);
    if (!scope) return;
    if (e.key === 'Escape') { sheetOpen ? closeSheet() : closeMenu(); }
    if (e.key === 'Tab') {
      var f = $$('button, input, textarea, a[href]', scope).filter(function (x) { return !x.disabled && x.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openSheet(o.dataset.open); return; }
    var p = e.target.closest('[data-promo]');
    if (p) { cart.set(p.dataset.promo, 1); saveCart(); syncAdds(); updateBadges(); openSheet('book'); }
  });

  function stepBar() {
    var st = stepsOf(); if (B.mode === 'mine') { $('#steps').innerHTML = ''; return; }
    $('#steps').innerHTML = st.map(function (_, i) { return '<i class="' + (i <= B.step ? 'on' : '') + '"></i>'; }).join('');
  }
  function renderSheet() {
    stepBar();
    if (B.mode === 'mine') return renderMine();
    var s = stepsOf()[B.step];
    $('#sheetTitle').textContent = B.mode === 'quick' ? 'Быстрая запись' : 'Запись';
    ({ cart: renderCartStep, time: renderTimeStep, contacts: renderContactsStep, done: renderDone })[s]();
  }
  function footer(back, nextLabel, nextOk, total) {
    foot.innerHTML = (back ? '<button class="btn btn--ghost" type="button" id="bBack" style="flex:none">Назад</button>' : '') +
      (total ? '<span class="sheet__total">' + total + '</span>' : '') +
      '<button class="btn btn--copper" type="button" id="bNext"' + (nextOk ? '' : ' disabled') + '>' + nextLabel + '</button>';
    var bb = $('#bBack'); if (bb) bb.onclick = function () { B.step--; renderSheet(); };
  }
  function renderCartStep() {
    var lines = cartLines();
    body.innerHTML = '<div><p class="lbl">Класс автомобиля</p><div class="chips">' + D.classes.map(function (c, i) {
        return '<button class="chip" type="button" data-cls="' + i + '" aria-pressed="' + (i === cls) + '">' + esc(c[1]) + '</button>';
      }).join('') + '</div></div>' +
      '<div><p class="lbl">Услуги</p>' + (lines.length ? '<div class="cart">' + lines.map(function (l) {
        return '<div class="cart__row"><span>' + esc(l.name) + '</span><span>от ' + rub(l.p[cls]) + '</span><button type="button" data-del="' + l.key + '" aria-label="Убрать ' + esc(l.name) + '">✕</button></div>';
      }).join('') + '</div>' : '<p class="empty">Пока ничего не выбрано. Отметьте услуги в каталоге или запишитесь без выбора — администратор уточнит по телефону.</p>') +
      '<div class="row-btns"><a class="btn btn--ghost btn--sm" href="services.html">' + (lines.length ? 'Добавить ещё' : 'Открыть каталог') + '</a>' +
      (lines.length ? '' : '<button class="btn btn--ghost btn--sm" type="button" id="toQuick">Быстрая запись</button>') + '</div></div>' +
      (lines.length ? '<div class="freetime"><span>Пока мы работаем</span><b>≈ ' + hrs(cartHours()) + ' свободного времени в центре</b><a href="park.html#calc">Чем заняться</a></div>' : '');
    footer(false, 'Выбрать время', lines.length > 0, lines.length ? 'от ' + rub(cartTotal()) : '');
    $('#bNext').onclick = function () { if (cart.size) { B.step++; renderSheet(); } };
    var tq = $('#toQuick'); if (tq) tq.onclick = function () { openSheet('quick'); };
    $$('[data-del]', body).forEach(function (b) {
      b.onclick = function () { cart.delete(b.dataset.del); saveCart(); syncAdds(); updateBadges(); renderSheet(); };
    });
  }
  function renderTimeStep() {
    var days = [], d0 = new Date();
    for (var i = 0; i < 14; i++) { var d = new Date(d0); d.setDate(d0.getDate() + i); days.push(d); }
    var sl = slots(B.day);
    if (B.time && sl.every(function (s) { return s.t !== B.time || s.off; })) B.time = null;
    var h = B.mode === 'quick' ? 1 : cartHours(), end = B.time ? endTime(B.time, h) : null;
    body.innerHTML = '<div><p class="lbl">День</p><div class="days">' + days.map(function (d) {
      var k = ymd(d);
      return '<button class="day" type="button" data-day="' + k + '" aria-pressed="' + (k === B.day) + '" aria-label="' + dayLabel(k) + '"><small>' + DAYS[d.getDay()] + '</small><b>' + d.getDate() + '</b></button>';
    }).join('') + '</div></div>' +
      '<div><p class="lbl">Время заезда · ' + dayLabel(B.day) + '</p><div class="times">' + sl.map(function (s) {
        return '<button class="time" type="button" data-time="' + s.t + '"' + (s.off ? ' disabled' : '') + ' aria-pressed="' + (s.t === B.time) + '">' + s.t + '</button>';
      }).join('') + '</div></div>' +
      (sl.every(function (s) { return s.off; }) ? '<p class="empty">На этот день свободного времени нет — выберите другой.</p>' : '') +
      (B.time && B.mode !== 'quick' ? '<div class="freetime"><span>Машина будет готова</span><b>' + (end ? 'примерно к ' + end : 'на следующий день — останется в паркинге') + '</b></div>' : '') +
      '<p class="demo">Демо-расписание: занятость условная. В рабочей версии здесь будут реальные свободные окна по трём постам.</p>';
    footer(B.mode !== 'quick', 'Дальше', !!B.time, B.mode === 'quick' ? '' : 'от ' + rub(cartTotal()));
    $('#bNext').onclick = function () { if (B.time) { B.step++; renderSheet(); } };
    $$('[data-day]', body).forEach(function (b) { b.onclick = function () { B.day = b.dataset.day; B.time = null; renderSheet(); }; });
    $$('[data-time]', body).forEach(function (b) { b.onclick = function () { B.time = b.dataset.time; renderSheet(); }; });
  }
  function phoneDigits(s) { var d = s.replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); if (d[0] === '9') d = '7' + d; return d.slice(0, 11); }
  function phoneFmt(s) { var d = phoneDigits(s); if (!d) return ''; var o = '+7'; if (d.length > 1) o += ' ' + d.slice(1, 4); if (d.length > 4) o += ' ' + d.slice(4, 7); if (d.length > 7) o += '-' + d.slice(7, 9); if (d.length > 9) o += '-' + d.slice(9, 11); return o; }
  function renderContactsStep() {
    var e = B.errs;
    body.innerHTML = '<div class="summary"><div><span>Когда</span><b>' + dayLabel(B.day) + ', ' + B.time + '</b></div>' +
      (B.mode === 'quick' ? '<div><span>Услуги</span><b>уточнит администратор</b></div>' : '<div><span>Услуги</span><b>' + cart.size + ' · от ' + rub(cartTotal()) + '</b></div>') + '</div>' +
      '<div class="field"><label for="fName">Имя</label><input id="fName" autocomplete="given-name" value="' + esc(B.name) + '">' + (e.name ? '<span class="err">' + e.name + '</span>' : '') + '</div>' +
      '<div class="field"><label for="fPhone">Телефон</label><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(B.phone) + '">' + (e.phone ? '<span class="err">' + e.phone + '</span>' : '') + '</div>' +
      '<div class="field"><label for="fCar">Машина (необязательно)</label><input id="fCar" placeholder="Например, Mercedes S или BMW X5" value="' + esc(B.car) + '"></div>' +
      '<div class="field"><label for="fNote">Комментарий (необязательно)</label><textarea id="fNote" placeholder="Например: шерсть питомца в салоне">' + esc(B.note) + '</textarea></div>' +
      '<label class="check"><input id="fConsent" type="checkbox"' + (B.consent ? ' checked' : '') + '><span>Согласен на обработку персональных данных для записи по <a href="route.html#privacy">политике</a>.' + (e.consent ? ' <b class="err-inline">' + e.consent + '</b>' : '') + '</span></label>';
    footer(true, 'Записаться', true, '');
    var ph = $('#fPhone');
    ph.addEventListener('input', function () { var p = ph.selectionStart, l = ph.value.length; ph.value = phoneFmt(ph.value); B.phone = ph.value; try { ph.setSelectionRange(p + ph.value.length - l, p + ph.value.length - l); } catch (x) {} });
    $('#fName').oninput = function (ev) { B.name = ev.target.value; };
    $('#fCar').oninput = function (ev) { B.car = ev.target.value; };
    $('#fNote').oninput = function (ev) { B.note = ev.target.value; };
    $('#fConsent').onchange = function (ev) { B.consent = ev.target.checked; };
    $('#bNext').onclick = submit;
  }
  function submit() {
    var e = {};
    if (B.name.trim().length < 2) e.name = 'Напишите имя, чтобы администратор знал, как к вам обращаться.';
    if (phoneDigits(B.phone).length !== 11) e.phone = 'Нужен номер из 11 цифр, например +7 925 034-44-42.';
    if (!B.consent) e.consent = 'Отметьте согласие.';
    B.errs = e;
    if (Object.keys(e).length) { renderSheet(); var f = $('.err', body); if (f && f.previousElementSibling) f.previousElementSibling.focus(); return; }
    var h = B.mode === 'quick' ? 1 : cartHours();
    var rec = { id: Date.now(), code: String(1000 + Math.floor(Math.random() * 9000)), day: B.day, time: B.time, end: endTime(B.time, h), quick: B.mode === 'quick',
      items: B.mode === 'quick' ? [] : cartLines().map(function (l) { return l.name; }), total: B.mode === 'quick' ? 0 : cartTotal(), h: h,
      name: B.name.trim(), phone: phoneDigits(B.phone), car: B.car };
    var list = store.get('nik:bookings', []); list.push(rec); store.set('nik:bookings', list);
    B.last = rec;
    if (B.mode !== 'quick') { cart.clear(); saveCart(); syncAdds(); updateBadges(); }
    B.step++; renderSheet();
  }
  // Штрихкод талона из кода записи
  function barcode(code) {
    var bars = '', x = 0, seed = +code;
    for (var i = 0; i < 46; i++) { seed = (seed * 9301 + 49297) % 233280; var w = 1 + Math.floor(seed / 233280 * 3); if (i % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>'; x += w + 1; }
    return '<svg class="ticket__bars" viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>';
  }
  function renderDone() {
    var r = B.last;
    body.innerHTML = '<div class="ticket" role="group" aria-label="Талон записи">' +
      '<div class="ticket__head"><img src="logo.webp" alt="Автомойка на Никольской" width="110" height="40"><span>Талон записи</span></div>' +
      '<div class="ticket__grid"><div><span>Дата</span><b>' + dayLabel(r.day) + '</b></div><div><span>Заезд</span><b>' + r.time + '</b></div>' +
      '<div><span>Готово</span><b>' + (r.quick ? 'уточним' : (r.end ? '≈ ' + r.end : 'завтра')) + '</b></div><div><span>Код</span><b class="ticket__code">' + r.code + '</b></div></div>' +
      '<div class="ticket__cut" aria-hidden="true"></div>' +
      '<div class="ticket__park"><b>Парковка бесплатно</b><span>на всё время мойки · паркинг Никольской Плазы · въезд с Б. Черкасского пер.</span></div>' +
      barcode(r.code) + '</div>' +
      '<div class="summary">' + (r.quick ? '<div><span>Услуги</span><b>уточнит администратор</b></div>' : r.items.map(function (n) { return '<div><span>' + esc(n) + '</span></div>'; }).join('') + '<div><span>Итого</span><b>от ' + rub(r.total) + '</b></div>') + '</div>' +
      (r.quick ? '' : '<a class="freetime freetime--link" href="park.html#calc"><span>Пока мы работаем</span><b>≈ ' + hrs(r.h) + ' на прогулку по центру — составим маршрут</b></a>') +
      '<p class="demo">Это демонстрация: запись сохранена только в этом браузере и никуда не отправлена.</p>';
    foot.innerHTML = '<button class="btn btn--ghost" type="button" data-open="mine">Мои записи</button><button class="btn btn--copper" type="button" data-close>Готово</button>';
  }
  function renderMine() {
    $('#sheetTitle').textContent = 'Мои записи';
    var all = store.get('nik:bookings', []).filter(function (r) { return new Date(r.day + 'T' + r.time) > new Date(Date.now() - 3 * 3600e3); });
    var q = B.lookup;
    var list = q ? all.filter(function (r) { return r.phone === q.phone && r.name.toLowerCase() === q.name.toLowerCase(); }) : all;
    body.innerHTML = (list.length ? '<div class="mine">' + list.map(function (r) {
      var canCancel = new Date(r.day + 'T' + r.time) - new Date() > 2 * 3600e3;
      return '<div class="mine__item"><b>' + dayLabel(r.day) + ', ' + r.time + '</b><span>' + (r.quick ? 'Быстрая запись' : esc(r.items.join(', '))) + '</span><span>Код ' + r.code + (r.total ? ' · от ' + rub(r.total) : '') + '</span>' +
        (canCancel ? '<button class="btn btn--ghost btn--sm" type="button" data-cancel="' + r.id + '">Отменить запись</button>' : '<span>Отмена возможна не позднее чем за 2 часа — позвоните нам.</span>') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + (q ? 'Записей с таким номером и именем не нашли.' : 'На этом устройстве записей нет.') + '</p>') +
      '<div><p class="lbl">Записывались с другого устройства?</p><div class="field"><label for="lPhone">Телефон</label><input id="lPhone" type="tel" inputmode="tel" placeholder="+7 900 000-00-00"></div>' +
      '<div class="field" style="margin-top:10px"><label for="lName">Имя, указанное при записи</label><input id="lName"></div></div>' +
      '<p class="demo">В демо поиск идёт только по записям этого браузера.</p>';
    foot.innerHTML = '<button class="btn btn--copper" type="button" id="lGo">Найти записи</button>';
    var lp = $('#lPhone'); lp.addEventListener('input', function () { lp.value = phoneFmt(lp.value); });
    $('#lGo').onclick = function () { B.lookup = { phone: phoneDigits(lp.value), name: $('#lName').value.trim() }; renderSheet(); };
    $$('[data-cancel]', body).forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.armed) { store.set('nik:bookings', store.get('nik:bookings', []).filter(function (r) { return String(r.id) !== b.dataset.cancel; })); renderSheet(); }
        else { b.dataset.armed = '1'; b.textContent = 'Точно отменить? Нажмите ещё раз'; }
      };
    });
  }

  /* ---------- отзывы, схема заезда, копирование (если есть на странице) ---------- */
  var mq = $('#marquee');
  if (mq) {
    var q = D.reviews.map(function (r) { return '<blockquote class="quote"><p>' + esc(r[1]) + '</p><cite>' + esc(r[0]) + ' · Яндекс Карты</cite></blockquote>'; });
    var half = Math.ceil(q.length / 2), a1 = q.slice(0, half).join(''), b1 = q.slice(half).join('');
    mq.innerHTML = '<div class="marquee__track">' + a1 + '<div style="display:contents" aria-hidden="true">' + a1 + '</div></div>' +
      '<div class="marquee__track marquee__track--b">' + b1 + '<div style="display:contents" aria-hidden="true">' + b1 + '</div></div>';
  }
  var path = $('#routePath');
  if (path) {
    var steps = $$('#routeSteps li'), pins = $$('.pin'), box = $('.route__map'), L = path.getTotalLength(), marks = [0.12, 0.42, 0.55, 0.9];
    path.style.strokeDasharray = L; path.style.strokeDashoffset = reduced ? 0 : L;
    var upd = function () {
      var r = box.getBoundingClientRect(), vh = window.innerHeight;
      var k = reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height * 0.9)));
      path.style.strokeDashoffset = String(L * (1 - k));
      steps.forEach(function (s, i) { s.classList.toggle('on', k >= marks[i]); });
      pins.forEach(function (p, i) { p.style.opacity = k >= marks[i] ? 1 : 0.25; });
    };
    NIK.onScroll(upd); window.addEventListener('resize', upd);
  }
  var gl = $('#galleryList');
  if (gl) gl.innerHTML = D.works.map(function (w) {
    return '<figure class="shot"><div class="shot__img"><img src="' + w.thumb + '" alt="' + esc(w.title) + '" loading="lazy" width="720" height="900"></div>' +
      '<figcaption>' + esc(w.title) + '<small>Фото: <a href="' + esc(w.credit.url) + '" target="_blank" rel="noopener">' + esc(w.credit.author) + '</a>, ' + esc(w.credit.license) + '</small></figcaption></figure>';
  }).join('');
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'); if (!c) return;
    var txt = c.dataset.copy, label = c.textContent;
    var ok = function () { c.textContent = 'Скопировано'; setTimeout(function () { c.textContent = label; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { c.textContent = txt; });
    else c.textContent = txt;
  });

  /* ---------- магнитные кнопки ---------- */
  if (!coarse && !reduced) {
    document.addEventListener('pointermove', function (e) {
      var b = e.target.closest && e.target.closest('.btn--magnet');
      $$('.btn--magnet').forEach(function (x) { if (x !== b) { x.style.setProperty('--mx', '0px'); x.style.setProperty('--my', '0px'); } });
      if (!b) return;
      var r = b.getBoundingClientRect();
      b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px');
      b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px');
    });
  }

  renderClassChips(); renderCatalogs(); updateBadges(); NIK.observeRise(document);
})();
