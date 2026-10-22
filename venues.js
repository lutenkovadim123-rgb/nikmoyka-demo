/* Чем заняться, пока моем. Этажи — по карточкам заведений на Яндекс Картах (проверено 22.10.2026); где этаж не подтверждён — «в Плазе».
   Мойка — паркинг Никольской Плазы, −3 этаж; наверх — на лифте. Время — ориентир для подсказок. */
window.NIK_VENUES = {
 "cats": [
  {
   "id": "eat",
   "k": "Поесть",
   "title": "Еда",
   "img": "vokrug",
   "lead": "Огромная гастрозона с кухнями разных стран — в том же здании.",
   "items": [
    {
     "id": "vokrug",
     "name": "Гастромаркет «Вокруг Света»",
     "where": "1 этаж",
     "what": "24 ресторана и кафе разных кухонь мира, бар и сцена. Проект Аркадия Новикова, Бориса Заркова и Владимира Мухина",
     "min": 60
    },
    {
     "id": "patio",
     "name": "IL Патио",
     "where": "в Плазе",
     "what": "Итальянский ресторан: паста, пицца, обед или ужин",
     "min": 75
    },
    {
     "id": "ab",
     "name": "Азбука вкуса · AB Daily",
     "where": "в Плазе",
     "what": "Кофе с собой и минимаркет, круглосуточно",
     "min": 20
    },
    {
     "id": "vkusno",
     "name": "Вкусно — и точка",
     "where": "в Плазе",
     "what": "Быстро перекусить",
     "min": 25
    }
   ]
  },
  {
   "id": "drink",
   "k": "Выпить",
   "title": "Бары",
   "img": "bar",
   "lead": "Паб и бар, если ждёте вечером.",
   "items": [
    {
     "id": "dubliner",
     "name": "The Dubliner",
     "where": "в Плазе",
     "what": "Ирландский паб",
     "min": 60
    },
    {
     "id": "papas",
     "name": "Papa's",
     "where": "в Плазе",
     "what": "Американский бар-ресторан",
     "min": 60
    }
   ]
  },
  {
   "id": "fit",
   "k": "Спорт",
   "title": "Фитнес",
   "img": "fit",
   "lead": "Тренируйтесь — машина стоит на бесплатном паркинге, мы её моем.",
   "items": [
    {
     "id": "mosfit",
     "name": "MOSFITNESS",
     "where": "−1 этаж",
     "what": "Зал TechnoGym, бассейн с противотоком, хаммам и сауны. Разовое посещение уточняйте в клубе",
     "min": 90
    }
   ]
  },
  {
   "id": "beauty",
   "k": "Красота",
   "title": "Салоны и барбершоп",
   "img": "beauty",
   "lead": "Укладка, маникюр или стрижка — пока машина в работе.",
   "items": [
    {
     "id": "goar",
     "name": "Beauty Studio Goar Avetisyan",
     "where": "2 этаж",
     "what": "Волосы, маникюр и педикюр, брови и ресницы",
     "min": 90
    },
    {
     "id": "mvk",
     "name": "M.V.K. Beauty Line",
     "where": "в Плазе",
     "what": "Салон красоты",
     "min": 90
    },
    {
     "id": "jumanji",
     "name": "Jumanji barbers",
     "where": "2 этаж",
     "what": "Барбершоп: мужские стрижки, укладка, окрашивание",
     "min": 45
    }
   ]
  },
  {
   "id": "shop",
   "k": "Шопинг",
   "title": "Бутики",
   "img": "shop",
   "lead": "Одежда, часы и украшения не выходя из здания.",
   "items": [
    {
     "id": "wear",
     "name": "Intimissimi · TOUS · Populuxe",
     "where": "в Плазе",
     "what": "Одежда и аксессуары",
     "min": 40
    },
    {
     "id": "watch",
     "name": "Rado · Bestwatch · Diamonds Are Forever",
     "where": "в Плазе",
     "what": "Часы и украшения",
     "min": 30
    },
    {
     "id": "pharma",
     "name": "Аптека «36,6»",
     "where": "в Плазе",
     "what": "Аптека",
     "min": 10
    }
   ]
  }
 ],
 "near": [
  {
   "id": "nikst",
   "name": "Никольская улица",
   "sub": "у входа в Плазу",
   "min": 0
  },
  {
   "id": "cdm",
   "name": "ЦДМ на Лубянке",
   "sub": "6 мин пешком",
   "min": 60
  },
  {
   "id": "gum",
   "name": "ГУМ",
   "sub": "8 мин пешком",
   "min": 60
  },
  {
   "id": "red",
   "name": "Красная площадь",
   "sub": "11 мин пешком",
   "min": 50
  }
 ]
};
// План на свободное время: что успеть за H часов мойки
window.NIK_VENUES.plan = function (h) {
    var V = {}, C = {};
    this.cats.forEach(function (c) { c.items.forEach(function (v) { V[v.id] = v; C[v.id] = c; }); });
    var free = Math.round(h * 60) - 15, out = [];
    function add(id, label, alt) { var v = V[id]; out.push({ label: label, name: v.name + (alt ? ' или ' + V[alt].name : ''), where: v.where, img: C[id].img, min: v.min }); }
    add('ab', 'Кофе');
    if (free >= 50) add('vokrug', 'Перекусить', 'patio');
    if (free >= 80) add('mosfit', 'Тренировка');
    if (free >= 80) add('goar', 'Красота', 'jumanji');
    if (free >= 150) out.push({ label: 'Прогулка', name: 'Красная площадь и ГУМ', where: '8–11 мин пешком', img: 'red', min: 60 });
    if (free >= 240) add('wear', 'Шопинг');
    return { free: free, items: out };
  };
