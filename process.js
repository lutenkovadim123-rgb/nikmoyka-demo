/* Этапы мойки «НАНО» при прокрутке: пена, ручная мойка, воск, продувка, детали. */
(function () {
  'use strict';
  var NIK = window.NIK, box = document.querySelector('[data-process]'); if (!box) return;
  var cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), steps = [].slice.call(box.querySelectorAll('.pstep'));
  var bar = box.querySelector('.process__bar i'), label = box.querySelector('[data-plabel]');
  var img = new Image(); img.src = 'logo-line.webp';
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5), prog = 0, shown = 0;
  var bubbles = [], drops = [], sparks = [];
  function resize() { var r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function carRect() { var w = W * 0.86, h = w * 106 / 662; return { x: (W - w) / 2, y: H * 0.5 - h * 0.7, w: w, h: h }; }
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible) return;
    shown += (prog - shown) * 0.12;
    var s = Math.min(4, Math.floor(shown)), f = shown - Math.floor(shown), c = carRect();
    ctx.clearRect(0, 0, W, H);
    // подиум-отражение
    var fl = ctx.createRadialGradient(W / 2, c.y + c.h * 1.1, 0, W / 2, c.y + c.h * 1.1, W * 0.5);
    fl.addColorStop(0, 'rgba(201,135,90,.18)'); fl.addColorStop(1, 'rgba(201,135,90,0)');
    ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
    if (img.complete) { ctx.globalAlpha = 0.9; ctx.drawImage(img, 0, 0, 662, 106, c.x, c.y, c.w, c.h); ctx.globalAlpha = 1; }
    var base = c.y + c.h * 0.95;
    // 0: пена нарастает, 1: смывается справа налево
    if (s <= 1) {
      var level = s === 0 ? f : 1, wipe = s === 1 ? f : 0;
      while (bubbles.length < 260) bubbles.push({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(3, 11), o: rnd(0.3, 0.8) });
      bubbles.forEach(function (b) {
        if (b.x > 1 - wipe) return;
        var by = base - b.y * c.h * 1.1 * level;
        if (b.y > level) return;
        ctx.beginPath(); ctx.arc(c.x + b.x * c.w, by, b.r * dpr, 0, 6.283);
        ctx.fillStyle = 'rgba(245,240,234,' + (b.o * 0.55) + ')'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,' + b.o + ')'; ctx.lineWidth = 0.8 * dpr; ctx.stroke();
      });
      if (s === 1) { // губка
        var sx = c.x + (1 - wipe) * c.w;
        var sg = ctx.createLinearGradient(sx - 30 * dpr, 0, sx + 30 * dpr, 0);
        sg.addColorStop(0, 'rgba(242,195,154,0)'); sg.addColorStop(0.5, 'rgba(242,195,154,.5)'); sg.addColorStop(1, 'rgba(242,195,154,0)');
        ctx.fillStyle = sg; ctx.fillRect(sx - 30 * dpr, c.y - c.h * 0.2, 60 * dpr, c.h * 1.4);
      }
    }
    // 2: воск — медный блик вдоль линии
    if (s === 2) {
      var px = c.x + (f * 1.4 - 0.2) * c.w;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var wg = ctx.createLinearGradient(px - c.w * 0.15, 0, px + c.w * 0.15, 0);
      wg.addColorStop(0, 'rgba(242,195,154,0)'); wg.addColorStop(0.5, 'rgba(255,214,170,.55)'); wg.addColorStop(1, 'rgba(242,195,154,0)');
      ctx.fillStyle = wg; ctx.fillRect(c.x, c.y - c.h * 0.3, c.w, c.h * 1.6); ctx.restore();
      if (img.complete) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(img, 0, 0, 662, 106, c.x, c.y, c.w, c.h); ctx.restore(); }
    }
    // 3: продувка — горизонтальные струи и капли уходят вправо
    if (s === 3) {
      while (drops.length < 70) drops.push({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.004, 0.012), l: rnd(20, 70) });
      drops.forEach(function (d) {
        d.x += d.v * (NIK.reduced ? 0 : 1); if (d.x > 1.1) { d.x = -0.1; d.y = rnd(0, 1); }
        var x = c.x + d.x * c.w, y = c.y - c.h * 0.2 + d.y * c.h * 1.4;
        ctx.strokeStyle = 'rgba(220,230,240,' + (0.15 + 0.3 * (1 - f)) + ')'; ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.l * dpr, y); ctx.stroke();
      });
    }
    // 4: детали — искры на резине и порогах
    if (s === 4) {
      if (sparks.length < 24) sparks.push({ x: rnd(0.1, 0.9), y: rnd(0.75, 1), t: t, d: rnd(600, 1400) });
      sparks = sparks.filter(function (p) { return t - p.t < p.d; });
      sparks.forEach(function (p) {
        var a = Math.sin((t - p.t) / p.d * Math.PI), x = c.x + p.x * c.w, y = c.y + p.y * c.h, r = 9 * dpr * a;
        ctx.strokeStyle = 'rgba(255,230,200,' + a + ')'; ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      });
    }
  }
  var visible = false;
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(box);
  function onScroll() {
    var r = box.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.min(1, Math.max(0, (vh * 0.35 - r.top) / (r.height - vh * 0.7)));
    prog = NIK.reduced ? 4.6 : p * 4.999;
    var i = Math.min(4, Math.floor(prog));
    steps.forEach(function (s, j) { s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); });
    if (bar) bar.style.transform = 'scaleX(' + (p || 0.001) + ')';
    if (label) label.textContent = steps[i].querySelector('h3').textContent;
  }
  window.addEventListener('resize', function () { resize(); onScroll(); });
  NIK.onScroll(onScroll);
  resize(); onScroll(); requestAnimationFrame(frame);
})();
