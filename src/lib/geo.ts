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
export function canDeliver(p: Product, cityOrDistrict: string): boolean {
  /* цифровые товары не имеют географических ограничений — мгновенная выдача */
  if (p.id.startsWith("dp-")) return true;
  const vendorRegion = (vendorById(p.vendorId)?.production_region || "").trim();
  if (!vendorRegion) return true;

  const inputIsDistrict = DISTRICTS.some((d) => d.id === cityOrDistrict);
  const inputIsKnownCity = CITIES.some((c) => normalizeCity(c.name) === normalizeCity(cityOrDistrict));
  if (!inputIsDistrict && !inputIsKnownCity) return true;

  const buyerDistrict = inputIsDistrict ? cityOrDistrict : cityToDistrict(cityOrDistrict);

  const vendorIsDistrict = DISTRICTS.some((d) => d.id === vendorRegion);
  const vendorDistrict = vendorIsDistrict ? vendorRegion : cityToDistrict(vendorRegion);

  if (!buyerDistrict || !vendorDistrict) return true;

  if (LOCAL_ONLY.has(p.categoryId)) return vendorDistrict === buyerDistrict;

  if (LARGE.includes(p.categoryId)) {
    return vendorDistrict === buyerDistrict || vendorDistrict === "ЦФО" || vendorDistrict === "СЗФО";
  }

  return true;
}

export const vendorDistrictName = (p: Product): string => {
  const d = vendorById(p.vendorId)?.production_region || "";
  return DISTRICTS.find((x) => x.id === d)?.name || "округ не определён";
};

/* определение округа по городу (для регистрации и региональных настроек) */
export function cityToDistrict(city: string): string {
  const c = city.trim().toLowerCase();
  const known = CITIES.find((x) => x.name.toLowerCase() === c);
  if (known) return known.district;
  if (/(санкт|петербург|петрозаводск|архангельск|вологд|калининград|мурманск|новгород|псков)/.test(c)) return "СЗФО";
  if (/(краснодар|ростов|волгоград|астрахан|крым|севастополь|сочи|майкоп|элист)/.test(c)) return "ЮФО";
  if (/(махачкала|грозный|владикавказ|ставропол|пятигорск|нальчик|черкесск)/.test(c)) return "СКФО";
  if (/(екатеринбург|челябинск|тюмен|курган|ханты|ямал)/.test(c)) return "УФО";
  if (/(новосибирск|омск|красноярск|кемерово|томск|барнаул|иркутск|улан-удэ|чита)/.test(c)) return "СФО";
  if (/(владивосток|хабаровск|сахалин|камчат|магадан|якут|амур|байкал|благовещенск)/.test(c)) return "ДФО";
  if (/(казань|нижний новгород|самара|уфа|пермь|саратов|оренбург|пенза|ижевск|йошкар|саранск|чебоксар|киров|ульяновск)/.test(c)) return "ПФО";
  return "";
}


/* ---------- безопасная подпись округа (не врёт ЦФО для неизвестного города) ---------- */
export function safeDistrictLabel(city: string): string {
  const d = cityToDistrict(city);
  if (!d) return "округ не определён";
  return (DISTRICTS.find((x) => x.id === d)?.name || d) + " ФО";
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
  { name: "Рязань", lat: 54.6292, lon: 39.7357, district: "ЦФО" },
  { name: "Тамбов", lat: 52.7217, lon: 41.4519, district: "ЦФО" },
  { name: "Сергиев Посад", lat: 56.3145, lon: 38.1306, district: "ЦФО" },
  { name: "Углич", lat: 57.5254, lon: 38.3339, district: "ЦФО" },
  { name: "Ростов Великий", lat: 57.1894, lon: 39.4174, district: "ЦФО" },
  { name: "Мышкин", lat: 57.7886, lon: 38.4629, district: "ЦФО" },
  { name: "Плёс", lat: 57.5153, lon: 40.7883, district: "ЦФО" },
  { name: "Кинешма", lat: 57.4335, lon: 43.5762, district: "ЦФО" },
  { name: "Шуя", lat: 56.8681, lon: 40.8671, district: "ЦФО" },
  { name: "Гусь-Хрустальный", lat: 55.5854, lon: 40.6534, district: "ЦФО" },
  { name: "Мстёра", lat: 56.2711, lon: 41.8422, district: "ЦФО" },
  { name: "Елец", lat: 52.6168, lon: 38.5064, district: "ЦФО" },
  { name: "Данков", lat: 53.2533, lon: 39.1583, district: "ЦФО" },
  { name: "Ливны", lat: 52.4258, lon: 37.6178, district: "ЦФО" },
  { name: "Старый Оскол", lat: 51.3003, lon: 37.8301, district: "ЦФО" },
  { name: "Грайворон", lat: 50.4453, lon: 35.6019, district: "ЦФО" },
  { name: "Курчатов", lat: 51.6608, lon: 35.6464, district: "ЦФО" },
  { name: "Валдай", lat: 57.9387, lon: 33.2594, district: "ЦФО" },
  { name: "Ржев", lat: 56.2724, lon: 34.3958, district: "ЦФО" },
  { name: "Вышний Волочёк", lat: 57.0755, lon: 36.4434, district: "ЦФО" },
  { name: "Обнинск", lat: 55.0911, lon: 36.6109, district: "ЦФО" },
  { name: "Люберцы", lat: 55.6775, lon: 37.8952, district: "ЦФО" },
  { name: "Звенигород", lat: 55.7317, lon: 36.8544, district: "ЦФО" },
  { name: "Дмитров", lat: 56.3439, lon: 37.5203, district: "ЦФО" },
  { name: "Коломна", lat: 55.0827, lon: 38.7805, district: "ЦФО" },
  { name: "Серпухов", lat: 54.9113, lon: 37.4096, district: "ЦФО" },
  { name: "Клин", lat: 56.3339, lon: 36.7409, district: "ЦФО" },
  { name: "Павловский Посад", lat: 55.8689, lon: 38.6559, district: "ЦФО" },
  { name: "Богородск", lat: 55.8533, lon: 38.1719, district: "ЦФО" },
  { name: "Гжель", lat: 55.4453, lon: 38.8181, district: "ЦФО" },
  { name: "Семёнов", lat: 56.9291, lon: 44.4897, district: "ЦФО" },
  { name: "Боровск", lat: 55.2050, lon: 36.4700, district: "ЦФО" },
  { name: "Белёв", lat: 54.0100, lon: 37.0300, district: "ЦФО" },
  { name: "Таруса", lat: 54.8980, lon: 37.1400, district: "ЦФО" },
  { name: "Фрязино", lat: 55.9450, lon: 38.0500, district: "ЦФО" },
  { name: "Истра", lat: 55.9100, lon: 36.8600, district: "ЦФО" },
  { name: "Руза", lat: 55.7000, lon: 36.1000, district: "ЦФО" },
  { name: "Волоколамск", lat: 56.0100, lon: 36.0100, district: "ЦФО" },
  { name: "Калязин", lat: 57.1500, lon: 36.9000, district: "ЦФО" },
  { name: "Южа", lat: 56.7700, lon: 40.7100, district: "ЦФО" },
  { name: "Череповец", lat: 59.1217, lon: 37.9119, district: "СЗФО" },
  { name: "Вытегра", lat: 61.0079, lon: 36.4481, district: "СЗФО" },
  { name: "Беломорск", lat: 64.5272, lon: 34.7643, district: "СЗФО" },
  { name: "Сокол", lat: 59.5514, lon: 40.1075, district: "СЗФО" },
  { name: "Тихвин", lat: 59.6444, lon: 33.3997, district: "СЗФО" },
  { name: "Кириши", lat: 59.4530, lon: 32.1359, district: "СЗФО" },
  { name: "Выборг", lat: 60.7051, lon: 28.7501, district: "СЗФО" },
  { name: "Сортавала", lat: 61.7041, lon: 30.6917, district: "СЗФО" },
  { name: "Великие Луки", lat: 56.3444, lon: 30.4950, district: "СЗФО" },
  { name: "Осташков", lat: 57.1400, lon: 33.1100, district: "СЗФО" },
  { name: "Кировск", lat: 59.8700, lon: 31.0000, district: "СЗФО" },
  { name: "Лодейное Поле", lat: 60.2200, lon: 33.5200, district: "СЗФО" },
  { name: "Печоры", lat: 57.8200, lon: 27.6100, district: "СЗФО" },
  { name: "Изборск", lat: 57.7200, lon: 27.9000, district: "СЗФО" },
  { name: "Холм", lat: 57.1400, lon: 31.1900, district: "СЗФО" },
  { name: "Никольское", lat: 59.7000, lon: 35.5000, district: "СЗФО" },
  { name: "Белозерск", lat: 60.0500, lon: 37.7700, district: "СЗФО" },
  { name: "Устюжна", lat: 58.8400, lon: 36.4900, district: "СЗФО" },
  { name: "Вельск", lat: 61.0600, lon: 42.1000, district: "СЗФО" },
  { name: "Шенкурск", lat: 62.1000, lon: 42.9000, district: "СЗФО" },
  { name: "Мезень", lat: 65.0300, lon: 44.4700, district: "СЗФО" },
  { name: "Армавир", lat: 44.9228, lon: 41.1187, district: "ЮФО" },
  { name: "Анапа", lat: 44.8948, lon: 37.3164, district: "ЮФО" },
  { name: "Геленджик", lat: 44.6145, lon: 38.0903, district: "ЮФО" },
  { name: "Тимашёвск", lat: 45.6058, lon: 38.9228, district: "ЮФО" },
  { name: "Кропоткин", lat: 45.4300, lon: 40.5800, district: "ЮФО" },
  { name: "Приморско-Ахтарск", lat: 46.0500, lon: 38.1700, district: "ЮФО" },
  { name: "Азов", lat: 47.1111, lon: 39.4090, district: "ЮФО" },
  { name: "Шахты", lat: 47.7062, lon: 40.2150, district: "ЮФО" },
  { name: "Аксай", lat: 47.2600, lon: 39.8700, district: "ЮФО" },
  { name: "Каменск-Шахтинский", lat: 48.3100, lon: 40.0000, district: "ЮФО" },
  { name: "Камышин", lat: 49.8100, lon: 44.6900, district: "ЮФО" },
  { name: "Урюпинск", lat: 49.6900, lon: 41.9900, district: "ЮФО" },
  { name: "Фролово", lat: 49.7700, lon: 43.6500, district: "ЮФО" },
  { name: "Ейск", lat: 46.7100, lon: 38.2900, district: "ЮФО" },
  { name: "Темрюк", lat: 45.2600, lon: 36.7100, district: "ЮФО" },
  { name: "Лабинск", lat: 44.6400, lon: 40.7100, district: "ЮФО" },
  { name: "Апшеронск", lat: 44.4500, lon: 40.1800, district: "ЮФО" },
  { name: "Северская", lat: 44.7800, lon: 40.3700, district: "ЮФО" },
  { name: "Вёшенская", lat: 49.3500, lon: 42.9600, district: "ЮФО" },
  { name: "Миллерово", lat: 48.6200, lon: 40.4000, district: "ЮФО" },
  { name: "Симферополь", lat: 44.9525, lon: 34.1025, district: "ЮФО" },
  { name: "Ялта", lat: 44.4952, lon: 34.1667, district: "ЮФО" },
  { name: "Феодосия", lat: 45.0300, lon: 35.3800, district: "ЮФО" },
  { name: "Керчь", lat: 45.3600, lon: 36.4700, district: "ЮФО" },
  { name: "Кисловодск", lat: 43.9067, lon: 42.7201, district: "СКФО" },
  { name: "Ессентуки", lat: 44.0450, lon: 42.8590, district: "СКФО" },
  { name: "Железноводск", lat: 43.9400, lon: 42.9500, district: "СКФО" },
  { name: "Пятигорск", lat: 44.0486, lon: 43.0593, district: "СКФО" },
  { name: "Минеральные Воды", lat: 44.2100, lon: 43.1400, district: "СКФО" },
  { name: "Невинномысск", lat: 44.6200, lon: 41.9400, district: "СКФО" },
  { name: "Будённовск", lat: 44.7700, lon: 44.1700, district: "СКФО" },
  { name: "Теберда", lat: 43.4500, lon: 41.6800, district: "СКФО" },
  { name: "Домбай", lat: 43.4800, lon: 41.6000, district: "СКФО" },
  { name: "Архыз", lat: 43.5600, lon: 41.2700, district: "СКФО" },
  { name: "Нальчик", lat: 43.4900, lon: 43.6000, district: "СКФО" },
  { name: "Майкоп", lat: 44.6100, lon: 40.1100, district: "ЮФО" },
  { name: "Карачаевск", lat: 43.7800, lon: 41.9000, district: "СКФО" },
  { name: "Черкесск", lat: 44.1600, lon: 41.9900, district: "СКФО" },
  { name: "Сунжа", lat: 43.3600, lon: 44.9100, district: "СКФО" },
  { name: "Гудермес", lat: 43.3200, lon: 46.1200, district: "СКФО" },
  { name: "Аргун", lat: 43.2800, lon: 45.9000, district: "СКФО" },
  { name: "Шали", lat: 43.1300, lon: 45.9400, district: "СКФО" },
  { name: "Буйнакск", lat: 42.7700, lon: 47.1200, district: "СКФО" },
  { name: "Дербент", lat: 42.0600, lon: 48.2900, district: "СКФО" },
  { name: "Каспийск", lat: 42.8900, lon: 47.6400, district: "СКФО" },
  { name: "Избербаш", lat: 42.5600, lon: 47.8700, district: "СКФО" },
  { name: "Магас", lat: 43.1800, lon: 44.8200, district: "СКФО" },
  { name: "Владикавказ", lat: 43.0200, lon: 44.5100, district: "СКФО" },
  { name: "Моздок", lat: 43.7400, lon: 44.1600, district: "СКФО" },
  { name: "Балаково", lat: 51.9700, lon: 47.8200, district: "ПФО" },
  { name: "Сызрань", lat: 53.1400, lon: 48.4200, district: "ПФО" },
  { name: "Тольятти", lat: 53.5075, lon: 49.4208, district: "ПФО" },
  { name: "Стерлитамак", lat: 53.6500, lon: 55.9400, district: "ПФО" },
  { name: "Салават", lat: 53.3600, lon: 55.9200, district: "ПФО" },
  { name: "Сибай", lat: 52.7900, lon: 58.6800, district: "ПФО" },
  { name: "Октябрьский", lat: 54.4900, lon: 53.2000, district: "ПФО" },
  { name: "Чайковский", lat: 56.7800, lon: 54.1300, district: "ПФО" },
  { name: "Березники", lat: 59.4100, lon: 56.8300, district: "ПФО" },
  { name: "Саров", lat: 54.9400, lon: 43.3300, district: "ПФО" },
  { name: "Арзамас", lat: 56.1200, lon: 43.8200, district: "ПФО" },
  { name: "Павлово", lat: 55.9400, lon: 43.0800, district: "ПФО" },
  { name: "Ветлуга", lat: 57.8900, lon: 46.3600, district: "ПФО" },
  { name: "Юрьевец", lat: 57.3200, lon: 43.1200, district: "ПФО" },
  { name: "Мамадыш", lat: 55.7100, lon: 51.1700, district: "ПФО" },
  { name: "Елабуга", lat: 55.7500, lon: 52.0600, district: "ПФО" },
  { name: "Алатырь", lat: 54.9400, lon: 46.5800, district: "ПФО" },
  { name: "Чебоксары", lat: 56.1300, lon: 47.2500, district: "ПФО" },
  { name: "Йошкар-Ола", lat: 56.6300, lon: 47.8900, district: "ПФО" },
  { name: "Саранск", lat: 54.1800, lon: 45.1800, district: "ПФО" },
  { name: "Пенза", lat: 53.1900, lon: 45.0100, district: "ПФО" },
  { name: "Балашов", lat: 52.9700, lon: 45.5500, district: "ПФО" },
  { name: "Петровск", lat: 50.5100, lon: 45.7500, district: "ПФО" },
  { name: "Хвалынск", lat: 52.5000, lon: 48.0900, district: "ПФО" },
  { name: "Бузулук", lat: 52.7900, lon: 52.2700, district: "ПФО" },
  { name: "Соль-Илецк", lat: 51.1600, lon: 54.9900, district: "ПФО" },
  { name: "Орск", lat: 51.2100, lon: 58.5700, district: "ПФО" },
  { name: "Чистополь", lat: 54.9400, lon: 52.1100, district: "ПФО" },
  { name: "Зеленодольск", lat: 55.8800, lon: 48.5300, district: "ПФО" },
  { name: "Альметьевск", lat: 54.9000, lon: 52.3000, district: "ПФО" },
  { name: "Нижнекамск", lat: 55.6400, lon: 51.8200, district: "ПФО" },
  { name: "Болгар", lat: 54.9700, lon: 49.0500, district: "ПФО" },
  { name: "Нижний Тагил", lat: 57.9000, lon: 59.9800, district: "УФО" },
  { name: "Магнитогорск", lat: 53.4200, lon: 58.9800, district: "УФО" },
  { name: "Сургут", lat: 61.2500, lon: 73.4000, district: "УФО" },
  { name: "Нижневартовск", lat: 60.9300, lon: 76.5500, district: "УФО" },
  { name: "Новый Уренгой", lat: 66.0800, lon: 76.6300, district: "УФО" },
  { name: "Надым", lat: 66.5300, lon: 72.4200, district: "УФО" },
  { name: "Когалым", lat: 61.2600, lon: 68.1200, district: "УФО" },
  { name: "Мегион", lat: 61.0300, lon: 67.7000, district: "УФО" },
  { name: "Тобольск", lat: 58.2000, lon: 68.2500, district: "УФО" },
  { name: "Ишим", lat: 56.1100, lon: 69.4700, district: "УФО" },
  { name: "Ялуторовск", lat: 56.8800, lon: 66.1800, district: "УФО" },
  { name: "Курган", lat: 55.4300, lon: 65.3200, district: "УФО" },
  { name: "Шадринск", lat: 56.0900, lon: 63.6100, district: "УФО" },
  { name: "Миасс", lat: 55.0300, lon: 60.2400, district: "УФО" },
  { name: "Златоуст", lat: 55.1700, lon: 59.6500, district: "УФО" },
  { name: "Озёрск", lat: 55.7700, lon: 60.7000, district: "УФО" },
  { name: "Сатка", lat: 55.0200, lon: 59.0300, district: "УФО" },
  { name: "Верхняя Пышма", lat: 56.9700, lon: 60.5800, district: "УФО" },
  { name: "Первоуральск", lat: 56.9000, lon: 59.9500, district: "УФО" },
  { name: "Каменск-Уральский", lat: 56.4200, lon: 61.9400, district: "УФО" },
  { name: "Серов", lat: 57.9800, lon: 60.5400, district: "УФО" },
  { name: "Кушва", lat: 57.0500, lon: 60.6000, district: "УФО" },
  { name: "Невьянск", lat: 57.4900, lon: 60.2100, district: "УФО" },
  { name: "Алапаевск", lat: 56.9400, lon: 61.7100, district: "УФО" },
  { name: "Ирбит", lat: 57.0500, lon: 63.8800, district: "УФО" },
  { name: "Томск", lat: 56.4800, lon: 84.9500, district: "СФО" },
  { name: "Кемерово", lat: 55.3600, lon: 86.0900, district: "СФО" },
  { name: "Новокузнецк", lat: 53.7500, lon: 87.1100, district: "СФО" },
  { name: "Барнаул", lat: 53.3500, lon: 83.7800, district: "СФО" },
  { name: "Бийск", lat: 52.5400, lon: 85.2100, district: "СФО" },
  { name: "Рубцовск", lat: 51.5000, lon: 81.2000, district: "СФО" },
  { name: "Томмот", lat: 56.9500, lon: 106.0700, district: "ДФО" },
  { name: "Железногорск", lat: 56.2500, lon: 93.5500, district: "СФО" },
  { name: "Минусинск", lat: 56.1100, lon: 91.6800, district: "СФО" },
  { name: "Абакан", lat: 53.7200, lon: 91.4400, district: "СФО" },
  { name: "Кызыл", lat: 51.7200, lon: 94.4400, district: "СФО" },
  { name: "Горно-Алтайск", lat: 51.9300, lon: 85.8200, district: "СФО" },
  { name: "Белокуриха", lat: 51.9900, lon: 84.9800, district: "СФО" },
  { name: "Камень-на-Оби", lat: 52.3400, lon: 78.6400, district: "СФО" },
  { name: "Славгород", lat: 53.0000, lon: 78.6500, district: "СФО" },
  { name: "Татарск", lat: 55.2200, lon: 72.4400, district: "СФО" },
  { name: "Калачинск", lat: 55.0300, lon: 74.5700, district: "СФО" },
  { name: "Балей", lat: 51.5200, lon: 116.7400, district: "ДФО" },
  { name: "Краснокаменск", lat: 42.9000, lon: 114.1300, district: "ДФО" },
  { name: "Ноябрьск", lat: 65.9300, lon: 73.3800, district: "УФО" },
  { name: "Благовещенск", lat: 50.2900, lon: 127.5200, district: "ДФО" },
  { name: "Якутск", lat: 62.0300, lon: 129.7300, district: "ДФО" },
  { name: "Южно-Сахалинск", lat: 46.9500, lon: 142.7400, district: "ДФО" },
  { name: "Магадан", lat: 59.5600, lon: 150.8000, district: "ДФО" },
  { name: "Петропавловск-Камчатский", lat: 53.0500, lon: 158.6500, district: "ДФО" },
  { name: "Уссурийск", lat: 43.8000, lon: 131.9500, district: "ДФО" },
  { name: "Находка", lat: 42.8300, lon: 132.8900, district: "ДФО" },
  { name: "Комсомольск-на-Амуре", lat: 51.7300, lon: 137.7200, district: "ДФО" },
  { name: "Амурск", lat: 50.2400, lon: 136.8900, district: "ДФО" },
  { name: "Свободный", lat: 51.4700, lon: 128.1100, district: "ДФО" },
  { name: "Тыда", lat: 55.1900, lon: 124.7700, district: "ДФО" },
  { name: "Нерюнгри", lat: 56.6500, lon: 124.8800, district: "ДФО" },
  { name: "Ленинское", lat: 48.6500, lon: 133.1500, district: "ДФО" },
  { name: "Бикин", lat: 46.8300, lon: 135.2500, district: "ДФО" },
  { name: "Чегдомын", lat: 47.9000, lon: 136.9400, district: "ДФО" },
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
  if (zone.mode === "region") return "🏛 " + safeDistrictLabel(sellerCity);
  return "🇷🇺 По России";
}
