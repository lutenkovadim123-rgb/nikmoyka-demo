/* Фонарь детейлера: луч показывает паутинку царапин на лаке; после полировки — чистое зеркальное отражение. */
(function () {
  'use strict';
  var NIK = window.NIK;
  document.querySelectorAll('[data-flash]').forEach(function (box) {
    var cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
    var tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
    var sw = document.createElement('canvas'), sctx = sw.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5), polished = false, k = 0;
    var mx = 0.62, my = 0.42, tx = mx, ty = my, idle = true, lastMove = 0;

    function swirls() {
      sw.width = W; sw.height = H;
      sctx.clearRect(0, 0, W, H);
      var rnd = mulberry(7);
      // Паутинка: концентрические дуги от машинной мойки щётками
      for (var c = 0; c < 26; c++) {
        var cx = rnd() * W, cy = rnd() * H, rings = 10 + rnd() * 18;
        for (var i = 0; i < rings; i++) {
          var r = 8 * dpr + i * (5 + rnd() * 5) * dpr, a0 = rnd() * 6.28, len = 0.5 + rnd() * 1.6;
          sctx.strokeStyle = 'rgba(255,240,225,' + (0.18 + rnd() * 0.35) + ')';
          sctx.lineWidth = (0.5 + rnd() * 0.7) * dpr;
          sctx.beginPath(); sctx.arc(cx, cy, r, a0, a0 + len); sctx.stroke();
        }
      }
      // Отдельные риски
      for (var j = 0; j < 70; j++) {
        var x = rnd() * W, y = rnd() * H, l = (20 + rnd() * 90) * dpr, ang = rnd() * 3.14;
        sctx.strokeStyle = 'rgba(255,240,225,' + (0.15 + rnd() * 0.3) + ')'; sctx.lineWidth = 0.6 * dpr;
        sctx.beginPath(); sctx.moveTo(x, y); sctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); sctx.stroke();
      }
    }
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function resize() {
      var r = box.getBoundingClientRect();
      W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr);
      tmp.width = W; tmp.height = H; swirls(); draw();
    }
    function draw() {
      var x = mx * W, y = my * H, R = Math.max(W, H) * 0.22;
      // лак: тёмный, с мягким отражением потолка
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0d0a08'); g.addColorStop(0.55, '#1a120d'); g.addColorStop(1, '#070504');
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var band = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.34);
      band.addColorStop(0, 'rgba(201,135,90,0)'); band.addColorStop(0.5, 'rgba(201,135,90,' + (0.06 + k * 0.1) + ')'); band.addColorStop(1, 'rgba(201,135,90,0)');
      ctx.fillStyle = band; ctx.fillRect(0, 0, W, H);
      // пятно света
      ctx.globalCompositeOperation = 'lighter';
      var spot = ctx.createRadialGradient(x, y, 0, x, y, R);
      spot.addColorStop(0, 'rgba(255,236,214,' + (0.22 + k * 0.06) + ')'); spot.addColorStop(0.5, 'rgba(242,195,154,0.07)'); spot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
      // царапины видны только в луче
      if (k < 1) {
        tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, W, H); tctx.drawImage(sw, 0, 0);
        tctx.globalCompositeOperation = 'destination-in';
        var m = tctx.createRadialGradient(x, y, 0, x, y, R * 0.95);
        m.addColorStop(0, 'rgba(0,0,0,' + (1 - k) + ')'); m.addColorStop(0.7, 'rgba(0,0,0,' + 0.35 * (1 - k) + ')'); m.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = m; tctx.fillRect(0, 0, W, H);
        ctx.drawImage(tmp, 0, 0);
      }
      // отражение лампы: после полировки — чёткое, до — размытое
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
      var lw = R * 0.42, lh = R * 0.07;
      var lamp = ctx.createLinearGradient(-lw, 0, lw, 0);
      lamp.addColorStop(0, 'rgba(255,245,235,0)'); lamp.addColorStop(0.2, 'rgba(255,245,235,' + (0.25 + k * 0.7) + ')'); lamp.addColorStop(0.8, 'rgba(255,245,235,' + (0.25 + k * 0.7) + ')'); lamp.addColorStop(1, 'rgba(255,245,235,0)');
      ctx.filter = 'blur(' + ((1 - k) * 10 * dpr + 0.5) + 'px)';
      ctx.fillStyle = lamp; ctx.beginPath(); ctx.ellipse(0, 0, lw, lh, 0, 0, 6.283); ctx.fill();
      ctx.filter = 'none'; ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    var visible = false;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(box);
    var lt = 0;
    function loop(t) {
      requestAnimationFrame(loop);
      if (!visible) { lt = t; return; }
      var dt = Math.min(0.1, (t - (lt || t)) / 1000); lt = t;
      if (idle && !NIK.reduced) { tx = 0.5 + Math.sin(t / 2600) * 0.3; ty = 0.45 + Math.sin(t / 1900) * 0.22; }
      if (performance.now() - lastMove > 2600) idle = true;
      var target = polished ? 1 : 0;
      var e1 = 1 - Math.exp(-dt * 3.5), e2 = 1 - Math.exp(-dt * 9);
      k += (target - k) * e1; mx += (tx - mx) * e2; my += (ty - my) * e2;
      draw();
    }
    function point(e) {
      var r = box.getBoundingClientRect();
      tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      idle = false; lastMove = performance.now();
    }
    box.addEventListener('pointermove', point);
    box.addEventListener('pointerdown', point);
    box.querySelectorAll('[data-state]').forEach(function (b) {
      b.addEventListener('click', function () {
        polished = b.dataset.state === 'after';
        box.querySelectorAll('[data-state]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var cap = box.querySelector('[data-cap]');
        if (cap) cap.textContent = polished ? 'После полировки: царапин нет, лампа отражается чётко, как в зеркале.' : 'До полировки: под лампой видна паутинка от щёточных моек и мелкие риски.';
      });
    });
    window.addEventListener('resize', resize);
    resize(); requestAnimationFrame(loop);
  });
})();
