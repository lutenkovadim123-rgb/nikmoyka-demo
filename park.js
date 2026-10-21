/* «Пока мы моем»: калькулятор свободного времени. Маршрут показывается на реальной карте района, с фото места назначения. */
(function () {
  'use strict';
  var NIK = window.NIK, C = window.NIK_CITY, M = window.NIK_MAP, PH = window.NIK_PHOTOS || {};
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var calc = $('#calc'); if (!calc) return;
  var P = {}; C.places.forEach(function (p) { P[p.id] = p; });
  var A = {}; C.activities.forEach(function (a) { A[a.id] = a; });
  var st = { svc: 'complex-standard', at: '12:00', sc: 'plaza', focus: 0 };
  var hash = location.hash.slice(1);
  if (C.scenarios.some(function (s) { return s.id === hash; })) st.sc = hash;

  function xyOf(id) { return id === 'plaza' ? [0, 0] : (M && M.places[id]) || [P[id].x, P[id].y]; }
  function walk(a, b) {
    if (a === b) return 0;
    if (M && a === 'plaza' && M.foot[b]) return M.foot[b].min;
    if (M && b === 'plaza' && M.foot[a]) return M.foot[a].min;
    var pa = xyOf(a), pb = xyOf(b);
    return Math.max(1, Math.ceil(Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) * 1.35 / 75));
  }
  function tm(m) { m = Math.round(m); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function toMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }

  function plan() {
    var svc = C.durations.filter(function (d) { return d.id === st.svc; })[0];
    var total = svc.h * 60, start = toMin(st.at) + 10, end = toMin(st.at) + total, free = total - 15;
    var sc = C.scenarios.filter(function (s) { return s.id === st.sc; })[0];
    var steps = [], used = 0, here = 'plaza', t = start;
    sc.plan.forEach(function (id) {
      var a = A[id], w = walk(here, a.place), back = walk(a.place, 'plaza');
      if (used + w + a.min + back <= free) { steps.push({ t: t + w, a: a, w: w }); used += w + a.min; t += w + a.min; here = a.place; }
    });
    var back = walk(here, 'plaza');
    return { svc: svc, sc: sc, end: end, steps: steps, left: free - used - back };
  }

  /* ---------- карта и фото ---------- */
  var map = null, anim = null, cur = null;
  var cv = $('#pmap'), now = $('#pnow');
  if (M && window.CityMap && cv) { map = new window.CityMap(cv, { highlight: [M.plaza] }); map.cam.z = 0.4; }
  function fit(ids) {
    var xs = [0], ys = [0];
    ids.forEach(function (id) { var f = M.foot[id]; if (f) for (var i = 0; i < f.p.length; i += 2) { xs.push(f.p[i]); ys.push(f.p[i + 1]); } });
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs), miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    var z = Math.min((map.W - 80) / Math.max(200, maxx - minx), (map.H - 140) / Math.max(200, maxy - miny));
    return { x: (minx + maxx) / 2, y: (miny + maxy) / 2, z: Math.min(z, 2.2) };
  }
  function flyTo(target, routes, focusIdx) {
    if (!map) return;
    var from = { x: map.cam.x, y: map.cam.y, z: map.cam.z }, t0 = performance.now(), dur = NIK.reduced ? 0 : 900;
    if (anim) cancelAnimationFrame(anim);
    function step(t) {
      var k = dur ? Math.min(1, (t - t0) / dur) : 1, e = k * k * (3 - 2 * k);
      map.cam.x = from.x + (target.x - from.x) * e; map.cam.y = from.y + (target.y - from.y) * e;
      map.cam.z = Math.exp(Math.log(from.z) + (Math.log(target.z) - Math.log(from.z)) * e);
      routes.forEach(function (r, i) {
        var d = NIK.reduced ? 1 : Math.min(1, Math.max(0, (t - t0 - 300 - i * 260) / 900));
        r.rt.p = r.rt.p >= 1 ? 1 : d * d * (3 - 2 * d);
        r.rt.w = i === focusIdx ? 4 : 2.5; r.rt.color = i === focusIdx || focusIdx < 0 ? '#f2c39a' : 'rgba(242,195,154,.45)';
      });
      map.draw();
      if (k < 1 || routes.some(function (r) { return r.rt.p < 1; })) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }
  function showPlace(r, idx) {
    if (!now) return;
    var s = r.steps[idx]; if (!s) { now.hidden = true; return; }
    var id = s.a.place, img = ({ vokrug: 'vokrug', plz_shop: 'shop', plz_beauty: 'beauty', plz_fit: 'fit' })[s.a.id] || id, ph = PH[img], f = M && M.foot[id];
    now.hidden = false;
    now.innerHTML = (ph ? '<div class="pnow__img"><img class="kb" src="places/' + img + '.webp" alt="' + NIK.esc(s.a.name) + '"></div>' : '<div class="pnow__img pnow__img--plaza"><img src="logo@2x.webp" alt="" class="pnow__logo"></div>') +
      '<div class="pnow__txt"><span class="lbl" style="margin:0">' + tm(s.t) + ' · шаг ' + (idx + 1) + ' из ' + r.steps.length + '</span><b>' + NIK.esc(s.a.name) + '</b>' +
      '<span>' + (id === 'plaza' ? '1 минута · в том же здании' : '≈ ' + (f ? f.min : s.w) + ' мин пешком от мойки' + (f ? ' · ' + f.m + ' м' : '')) + '</span>' +
      (ph ? '<small>Фото: <a href="' + ph.url + '" target="_blank" rel="noopener">' + NIK.esc(ph.author) + '</a>, ' + NIK.esc(ph.license) + '</small>' : '') + '</div>';
  }
  function drawPlan(r) {
    if (!map) return;
    map.routes = [];
    var ids = [], seen = {};
    r.steps.forEach(function (s) { var id = s.a.place; if (id !== 'plaza' && !seen[id] && M.foot[id]) { seen[id] = 1; ids.push(id); } });
    var routes = ids.map(function (id) { return { id: id, rt: map.addRoute(M.foot[id].p, { w: 3, dash: [2, 7] }) }; });
    map.marks = [{ x: 0, y: 0, label: 'Мойка · Никольская Плаза', hi: true }].concat(ids.map(function (id) { var p = M.places[id]; return { x: p[0], y: p[1], label: P[id].name + ' · ' + M.foot[id].min + ' мин' }; }));
    cur = { r: r, routes: routes, ids: ids };
    flyTo(fit(ids), routes, -1);
  }
  function focusStep(idx) {
    if (!cur || !map) return;
    st.focus = idx; showPlace(cur.r, idx);
    var id = cur.r.steps[idx] && cur.r.steps[idx].a.place;
    $$('.tl__row[data-i]').forEach(function (li) { li.classList.toggle('is-focus', +li.dataset.i === idx); });
    var ri = cur.ids.indexOf(id);
    if (ri < 0) { flyTo({ x: 0, y: 0, z: 2.4 }, cur.routes, -2); return; }
    var f = M.foot[id].p, tx = f[f.length - 2], ty = f[f.length - 1];
    var tgt = fit([id]); tgt.z = Math.min(tgt.z, 1.6);
    flyTo({ x: tgt.x * 0.4 + tx * 0.6, y: tgt.y * 0.4 + ty * 0.6, z: tgt.z }, cur.routes, ri);
    if (window.innerWidth < 980) { var mp = $('.calc__out'); if (mp && mp.getBoundingClientRect().top < 0) NIK.scrollToEl(mp); }
  }

  function render() {
    var r = plan(), overnight = r.end > 21 * 60;
    $('#calcFree').textContent = '≈ ' + NIK.hrs(r.svc.h) + ' в центре';
    $('#calcLead').textContent = r.sc.lead;
    var rows = '<li class="tl__row tl__row--car"><time>' + st.at + '</time><div><b>Оставляете машину</b><span>Никольская, 10 · паркинг Плазы, парковка бесплатно</span></div></li>';
    r.steps.forEach(function (s, i) {
      rows += '<li class="tl__row tl__row--pick" data-i="' + i + '" tabindex="0" role="button" aria-label="Показать на карте: ' + NIK.esc(s.a.name) + '"><time>' + tm(s.t) + '</time><div><b>' + NIK.esc(s.a.name) + '</b><span>' + (s.w ? '≈ ' + s.w + ' мин пешком · ' : 'рядом · ') + s.a.min + ' мин</span></div></li>';
    });
    if (r.left >= 20) rows += '<li class="tl__row tl__row--free"><time>+' + NIK.hrs(r.left / 60) + '</time><div><b>Ещё свободное время</b><span>Можно не торопиться</span></div></li>';
    rows += '<li class="tl__row tl__row--car"><time>' + (overnight ? 'завтра' : tm(r.end)) + '</time><div><b>' + (overnight ? 'Машина остаётся в паркинге' : 'Забираете чистую машину') + '</b><span>' + (overnight ? 'Работа дольше дня — заберёте утром, парковка бесплатна' : 'Готово примерно к этому времени, мастер позвонит') + '</span></div></li>';
    var tl = $('#calcTl'); tl.innerHTML = rows;
    if (!NIK.reduced) $$('.tl__row', tl).forEach(function (li, i) { li.style.animationDelay = (i * 70) + 'ms'; li.classList.add('tl__row--in'); });
    $('#calcBook').textContent = 'Записаться: ' + r.svc.name;
    $$('[data-svc]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.svc === st.svc)); });
    $$('[data-at]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.at === st.at)); });
    $$('[data-sc]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sc === st.sc)); });
    drawPlan(r); showPlace(r, 0); st.focus = 0;
    var f0 = tl.querySelector('.tl__row[data-i="0"]'); if (f0) f0.classList.add('is-focus');
  }
  calc.addEventListener('click', function (e) {
    var row = e.target.closest('.tl__row[data-i]'); if (row) { focusStep(+row.dataset.i); return; }
    var b = e.target.closest('[data-svc],[data-at],[data-sc]'); if (!b) return;
    if (b.dataset.svc) st.svc = b.dataset.svc; if (b.dataset.at) st.at = b.dataset.at; if (b.dataset.sc) st.sc = b.dataset.sc;
    render();
  });
  calc.addEventListener('keydown', function (e) { var row = e.target.closest('.tl__row[data-i]'); if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); focusStep(+row.dataset.i); } });
  $('#calcBook').addEventListener('click', function () { NIK.cart.add(st.svc); NIK.openSheet('book'); });
  $$('[data-scgo]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); st.sc = a.dataset.scgo; render(); NIK.scrollToEl(calc); }); });

  function chips() {
    $('#calcSvc').innerHTML = C.durations.map(function (d) { return '<button class="chip" type="button" data-svc="' + d.id + '">' + NIK.esc(d.name) + ' · ' + NIK.hrs(d.h) + '</button>'; }).join('');
    $('#calcAt').innerHTML = ['10:00', '12:00', '14:00', '16:00', '18:00'].map(function (t) { return '<button class="chip" type="button" data-at="' + t + '">' + t + '</button>'; }).join('');
    $('#calcSc').innerHTML = C.scenarios.map(function (s) { return '<button class="chip" type="button" data-sc="' + s.id + '">' + NIK.esc(s.name) + '</button>'; }).join('');
  }
  chips(); render();
  if (hash && C.scenarios.some(function (s) { return s.id === hash; })) setTimeout(function () { NIK.scrollToEl(calc); }, 300);
})();
