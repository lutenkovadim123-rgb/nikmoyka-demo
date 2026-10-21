/* «История на карте»: закреплённая сцена, где прокрутка ведёт камеру по реальной карте района, как в видео.
   Камера наклоняется в 3D на заезде и у Плазы, подписи стоят на самих зданиях. */
(function () {
  'use strict';
  var NIK = window.NIK, M = window.NIK_MAP, PH = window.NIK_PHOTOS || {}, C = window.NIK_CITY;
  if (!M || !window.CityMap) return;
  var seg = NIK.seg, ease = NIK.ease, LM = M.lm || {}, ang = window.CityMap.angLerp;
  var NAMES = {}; C.places.forEach(function (p) { NAMES[p.id] = p.name; });
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lz(a, b, t) { return Math.exp(lerp(Math.log(a), Math.log(b), t)); }
  var small = function () { return window.innerWidth < 700; };
  function bidx(keys) { var o = []; keys.forEach(function (k) { if (LM[k]) o = o.concat(LM[k].b); }); return o; }
  var PLAZA = LM.plaza || { x: 0, y: 0, h: 15 };
  // точка на Никольской улице между Плазой и Красной площадью — для подписи
  var NIKST = (function () {
    var best = null;
    M.roads.forEach(function (r) {
      if (r.n !== 'Никольская улица') return;
      for (var i = 0; i < r.p.length; i += 2) { var d = Math.hypot(r.p[i] + 120, r.p[i + 1] + 95); if (!best || d < best[2]) best = [r.p[i], r.p[i + 1], d]; }
    });
    return best || [-120, -95];
  })();

  function hit(a, b) { return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]; }
  function area(a, b) { var w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? w * h : 0; }
  var DIRS = [[0, -1], [0.71, -0.71], [1, 0], [0.71, 0.71], [0, 1], [-0.71, 0.71], [-1, 0], [-0.71, -0.71]];

  function build(section, cfg) {
    var pin = section.querySelector('.story__pin'), cv = pin.querySelector('canvas');
    var map = new window.CityMap(cv, { highlight: [M.plaza], landmarks: bidx(['stregis', 'gum', 'cdm']), streets: cfg.streets || [] });
    (window.NIK_MAPS = window.NIK_MAPS || []).push(map);
    var cap = pin.querySelector('.story__cap'), tl = pin.querySelector('.story__tl'), sw = pin.querySelector('.story__switch');
    // шкала глав как у видеоплеера
    tl.innerHTML = '<div class="story__bar"><i></i></div><ol>' + cfg.chapters.map(function (c) {
      return '<li style="left:' + (c.t[0] * 100) + '%;width:' + ((c.t[1] - c.t[0]) * 100) + '%">' + c.k + '</li>';
    }).join('') + '</ol>';
    var fill = tl.querySelector('.story__bar i'), lis = tl.querySelectorAll('li');
    var cards = pin.querySelector('.story__cards');
    var st = { chapter: -1, map: map, cards: {}, res: 0 };

    // карточка места: фото на всю карточку, поверх — название и время
    st.card = function (id, o) {
      if (st.cards[id]) return st.cards[id];
      o = o || {};
      var el = document.createElement('figure'), f = M.foot[id], img = o.img || (PH[id] ? id : null);
      el.className = 'pcard pcard--' + (o.size || 'pin');
      el.innerHTML = (img ? '<img src="places/' + img + '.webp" alt="" loading="lazy" decoding="async">' : '') +
        '<figcaption>' + (o.k ? '<small>' + o.k + '</small>' : '') + '<b>' + (o.name || NAMES[id] || id) + '</b>' +
        '<span>' + (o.sub != null ? o.sub : f ? f.min + ' мин пешком' : '') + '</span></figcaption>';
      cards.appendChild(el); st.cards[id] = el; return el;
    };
    function show(el, x, y, a, sc) {
      el.style.transform = 'translate3d(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px,0) scale(' + (sc || (0.92 + 0.08 * a)).toFixed(3) + ')';
      el.style.opacity = a.toFixed(3); el.style.visibility = a > 0.01 ? 'visible' : 'hidden';
    }
    st.hide = function (el) { show(el, -999, -999, 0); };

    // ---- свободная область: экран минус подпись главы, переключатель, шапка и шкала ----
    function rel(el) { return [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]; }
    function calcSafe() {
      var W = map.W, H = map.H, mob = W < 860, top = mob ? 84 : 76, bot = H - (mob ? 120 : 60);
      var c = cap.offsetHeight ? rel(cap) : null, regs = [];
      if (!c) regs.push([12, top, W - 24, bot - top]);
      else {
        regs.push([c[0] + c[2] + 18, top, W - 14 - (c[0] + c[2] + 18), bot - top]);
        regs.push([12, top, W - 24, c[1] - 14 - top]);
        regs.push([12, c[1] + c[3] + 14, W - 24, bot - c[1] - c[3] - 14]);
      }
      if (sw && sw.offsetHeight) {
        var s = rel(sw);
        regs.forEach(function (r) { if (hit(r, s)) { var nt = s[1] + s[3] + 10; r[3] -= nt - r[1]; r[1] = nt; } });
      }
      var best = null;
      regs.forEach(function (r) { if (r[2] >= 140 && r[3] >= 140 && (!best || r[2] * r[3] > best[2] * best[3])) best = r; });
      return best || [12, top, W - 24, bot - top];
    }
    var sf = { cur: null, from: null, to: null, t0: 0 }, raf = 0;
    function retarget(instant) {
      var t = calcSafe();
      if (!sf.cur || instant || NIK.reduced) { sf.cur = sf.to = t; sf.from = null; return; }
      sf.from = sf.cur.slice(); sf.to = t; sf.t0 = performance.now();
    }
    function safeNow() {
      if (!sf.from) return sf.cur;
      var k = Math.min(1, (performance.now() - sf.t0) / 650); k = k * k * (3 - 2 * k);
      sf.cur = sf.from.map(function (v, i) { return v + (sf.to[i] - v) * k; });
      if (k >= 1) sf.from = null;
      else if (!raf) raf = requestAnimationFrame(function () { raf = 0; render(section._p || 0); });
      return sf.cur;
    }
    // часть свободной области отдаётся под плитки заведений (справа на ноутбуке, сверху на телефоне)
    function split(s) {
      var mob = map.W < 860, res = st.res || 0;
      if (!res) return { focus: s, tiles: null };
      if (!mob && s[2] > s[3]) { var w = Math.min(460, s[2] * 0.52) * res; return { focus: [s[0], s[1], s[2] - w, s[3]], tiles: [s[0] + s[2] - w, s[1], w, s[3]] }; }
      var h = Math.min(280, s[3] * 0.58) * res; return { focus: [s[0], s[1] + h, s[2], s[3] - h], tiles: [s[0], s[1], s[2], h] };
    }
    function applySafe() {
      var s = safeNow(), sp = split(s), f = sp.focus, m = map, W = m.W, H = m.H, tl = Math.sin(m.cam.t || 0);
      m.cam.sx = f[0] + f[2] / 2 - W / 2;
      m.cam.sy = f[1] + f[3] / 2 + f[3] * 0.14 * tl - H / 2 - H * 0.16 * tl;
      m.cam.z *= Math.min(1, Math.max(0.5, Math.min(f[2] / W, f[3] / H) * 1.3));
      m.block = cap.offsetHeight ? [rel(cap)] : [];
      st.safe = s; st.focus = f; st.tiles = sp.tiles;
    }

    // экранные точки нарисованных маршрутов — карточки их не закрывают
    function routePts() {
      var out = [];
      map.routes.forEach(function (rt) {
        if (!(rt.p > 0) || rt.a === 0) return;
        var step = Math.max(8, 14 / Math.max(0.3, map.cam.z)), n = Math.ceil(rt.len * rt.p / step);
        for (var i = 0; i <= n; i++) { var q = map.pointAt(rt, Math.min(rt.p, i * step / rt.len)), s = map.project(q[0], q[1], 0); if (s) out.push(s); }
      });
      return out;
    }
    // раскладка карточек у мест: перебираем 8 сторон, штраф за маршрут, за выход из свободной области, за соседей
    st.layout = function (items, obst) {
      var pts = routePts(), S = st.safe, placed = (obst || []).slice(), ctx = map.ctx;
      ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
      items.forEach(function (it) {
        var el = it.el, a = it.a;
        var p = a > 0.01 ? map.project(it.x, it.y, it.h || 0) : null;
        if (!p) { st.hide(el); return; }
        var w = el.offsetWidth || 160, h = el.offsetHeight || 120, pref = [0, -1];
        if (it.from) { var q = map.project(it.from[0], it.from[1], 0); if (q) { var dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy); if (d > 2) pref = [dx / d, dy / d]; } }
        var best = null;
        DIRS.forEach(function (dv, di) {
          var ex = Math.abs(dv[0]) * w / 2 + Math.abs(dv[1]) * h / 2 + 16;
          var r = [p[0] + dv[0] * ex - w / 2, p[1] + dv[1] * ex - h / 2, w, h], cost = 0;
          for (var i = 0; i < pts.length; i++) if (pts[i][0] > r[0] - 6 && pts[i][0] < r[0] + w + 6 && pts[i][1] > r[1] - 6 && pts[i][1] < r[1] + h + 6) cost += 4;
          cost += (w * h - area(r, S)) / 400;
          placed.forEach(function (o) { cost += area(r, o) / 150; });
          cost += (1 - (dv[0] * pref[0] + dv[1] * pref[1])) * 3;
          if (el._d === di) cost -= 3;
          if (!best || cost < best.c) best = { c: cost, r: r, d: di };
        });
        el._d = best.d;
        var r = best.r;
        r[0] = Math.max(S[0], Math.min(S[0] + S[2] - w, r[0])); r[1] = Math.max(S[1], Math.min(S[1] + S[3] - h, r[1]));
        placed.push(r);
        show(el, r[0], r[1], a);
        // ножка от места к карточке
        var cx = Math.max(r[0], Math.min(r[0] + w, p[0])), cy = Math.max(r[1], Math.min(r[1] + h, p[1]));
        ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(242,195,154,.75)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.fillStyle = '#f2c39a'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      });
      return placed;
    };
    // плитки заведений в отведённой части экрана, с линией к зданию
    st.tilesAt = function (list, anchor) {
      var R = st.tiles, ctx = map.ctx;
      if (!R || R[2] < 60 || R[3] < 60) { list.forEach(function (t) { st.hide(t.el); }); return; }
      var g = 10, cols = 2, rows = Math.ceil(list.length / cols), tw = (R[2] - g) / cols, th = Math.min((R[3] - g * (rows - 1)) / rows, tw * 0.78);
      var y0 = R[1] + (R[3] - (th * rows + g * (rows - 1))) / 2;
      list.forEach(function (t, i) {
        t.el.style.width = tw.toFixed(0) + 'px'; t.el.style.height = th.toFixed(0) + 'px';
        show(t.el, R[0] + (i % cols) * (tw + g), y0 + Math.floor(i / cols) * (th + g), t.a, 0.94 + 0.06 * t.a);
      });
      var p = anchor && map.project(anchor.x, anchor.y, anchor.h || 0), a = Math.min.apply(null, list.map(function (t) { return t.a; }));
      if (p && a > 0.05) {
        var bx = Math.max(R[0], Math.min(R[0] + R[2], p[0])), by = Math.max(y0, Math.min(y0 + th * rows + g * (rows - 1), p[1]));
        ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0); ctx.globalAlpha = a; ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(242,195,154,.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(bx, by); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    };

    cfg.setup(st);
    function render(p) {
      var ch = 0; cfg.chapters.forEach(function (c, i) { if (p >= c.t[0]) ch = i; });
      if (ch !== st.chapter) {
        st.chapter = ch; var c = cfg.chapters[ch];
        lis.forEach(function (li, i) { li.classList.toggle('on', i === ch); li.classList.toggle('done', i < ch); });
        cap.classList.remove('in'); void cap.offsetWidth;
        cap.innerHTML = '<span class="story__k">' + c.k + '</span><h2>' + c.h + '</h2><p>' + c.p + '</p>' + (c.extra || '');
        cap.classList.add('in');
        retarget(false);
      }
      cfg.frame(p, st);
      applySafe();
      map.draw();
      if (cfg.after) cfg.after(p, st);
      fill.style.transform = 'scaleX(' + Math.max(0.001, p) + ')';
    }
    st.render = render;
    NIK.scene(section.dataset.scene, render);
    window.addEventListener('resize', function () { retarget(true); render(section._p || 0); });
    render(NIK.reduced ? 1 : 0);
    retarget(true); render(section._p || (NIK.reduced ? 1 : 0));
    return st;
  }
  NIK.buildStory = build;

  // Камера едет за головой маршрута, наклонена и повёрнута по ходу движения
  function follow(st, rt, q, z0, z1, tilt) {
    var m = st.map, h = m.pointAt(rt, q);
    m.cam.x = h[0]; m.cam.y = h[1]; m.cam.z = lz(z0, z1, q);
    m.cam.r = m.headingAt(rt, Math.max(0, q - 0.02), 160); m.cam.t = tilt;
  }
  NIK.follow = follow;
  function zoomFit() { var w = Math.min(window.innerWidth, 1400); return w < 700 ? 0.28 : 0.42; }

  // подписи на зданиях
  function tags(extra) {
    var t = [
      { id: 'plaza', x: PLAZA.x, y: PLAZA.y, h: PLAZA.h, label: 'Никольская Плаза', tag: 'main', sub: 'мойка в паркинге' },
      LM.stregis && { id: 'stregis', x: LM.stregis.x, y: LM.stregis.y, h: LM.stregis.h, label: 'The St. Regis', tag: 'bld', minZ: 0.5 },
      LM.cdm && { id: 'cdm', x: LM.cdm.x, y: LM.cdm.y, h: LM.cdm.h, label: 'ЦДМ', tag: 'bld', minZ: 0.3 },
      LM.gum && { id: 'gum', x: LM.gum.x, y: LM.gum.y, h: LM.gum.h, label: 'ГУМ', tag: 'bld' },
      { id: 'red', x: M.places.red[0], y: M.places.red[1], h: 0, label: 'Красная площадь', tag: 'bld' },
      { id: 'nik', x: NIKST[0], y: NIKST[1], h: 0, label: 'Никольская улица', tag: 'bld', minZ: 0.45 }
    ].filter(Boolean);
    return t.concat(extra || []);
  }
  function mark(st, id) { for (var i = 0; i < st.map.marks.length; i++) if (st.map.marks[i].id === id) return st.map.marks[i]; return {}; }
  // заведения внутри Плазы — плитки с фото
  var VENUES = [
    { id: 'v-food', img: 'vokrug', k: 'Еда', name: '«Вокруг Света»', sub: 'гастрозона, кухни разных стран' },
    { id: 'v-shop', img: 'shop', k: 'Шопинг', name: 'Бутики', sub: 'одежда, часы, украшения' },
    { id: 'v-beauty', img: 'beauty', k: 'Красота', name: 'Салоны', sub: 'укладка, маникюр, барбер' },
    { id: 'v-fit', img: 'fit', k: 'Спорт', name: 'MOSFITNESS', sub: 'тренировка, пока моем' }
  ];
  NIK.VENUES = VENUES;

  // ---------- Главная: от Кремля до паркинга, Плаза и прогулки ----------
  var home = document.querySelector('[data-scene="story"]');
  if (home) build(home, {
    streets: [{ name: 'Никольская улица', a: 0 }],
    chapters: [
      { t: [0, 0.16], k: 'Где мы', h: '300 метров от Кремля', p: 'Мойка — в паркинге Никольской Плазы.' },
      { t: [0.16, 0.5], k: 'Как заехать', h: 'С Большого Черкасского', p: 'От Лубянской площади — ' + M.car.lubyanka.m + ' м.' },
      { t: [0.5, 0.64], k: 'Въезд', h: 'Во двор Плазы — и вниз', p: 'Парковка на время мойки бесплатная.' },
      { t: [0.64, 0.82], k: 'Пока мы моем', h: 'А вы — в Плазе', p: 'Еда, шопинг, красота и спорт — в том же здании.', extra: '<a class="btn btn--copper btn--sm" href="park.html#plaza">Что есть в Плазе</a>' },
      { t: [0.82, 1], k: 'Прогулка', h: 'Или — гулять', p: 'ЦДМ — ' + M.foot.cdm.min + ' мин, ГУМ — ' + M.foot.gum.min + ', Красная площадь — ' + M.foot.red.min + '.', extra: '<a class="btn btn--copper btn--sm" href="park.html#calc">Составить маршрут</a>' }
    ],
    setup: function (st) {
      st.car = st.map.addRoute(M.car.lubyanka.p, { w: 4, color: '#c9875a' });
      st.walks = ['cdm', 'gum', 'red'].map(function (id) { return { id: id, rt: st.map.addRoute(M.foot[id].p, { w: 2.5, dash: [2, 7], color: 'rgba(242,195,154,.85)' }) }; });
      st.map.marks = tags([
        { id: 'turn', x: M.turn[0], y: M.turn[1], label: 'Поворот', a: 0, side: 'l' },
        { id: 'ent', x: M.entrance[0], y: M.entrance[1], label: 'Въезд в паркинг', a: 0, hi: true }
      ]);
    },
    frame: function (p, st) {
      var m = st.map, z = zoomFit(), zNear = small() ? 3 : 3.8;
      var mx = M.places.red[0] / 2, my = M.places.red[1] / 2;
      st.car.p = ease(seg(p, 0.18, 0.48));
      st.res = 0;
      if (p < 0.16) { var k = ease(seg(p, 0, 0.16)); m.cam.x = mx; m.cam.y = my; m.cam.z = z * (0.85 + 0.25 * k); m.cam.r = 0; m.cam.t = 0.45 * k; }
      else if (p < 0.5) {
        var q = seg(p, 0.16, 0.48), s0 = M.car.lubyanka.p;
        if (q < 0.1) { var t = ease(q / 0.1); m.cam.x = lerp(mx, s0[0], t); m.cam.y = lerp(my, s0[1], t); m.cam.z = lz(z * 1.1, 1.0, t); m.cam.t = lerp(0.45, 0.95, t); m.cam.r = ang(0, m.headingAt(st.car, 0, 160), t); }
        else follow(st, st.car, ease(seg(q, 0.1, 1)), 1.0, 1.8, 0.95);
      } else if (p < 0.64) {
        var k2 = ease(seg(p, 0.5, 0.6)), end = m.pointAt(st.car, 1), hd = m.headingAt(st.car, 0.97, 160);
        var cx = (M.turn[0] + M.entrance[0]) / 2, cy = (M.turn[1] + M.entrance[1]) / 2;
        m.cam.x = lerp(end[0], cx, k2); m.cam.y = lerp(end[1], cy, k2); m.cam.z = lz(1.8, zNear, k2); m.cam.t = 0.95 + 0.1 * k2; m.cam.r = ang(hd, hd - 0.5, k2);
      } else {
        // Плаза крупно, рядом плитки заведений; затем отъезд к прогулкам
        var a = ease(seg(p, 0.64, 0.72)), b = ease(seg(p, 0.82, 0.9)), hd2 = m.headingAt(st.car, 0.97, 160) - 0.5;
        st.res = ease(seg(p, 0.66, 0.72)) * (1 - ease(seg(p, 0.81, 0.85)));
        var px = lerp(M.entrance[0], PLAZA.x, a), py = lerp(M.entrance[1], PLAZA.y, a);
        m.cam.x = lerp(px, small() ? -40 : -60, b); m.cam.y = lerp(py, small() ? -150 : -170, b);
        m.cam.z = lz(lz(zNear, small() ? 2.6 : 3.2, a), z * (small() ? 1.15 : 1.45), b);
        m.cam.t = lerp(lerp(1.05, 0.85, a), 0.55, b);
        m.cam.r = ang(hd2 - 0.5 * seg(p, 0.64, 0.82), 0, b);
      }
      var near = seg(p, 0.5, 0.56) * (1 - seg(p, 0.64, 0.68));
      mark(st, 'turn').a = near; mark(st, 'ent').a = near;
      st.walks.forEach(function (w, i) { w.rt.p = ease(seg(p, 0.86 + i * 0.025, 0.93 + i * 0.025)); });
      m.streets[0].a = seg(p, 0.84, 0.88);
      // подписи: у Плазы — только Плаза; на прогулке места подписаны карточками
      var calm = p > 0.64;
      m.marks.forEach(function (mk) { if (mk.tag && mk.id !== 'plaza') mk.a = calm ? 0 : 1; });
    },
    after: function (p, st) {
      VENUES.forEach(function (v) { st.card(v.id, { size: 'tile', img: v.img, k: v.k, name: v.name, sub: v.sub }); });
      st.tilesAt(VENUES.map(function (v, i) { return { el: st.cards[v.id], a: seg(p, 0.68 + i * 0.012, 0.72 + i * 0.012) * (1 - seg(p, 0.8, 0.83)) }; }), { x: PLAZA.x, y: PLAZA.y, h: PLAZA.h });
      var plazaTag = (function () { var q = st.map.project(PLAZA.x, PLAZA.y, PLAZA.h); return q ? [q[0] - 120, q[1] - 70, 240, 64] : null; })();
      var items = st.walks.map(function (w, i) {
        var f = M.foot[w.id].p, n = f.length, back = st.map.pointAt(w.rt, Math.max(0, 1 - 60 / w.rt.len));
        return { el: st.card(w.id), x: f[n - 2], y: f[n - 1], from: back, a: seg(p, 0.9 + i * 0.025, 0.93 + i * 0.025) };
      });
      items.push({ el: st.card('nikst', { img: 'nikst', name: 'Никольская улица', sub: 'у входа в Плазу' }), x: NIKST[0], y: NIKST[1], from: [PLAZA.x, PLAZA.y], a: seg(p, 0.86, 0.89) });
      st.layout(items, plazaTag ? [plazaTag] : []);
    }
  });

  // ---------- Как добраться: подъезд к паркингу ----------
  var app = document.querySelector('[data-scene="approach"]');
  if (app) {
    var from = 'lubyanka';
    var st2 = build(app, {
      chapters: [
        { t: [0, 0.18], k: 'Район', h: 'Никольская, 10', p: 'Мойка — в паркинге Никольской Плазы. С Никольской улицы заезда нет: она пешеходная.' },
        { t: [0.18, 0.6], k: 'Подъезд', h: 'К Большому Черкасскому', p: '' },
        { t: [0.6, 0.82], k: 'Поворот', h: 'Поворот к въезду', p: 'Из переулка — во двор Плазы.' },
        { t: [0.82, 1], k: 'Паркинг', h: 'Спуск в паркинг', p: 'Парковка на время мойки бесплатная. Выезд — на Лубянскую площадь.' }
      ],
      setup: function (st) {
        st.routes = {
          lubyanka: st.map.addRoute(M.car.lubyanka.p, { w: 5, color: '#c9875a' }),
          ilyinka: st.map.addRoute(M.car.ilyinka.p, { w: 5, color: '#c9875a' })
        };
        st.map.marks = tags([
          { id: 'turn', x: M.turn[0], y: M.turn[1], label: 'Поворот', a: 0, side: 'l' },
          { id: 'ent', x: M.entrance[0], y: M.entrance[1], label: 'Въезд в паркинг', a: 0, hi: true }
        ]);
      },
      frame: function (p, st) {
        var m = st.map, rt = st.routes[from], other = st.routes[from === 'lubyanka' ? 'ilyinka' : 'lubyanka'], z = zoomFit() * 1.3;
        other.p = 0;
        var ch = this.chapters; ch[1].p = (from === 'lubyanka' ? 'От Лубянской площади — ' + M.car.lubyanka.m + ' м.' : 'С Ильинки — ' + M.car.ilyinka.m + ' м.');
        rt.p = ease(seg(p, 0.2, 0.58));
        if (p < 0.18) { var k = ease(seg(p, 0, 0.18)); m.cam.x = 40; m.cam.y = -60; m.cam.z = z * (0.9 + 0.3 * k); m.cam.r = 0; m.cam.t = 0.5 * k; }
        else if (p < 0.6) {
          var q = seg(p, 0.18, 0.58), s0 = rt.pts;
          if (q < 0.1) { var t = ease(q / 0.1); m.cam.x = lerp(40, s0[0], t); m.cam.y = lerp(-60, s0[1], t); m.cam.z = lz(z * 1.2, 1.1, t); m.cam.t = lerp(0.5, 0.95, t); m.cam.r = ang(0, m.headingAt(rt, 0, 160), t); }
          else follow(st, rt, ease(seg(q, 0.1, 1)), 1.1, 2, 0.95);
        } else {
          var k2 = ease(seg(p, 0.6, 0.72)), k3 = ease(seg(p, 0.82, 0.92)), end = m.pointAt(rt, 1), hd = m.headingAt(rt, 0.97, 160);
          var ax = lerp(end[0], M.turn[0], k2), ay = lerp(end[1], M.turn[1], k2);
          m.cam.x = lerp(ax, M.entrance[0], k3); m.cam.y = lerp(ay, M.entrance[1], k3);
          m.cam.z = lz(2, small() ? 3.6 : 4.6, k2); m.cam.t = 0.95 + 0.12 * k2; m.cam.r = ang(hd, hd - 0.7, k3);
        }
        mark(st, 'turn').a = seg(p, 0.58, 0.64); mark(st, 'ent').a = seg(p, 0.6, 0.66);
      }
    });
    document.querySelectorAll('[data-from]').forEach(function (b) {
      b.addEventListener('click', function () {
        from = b.dataset.from;
        document.querySelectorAll('[data-from]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        st2.chapter = -1; NIK.sceneTick(); app._p = -1; NIK.sceneTick();
      });
    });
  }
})();
