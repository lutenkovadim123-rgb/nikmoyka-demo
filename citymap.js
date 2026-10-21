/* Медная карта района по данным OpenStreetMap: здания, улицы, парки, стена Кремля, маршруты.
   Камера в метрах от мойки: x — восток, y — север. cam.t — наклон (0 — сверху, ~1 — «3D» вид),
   cam.r — поворот. Здания с наклоном становятся объёмными по этажности из OSM.
   Используется на главной, в «Пока мы моем» и в «Как добраться». */
(function () {
  'use strict';
  var M = window.NIK_MAP; if (!M) return;
  var COL = {
    bg: '#0d0a08', bld: '#1c1510', bldEdge: 'rgba(201,135,90,.22)', bldHi: 'rgba(201,135,90,.55)',
    park: 'rgba(92,110,72,.18)', parkEdge: 'rgba(140,160,110,.25)', square: 'rgba(201,135,90,.07)', water: '#0f1418',
    road: '#241d18', roadMain: '#30281f', foot: '#1a1512', label: 'rgba(239,233,226,.86)', wall: 'rgba(196,92,70,.55)',
    route: '#f2c39a', car: '#c9875a'
  };
  var MAIN = { primary: 1, secondary: 1, tertiary: 1, trunk: 1 };
  var WIDTH = { primary: 14, trunk: 16, secondary: 12, tertiary: 10, residential: 7, unclassified: 6, living_street: 6, service: 4, pedestrian: 8, footway: 2.5, path: 2, steps: 2 };
  var MINOR = { footway: 1, steps: 1, path: 1, service: 1 };
  var NAMED = { residential: 1, pedestrian: 1, living_street: 1, unclassified: 1 };
  // стены зданий: тон по стороне света (свет с северо-запада), 4 ступени
  var WALL = ['#1d1611', '#261d16', '#30251c', '#3b2d22'], WALL_HI = ['#4a2d1a', '#5e3a22', '#73482a', '#8a5732'], WALL_LM = ['#2a2019', '#352920', '#413228', '#4e3c30'];
  var ROOF = '#211912', ROOF_HI = 'rgba(201,135,90,.42)', ROOF_LM = '#33271e';
  var LX = -0.6, LY = 0.8;

  // ориентация колец зданий — один раз
  M.bld.forEach(function (b) {
    var p = b.p, a = 0, cx = 0, cy = 0, n = p.length / 2;
    for (var i = 0; i < n; i++) { var j = (i + 1) % n; a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; cx += p[i * 2]; cy += p[i * 2 + 1]; }
    b.ccw = a > 0; b.cx = cx / n; b.cy = cy / n;
  });

  function CityMap(canvas, opts) {
    opts = opts || {};
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, z: 0.6, r: 0, t: 0 };   // z — пикселей на метр в точке прицела
    this.fov = 0.72;
    this.hk = opts.hk || 1;                          // множитель высоты зданий
    this.routes = [];                                // {pts:[x,y,...], p:0..1, color, w, dash}
    this.marks = [];                                 // {x,y,h,label,hi,tag,a,maxZ,minZ,size}
    this.highlight = opts.highlight || [];           // индексы зданий: медная подсветка
    this.lm = opts.landmarks || [];                  // индексы зданий: светлее соседей
    this.streets = opts.streets || [];               // {name, a, color} — подсвеченная улица
    this.labels = opts.labels !== false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var self = this;
    this.resize = function () {
      var r = canvas.getBoundingClientRect();
      self.W = r.width; self.H = r.height;
      canvas.width = Math.max(2, Math.round(r.width * self.dpr)); canvas.height = Math.max(2, Math.round(r.height * self.dpr));
      self.draw();
    };
    window.addEventListener('resize', this.resize);
    this.resize();
  }
  // параметры камеры на кадр
  CityMap.prototype.setup = function () {
    var c = this.cam;
    this.cs = Math.cos(c.r); this.sn = Math.sin(c.r);
    this.st = Math.sin(c.t || 0); this.ct = Math.cos(c.t || 0);
    this.F = (this.H / 2) / Math.tan(this.fov / 2);
    this.D = this.F / c.z;
    this.oy = this.H * 0.16 * this.st;              // прицел ниже центра, когда камера наклонена
    this.flat = !(c.t > 0.02);
    // точка прицела на экране: центр свободной от плашек области (cam.sx, cam.sy — сдвиг в пикселях)
    this.px = this.W / 2 + (c.sx || 0); this.py = this.H / 2 + this.oy + (c.sy || 0);
    // положение камеры в плоскости карты — для выбора видимых стен
    this.camX = c.x - this.D * this.st * this.sn; this.camY = c.y - this.D * this.st * this.cs;
    // видимая полоса земли вдоль взгляда: от нижнего края экрана до верхнего (или до «тумана» у горизонта)
    var hb = this.H - this.py, ht = this.py;
    if (this.flat) { this.vB = -hb / c.z; this.vT = ht / c.z; }
    else {
      this.vB = -hb * this.D / (this.F * this.ct + hb * this.st);
      var den = this.F * this.ct - ht * this.st;
      this.vT = den > 0 ? Math.min(ht * this.D / den, this.D * 1.45) : this.D * 1.45;
    }
  };
  // быстрая проверка видимости по описанной окружности объекта
  CityMap.prototype.inView = function (o, extra) {
    var q = o._c;
    if (!q) { var b = o.bb; q = o._c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.hypot(b[2] - b[0], b[3] - b[1]) / 2]; }
    var c = this.cam, dx = q[0] - c.x, dy = q[1] - c.y, u = dx * this.cs - dy * this.sn, v = dx * this.sn + dy * this.cs, r = q[2] + (extra || 0);
    if (v + r < this.vB || v - r > this.vT) return false;
    var dd = this.D + Math.max(this.vB, v) * this.st, hx = Math.max(this.px, this.W - this.px) + 60, hw = this.flat ? hx / c.z : hx * dd / this.F;
    if (Math.abs(u) > hw + r) return false;
    this._k = this.flat ? c.z : this.F / Math.max(1, this.D + v * this.st);   // масштаб в этой точке, px/м
    return true;
  };
  // мир (x, y, h) → экран [sx, sy, масштаб px/м] или null, если точка за камерой
  CityMap.prototype.project = function (x, y, h) {
    if (this.F === undefined) this.setup();
    var c = this.cam, dx = x - c.x, dy = y - c.y, u = dx * this.cs - dy * this.sn, v = dx * this.sn + dy * this.cs;
    if (this.flat && !h) return [this.px + u * c.z, this.py - v * c.z, c.z];
    h = (h || 0) * this.hk;
    var d = this.D + v * this.st - h * this.ct;
    if (d < this.D * 0.06) return null;
    var k = this.F / d;
    return [this.px + u * k, this.py - (v * this.ct + h * this.st) * k, k];
  };
  // ломаная/полигон; у ломаной точки за камерой дают разрыв, полигон пропускается целиком
  CityMap.prototype.path = function (flat, close, h, target) {
    var ctx = target || this.ctx, pen = false;
    for (var i = 0; i < flat.length; i += 2) {
      var p = this.project(flat[i], flat[i + 1], h);
      if (!p) { if (close) return false; pen = false; continue; }
      if (pen) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); pen = true; }
    }
    if (close) ctx.closePath();
    return true;
  };
  CityMap.prototype.visible = function (bb, h, o) {
    if (o) return this.inView(o, h ? h * this.st : 0);
    // bb: [minx,miny,maxx,maxy] в метрах — проекция углов и пересечение с экраном
    var W = this.W, H = this.H, m = 60, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
    var pts = [bb[0], bb[1], bb[2], bb[1], bb[2], bb[3], bb[0], bb[3]];
    for (var i = 0; i < 8; i += 2) {
      for (var k = 0; k < (h ? 2 : 1); k++) {
        var p = this.project(pts[i], pts[i + 1], k ? h : 0);
        if (!p) continue; any = true;
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      }
    }
    if (!any) return false;
    return !(x1 < -m || x0 > W + m || y1 < -m || y0 > H + m);
  };
  CityMap.prototype.scaleAt = function (x, y) { var p = this.project(x, y, 0); return p ? p[2] : this.cam.z; };

  CityMap.prototype.draw = function () {
    var ctx = this.ctx, self = this;
    this.setup();
    var z = this.cam.z, flat = this.flat;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, this.W, this.H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // вода, парки, площади
    [['water', COL.water, null], ['parks', COL.park, COL.parkEdge], ['squares', COL.square, null]].forEach(function (L) {
      (M[L[0]] || []).forEach(function (poly) {
        if (!self.visible(poly.bb, 0, poly)) return;
        ctx.beginPath(); if (!self.path(poly.p, true)) return; ctx.fillStyle = L[1]; ctx.fill();
        if (L[2]) { ctx.strokeStyle = L[2]; ctx.lineWidth = 1; ctx.stroke(); }
      });
    });
    // улицы
    var hiStreet = {}; this.streets.forEach(function (s) { hiStreet[s.name] = s; });
    var roadsOn = [], buckets = {};
    M.roads.forEach(function (r) {
      if (MINOR[r.c] && z < (r.c === 'service' ? 0.7 : 1.4)) return;
      if (!self.visible(r.bb, 0, r)) return;
      if (!flat && !MAIN[r.c] && self._k < z * 0.42) return;              // мелкие улицы вдали не рисуем
      var s = flat ? z : self._k;
      // улицы одного цвета и близкой толщины — одним штрихом (тысячи вызовов → десятки)
      var col = MAIN[r.c] ? COL.roadMain : (MINOR[r.c] && r.c !== 'service' ? COL.foot : COL.road);
      var lw = Math.max(0.6, Math.round((WIDTH[r.c] || 3) * s * 2) / 2), key = col + lw;
      var bk = buckets[key] || (buckets[key] = { p: new Path2D(), c: col, w: lw });
      self.path(r.p, false, 0, bk.p);
      roadsOn.push(r);
    });
    Object.keys(buckets).forEach(function (k) { var bk = buckets[k]; ctx.strokeStyle = bk.c; ctx.lineWidth = bk.w; ctx.stroke(bk.p); });
    // подсвеченные улицы (например, Никольская)
    roadsOn.forEach(function (r) {
      var hs = r.n && hiStreet[r.n]; if (!hs || !(hs.a > 0)) return;
      var s = flat ? z : self.scaleAt((r.bb[0] + r.bb[2]) / 2, (r.bb[1] + r.bb[3]) / 2);
      ctx.globalAlpha = hs.a;
      ctx.beginPath(); self.path(r.p, false); ctx.strokeStyle = 'rgba(242,195,154,.16)'; ctx.lineWidth = (WIDTH[r.c] || 6) * s + 10; ctx.stroke();
      ctx.beginPath(); self.path(r.p, false); ctx.strokeStyle = hs.color || 'rgba(242,195,154,.7)'; ctx.lineWidth = Math.max(1.5, (WIDTH[r.c] || 6) * s * 0.55); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // стена Кремля
    (M.wall || []).forEach(function (w) {
      if (!self.visible(w.bb, 0, w)) return;
      ctx.beginPath(); self.path(w.p, false); ctx.strokeStyle = COL.wall; ctx.lineWidth = Math.max(1.5, 6 * (flat ? z : self.scaleAt(w.bb[0], w.bb[1]))); ctx.stroke();
    });
    // маршруты по земле (под зданиями)
    this.routes.forEach(function (rt) { self.drawRoute(rt, 1); });
    // здания
    var hi = {}, lm = {}; this.highlight.forEach(function (i) { hi[i] = 1; }); this.lm.forEach(function (i) { lm[i] = 1; });
    if (flat) {
      ctx.lineWidth = 0.8;
      M.bld.forEach(function (b, i) {
        if (!self.visible(b.bb, 0, b)) return;
        ctx.beginPath(); self.path(b.p, true);
        ctx.fillStyle = hi[i] ? 'rgba(201,135,90,.28)' : lm[i] ? ROOF_LM : COL.bld; ctx.fill();
        ctx.strokeStyle = hi[i] ? COL.bldHi : COL.bldEdge; ctx.stroke();
      });
    } else this.drawBuildings(hi, lm);
    // маршруты поверх зданий — полупрозрачно, чтобы путь читался за домами
    if (!flat) this.routes.forEach(function (rt) { self.drawRoute(rt, 0.35); });
    this.routes.forEach(function (rt) { self.drawHead(rt); });
    // подписи улиц
    // метки и подписи зданий (раньше подписей улиц — у них приоритет)
    this.labelBoxes = (this.block || []).slice();
    this.drawMarks();
    if (this.labels && z > 0.3) this.drawStreetLabels(roadsOn);
    // виньетка; при наклоне — дымка у горизонта
    if (!this._vg || this._vgW !== this.W || this._vgH !== this.H) {
      this._vg = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.hypot(this.W, this.H) * 0.62);
      this._vg.addColorStop(0, 'rgba(10,8,7,0)'); this._vg.addColorStop(1, 'rgba(10,8,7,.85)'); this._vgW = this.W; this._vgH = this.H;
    }
    ctx.fillStyle = this._vg; ctx.fillRect(0, 0, this.W, this.H);
    if (!flat) {
      var hz = ctx.createLinearGradient(0, 0, 0, this.H * 0.45);
      hz.addColorStop(0, 'rgba(13,10,8,' + (0.95 * this.st).toFixed(3) + ')'); hz.addColorStop(1, 'rgba(13,10,8,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, 0, this.W, this.H * 0.45);
    }
  };

  CityMap.prototype.drawBuildings = function (hi, lm) {
    var ctx = this.ctx, self = this, list = [];
    M.bld.forEach(function (b, i) {
      var h = (b.h || 10);
      if (!self.visible(b.bb, h, b)) return;
      if (b._c[2] * self._k < 3) return;                               // слишком мелко вдали
      var dx = b.cx - self.camX, dy = b.cy - self.camY;
      list.push({ b: b, i: i, h: h, d: dx * dx + dy * dy });
    });
    list.sort(function (a, b) { return b.d - a.d; });
    // дальние дома рисуем группами (стены четырёх тонов + крыши одним вызовом), ближние — по одному
    var batch = null, bn = 0, zNear = this.cam.z * 0.55;
    function flush() {
      if (!batch) return;
      for (var s = 0; s < 4; s++) { ctx.fillStyle = WALL[s]; ctx.fill(batch.w[s]); }
      ctx.fillStyle = ROOF; ctx.fill(batch.r); ctx.strokeStyle = 'rgba(201,135,90,.16)'; ctx.lineWidth = 0.6; ctx.stroke(batch.r);
      batch = null; bn = 0;
    }
    list.forEach(function (o) {
      var far = !hi[o.i] && !lm[o.i] && self.scaleAt(o.b.cx, o.b.cy) < zNear;
      if (!far) flush();
      var b = o.b, p = b.p, n = p.length / 2, base = [], top = [], ok = true;
      for (var i = 0; i < n; i++) {
        var a = self.project(p[i * 2], p[i * 2 + 1], 0), t = self.project(p[i * 2], p[i * 2 + 1], o.h);
        if (!a || !t) { ok = false; break; }
        base.push(a); top.push(t);
      }
      if (!ok) return;
      var pal = hi[o.i] ? WALL_HI : lm[o.i] ? WALL_LM : WALL;
      var lv = [[], [], [], []], tgt = null;
      if (far) { if (!batch) batch = { w: [new Path2D(), new Path2D(), new Path2D(), new Path2D()], r: new Path2D() }; tgt = batch; }
      for (var e = 0; e < n; e++) {
        var f = (e + 1) % n, ex = p[f * 2] - p[e * 2], ey = p[f * 2 + 1] - p[e * 2 + 1];
        var nx = b.ccw ? ey : -ey, ny = b.ccw ? -ex : ex;                 // внешняя нормаль
        var mx = (p[e * 2] + p[f * 2]) / 2 - self.camX, my = (p[e * 2 + 1] + p[f * 2 + 1]) / 2 - self.camY;
        if (nx * -mx + ny * -my <= 0) continue;                         // стена смотрит от камеры
        var L = Math.hypot(nx, ny) || 1, sh = (nx * LX + ny * LY) / L;  // -1..1
        lv[Math.max(0, Math.min(3, Math.floor((sh + 1) * 2)))].push(e);
      }
      for (var s = 0; s < 4; s++) {
        if (!lv[s].length) continue;
        var w = tgt ? tgt.w[s] : ctx;
        if (!tgt) ctx.beginPath();
        lv[s].forEach(function (e) {
          var f = (e + 1) % n;
          w.moveTo(base[e][0], base[e][1]); w.lineTo(base[f][0], base[f][1]); w.lineTo(top[f][0], top[f][1]); w.lineTo(top[e][0], top[e][1]); w.closePath();
        });
        if (!tgt) { ctx.fillStyle = pal[s]; ctx.fill(); }
      }
      var rf = tgt ? tgt.r : ctx;
      if (!tgt) ctx.beginPath();
      rf.moveTo(top[0][0], top[0][1]);
      for (var k = 1; k < n; k++) rf.lineTo(top[k][0], top[k][1]);
      rf.closePath();
      if (tgt) { if (++bn >= 50) flush(); return; }
      ctx.fillStyle = hi[o.i] ? '#7a4a2c' : lm[o.i] ? ROOF_LM : ROOF; ctx.fill();
      ctx.strokeStyle = hi[o.i] ? 'rgba(242,195,154,.9)' : lm[o.i] ? 'rgba(239,233,226,.32)' : 'rgba(201,135,90,.2)'; ctx.lineWidth = hi[o.i] ? 1.4 : 0.7; ctx.stroke();
    });
    flush();
  };

  CityMap.prototype.routePath = function (rt) {
    var pts = rt.pts, n = pts.length / 2, upto = rt.len * rt.p, acc = 0, ctx = this.ctx, pen = false, head = null;
    ctx.beginPath();
    function put(x, y) { var q = this.project(x, y, 0.5); if (!q) { pen = false; return; } if (pen) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); pen = true; } head = q; }
    put.call(this, pts[0], pts[1]);
    for (var i = 1; i < n; i++) {
      var seg = rt.seg[i - 1];
      if (acc + seg >= upto) { var t = (upto - acc) / (seg || 1); put.call(this, pts[i * 2 - 2] + (pts[i * 2] - pts[i * 2 - 2]) * t, pts[i * 2 - 1] + (pts[i * 2 + 1] - pts[i * 2 - 1]) * t); break; }
      acc += seg; put.call(this, pts[i * 2], pts[i * 2 + 1]);
    }
    return head;
  };
  CityMap.prototype.drawRoute = function (rt, alpha) {
    if (rt.p <= 0) return;
    var ctx = this.ctx, k = this.flat ? 1 : Math.min(1.6, Math.max(0.7, this.scaleAt(this.cam.x, this.cam.y) / this.cam.z));
    rt.head = this.routePath(rt);
    ctx.globalAlpha = alpha * (rt.a == null ? 1 : rt.a);
    ctx.strokeStyle = 'rgba(242,195,154,.18)'; ctx.lineWidth = ((rt.w || 4) + 8) * k; ctx.setLineDash([]); ctx.stroke();
    ctx.strokeStyle = rt.color || COL.route; ctx.lineWidth = (rt.w || 4) * k; ctx.setLineDash(rt.dash || []); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  CityMap.prototype.drawHead = function (rt) {
    var head = rt.head; if (rt.p <= 0 || !head || rt.p >= 1 && rt.noEnd) return;
    var ctx = this.ctx, a = rt.a == null ? 1 : rt.a; if (a <= 0) return;
    ctx.globalAlpha = a;
    var g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 18);
    g.addColorStop(0, 'rgba(255,226,196,.95)'); g.addColorStop(1, 'rgba(255,226,196,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head[0], head[1], 18, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  };

  CityMap.prototype.free = function (x, y, w, h) {
    var b = this.labelBoxes;
    for (var i = 0; i < b.length; i++) if (x < b[i][0] + b[i][2] && x + w > b[i][0] && y < b[i][1] + b[i][3] && y + h > b[i][1]) return false;
    b.push([x, y, w, h]); return true;
  };
  CityMap.prototype.drawStreetLabels = function (roads) {
    var ctx = this.ctx, self = this, z = this.cam.z, seen = {}, W = this.W, H = this.H;
    var size = Math.round(Math.min(14, Math.max(11, 10 + z * 2.2)));
    ctx.font = '600 ' + size + 'px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var hiStreet = {}; this.streets.forEach(function (s) { hiStreet[s.name] = s; });
    this.marks.forEach(function (m) { if (m.tag && m.label && (m.a == null || m.a > 0)) seen[m.label] = 1; });
    // сначала длинные улицы
    roads.slice().sort(function (a, b) { return b.len - a.len; }).forEach(function (r) {
      if (!r.n || seen[r.n] || !(MAIN[r.c] || NAMED[r.c])) return;
      var mid = Math.max(2, Math.floor(r.p.length / 4) * 2);
      var a = self.project(r.p[mid - 2], r.p[mid - 1], 0), b = self.project(r.p[mid], r.p[mid + 1], 0);
      if (!a || !b) return;
      var segPx = Math.hypot(b[0] - a[0], b[1] - a[1]), txt = r.n.toUpperCase(), tw = ctx.measureText(txt).width;
      if (r.len * (a[2] + b[2]) / 2 < tw * 1.15) return;                // улица короче подписи
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (mx < 30 || mx > W - 30 || my < 40 || my > H - 30) return;
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      var bw = Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * size, bh = Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * size;
      if (!self.free(mx - bw / 2, my - bh / 2, bw, bh)) return;
      seen[r.n] = 1;
      var hs = hiStreet[r.n];
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(10,8,7,.92)'; ctx.lineWidth = 4; ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = hs && hs.a > 0 ? '#f2c39a' : COL.label; ctx.fillText(txt, 0, 0);
      ctx.restore();
    });
  };
  CityMap.prototype.drawMarks = function () {
    var ctx = this.ctx, self = this, z = this.cam.z;
    ctx.textBaseline = 'middle';
    var order = this.marks.slice().sort(function (a, b) { return (b.tag === 'main') - (a.tag === 'main'); });
    // экранные точки видимой части маршрутов: подписи над маршрутом гаснут, чтобы не перекрывать путь
    var rp = [];
    this.routes.forEach(function (rt) {
      if (!(rt.p > 0) || rt.a === 0) return;
      var step = Math.max(6, 10 / Math.max(0.3, z)), n = Math.ceil(rt.len * rt.p / step);
      for (var i = 0; i <= n; i++) { var q = self.pointAt(rt, Math.min(rt.p, i * step / rt.len)), sp = self.project(q[0], q[1], 0); if (sp) rp.push(sp); }
    });
    function onRoute(x, y, w, h) { for (var i = 0; i < rp.length; i++) if (rp[i][0] > x && rp[i][0] < x + w && rp[i][1] > y && rp[i][1] < y + h) return true; return false; }
    order.forEach(function (m) {
      var a = m.a == null ? 1 : m.a; if (a <= 0) return;
      if (m.maxZ && z > m.maxZ || m.minZ && z < m.minZ) return;
      var g = self.project(m.x, m.y, 0), p = m.h ? self.project(m.x, m.y, m.h) : g;
      if (!g || !p || p[0] < -80 || p[0] > self.W + 80 || p[1] < -40 || p[1] > self.H + 40) return;
      ctx.globalAlpha = a;
      if (m.tag) {                                                     // подпись на здании
        var big = m.tag === 'main', fs = m.size || (big ? 17 : 13);
        ctx.font = big ? '400 ' + fs + 'px "Tenor Sans", serif' : '500 ' + fs + 'px "Golos Text", sans-serif';
        var txt = big ? m.label.toUpperCase() : m.label, tw = ctx.measureText(txt).width + (big ? txt.length * 1.2 : 0), pw = tw + (big ? 30 : 20), ph = big ? 34 : 26;
        var x = Math.max(8, Math.min(self.W - pw - 8, p[0] - pw / 2)), y = p[1] - ph - 10, cxl = x + pw / 2;
        if (!big && (!self.flat && p[2] < z * 0.3 || onRoute(x - 4, y - 4, pw + 8, ph + 8) || !self.free(x - 4, y - 4, pw + 8, ph + 8))) { ctx.globalAlpha = 1; return; }
        if (big && onRoute(x - 2, y - 2, pw + 4, ph + 4)) { a *= 0.28; ctx.globalAlpha = a; }
        if (big) self.free(x - 4, y - 18, pw + 8, ph + 22);
        if (m.h && g) { ctx.strokeStyle = big ? 'rgba(242,195,154,.8)' : 'rgba(239,233,226,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], y + ph); ctx.stroke(); }
        ctx.fillStyle = big ? 'rgba(201,135,90,.94)' : 'rgba(18,14,11,.9)';
        rr(ctx, x, y, pw, ph, ph / 2); ctx.fill();
        if (!big) { ctx.strokeStyle = 'rgba(201,135,90,.55)'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.fillStyle = big ? '#1a100a' : '#efe9e2'; ctx.textAlign = 'center';
        if (big && ctx.letterSpacing !== undefined) { ctx.letterSpacing = '1.2px'; ctx.fillText(txt, cxl, y + ph / 2 + 1); ctx.letterSpacing = '0px'; }
        else ctx.fillText(txt, cxl, y + ph / 2 + 1);
        if (m.sub && z < 2.6) { ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(242,195,154,.95)'; ctx.strokeStyle = 'rgba(10,8,7,.9)'; ctx.lineWidth = 3; ctx.strokeText(m.sub, cxl, y - 9); ctx.fillText(m.sub, cxl, y - 9); }
        ctx.globalAlpha = 1; return;
      }
      ctx.beginPath(); ctx.arc(p[0], p[1], m.hi ? 7 : 5, 0, 6.283); ctx.fillStyle = m.hi ? '#c9875a' : '#0d0a08'; ctx.fill();
      ctx.strokeStyle = '#c9875a'; ctx.lineWidth = 1.5; ctx.stroke();
      if (m.hi) { ctx.beginPath(); ctx.arc(p[0], p[1], 14, 0, 6.283); ctx.strokeStyle = 'rgba(201,135,90,.4)'; ctx.stroke(); }
      if (m.label) {
        ctx.font = (m.hi ? '500 15px "Tenor Sans", serif' : '500 12px "IBM Plex Mono", monospace');
        var w = ctx.measureText(m.label).width, left = m.side === 'l' || p[0] + w + 30 > self.W;
        ctx.fillStyle = 'rgba(13,10,8,.8)'; rr(ctx, left ? p[0] - w - 24 : p[0] + 12, p[1] - 11, w + 12, 22, 6); ctx.fill();
        ctx.textAlign = 'left'; ctx.fillStyle = m.hi ? '#f2c39a' : 'rgba(239,233,226,.9)'; ctx.fillText(m.label, left ? p[0] - w - 18 : p[0] + 18, p[1]);
      }
      ctx.globalAlpha = 1;
    });
  };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  CityMap.prototype.addRoute = function (pts, o) {
    o = o || {};
    var seg = [], len = 0;
    for (var i = 2; i < pts.length; i += 2) { var d = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); seg.push(d); len += d; }
    var rt = { pts: pts, seg: seg, len: len, p: o.p || 0, color: o.color, w: o.w, dash: o.dash, a: o.a };
    this.routes.push(rt); return rt;
  };
  CityMap.prototype.pointAt = function (rt, p) {
    var upto = rt.len * Math.min(1, Math.max(0, p)), acc = 0, pts = rt.pts;
    for (var i = 0; i < rt.seg.length; i++) {
      if (acc + rt.seg[i] >= upto) { var t = (upto - acc) / (rt.seg[i] || 1); return [pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * t, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * t]; }
      acc += rt.seg[i];
    }
    return [pts[pts.length - 2], pts[pts.length - 1]];
  };
  // направление маршрута в точке p — поворот камеры «по ходу движения»
  CityMap.prototype.headingAt = function (rt, p, ahead) {
    var a = this.pointAt(rt, p), b = this.pointAt(rt, Math.min(1, p + (ahead || 60) / (rt.len || 1)));
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) b = this.pointAt(rt, 1), a = this.pointAt(rt, Math.max(0, 1 - 80 / (rt.len || 1)));
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  };
  // Камера по ключевым кадрам: frames [{t, x, y, z, r, tilt}], t 0..1
  CityMap.prototype.camAt = function (frames, t) {
    var a = frames[0], b = frames[frames.length - 1];
    for (var i = 0; i < frames.length - 1; i++) if (t >= frames[i].t && t <= frames[i + 1].t) { a = frames[i]; b = frames[i + 1]; break; }
    if (t <= frames[0].t) { a = b = frames[0]; } if (t >= b.t && b === frames[frames.length - 1]) a = b;
    var k = a === b ? 0 : (t - a.t) / (b.t - a.t); k = k * k * (3 - 2 * k);
    var lz = Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * k;
    this.cam.x = a.x + (b.x - a.x) * k; this.cam.y = a.y + (b.y - a.y) * k; this.cam.z = Math.exp(lz);
    this.cam.r = angLerp(a.r || 0, b.r || 0, k); this.cam.t = (a.tilt || 0) + ((b.tilt || 0) - (a.tilt || 0)) * k;
  };
  function angLerp(a, b, k) { var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; }
  CityMap.angLerp = angLerp;
  window.CityMap = CityMap;
})();
