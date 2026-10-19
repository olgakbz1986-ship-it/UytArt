/* ============================================================
   ЭТАП 2: серверный движок гео-локальности и расчёта логистики
   ------------------------------------------------------------
   Изолированный модуль (не меняет структуру таблиц):
   1) Жёсткая фильтрация записей по городу покупателя ДО отправки
      данных клиенту (аналог SQL WHERE на уровне dev-хранилища).
      Правила попадания в выборку:
        - товар/мастер доставляет «по всей России» (nationwide);
        - город покупателя явно в списке доставки (cities) или
          совпадает с базовым городом продавца (city / mode:"city");
        - зона «region» — тот же федеральный округ;
        - зона «radius» — расстояние от базового города ≤ km;
        - цифровые товары — без географических ограничений.
   2) Калькулятор логистики: стоимость и сроки СДЭК / Почты России
      по координатам городов (гаверсинус), детерминированные пороги.
   Коэффициенты соответствуют упрощённым тарифным сетям служб.
   ============================================================ */

const CITIES = [
  { name: "Москва", lat: 55.7558, lon: 37.6173, district: "ЦФО" },
  { name: "Санкт-Петербург", lat: 59.9311, lon: 30.3609, district: "СЗФО" },
  { name: "Курск", lat: 51.7308, lon: 36.1932, district: "ЦФО" },
  { name: "Воронеж", lat: 51.672, lon: 39.1843, district: "ЦФО" },
  { name: "Белгород", lat: 50.5997, lon: 36.5882, district: "ЦФО" },
  { name: "Орёл", lat: 52.9651, lon: 36.0785, district: "ЦФО" },
  { name: "Брянск", lat: 53.2521, lon: 34.3717, district: "ЦФО" },
  { name: "Липецк", lat: 52.6031, lon: 39.5708, district: "ЦФО" },
  { name: "Тула", lat: 54.1961, lon: 37.6182, district: "ЦФО" },
  { name: "Калуга", lat: 54.5138, lon: 36.2604, district: "ЦФО" },
  { name: "Смоленск", lat: 54.7818, lon: 32.0401, district: "ЦФО" },
  { name: "Тверь", lat: 56.8587, lon: 35.9176, district: "ЦФО" },
  { name: "Ярославль", lat: 57.6261, lon: 39.8845, district: "ЦФО" },
  { name: "Владимир", lat: 56.1291, lon: 40.407, district: "ЦФО" },
  { name: "Нижний Новгород", lat: 56.2965, lon: 43.9361, district: "ПФО" },
  { name: "Казань", lat: 55.7887, lon: 49.1221, district: "ПФО" },
  { name: "Самара", lat: 53.1959, lon: 50.1008, district: "ПФО" },
  { name: "Екатеринбург", lat: 56.8389, lon: 60.6057, district: "УФО" },
  { name: "Челябинск", lat: 55.1644, lon: 61.4368, district: "УФО" },
  { name: "Новосибирск", lat: 55.0084, lon: 82.9357, district: "СФО" },
  { name: "Омск", lat: 54.9885, lon: 73.3242, district: "СФО" },
  { name: "Краснодар", lat: 45.0355, lon: 38.9753, district: "ЮФО" },
  { name: "Ростов-на-Дону", lat: 47.2357, lon: 39.7015, district: "ЮФО" },
  { name: "Волгоград", lat: 48.708, lon: 44.5133, district: "ЮФО" },
  { name: "Сочи", lat: 43.6028, lon: 39.7342, district: "ЮФО" },
  { name: "Калининград", lat: 54.7104, lon: 20.4522, district: "СЗФО" },
  { name: "Мурманск", lat: 68.9585, lon: 33.0827, district: "СЗФО" },
  { name: "Петрозаводск", lat: 61.7849, lon: 34.3469, district: "СЗФО" },
  { name: "Архангельск", lat: 64.5402, lon: 40.5433, district: "СЗФО" },
  { name: "Вологда", lat: 59.2239, lon: 39.8836, district: "СЗФО" },
  { name: "Красноярск", lat: 56.0184, lon: 92.8672, district: "СФО" },
  { name: "Тюмень", lat: 57.1553, lon: 65.5339, district: "УФО" },
  { name: "Пермь", lat: 58.0105, lon: 56.2502, district: "ПФО" },
  { name: "Уфа", lat: 54.7388, lon: 55.9721, district: "ПФО" },
  { name: "Иркутск", lat: 52.287, lon: 104.305, district: "СФО" },
  { name: "Владивосток", lat: 43.1155, lon: 131.8855, district: "ДФО" },
  { name: "Хабаровск", lat: 48.4827, lon: 135.0838, district: "ДФО" },
  { name: "Рязань", lat: 54.6292, lon: 39.7357, district: "ЦФО" },
  { name: "Тамбов", lat: 52.7217, lon: 41.4519, district: "ЦФО" },
  { name: "Саратов", lat: 51.5924, lon: 45.9529, district: "ПФО" },
  { name: "Пенза", lat: 53.19, lon: 45.01, district: "ПФО" },
  { name: "Ижевск", lat: 56.8619, lon: 53.2326, district: "ПФО" },
  { name: "Саранск", lat: 54.18, lon: 45.18, district: "ПФО" },
  { name: "Чебоксары", lat: 56.13, lon: 47.25, district: "ПФО" },
  { name: "Йошкар-Ола", lat: 56.63, lon: 47.89, district: "ПФО" },
  { name: "Киров", lat: 58.6035, lon: 49.6668, district: "ПФО" },
  { name: "Ульяновск", lat: 54.3142, lon: 48.4031, district: "ПФО" },
  { name: "Оренбург", lat: 51.7727, lon: 55.0988, district: "ПФО" },
  { name: "Белгород", lat: 50.5997, lon: 36.5882, district: "ЦФО" },
  { name: "Старый Оскол", lat: 51.3003, lon: 37.8301, district: "ЦФО" },
  { name: "Курчатов", lat: 51.6608, lon: 35.6464, district: "ЦФО" },
  { name: "Махачкала", lat: 42.9644, lon: 47.5047, district: "СКФО" },
  { name: "Грозный", lat: 43.3149, lon: 45.6981, district: "СКФО" },
  { name: "Владикавказ", lat: 43.02, lon: 44.51, district: "СКФО" },
  { name: "Ставрополь", lat: 45.0445, lon: 41.9691, district: "СКФО" },
  { name: "Пятигорск", lat: 44.0486, lon: 43.0593, district: "СКФО" },
  { name: "Нальчик", lat: 43.49, lon: 43.6, district: "СКФО" },
  { name: "Черкесск", lat: 44.16, lon: 41.99, district: "СКФО" },
  { name: "Майкоп", lat: 44.61, lon: 40.11, district: "ЮФО" },
  { name: "Элиста", lat: 46.3077, lon: 44.2557, district: "ЮФО" },
  { name: "Астрахань", lat: 46.3479, lon: 48.0336, district: "ЮФО" },
  { name: "Симферополь", lat: 44.9525, lon: 34.1025, district: "ЮФО" },
  { name: "Севастополь", lat: 44.6054, lon: 33.518, district: "ЮФО" },
  { name: "Курган", lat: 55.43, lon: 65.32, district: "УФО" },
  { name: "Сургут", lat: 61.25, lon: 73.4, district: "УФО" },
  { name: "Тобольск", lat: 58.2, lon: 68.25, district: "УФО" },
  { name: "Томск", lat: 56.48, lon: 84.95, district: "СФО" },
  { name: "Кемерово", lat: 55.36, lon: 86.09, district: "СФО" },
  { name: "Барнаул", lat: 53.35, lon: 83.78, district: "СФО" },
  { name: "Иркутск", lat: 52.287, lon: 104.305, district: "СФО" },
  { name: "Чита", lat: 52.034, lon: 113.4999, district: "СФО" },
  { name: "Улан-Удэ", lat: 51.827, lon: 107.603, district: "СФО" },
  { name: "Якутск", lat: 62.03, lon: 129.73, district: "ДФО" },
  { name: "Южно-Сахалинск", lat: 46.95, lon: 142.74, district: "ДФО" },
  { name: "Магадан", lat: 59.56, lon: 150.8, district: "ДФО" },
  { name: "Комсомольск-на-Амуре", lat: 51.73, lon: 137.72, district: "ДФО" },
  { name: "Благовещенск", lat: 50.29, lon: 127.52, district: "ДФО" },
  { name: "Уссурийск", lat: 43.8, lon: 131.95, district: "ДФО" },
];

const normalizeCity = (s) =>
  String(s || "").trim().toLowerCase().replace(/^(г\.|город|с\.|п\.|пос\.|ст\.|д\.)\s*/i, "").replace(/ё/g, "е");

function findCity(name) {
  const n = normalizeCity(name);
  if (!n) return null;
  return CITIES.find((c) => normalizeCity(c.name) === n) || null;
}

function cityToDistrict(name) {
  const c = findCity(name);
  return c ? c.district : "";
}

/* расстояние в км по гаверсинусу; null если один из городов неизвестен */
function distanceKm(aName, bName) {
  const a = findCity(aName), b = findCity(bName);
  if (!a || !b) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Совпадение названий с учётом морфологии («Курске» ≈ «Курск») */
function looseMatch(aName, bName) {
  const na = normalizeCity(aName), nb = normalizeCity(bName);
  if (!na || !nb) return false;
  if (na === nb) return true;
  /* префиксное совпадение длинных основ (Курск/Курске, Воронеж/Воронеже) */
  const long = na.length >= nb.length ? na : nb, short = na.length >= nb.length ? nb : na;
  return short.length >= 5 && long.startsWith(short.slice(0, Math.max(5, short.length - 1)));
}

/* ---------- ЯДРО ГЕО-ФИЛЬТРА (для поиска и ленты) ----------
   geoAllowed(entity, buyerCity) → true, если сущность доступна
   покупателю из buyerCity. Пустой buyerCity = фильтр не применяется. */
function geoAllowed(entity, buyerCity) {
  if (!entity) return false;
  if (!buyerCity || !String(buyerCity).trim()) return true; // покупатель без города — без фильтра
  /* цифровые товары — мгновенная выдача, без географии */
  if (entity.digitalType || (entity.id && String(entity.id).startsWith("dp-"))) return true;

  const zone = entity.deliveryZone;
  const sellerCity = entity.sellerCity || entity.city || "";

  /* явные списки городов доставки/монтажа (ЭТАП 2, п.1) */
  const cities = Array.isArray(zone && zone.cities) ? zone.cities : [];
  const installCities = Array.isArray(entity.installCities) ? entity.installCities : [];
  const inDeliveryList = cities.some((c) => looseMatch(c, buyerCity));
  const inInstallList = installCities.some((c) => looseMatch(c, buyerCity));
  if (inDeliveryList || inInstallList) return true;

  /* FIX (аудит, п.1): явная ветка mode:"cities" — город покупателя НЕ в
     списке доставки/монтажа => запись ИСКЛЮЧАЕТСЯ из выборки даже при
     пустом sellerCity (раньше строка «гео не задан» пропускала такие
     записи, и хабаровский товар попадал к курянину). */
  if (zone && zone.mode === "cities") {
    if (sellerCity && looseMatch(sellerCity, buyerCity)) return true; // базовый город продавца тоже зона
    return false;
  }

  if (!zone || zone.mode === "nationwide") return true; // доставка по всей стране
  if (!sellerCity) return true;                          // гео не задан — не исключаем

  if (zone.mode === "city") {
    return looseMatch(sellerCity, buyerCity) || !!zone.withDistrict && looseMatch(sellerCity, buyerCity);
  }
  if (zone.mode === "region") {
    const ds = cityToDistrict(sellerCity), db_ = cityToDistrict(buyerCity);
    if (!ds || !db_) return looseMatch(sellerCity, buyerCity);
    return ds === db_;
  }
  if (zone.mode === "radius") {
    const km = distanceKm(sellerCity, buyerCity);
    if (km == null) return looseMatch(sellerCity, buyerCity);
    return km <= (Number(zone.km) || 50);
  }
  return true;
}

/* Установка/монтаж доступен именно в городе покупателя? */
function installAllowed(entity, buyerCity) {
  if (!entity || !buyerCity) return false;
  const list = Array.isArray(entity.installCities) ? entity.installCities : [];
  if (list.some((c) => looseMatch(c, buyerCity))) return true;
  /* крупногабарит без явного списка монтажа: монтаж там же, куда доставка nationwide */
  if (entity.largeSize && (!entity.deliveryZone || entity.deliveryZone.mode === "nationwide")) return true;
  return false;
}

/* ---------- КАЛЬКУЛЯТОР ЛОГИСТИКИ (СДЭК / Почта России) ----------
   priceFromKm — упрощённые детерминированные тарифные сетки:
   СДЭК: 250 ₽ база + 45 ₽/км (скорость выше);
   Почта: 180 ₽ база + 30 ₽/км (дешевле, дольше).
   Срок: ~1 день на 400 км + обработка 1–2 дня. */
function logisticsQuote(fromCity, toCity, opts) {
  const o = opts || {};
  const km = distanceKm(fromCity, toCity);
  if (km == null) return null; // неизвестные города — предложение не формируется
  const weightKg = Math.max(0.1, Number(o.weightKg) || 1);
  const factorW = 1 + Math.max(0, (weightKg - 1) * 0.08);
  const cdekPrice = Math.round((250 + 45 * km * factorW) / 5) * 5;
  const pochtaPrice = Math.round((180 + 30 * km * factorW) / 5) * 5;
  const transitDays = Math.max(1, Math.ceil(km / 400));
  return {
    km: Math.round(km),
    from: fromCity, to: toCity,
    options: [
      { carrier: "cdek", title: "СДЭК (курьер до двери)", price: cdekPrice, daysMin: transitDays, daysMax: transitDays + 2 },
      { carrier: "pochta", title: "Почта России (посылка)", price: pochtaPrice, daysMin: transitDays + 1, daysMax: transitDays + 4 },
    ],
  };
}

/* Фильтрация массива сущностей (товары/мастера) по городу покупателя */
function geoFilter(list, buyerCity) {
  const arr = Array.isArray(list) ? list : [];
  if (!buyerCity || !String(buyerCity).trim()) return arr;
  return arr.filter((e) => geoAllowed(e, buyerCity));
}

module.exports = { CITIES, normalizeCity, findCity, cityToDistrict, distanceKm, looseMatch, geoAllowed, geoFilter, installAllowed, logisticsQuote };
