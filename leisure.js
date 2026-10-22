/* «Досуг»: если на этом устройстве есть запись — план на её время; иначе выбор длительности. */
(function () {
  'use strict';
  var NIK = window.NIK, box = document.getElementById('plan');
  if (!NIK || !box) return;
  var DUR = [[1.5, 'Мойка · 1,5 ч'], [3, 'Комплекс · 3 ч'], [8, 'Химчистка · 8 ч']], pick = 3;
  function next() {
    var now = Date.now() - 3600e3;
    return NIK.store.get('nik:bookings', []).filter(function (r) { return new Date(r.day + 'T' + (r.end || r.time) + ':00') > now; })
      .sort(function (a, b) { return (a.day + a.time) < (b.day + b.time) ? -1 : 1; })[0];
  }
  function render() {
    var r = next(), h = r ? r.h : pick;
    var head = r ? '<span class="k">Ваша запись</span><h2>' + NIK.esc(r.items[0] || 'Мойка') + (r.items.length > 1 ? ' и ещё ' + (r.items.length - 1) : '') + ' займёт ≈ ' + NIK.hrs(r.h) + '</h2>' +
      '<p class="plan__meta">Заезд ' + r.day.split('-').reverse().slice(0, 2).join('.') + ' в ' + r.time + (r.end ? ' · готово примерно к ' + r.end : ' · машина останется до завтра') + '. Вот чем можно заняться:</p>'
      : '<span class="k">Пока мы моем</span><h2>Сколько у вас будет времени?</h2><div class="durs">' + DUR.map(function (d) { return '<button class="chip" type="button" data-h="' + d[0] + '" aria-pressed="' + (d[0] === pick) + '">' + d[1] + '</button>'; }).join('') + '</div>';
    box.innerHTML = head + NIK.leisure(h, 6).replace('<p class="lbl">', '<p class="lbl" hidden>') +
      (r ? '' : '<button class="btn btn--copper" type="button" data-open="book" style="justify-self:start">Записаться</button>');
    [].forEach.call(box.querySelectorAll('[data-h]'), function (b) { b.onclick = function () { pick = +b.dataset.h; render(); }; });
  }
  render();
  document.addEventListener('nik:booked', render);
})();
