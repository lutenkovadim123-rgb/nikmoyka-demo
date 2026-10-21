/* Сравнение «до/после»: перегородка. Левее линии — «до», правее — «после». */
(function () {
  'use strict';
  document.querySelectorAll('[data-ba]').forEach(function (el) {
    var range = el.querySelector('.ba__range'), drag = false;
    function set(v) { v = Math.max(0, Math.min(100, v)); el.style.setProperty('--x', v + '%'); range.value = Math.round(v); }
    function at(e) { var r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); }
    el.addEventListener('pointerdown', function (e) { if (e.button) return; drag = true; el.classList.add('is-drag'); el.setPointerCapture(e.pointerId); at(e); });
    el.addEventListener('pointermove', function (e) { if (drag) at(e); });
    el.addEventListener('pointerup', function () { drag = false; el.classList.remove('is-drag'); });
    el.addEventListener('pointercancel', function () { drag = false; el.classList.remove('is-drag'); });
    range.addEventListener('input', function () { set(+range.value); });
    // подсказка движением, когда блок впервые виден
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; io.disconnect();
        var t0 = performance.now();
        (function step(t) { var k = Math.min(1, (t - t0) / 1600); if (drag) return; set(50 + Math.sin(k * Math.PI * 2) * 18 * (1 - k)); if (k < 1) requestAnimationFrame(step); })(t0);
      }, { threshold: 0.6 });
      io.observe(el);
    }
  });
})();
