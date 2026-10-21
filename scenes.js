/* Прокрутка как видео: закреплённые сцены с прогрессом 0..1, кинематографичные титры и «история на карте». */
(function () {
  'use strict';
  var NIK = window.NIK, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var scenes = $$('[data-scene]'), handlers = {};
  NIK.scene = function (id, fn) { handlers[id] = fn; };
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  NIK.seg = function (p, a, b) { return clamp((p - a) / (b - a)); };       // доля внутри отрезка
  NIK.ease = function (t) { return t * t * (3 - 2 * t); };
  function tick() {
    var vh = window.innerHeight;
    scenes.forEach(function (s) {
      var r = s.getBoundingClientRect(), len = r.height - vh;
      var p = NIK.reduced ? 1 : clamp(len > 0 ? -r.top / len : (r.top < vh ? 1 : 0));
      if (s._p === p) return; s._p = p;
      s.style.setProperty('--p', p.toFixed(4));
      var h = handlers[s.dataset.scene]; if (h) h(p, s);
    });
  }
  NIK.onScroll(tick); window.addEventListener('resize', tick);
  NIK.sceneTick = tick;

  // Шапки внутренних страниц: заголовок уходит вверх и растворяется, как в титрах
  $$('.phead').forEach(function (ph) {
    var inner = ph.querySelector('.phead__in');
    NIK.onScroll(function () {
      if (NIK.reduced) return;
      var r = ph.getBoundingClientRect(), k = clamp(-r.top / (r.height * 0.9));
      inner.style.transform = 'translate3d(0,' + (-k * 60).toFixed(1) + 'px,0) scale(' + (1 - k * 0.06).toFixed(3) + ')';
      inner.style.opacity = (1 - k * 1.2).toFixed(3);
      inner.style.filter = k > 0.02 ? 'blur(' + (k * 6).toFixed(1) + 'px)' : '';
    });
  });

  // Раскрытие блоков шторкой: [data-wipe] открывается по мере входа в кадр
  $$('[data-wipe]').forEach(function (el) {
    NIK.onScroll(function () {
      var r = el.getBoundingClientRect(), vh = window.innerHeight;
      var k = NIK.reduced ? 1 : clamp((vh - r.top) / (vh * 0.55));
      el.style.setProperty('--w', k.toFixed(3));
    });
  });

  // Горизонтальная лента в закреплённой сцене
  NIK.scene('pan', function (p, s) {
    var track = s.querySelector('.pan__track'); if (!track) return;
    var max = track.scrollWidth - s.querySelector('.pan__vp').clientWidth;
    track.style.transform = 'translate3d(' + (-max * NIK.ease(p)).toFixed(1) + 'px,0,0)';
  });
})();
