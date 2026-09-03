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
