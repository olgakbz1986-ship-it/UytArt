import { Product, vendorById } from "../data/seed";

/* ---------- федеральные округа ---------- */
export const DISTRICTS = [
  { id: "ЦФО", name: "Центральный" },
  { id: "СЗФО", name: "Северо-Западный" },
  { id: "ЮФО", name: "Южный" },
  { id: "СКФО", name: "Северо-Кавказский" },
  { id: "ПФО", name: "Приволжский" },
  { id: "УФО", name: "Уральский" },
  { id: "СФО", name: "Сибирский" },
  { id: "ДФО", name: "Дальневосточный" },
] as const;
export type DistrictId = (typeof DISTRICTS)[number]["id"];

/* Крупногабарит и «локальные» категории: доставка ограничена округом производства */
const LOCAL_ONLY = new Set(["furniture", "mirrors"]);
const LARGE = ["lighting"];

/* сможет ли продавец доставить товар в округ покупателя */
export function canDeliver(p: Product, district: string): boolean {
  if (LOCAL_ONLY.has(p.categoryId)) return vendorById(p.vendorId)?.production_region === district;
  if (LARGE.includes(p.categoryId)) {
    const own = vendorById(p.vendorId)?.production_region;
    return own === district || own === "ЦФО" || own === "СЗФО";
  }
  return true;
}

export const vendorDistrictName = (p: Product): string => {
  const d = vendorById(p.vendorId)?.production_region || "ЦФО";
  return DISTRICTS.find((x) => x.id === d)?.name || d;
};

/* определение округа по городу (для регистрации и региональных настроек) */
export function cityToDistrict(city: string): string {
  const c = city.trim().toLowerCase();
  if (/(санкт|петербург|петрозаводск|архангельск|вологд|калининград|мурманск|новгород|псков)/.test(c)) return "СЗФО";
  if (/(краснодар|ростов|волгоград|астрахан|крым|севастополь|сочи|майкоп|элист)/.test(c)) return "ЮФО";
  if (/(махачкала|грозный|владикавказ|ставропол|пятигорск|нальчик|черкесск)/.test(c)) return "СКФО";
  if (/(екатеринбург|челябинск|тюмен|курган|ханты|ямал)/.test(c)) return "УФО";
  if (/(новосибирск|омск|красноярск|кемерово|томск|барнаул|иркутск|улан-удэ|чита)/.test(c)) return "СФО";
  if (/(владивосток|хабаровск|сахалин|камчат|магадан|якут|амур|байкал|благовещенск)/.test(c)) return "ДФО";
  if (/(казань|нижний новгород|самара|уфа|пермь|саратов|оренбург|пенза|ижевск|йошкар|саранск|чебоксар|киров|ульяновск)/.test(c)) return "ПФО";
  return "ЦФО";
}


/* ---------- справочник городов РФ для гео-зон ---------- */
export const CITIES: { name: string; lat: number; lon: number; district: string }[] = [
  { name: "Москва", lat: 55.7558, lon: 37.6173, district: "ЦФО" },
  { name: "Санкт-Петербург", lat: 59.9311, lon: 30.3609, district: "СЗФО" },
  { name: "Курск", lat: 51.7308, lon: 36.1932, district: "ЦФО" },
  { name: "Воронеж", lat: 51.6720, lon: 39.1843, district: "ЦФО" },
  { name: "Белгород", lat: 50.5997, lon: 36.5882, district: "ЦФО" },
  { name: "Орёл", lat: 52.9651, lon: 36.0785, district: "ЦФО" },
  { name: "Брянск", lat: 53.2521, lon: 34.3717, district: "ЦФО" },
  { name: "Липецк", lat: 52.6031, lon: 39.5708, district: "ЦФО" },
  { name: "Тула", lat: 54.1961, lon: 37.6182, district: "ЦФО" },
  { name: "Калуга", lat: 54.5138, lon: 36.2604, district: "ЦФО" },
  { name: "Смоленск", lat: 54.7818, lon: 32.0401, district: "ЦФО" },
  { name: "Тверь", lat: 56.8587, lon: 35.9176, district: "ЦФО" },
  { name: "Ярославль", lat: 57.6261, lon: 39.8845, district: "ЦФО" },
  { name: "Владимир", lat: 56.1291, lon: 40.4070, district: "ЦФО" },
  { name: "Нижний Новгород", lat: 56.2965, lon: 43.9361, district: "ПФО" },
  { name: "Казань", lat: 55.7887, lon: 49.1221, district: "ПФО" },
  { name: "Самара", lat: 53.1959, lon: 50.1008, district: "ПФО" },
  { name: "Екатеринбург", lat: 56.8389, lon: 60.6057, district: "УФО" },
  { name: "Челябинск", lat: 55.1644, lon: 61.4368, district: "УФО" },
  { name: "Новосибирск", lat: 55.0084, lon: 82.9357, district: "СФО" },
  { name: "Омск", lat: 54.9885, lon: 73.3242, district: "СФО" },
  { name: "Краснодар", lat: 45.0355, lon: 38.9753, district: "ЮФО" },
  { name: "Ростов-на-Дону", lat: 47.2357, lon: 39.7015, district: "ЮФО" },
  { name: "Волгоград", lat: 48.7080, lon: 44.5133, district: "ЮФО" },
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
  { name: "Иркутск", lat: 52.2870, lon: 104.3050, district: "СФО" },
  { name: "Владивосток", lat: 43.1155, lon: 131.8855, district: "ДФО" },
  { name: "Хабаровск", lat: 48.4827, lon: 135.0838, district: "ДФО" },
];

/* расстояние в км по формуле гаверсинуса */
export function distanceKm(a: string, b: string): number {
  const ca = CITIES.find((c) => c.name.toLowerCase() === a.trim().toLowerCase());
  const cb = CITIES.find((c) => c.name.toLowerCase() === b.trim().toLowerCase());
  if (!ca || !cb) return 9999;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(cb.lat - ca.lat);
  const dLon = toRad(cb.lon - ca.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(ca.lat)) * Math.cos(toRad(cb.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* соответствует ли товар зоне доставки для покупателя в городе buyerCity */
export const normalizeCity = (s: string): string =>
  s.trim().toLowerCase().replace(/^(г\.|город|с\.|п\.|пос\.|ст\.|д\.)\s*/i, "").replace(/ё/g, "е");

const nameMatch = (a: string, b: string): boolean => {
  const na = normalizeCity(a), nb = normalizeCity(b);
  return na === nb || na.includes(nb) || nb.includes(na);
};
const bothKnown = (a: string, b: string): boolean =>
  CITIES.some((c) => normalizeCity(c.name) === normalizeCity(a)) && CITIES.some((c) => normalizeCity(c.name) === normalizeCity(b));

export function isZoneMatch(
  zone: { mode: "city" | "radius" | "region" | "nationwide"; km?: number; withDistrict?: boolean } | undefined,
  sellerCity: string,
  buyerCity: string,
): boolean {
  if (!zone || zone.mode === "nationwide") return true;
  if (!sellerCity || !buyerCity) return true;
  const na = normalizeCity(sellerCity), nb = normalizeCity(buyerCity);
  if (zone.mode === "city") return na === nb || (!!zone.withDistrict && nameMatch(sellerCity, buyerCity));
  if (zone.mode === "region") return bothKnown(sellerCity, buyerCity) ? cityToDistrict(sellerCity) === cityToDistrict(buyerCity) : nameMatch(sellerCity, buyerCity);
  if (zone.mode === "radius") return bothKnown(sellerCity, buyerCity) ? distanceKm(sellerCity, buyerCity) <= (zone.km || 50) : nameMatch(sellerCity, buyerCity);
  return true;
}

export function zoneLabel(zone: { mode: "city" | "radius" | "region" | "nationwide"; km?: number; withDistrict?: boolean } | undefined, sellerCity: string): string {
  if (!zone || zone.mode === "nationwide") return "🇷🇺 По России";
  if (zone.mode === "city") return "📍 Только " + (sellerCity || "город продавца") + (zone.withDistrict ? " и район" : "");
  if (zone.mode === "radius") return "🚚 до " + (zone.km || 50) + " км от " + (sellerCity || "...");
  if (zone.mode === "region") return "🏛 " + (DISTRICTS.find((d) => d.id === cityToDistrict(sellerCity))?.name || "округ");
  return "🇷🇺 По России";
}
