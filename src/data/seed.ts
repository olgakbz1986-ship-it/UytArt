/* ============================================================
   УютАрт — слой данных.
   8 групп каталога → 41 категория → подкатегории → ~230 товаров.
   ============================================================ */

export const OPERATOR = {
  name: "Общество с ограниченной ответственностью «СтартТехноПро»",
  short: "ООО «СтартТехноПро»",
  inn: "4632275840",
  kpp: "463201001",
  domain: "uyutart.ru",
  legalEmail: "legal@uyutart.ru",
  supportEmail: "support@uyutart.ru",
  status: "Информационный агрегатор (ст. 12 ЗоЗПП), не является продавцом",
};

export type ProductType = "ready_made" | "custom_made";

/* ---------- 8 групп каталога ---------- */
export const GROUPS = [
  { id: "home", name: "Декор и дом", emoji: "🏠", desc: "Текстиль, керамика, свет и мебель" },
  { id: "fashion", name: "Одежда и обувь", emoji: "👗", desc: "Авторская одежда и обувь" },
  { id: "accessories", name: "Аксессуары", emoji: "👜", desc: "Сумки, украшения, часы" },
  { id: "tech", name: "Техника", emoji: "📱", desc: "Гаджеты, аудио, умный дом" },
  { id: "hardware", name: "Фурнитура", emoji: "🔧", desc: "Инструменты, крепёж, замки" },
  { id: "lifestyle", name: "Быт и сад", emoji: "🪴", desc: "Посуда, хранение, сад" },
  { id: "beauty", name: "Красота", emoji: "🧴", desc: "Уход и косметика" },
  { id: "hobby", name: "Хобби", emoji: "🎨", desc: "Творчество и игры" },
];
export const groupById = (id: string) => GROUPS.find((g) => g.id === id);

export const GROUP_IMG: Record<string, string> = {
  home: "https://image.qwenlm.ai/generated-images/74dccccd-f86c-4f10-b4ac-ebf41c899d76/_result.png",
  fashion: "https://image.qwenlm.ai/generated-images/dfa43fe6-81d0-4256-b409-8b85ae11fd3b/_result.png",
  accessories: "https://image.qwenlm.ai/generated-images/be1a669a-e043-4389-8f66-1348de232e30/_result.png",
  tech: "https://image.qwenlm.ai/generated-images/3b39ac23-cc8a-4d8b-a251-5986b0767844/_result.png",
  hardware: "https://image.qwenlm.ai/generated-images/d6739337-de1d-4aa8-a8f6-4c75ef66a4f1/_result.png",
  lifestyle: "https://image.qwenlm.ai/generated-images/8f059882-4120-4d53-86de-2aed9be0e14a/_result.png",
  beauty: "https://image.qwenlm.ai/generated-images/326026d2-bc84-400e-ae46-0bf5612faf8d/_result.png",
  hobby: "https://image.qwenlm.ai/generated-images/9a330681-dd17-4dbb-92e3-8b476ca6eea5/_result.png",
};

/* ---------- категории с подкатегориями ---------- */
export interface SubCategory { slug: string; name: string; }
export interface Category {
  slug: string; name: string; emoji: string; group: string; desc: string; subs: SubCategory[];
}
const sub = (list: string[]): SubCategory[] =>
  list.map((name) => ({ slug: name.toLowerCase().replace(/[^а-яa-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""), name }));

export const CATEGORIES: Category[] = [
  /* --- Декор и дом (12) --- */
  { slug: "textile", name: "Текстиль", emoji: "🧶", group: "home", desc: "Лён, хлопок и шерсть северных мануфактур.", subs: sub(["Подушки", "Пледы", "Шторы", "Ковры", "Скатерти", "Полотенца", "Постельное бельё", "Чехлы"]) },
  { slug: "ceramics", name: "Керамика", emoji: "🏺", group: "home", desc: "Кружки, вазы и сервизы ручного обжига.", subs: sub(["Кружки", "Тарелки", "Вазы", "Чайники", "Пиалы", "Сервизы", "Кувшины", "Маслёнки"]) },
  { slug: "lighting", name: "Освещение", emoji: "💡", group: "home", desc: "Авторские лампы и светильники.", subs: sub(["Настольные лампы", "Торшеры", "Подвесные", "Бра", "Ночники", "Гирлянды"]) },
  { slug: "mirrors", name: "Зеркала", emoji: "🪞", group: "home", desc: "Зеркала в рамах из ротанга и дуба.", subs: sub(["В раме", "Настенные", "Напольные", "Настольные", "С подсветкой"]) },
  { slug: "wood", name: "Дерево и плетение", emoji: "🪵", group: "home", desc: "Доски, корзины и шкатулки.", subs: sub(["Разделочные доски", "Корзины", "Шкатулки", "Подносы", "Полки", "Кашпо"]) },
  { slug: "candles", name: "Свечи и ароматы", emoji: "🕯️", group: "home", desc: "Соевый воск и эфирные масла.", subs: sub(["Соевые свечи", "Диффузоры", "Саше", "Благовония", "Подсвечники"]) },
  { slug: "art", name: "Картины и постеры", emoji: "🖼️", group: "home", desc: "Живопись, гравюры, постеры.", subs: sub(["Картины", "Постеры", "Гравюры", "Абстракции", "Иллюстрации"]) },
  { slug: "wall", name: "Декор для стен", emoji: "🪢", group: "home", desc: "Панно, макраме, часы.", subs: sub(["Панно", "Макраме", "Часы", "Наклейки", "Молдинги"]) },
  { slug: "kitchen", name: "Кухонный декор", emoji: "🍽️", group: "home", desc: "Приборы, доски, фартуки.", subs: sub(["Приборы", "Доски", "Ёмкости", "Прихватки", "Фартуки", "Органайзеры"]) },
  { slug: "bathroom", name: "Декор для ванной", emoji: "🛁", group: "home", desc: "Дозаторы, корзины, шторки.", subs: sub(["Дозаторы", "Мыльницы", "Корзины", "Шторки", "Коврики"]) },
  { slug: "smart", name: "Умный дом", emoji: "🔌", group: "home", desc: "Розетки, датчики, замки.", subs: sub(["Умные розетки", "Датчики", "Термостаты", "Камеры", "Замки", "Помощники"]) },
  { slug: "furniture", name: "Мебель", emoji: "🪑", group: "home", desc: "Массив дуба и сосны.", subs: sub(["Табуреты", "Стеллажи", "Тумбы", "Пуфы", "Консоли", "Столики"]) },

  /* --- Одежда и обувь (5) --- */
  { slug: "women", name: "Женская одежда", emoji: "👗", group: "fashion", desc: "Платья, костюмы, блузы.", subs: sub(["Платья", "Костюмы", "Блузы", "Юбки", "Трикотаж"]) },
  { slug: "men", name: "Мужская одежда", emoji: "👔", group: "fashion", desc: "Рубашки, брюки, свитеры.", subs: sub(["Рубашки", "Брюки", "Свитеры", "Футболки"]) },
  { slug: "shoes", name: "Обувь", emoji: "👞", group: "fashion", desc: "Ручная обувь из кожи.", subs: sub(["Туфли", "Ботинки", "Кроссовки", "Сандалии"]) },
  { slug: "outerwear", name: "Верхняя одежда", emoji: "🧥", group: "fashion", desc: "Пальто, куртки, жилеты.", subs: sub(["Пальто", "Куртки", "Жилеты", "Плащи"]) },
  { slug: "kids", name: "Детская одежда", emoji: "🧒", group: "fashion", desc: "Одежда для детей.", subs: sub(["Для малышей", "Для школьников", "Комбинезоны"]) },

  /* --- Аксессуары (5) --- */
  { slug: "bags", name: "Сумки", emoji: "👜", group: "accessories", desc: "Сумки из натуральной кожи.", subs: sub(["Тоуты", "Кросс-боди", "Рюкзаки", "Клатчи"]) },
  { slug: "belts", name: "Ремни", emoji: "🪢", group: "accessories", desc: "Ремни ручной прошивки.", subs: sub(["Кожаные", "Плетёные", "С пряжкой"]) },
  { slug: "jewelry", name: "Украшения", emoji: "💍", group: "accessories", desc: "Серебро, латунь, камни.", subs: sub(["Кольца", "Серьги", "Браслеты", "Подвески"]) },
  { slug: "hats", name: "Шапки и шарфы", emoji: "🧣", group: "accessories", desc: "Вязаные шапки и шарфы.", subs: sub(["Шапки", "Шарфы", "Береты", "Перчатки"]) },
  { slug: "watches", name: "Часы", emoji: "⌚", group: "accessories", desc: "Механика и минимализм.", subs: sub(["Механические", "Кварцевые", "Ремешки"]) },

  /* --- Техника (5) --- */
  { slug: "gadgets", name: "Гаджеты", emoji: "📱", group: "tech", desc: "Смартфоны и аксессуары.", subs: sub(["Смартфоны", "Чехлы", "Зарядки", "Держатели"]) },
  { slug: "audio", name: "Аудио", emoji: "🎧", group: "tech", desc: "Наушники и колонки.", subs: sub(["Наушники", "Колонки", "Винил", "Усилители"]) },
  { slug: "smarthome", name: "Умные устройства", emoji: "🏡", group: "tech", desc: "Датчики и хабы.", subs: sub(["Хабы", "Лампочки", "Розетки", "Камеры"]) },
  { slug: "computers", name: "Компьютеры", emoji: "💻", group: "tech", desc: "Ноутбуки и периферия.", subs: sub(["Ноутбуки", "Клавиатуры", "Мыши", "Мониторы"]) },
  { slug: "photo", name: "Фото и видео", emoji: "📷", group: "tech", desc: "Камеры и объективы.", subs: sub(["Камеры", "Объективы", "Штативы", "Свет"]) },

  /* --- Фурнитура (5) --- */
  { slug: "tools", name: "Инструменты", emoji: "🔨", group: "hardware", desc: "Ручной и электроинструмент.", subs: sub(["Ручные", "Электро", "Измерительные", "Наборы"]) },
  { slug: "fasteners", name: "Крепёж", emoji: "🔩", group: "hardware", desc: "Саморезы, болты, анкеры.", subs: sub(["Саморезы", "Болты", "Анкеры", "Уголки"]) },
  { slug: "locks", name: "Замки и ручки", emoji: "🔑", group: "hardware", desc: "Дверная фурнитура.", subs: sub(["Замки", "Ручки", "Петли", "Доводчики"]) },
  { slug: "plumbing", name: "Сантехника", emoji: "🚿", group: "hardware", desc: "Смесители и фитинги.", subs: sub(["Смесители", "Фитинги", "Шланги", "Сифоны"]) },
  { slug: "electric", name: "Электрика", emoji: "⚡", group: "hardware", desc: "Розетки и выключатели.", subs: sub(["Розетки", "Выключатели", "Кабели", "Автоматы"]) },

  /* --- Быт и сад (5) --- */
  { slug: "garden", name: "Сад", emoji: "🌿", group: "lifestyle", desc: "Инвентарь и кашпо.", subs: sub(["Инвентарь", "Кашпо", "Семена", "Грунт"]) },
  { slug: "tableware", name: "Посуда", emoji: "🍲", group: "lifestyle", desc: "Кастрюли, сковороды, формы.", subs: sub(["Кастрюли", "Сковороды", "Формы", "Ножи"]) },
  { slug: "storage", name: "Хранение", emoji: "📦", group: "lifestyle", desc: "Органайзеры и контейнеры.", subs: sub(["Органайзеры", "Контейнеры", "Коробки", "Вешалки"]) },
  { slug: "cleaning", name: "Уборка и уход", emoji: "🧹", group: "lifestyle", desc: "Щётки и средства.", subs: sub(["Щётки", "Тряпки", "Средства", "Губки"]) },
  { slug: "pets", name: "Товары для питомцев", emoji: "🐾", group: "lifestyle", desc: "Лежанки и миски.", subs: sub(["Лежанки", "Миски", "Игрушки", "Когтеточки"]) },

  /* --- Красота (2) --- */
  { slug: "care", name: "Уход", emoji: "🧼", group: "beauty", desc: "Мыло, кремы, масла.", subs: sub(["Мыло", "Кремы", "Масла", "Скрабы"]) },
  { slug: "cosmetics", name: "Косметика", emoji: "💄", group: "beauty", desc: "Декоративная косметика.", subs: sub(["Для лица", "Для губ", "Для глаз", "Кисти"]) },

  /* --- Хобби (2) --- */
  { slug: "craft", name: "Творчество", emoji: "🎨", group: "hobby", desc: "Краски, холсты, наборы.", subs: sub(["Краски", "Холсты", "Наборы", "Инструменты"]) },
  { slug: "games", name: "Игры", emoji: "🎲", group: "hobby", desc: "Настольные игры и пазлы.", subs: sub(["Настольные", "Пазлы", "Головоломки"]) },
];
export const catBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const catsByGroup = (group: string) => CATEGORIES.filter((c) => c.group === group);
export const catImage = (catSlug: string) => {
  const c = catBySlug(catSlug);
  return c ? GROUP_IMG[c.group] : undefined;
};

/* ---------- мастера ---------- */
export interface Vendor {
  id: string; slug: string; name: string; emoji: string; avatarColor: string;
  legal_name: string; legal_form: string; inn: string; ogrn: string;
  city: string; production_region: string; verified: boolean;
  rating: number; reviewsCount: number; sales: number; since: number;
  description: string;
}
const slugify = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "");
const vend = (id: string, name: string, emoji: string, color: string, city: string, region: string, legal_form: string, inn: string, since: number, rating: number, sales: number, description: string): Vendor => ({
  id, slug: slugify(name), name, emoji, avatarColor: color,
  legal_name: legal_form === "ИП" ? `ИП ${name}` : legal_form === "ООО" ? `ООО «${name}»` : `Самозанятый ${name}`,
  legal_form, inn, ogrn: "32160270001" + id.slice(1) + "345",
  city, production_region: region, verified: rating >= 4.7,
  rating, reviewsCount: Math.round(sales / 8), sales, since, description,
});
export const VENDORS: Vendor[] = [
  vend("v1", "Глиняный дом", "🏺", "#1e3a2f", "Псков", "СЗФО", "ИП", "602709876543", 2016, 4.9, 3840, "Гончарная династия в третьем поколении. Кружка обжигается при 1250 °C и помнит тепло рук."),
  vend("v2", "Северный лён", "🧶", "#2d5f4c", "Великий Новгород", "СЗФО", "ООО", "5321098765", 1998, 4.8, 6120, "Ткут лён с 1998 года. Пледы, шторы и бельё, которые становятся мягче с каждой стиркой."),
  vend("v3", "Тепло и Свет", "💡", "#d98e32", "Санкт-Петербург", "СЗФО", "ИП", "781434567890", 2019, 4.9, 2210, "Петербургская мастерская света: керамика, латунь и лён. Тёплый свет 2700К."),
  vend("v4", "Воск и Травы", "🕯️", "#7cb342", "Краснодар", "ЮФО", "Самозанятый", "231209876543", 2021, 4.8, 4480, "Соевый воск, деревянный фитиль и травы с алтайских лугов."),
  vend("v5", "Макраме Дом", "🪢", "#8a6b8f", "Самара", "ПФО", "ИП", "631809876543", 2020, 4.7, 1560, "До 40 часов ручного плетения на каждое панно. Хлопок, джут и стены, которые хочется разглядывать."),
  vend("v6", "Лесная мастерская", "🪵", "#6b5c4c", "Кострома", "ЦФО", "ИП", "440109876543", 2014, 4.7, 2890, "Плотницкая артель: ясень, дуб и карельская берёза. Мебель и утварь с запахом леса."),
  vend("v7", "Арт-студия Пигмент", "🖼️", "#244534", "Екатеринбург", "УФО", "ИП", "667109876543", 2017, 4.8, 1730, "Живопись, гравюры и постеры. Пигменты замешиваем сами — цвет живёт дольше краски."),
  vend("v8", "Зеркала Отрада", "🪞", "#d4a574", "Москва", "ЦФО", "ООО", "772809876543", 2022, 4.6, 940, "Зеркала в рамах из ротанга, дуба и макраме. Замер по фото, доставка в обрешётке."),
  vend("v9", "Ателье Вереск", "👗", "#a4555e", "Иваново", "ЦФО", "ООО", "3702098765", 2015, 4.8, 3120, "Льняные платья и костюмы. Ткань от ивановских мануфактур, пошив под фигуру."),
  vend("v10", "Кожа и Шило", "👜", "#7a5230", "Казань", "ПФО", "Самозанятый", "165909876543", 2018, 4.9, 2050, "Сумки и ремни из растительно-дублёной кожи. Прошивка седельным швом вручную."),
  vend("v11", "Умный Уют", "🔌", "#4a6b8a", "Новосибирск", "СФО", "ООО", "5406098765", 2020, 4.7, 1890, "Умные розетки, датчики и замки. Технологии, которые не спорят с уютом."),
  vend("v12", "Сад в Кубе", "🪴", "#5a8a52", "Воронеж", "ЦФО", "Самозанятый", "366509876543", 2021, 4.6, 1340, "Кашпо, флорариумы и садовый инвентарь. Растения приезжают уже укоренёнными."),
];
export const vendorById = (id: string) => VENDORS.find((v) => v.id === id);

/* ---------- детерминированный генератор товаров ---------- */
export interface Product {
  id: string; slug: string; name: string; emoji: string; art: [string, string];
  image: string; sub: string; sku: string;
  price: number; oldPrice?: number; categoryId: string; vendorId: string;
  product_type: ProductType; is_non_returnable: boolean; production_time_days?: number;
  rating: number; reviewsCount: number; stock: number; views: number;
  material: string; style: string; color: string; size: string; tags: string[];
  description: string; createdAt: string; isHit?: boolean; isNew?: boolean;
}

const MATERIALS = ["Лён", "Хлопок", "Шерсть", "Керамика", "Дуб", "Ясень", "Латунь", "Ротанг", "Стекло", "Кожа", "Серебро", "Берёза"];
const STYLES = ["Сканди", "Лофт", "Джапанди", "Неоклассика", "Бохо", "Минимализм", "Прованс", "Эко"];
const COLORS = ["Графит", "Слоновая кость", "Шалфей", "Терракота", "Медовый", "Оливковый", "Пыльная роза", "Индиго"];
const SIZES = ["S", "M", "L", "40×40 см", "60×90 см", "120×180 см", "Ø 20 см", "350 мл"];
const ARTS: [string, string][] = [
  ["#1e3a2f", "#2d5f4c"], ["#d98e32", "#c77e28"], ["#d4a574", "#b98a5a"], ["#2d5f4c", "#4a7a63"],
  ["#8a6b8f", "#6f5474"], ["#a4555e", "#8a4550"], ["#6b5c4c", "#544839"], ["#4a6b8a", "#38546d"],
];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
/* отрицательный остаток невозможен: seed >> N может дать отрицательное int32-число */
const pick = <T,>(arr: T[], seed: number) => arr[((seed % arr.length) + arr.length) % arr.length];

function genProducts(): Product[] {
  const out: Product[] = [];
  let n = 0;
  CATEGORIES.forEach((cat) => {
    const group = groupById(cat.group);
    const perCat = cat.group === "home" ? 7 : 5;
    for (let i = 0; i < perCat; i++) {
      n++;
      const seed = hash(cat.slug + i);
      const s = cat.subs[i % cat.subs.length];
      const material = pick(MATERIALS, seed);
      const style = pick(STYLES, seed >> 2);
      const color = pick(COLORS, seed >> 3);
      const size = pick(SIZES, seed >> 4);
      const art = ARTS[seed % ARTS.length];
      const base = 400 + (seed % 40) * 350;
      const custom = cat.slug === "furniture" || (cat.slug === "mirrors" && i % 3 === 0);
      const vendor = VENDORS[seed % VENDORS.length];
      const price = custom ? base + 4000 : base;
      const hasOld = seed % 5 === 0;
      out.push({
        id: "p" + n,
        slug: `${cat.slug}-${s.slug}-${i + 1}`,
        name: `${s.name} «${pick(["Авторское", "Тёплое", "Северное", "Ручное", "Домашнее", "Ясное", "Лесное", "Утреннее"], seed >> 5)}»`,
        emoji: cat.emoji,
        art,
        image: GROUP_IMG[cat.group] || "",
        sub: s.slug,
        sku: `UYA-${cat.slug.slice(0, 3).toUpperCase()}-${String(n).padStart(4, "0")}`,
        price,
        oldPrice: hasOld ? Math.round(price * 1.25) : undefined,
        categoryId: cat.slug,
        vendorId: vendor.id,
        product_type: custom ? "custom_made" : "ready_made",
        is_non_returnable: custom,
        production_time_days: custom ? 14 + (seed % 10) : undefined,
        rating: 4.3 + ((seed % 7) / 10),
        reviewsCount: 3 + (seed % 90),
        stock: custom ? 0 : 2 + (seed % 30),
        views: 120 + (seed % 4000),
        material, style, color, size,
        tags: [cat.name, group?.name || "", material, style, color].filter(Boolean),
        description: `${s.name} из материала «${material}» в стиле ${style}. Цвет — ${color.toLowerCase()}, размер ${size}. Изготовлено мастерской «${vendor.name}» (${vendor.city}). Ручная работа, каждая вещь немного отличается от фото — в этом её характер.`,
        createdAt: new Date(Date.now() - (seed % 120) * 864e5).toISOString(),
        isHit: seed % 7 === 0,
        isNew: seed % 9 === 0,
      });
    }
  });
  return out;
}
export const PRODUCTS: Product[] = genProducts();
export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);

/* ---------- AI-подбор ---------- */
export function aiPickProducts(query: string, count = 6): Product[] {
  const q = query.trim().toLowerCase();
  const scored = PRODUCTS.map((p) => {
    let score = 0;
    const hay = (p.name + " " + p.tags.join(" ") + " " + p.categoryId).toLowerCase();
    q.split(/\s+/).forEach((w) => {
      if (w.length > 2 && hay.includes(w)) score += 2;
    });
    if (q.includes(p.style.toLowerCase())) score += 3;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);
  const top = scored.filter((x) => x.score > 0).map((x) => x.p);
  const pool = top.length >= count ? top : [...top, ...PRODUCTS.filter((p) => !top.includes(p))];
  return pool.slice(0, count);
}

/* ---------- отзывы-цитаты ---------- */
export interface SeedReview { name: string; city: string; text: string; rating: number; }
export const REVIEWS: SeedReview[] = [
  { name: "Анна М.", city: "Москва", text: "Плед оказался даже мягче, чем на фото. Мастер ответил на все вопросы за час — чувствуется, что вещь сделана с любовью.", rating: 5 },
  { name: "Дмитрий К.", city: "Казань", text: "Заказывал стол под размеры ниши. Согласовали чертёж в чате, привезли раньше срока. Безопасная сделка — спокойно оплатил.", rating: 5 },
  { name: "Ольга В.", city: "Новосибирск", text: "AI-подбор собрал мне всю гостиную за вечер. Кураторский отбор реально работает — ни одной проходной вещи.", rating: 5 },
];

/* ---------- юридические документы ---------- */
export const LEGAL_VERSIONS: Record<string, string> = {
  buyer_tos: "2.1",
  seller_agreement: "1.4",
  privacy: "3.0",
  escrow_rules: "1.2",
  ip_policy: "1.1",
  ai_terms: "1.0",
  return_policy: "1.0",
  complaint_rules: "1.0",
};
export interface LegalDocument { doc_type: string; version: string; title: string; summary: string; content: string; }
export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    doc_type: "buyer_tos", version: LEGAL_VERSIONS.buyer_tos, title: "Оферта для покупателя",
    summary: "Условия покупки на платформе. УютАрт — информационный агрегатор и не является продавцом.",
    content: `## 1. Термины\n\nПлатформа «УютАрт» (uyutart.ru) принадлежит ${OPERATOR.short} (ИНН ${OPERATOR.inn}). Платформа действует в статусе агрегатора информации по ст. 12 ЗоЗПП и ст. 1253.1 ГК РФ.\n\n## 2. Предмет и статус\n\nАдминистрация не является продавцом: не формирует ассортимент, не определяет цены и не осуществляет доставку. Договоры купли-продажи заключаются напрямую между покупателем и продавцом. Информация о продавце (ИНН/ОГРН) размещается в карточке товара.\n\n## 3. Ограничение ответственности\n\nПо п. 2 ст. 12 ЗоЗПП администрация не несёт ответственности за несоответствие товара, брак, нарушение сроков, нарушение IP и причинение вреда. Претензии направляются покупателем непосредственно продавцу. Максимальная ответственность платформы ограничена суммой фактически полученной комиссии.\n\n## 4. Возврат товаров\n\nДействует ст. 26.1 ЗоЗПП: товары надлежащего качества возвращаются в течение 7 дней. Товары, изготовленные по индивидуальным параметрам (custom-made), возврату не подлежат (абз. 4 п. 4 ст. 26.1 ЗоЗПП). Товары ненадлежащего качества возвращаются за счёт продавца.\n\n## 5. Акцепт\n\nАкцепт происходит через чек-бокс при регистрации или использование сервиса. Изменения вступают в силу с момента публикации.`,
  },
  {
    doc_type: "seller_agreement", version: LEGAL_VERSIONS.seller_agreement, title: "Агентский договор-оферта для продавца",
    summary: "Условия работы продавцом на платформе: комиссия, сплитование, гарантии и индемнификация.",
    content: `## 1. Предмет\n\n${OPERATOR.short} предоставляет продавцу ПО для витрины и торговли и выступает агентом по приёму средств через сплитование.\n\n## 2. Финансы и сплитование\n\nВознаграждение платформы удерживается автоматически по тарифу продавца. Средства делятся на транзитном счёте: комиссия — платформе, остаток — продавцу. Фискализация по 54-ФЗ: чек на комиссию бьёт платформа, чек на полную сумму — продавец. Продавец самостоятельно уплачивает налоги.\n\n## 3. Гарантии и индемнификация\n\nПродавец гарантирует права на товар, его безопасность и соответствие описанию. При претензиях третьих лиц продавец возмещает платформе все убытки и штрафы.\n\n## 4. Аудит и блокировка\n\nПлатформа вправе запросить документы на авторство. Блокировка — при непредоставлении документов за 3 дня либо при 2+ претензиях за 30 дней.\n\n## 5. Интеллектуальная собственность\n\nПрава на контент принадлежат продавцу, платформе предоставляется лицензия для функционирования сервиса. Notice-and-takedown — рассмотрение за 3 рабочих дня.`,
  },
  {
    doc_type: "privacy", version: LEGAL_VERSIONS.privacy, title: "Политика конфиденциальности",
    summary: "Как мы обрабатываем персональные данные по 152-ФЗ.",
    content: `## 1. Данные и цели\n\nОбязательные данные: ФИО, телефон, email, адрес. Дополнительные: история покупок, фото для AI. Технические: IP, cookies.\n\n## 2. Передача третьим лицам\n\nДанные передаются продавцам (для доставки), службам доставки, платёжным системам и Yandex Cloud (для AI — при согласии).\n\n## 3. AI-профилирование\n\nТолько при явном согласии пользователя. Право на отзыв и удаление данных — в течение 30 дней.\n\n## 4. Защита\n\nШифрование TLS 1.3, AES-256, row-level security. Уведомление Роскомнадзора при утечке — в течение 24 часов.\n\n## 5. Cookies\n\nБаннер с выбором: принять все, настроить или отклонить. Метрика включается только после согласия.`,
  },
  {
    doc_type: "escrow_rules", version: LEGAL_VERSIONS.escrow_rules, title: "Регламент «Безопасной сделки»",
    summary: "Деньги резервируются на транзитном счёте до подтверждения отправки.",
    content: `## 1. Классификация\n\nТовары: ready-made (готовые, отправка 1–3 дня) и custom-made (на заказ, от 3 дней).\n\n## 2. Резервирование (hold)\n\nСредства хранятся на транзитном счёте и не зачисляются на счета платформы или продавца до раскрытия.\n\n## 3. Раскрытие (release)\n\nReady-made: при вводе трек-номера, подтверждении получения или через 14 дней. Custom-made: при статусе «Готов к отправке» или через 30 дней.\n\n## 4. Auto-refund\n\nReady-made: автоматический возврат через 5 дней при отсутствии трек-номера. Custom-made в статусе «В производстве» — авто-возврат не применяется.\n\n## 5. Споры\n\nАрбитраж платформы — 5 дней. Решение обязательно в рамках экосистемы, но не лишает права на суд.`,
  },
  {
    doc_type: "ip_policy", version: LEGAL_VERSIONS.ip_policy, title: "Политика интеллектуальной собственности",
    summary: "Порядок уведомлений о нарушении прав (notice-and-takedown).",
    content: `## 1. Уведомления\n\nУведомления о нарушении направляются на ${OPERATOR.legalEmail}. Рассмотрение — 3 рабочих дня, спорный товар блокируется на время проверки.\n\n## 2. Встречное уведомление\n\nПродавец вправе подать counter-notice с доказательствами в течение 10 дней.\n\n## 3. Ответственность\n\nСпоры разрешаются между правообладателем и продавцом; платформа — технический исполнитель. При 2+ нарушениях за 12 месяцев — блокировка.`,
  },
  {
    doc_type: "ai_terms", version: LEGAL_VERSIONS.ai_terms, title: "Условия использования AI-сервисов",
    summary: "AI-подбор — экспериментальный инструмент, не является профессиональным дизайнером.",
    content: `## 1. Природа AI\n\nAI-ассистент — экспериментальный инструмент на базе YandexGPT/Vision. Он не является профессиональным дизайнером или источником обязательных рекомендаций.\n\n## 2. Отказ от ответственности\n\nНе гарантируется точность и стилистическая совместимость. Платформа не отвечает за решения пользователя, несоответствие размерам и вред здоровью.\n\n## 3. Согласие на AI-профилирование\n\nАнализ фото и поведенческих паттернов — только при явном согласии через чек-бокс. Согласие можно отозвать в настройках. Фото не передаются третьим лицам.\n\n## 4. Ограничения\n\nЗапрещены генерация незаконного контента и обход лимитов запросов.`,
  },
  {
    doc_type: "return_policy", version: LEGAL_VERSIONS.return_policy, title: "Политика возврата товаров",
    summary: "Возврат — в течение 7 дней, за исключением товаров на заказ. Платформа — посредник.",
    content: `## 1. Общие положения\n\nВозврат регулируется ст. 26.1 ЗоЗПП. Продавцом товара является конкретный мастер, платформа выступает посредником и не несёт ответственности за товар, но обеспечивает защищённую процедуру возврата средств.\n\n## 2. Сроки\n\nТовар надлежащего качества можно вернуть в течение 7 дней с момента получения. Товары, изготовленные по индивидуальным параметрам (custom-made), возврату не подлежат.\n\n## 3. Порядок\n\nПокупатель оформляет заявку в личном кабинете, прикладывает фото. Продавец подтверждает возврат, покупатель отправляет товар. После получения товара продавцом средства размораживаются и возвращаются покупателю.\n\n## 4. Споры\n\nПри несогласии сторон спор передаётся в арбитраж платформы (5 дней). Ответственность за товар несёт продавец; ответственность платформы ограничена суммой комиссии.`,
  },
  {
    doc_type: "complaint_rules", version: LEGAL_VERSIONS.complaint_rules, title: "Правила подачи жалоб на продавцов",
    summary: "Как пожаловаться на продавца и что происходит дальше.",
    content: `## 1. Основания\n\nЖалоба подаётся на конкретного продавца: несоответствие товара, срыв сроков, попытка увести сделку, подделка, некорректное поведение.\n\n## 2. Порядок\n\nКнопка «Пожаловаться» на странице магазина. Обязательны категория жалобы, описание и (желательно) фото. Жалоба уходит в арбитраж платформы.\n\n## 3. Рассмотрение\n\nАрбитраж рассматривает жалобу в течение 5 рабочих дней. Продавец получает уведомление и право на объяснение.\n\n## 4. Последствия\n\nПри подтверждении нарушения: предупреждение, понижение в выдаче или блокировка (при 2+ нарушениях за 30 дней). Жалобы защищены от разглашения продавцу в части личных данных покупателя.`,
  },
];
export const legalDoc = (type: string) => LEGAL_DOCUMENTS.find((d) => d.doc_type === type);

/* ---------- форматирование ---------- */
export const fmt = (n: number) => n.toLocaleString("ru-RU") + " ₽";
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
