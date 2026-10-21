/* Что рядом с мойкой. Время пешком — по пешеходным маршрутам OpenStreetMap; координаты уточняются данными карты. */
window.NIK_CITY = {
  places: [
    { id: 'plaza', name: 'Никольская Плаза', x: 0, y: 0, walk: 1, kind: 'home' },
    { id: 'tret', name: 'Третьяковский проезд', x: -150, y: 110, walk: 3 },
    { id: 'gum', name: 'ГУМ', x: -160, y: -290, walk: 8 },
    { id: 'cdm', name: 'ЦДМ на Лубянке', x: 210, y: 240, walk: 6 },
    { id: 'bolshoi', name: 'Большой театр', x: -500, y: 160, walk: 9 },
    { id: 'red', name: 'Красная площадь', x: -260, y: -480, walk: 11 },
    { id: 'vasily', name: 'Покровский собор', x: -60, y: -620, walk: 13 },
    { id: 'zar', name: 'Парк Зарядье', x: 240, y: -760, walk: 14 },
    { id: 'sad', name: 'Александровский сад', x: -720, y: -420, walk: 20 }
  ],
  activities: [
    { id: 'vokrug', place: 'plaza', name: 'Гастромаркет «Вокруг Света» в Плазе', min: 60 },
    { id: 'plz_shop', place: 'plaza', name: 'Бутики Плазы: TOUS, Intimissimi, Rado', min: 40 },
    { id: 'plz_beauty', place: 'plaza', name: 'Салон красоты или барбершоп Jumanji', min: 60 },
    { id: 'plz_fit', place: 'plaza', name: 'Тренировка в MOSFITNESS', min: 75 },
    { id: 'plz_bar', place: 'plaza', name: "Papa's, The Dubliner или IL Патио", min: 60 },
    { id: 'coffee', place: 'plaza', name: 'Кофе в Никольской Плазе', min: 30 },
    { id: 'tret', place: 'tret', name: 'Бутики Третьяковского проезда', min: 45 },
    { id: 'gum', place: 'gum', name: 'ГУМ: магазины и знаменитое мороженое', min: 60 },
    { id: 'cdm', place: 'cdm', name: 'ЦДМ: игрушки и смотровая площадка', min: 90 },
    { id: 'red', place: 'red', name: 'Красная площадь и Покровский собор', min: 50 },
    { id: 'zar', place: 'zar', name: 'Парк Зарядье и парящий мост', min: 60 },
    { id: 'lunch', place: 'plaza', name: 'Обед или ужин в ресторане', min: 80 },
    { id: 'bolshoi', place: 'bolshoi', name: 'Театральная площадь и Большой театр', min: 30 },
    { id: 'sad', place: 'sad', name: 'Александровский сад и Вечный огонь', min: 40 }
  ],
  scenarios: [
    { id: 'plaza', name: 'В Плазе', lead: 'Еда, бутики, красота и спорт — не выходя из здания.', plan: ['vokrug', 'plz_shop', 'plz_beauty', 'plz_fit', 'plz_bar'] },
    { id: 'family', name: 'Семьёй', lead: 'Обед в «Вокруг Света», ЦДМ, ГУМ и Красная площадь.', plan: ['vokrug', 'cdm', 'gum', 'red', 'zar'] },
    { id: 'shop', name: 'Шопинг', lead: 'Бутики Плазы, Третьяковский проезд и ГУМ.', plan: ['plz_shop', 'tret', 'gum', 'vokrug', 'red'] },
    { id: 'walk', name: 'Прогулка', lead: 'Красная площадь, Зарядье и Александровский сад.', plan: ['red', 'zar', 'sad', 'bolshoi', 'vokrug'] },
    { id: 'dinner', name: 'Ужин или встреча', lead: 'Ужин в «Вокруг Света» или в баре Плазы.', plan: ['vokrug', 'plz_bar', 'bolshoi', 'tret'] }
  ],
  // Длительность по услугам — примерная, уточняется мастером
  durations: [
    { id: 'nano', name: 'Мойка «НАНО»', h: 1.5 },
    { id: 'nano-complex', name: 'Комплекс «НАНО»', h: 2 },
    { id: 'complex-mini', name: '«От Никольской» MINI', h: 2.5 },
    { id: 'complex-standard', name: '«От Никольской» STANDARD', h: 3.5 },
    { id: 'dry-complex', name: 'Химчистка салона', h: 8 },
    { id: 'polish-full', name: 'Полировка кузова', h: 10 }
  ]
};
