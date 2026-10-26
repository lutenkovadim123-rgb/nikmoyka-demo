/* Вход для владельца — демо. Показывает, как будет выглядеть админка: расписание по постам, статусы, заявки на звонок.
   Данные — записи этого браузера. В рабочей версии: вход по паролю на сервере, записи со всех устройств (этап 2). */
(function () {
  'use strict';
  var NIK = window.NIK, root = document.querySelector('[data-admin]'); if (!NIK || !root) return;
  var esc = NIK.esc, store = NIK.store, rub = NIK.rub, hrs = NIK.hrs;
  var ST = ['Новая', 'Подтверждена', 'В работе', 'Готова', 'Отменена'];
  var DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var day = ymd(new Date());
  function logged() { try { return sessionStorage.getItem('nik:owner') === '1'; } catch (e) { return false; } }
  function login() {
    root.innerHTML = '<form class="owner" id="ownerForm" autocomplete="off"><span class="num">Владелец</span><h2>Вход в админку</h2>' +
      '<div class="field"><label for="oLogin">Логин</label><input id="oLogin" autocomplete="username" required></div>' +
      '<div class="field"><label for="oPass">Пароль</label><input id="oPass" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn--copper i-login" type="submit">Войти</button>' +
      '<p class="demo">Демо: вход без проверки пароля, ничего не отправляется. В рабочей версии — учётка владельца и администраторов, вход по паролю на сервере.</p></form>';
    document.getElementById('ownerForm').onsubmit = function (e) { e.preventDefault(); try { sessionStorage.setItem('nik:owner', '1'); } catch (x) {} render(); };
  }
  function render() {
    if (!logged()) return login();
    var all = store.get('nik:bookings', []), reqs = store.get('nik:requests', []);
    var days = []; for (var i = -1; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); days.push(d); }
    var list = all.filter(function (r) { return r.day === day; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var sum = list.filter(function (r) { return r.status !== 4; }).reduce(function (s, r) { return s + r.total; }, 0);
    root.innerHTML = '<div class="adm__head"><div><span class="num">Админка · демо</span><h2>Расписание</h2></div><button class="btn btn--ghost btn--sm" type="button" id="oOut">Выйти</button></div>' +
      '<div class="chips" role="group" aria-label="День">' + days.map(function (d) { var k = ymd(d); return '<button class="chip" type="button" data-d="' + k + '" aria-pressed="' + (k === day) + '">' + DAYS[d.getDay()] + ' ' + d.getDate() + '</button>'; }).join('') + '</div>' +
      '<div class="adm__stats"><div><b>' + list.length + '</b><span>записей</span></div><div><b>от ' + rub(sum) + '</b><span>по прайсу</span></div><div><b>' + reqs.filter(function (q) { return !q.done; }).length + '</b><span>ждут звонка</span></div></div>' +
      (list.length ? '<div class="adm__list">' + list.map(function (r) {
        var post = 1 + (r.id % 3);
        return '<article class="adm__item"><div class="adm__time"><b>' + r.time + '</b><span>' + (r.end ? '— ' + r.end : 'до завтра') + '</span><em>Пост ' + post + '</em></div>' +
          '<div class="adm__body"><b>' + esc(r.items.join(', ')) + '</b><span>' + esc(r.name) + ' · <a href="tel:+' + r.phone + '">+' + r.phone + '</a>' + (r.car ? ' · ' + esc(r.car) : '') + '</span><span>Код ' + r.code + ' · от ' + rub(r.total) + ' · ≈ ' + hrs(r.h) + '</span></div>' +
          '<label class="adm__st"><span class="sr">Статус</span><select data-st="' + r.id + '">' + ST.map(function (s, i) { return '<option value="' + i + '"' + ((r.status || 0) === i ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label></article>';
      }).join('') + '</div>' : '<p class="note">На этот день записей нет. Запишитесь на сайте с этого устройства — запись появится здесь.</p>') +
      '<h3 class="adm__h3">Перезвонить</h3>' + (reqs.length ? '<div class="adm__list">' + reqs.slice().reverse().map(function (q) {
        return '<article class="adm__item adm__item--req"><div class="adm__body"><b>' + esc(q.name) + '</b><span><a href="tel:+' + q.phone + '">+' + q.phone + '</a> · ' + new Date(q.id).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + '</span></div>' +
          '<label class="check"><input type="checkbox" data-q="' + q.id + '"' + (q.done ? ' checked' : '') + '><span>Перезвонил</span></label></article>';
      }).join('') + '</div>' : '<p class="note">Заявок на звонок нет.</p>') +
      '<p class="demo">Демо: здесь записи и заявки этого браузера. В рабочей версии — все записи с сайта, письмо администратору о каждой новой, перенос, отмена и закрытие поста или времени.</p>';
    document.getElementById('oOut').onclick = function () { try { sessionStorage.removeItem('nik:owner'); } catch (e) {} render(); };
    [].forEach.call(root.querySelectorAll('[data-d]'), function (b) { b.onclick = function () { day = b.dataset.d; render(); }; });
    [].forEach.call(root.querySelectorAll('[data-st]'), function (sel) { sel.onchange = function () { var a = store.get('nik:bookings', []); a.forEach(function (r) { if (String(r.id) === sel.dataset.st) r.status = +sel.value; }); store.set('nik:bookings', a); render(); }; });
    [].forEach.call(root.querySelectorAll('[data-q]'), function (c) { c.onchange = function () { var a = store.get('nik:requests', []); a.forEach(function (q) { if (String(q.id) === c.dataset.q) q.done = c.checked; }); store.set('nik:requests', a); render(); }; });
  }
  render();
})();
