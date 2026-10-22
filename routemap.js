/* Карта заезда: неподвижный 3D-вид по данным OpenStreetMap. Карта рисуется один раз (и при смене размера),
   движется только маленькая метка машины по маршруту — на отдельном слое. Данные карты грузятся, когда блок близко к экрану. */
(function () {
  'use strict';
  var boxes = [].slice.call(document.querySelectorAll('[data-routemap]'));
  if (!boxes.length) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  var ready = null;
  function libs() { return ready || (ready = load('mapdata.js').then(function () { return load('citymap.js'); })); }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (!e.isIntersecting || e.target._init) return; e.target._init = 1; libs().then(function () { init(e.target); }, function () { e.target.querySelector('.mapbox__load').textContent = 'Карта не загрузилась — обновите страницу'; }); });
  }, { rootMargin: '600px 0px' });
  boxes.forEach(function (b) { io.observe(b); });

  function init(box) {
    var M = window.NIK_MAP, LM = M.lm || {};
    var cv = box.querySelector('canvas.map'), ov = box.querySelector('canvas.car');
    var bidx = function (k) { return LM[k] ? LM[k].b : []; };
    var map = new window.CityMap(cv, { highlight: [M.plaza], landmarks: bidx('stregis').concat(bidx('gum'), bidx('cdm')), streets: [{ name: 'Большой Черкасский переулок', a: 1, color: 'rgba(242,195,154,.35)' }] });
    var which = box.dataset.from || 'lubyanka', routes = {};
    ['lubyanka', 'ilyinka'].forEach(function (k) { if (M.car[k]) routes[k] = map.addRoute(M.car[k].p, { w: 5, color: '#f2c39a', p: 0 }); });
    var P = LM.plaza || { x: 0, y: 0, h: 15 };
    // ближайшая к Плазе точка Никольской улицы — для подписи
    var nik = [-120, -95], bd = 1e9;
    M.roads.forEach(function (r) { if (r.n !== 'Никольская улица') return; for (var i = 0; i < r.p.length; i += 2) { var d = Math.hypot(r.p[i] + 110, r.p[i + 1] + 90); if (d < bd) { bd = d; nik = [r.p[i], r.p[i + 1]]; } } });
    function marks() {
      var rt = M.car[which].p;
      return [
        { id: 'plaza', x: P.x, y: P.y, h: P.h, label: 'Никольская Плаза', tag: 'main', sub: 'мойка · паркинг −3 этаж', solid: true, size: map.W < 700 ? 13 : 0, dx: map.W < 700 ? -90 : -40, dy: map.W < 700 ? -74 : 0 },
        LM.stregis && { x: LM.stregis.x, y: LM.stregis.y, h: LM.stregis.h, label: 'The St. Regis', tag: 'bld' },
        LM.cdm && { x: LM.cdm.x, y: LM.cdm.y, h: LM.cdm.h, label: 'ЦДМ', tag: 'bld' },
        LM.gum && { x: LM.gum.x, y: LM.gum.y, h: LM.gum.h, label: 'ГУМ', tag: 'bld' },
        { x: M.places.red[0], y: M.places.red[1], h: 0, label: 'Красная площадь', tag: 'bld' },
        { x: nik[0], y: nik[1], h: 0, label: 'Никольская улица · пешеходная', tag: 'bld' },
        { x: rt[0], y: rt[1], label: map.W < 700 ? 'Старт' : (which === 'lubyanka' ? 'Старт: Лубянская площадь' : 'Старт: Ильинка') },
        { x: M.entrance[0], y: M.entrance[1], label: map.W < 700 ? 'Въезд' : 'Въезд в паркинг', hi: true }
      ].filter(Boolean).concat(routeStreets());
    }
    function segd(p, ax, ay, bx, by) { var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l)) : 0; return Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy); }
    // подписи улиц маршрута: для каждой улицы — точка маршрута, ближайшая к ней
    function routeStreets() {
      var rt = routes[which], out = [], N = { 'Новая площадь': 'Новая пл.', 'улица Ильинка': 'ул. Ильинка', 'Большой Черкасский переулок': 'Б. Черкасский пер.' };
      Object.keys(N).forEach(function (name) {
        // участок маршрута, который идёт по этой улице, — подпись в его середине
        var on = [];
        for (var f = 0.02; f < 0.98; f += 0.01) {
          var p = map.pointAt(rt, f), d = 1e9;
          M.roads.forEach(function (r) { if (r.n !== name) return; for (var i = 2; i < r.p.length; i += 2) { d = Math.min(d, segd(p, r.p[i - 2], r.p[i - 1], r.p[i], r.p[i + 1])); } });
          if (d < 9) on.push(f);
        }
        if (on.length > 2) { var q = map.pointAt(rt, on[Math.floor(on.length / 2)]); out.push({ x: q[0], y: q[1], label: N[name], side: name === 'Новая площадь' ? '' : 'l' }); }
      });
      return out;
    }
    // кадр: весь маршрут и Плаза, вид с юга под наклоном
    function frame() {
      var pts = M.car[which].p, xs = [P.x, M.entrance[0]], ys = [P.y, M.entrance[1]];
      for (var i = 0; i < pts.length; i += 2) { xs.push(pts[i]); ys.push(pts[i + 1]); }
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var W = map.W, H = map.H, t = W < 700 ? 0.62 : 0.72;
      map.cam.t = t; map.cam.r = 0; map.cam.x = (x0 + x1) / 2; map.cam.y = (y0 + y1) / 2 - (y1 - y0) * 0.08;
      map.cam.z = Math.min((W * 0.7) / Math.max(120, x1 - x0), (H * 0.52) / Math.max(120, (y1 - y0) * Math.cos(t)));
      map.cam.sx = 0; map.cam.sy = 0;
      Object.keys(routes).forEach(function (k) { routes[k].p = k === which ? 1 : 0; });
      map.marks = marks();
      map.draw();
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75), octx = ov.getContext('2d');
    function sizeOv() { var r = ov.getBoundingClientRect(); ov.width = Math.max(2, Math.round(r.width * dpr)); ov.height = Math.max(2, Math.round(r.height * dpr)); }
    // метка машины: проезд ≈ 9 с, пауза у въезда 2 с
    var t0 = performance.now(), raf = 0, visible = true, DUR = 9000, HOLD = 2200;
    function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
    function car(now) {
      raf = 0;
      var rt = routes[which], k = reduced ? 1 : ((now - t0) % (DUR + HOLD)) / DUR; k = Math.min(1, k);
      var q = ease(k), p = map.pointAt(rt, q), s = map.project(p[0], p[1], 0);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, ov.width, ov.height);
      if (s) {
        // хвост
        octx.lineCap = 'round'; octx.strokeStyle = 'rgba(255,226,196,.55)'; octx.lineWidth = 4; octx.beginPath();
        for (var i = 0; i <= 10; i++) { var a = map.pointAt(rt, Math.max(0, q - 0.06 + i * 0.006)), b = map.project(a[0], a[1], 0); if (b) { if (i) octx.lineTo(b[0], b[1]); else octx.moveTo(b[0], b[1]); } }
        octx.stroke();
        var g = octx.createRadialGradient(s[0], s[1], 0, s[0], s[1], 20); g.addColorStop(0, 'rgba(255,226,196,.95)'); g.addColorStop(1, 'rgba(255,226,196,0)');
        octx.fillStyle = g; octx.beginPath(); octx.arc(s[0], s[1], 20, 0, 6.283); octx.fill();
        octx.fillStyle = '#fff3e6'; octx.beginPath(); octx.arc(s[0], s[1], 5, 0, 6.283); octx.fill();
      }
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(car);
    }
    function kick() { if (!raf && !reduced) raf = requestAnimationFrame(car); }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(box);
    document.addEventListener('visibilitychange', kick);
    var rz = 0;
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { frame(); sizeOv(); car(performance.now()); }, 120); });
    frame(); sizeOv(); car(performance.now()); kick();
    box.querySelector('.mapbox__load').hidden = true;
    // переключатель «С Лубянки / С Ильинки»
    var sw = document.querySelectorAll('[data-from-btn]');
    [].forEach.call(sw, function (b) {
      b.addEventListener('click', function () {
        which = b.dataset.fromBtn; t0 = performance.now();
        [].forEach.call(sw, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var cap = document.getElementById('routeLen'); if (cap && M.car[which]) cap.textContent = M.car[which].m + ' м';
        frame(); car(performance.now()); kick();
      });
    });
  }
})();
