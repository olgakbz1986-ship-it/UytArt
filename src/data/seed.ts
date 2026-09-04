/* ============================================================
   УютАрт — слой данных.
   12 групп каталога → категории → подкатегории → товары.
   ============================================================ */

export const OPERATOR = {
  name: "Общество с ограниченной ответственностью «СтартТехноПро»",
  short: "ООО «СтартТехноПро»",
  inn: "4632275840",
  kpp: "463201001",
  domain: "uyutart.ru",
  legalEmail: "info@starttechpro.ru",
  supportEmail: "info@starttechpro.ru",
  status: "Информационный агрегатор (ст. 12 ЗоЗПП), не является продавцом",
};

export type ProductType = "ready_made" | "custom_made";

/* ---------- 12 групп каталога ---------- */
export const GROUPS = [
  { id: "decor_home", name: "Декор и дом", emoji: "🏠", desc: "Вазы, статуэтки, картины, зеркала, свечи" },
  { id: "clothing_shoes", name: "Одежда и обувь", emoji: "👗", desc: "Женская, мужская, детская одежда и обувь" },
  { id: "accessories", name: "Аксессуары", emoji: "👜", desc: "Сумки, украшения, часы, ремни, очки" },
  { id: "tech", name: "Техника", emoji: "📱", desc: "Бытовая техника, компьютеры, смартфоны, аудио" },
  { id: "hardware", name: "Фурнитура", emoji: "🔧", desc: "Крепёж, мебельная, дверная, оконная фурнитура" },
  { id: "home_garden", name: "Быт и сад", emoji: "🪴", desc: "Уборка, хранение, сад, товары для животных" },
  { id: "beauty", name: "Красота", emoji: "🧴", desc: "Уход за лицом, телом, волосами, косметика" },
  { id: "hobby", name: "Хобби", emoji: "🎨", desc: "Рисование, рукоделие, игры, канцелярия" },
  { id: "construction", name: "Стройматериалы и конструкции", emoji: "🧱", desc: "Кирпич, цемент, пиломатериалы, кровля, двери, окна" },
  { id: "finishing", name: "Отделка и ремонт", emoji: "🎨", desc: "Обои, штукатурка, краски, напольные покрытия, плитка" },
  { id: "furniture_textile", name: "Мебель и текстиль", emoji: "🛋️", desc: "Диваны, кровати, шкафы, шторы, постельное бельё" },
  { id: "plumbing_comms", name: "Сантехника и коммуникации", emoji: "🚿", desc: "Ванны, раковины, унитазы, смесители, электрика, освещение" },
];
export const groupById = (id: string) => GROUPS.find((g) => g.id === id);

export const GROUP_IMG: Record<string, string> = {
  decor_home: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=600&fit=crop",
  clothing_shoes: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&h=600&fit=crop",
  accessories: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&h=600&fit=crop",
  tech: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop",
  hardware: "https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=800&h=600&fit=crop",
  home_garden: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop",
  beauty: "https://images.unsplash.com/photo-1596462502278-27bfdd403348?w=800&h=600&fit=crop",
  hobby: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=600&fit=crop",
  construction: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=600&fit=crop",
  finishing: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&h=600&fit=crop",
  furniture_textile: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=600&fit=crop",
  plumbing_comms: "https://images.unsplash.com/photo-1584622050111-993a426fbf0a?w=800&h=600&fit=crop",
};

/* ---------- категории с подкатегориями ---------- */
export interface SubCategory { slug: string; name: string; }
export interface Category {
  slug: string; name: string; emoji: string; group: string; desc: string; subs: SubCategory[];
}
const sub = (list: string[]): SubCategory[] =>
  list.map((name) => ({ slug: name.toLowerCase().replace(/[^а-яa-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""), name }));

export const CATEGORIES: Category[] = [
  /* --- Декор и дом (10 подкатегорий) --- */
  { slug: "vases-cachepots", name: "Вазы и кашпо", emoji: "🏺", group: "decor_home", desc: "Декоративные вазы и цветочные кашпо.", subs: sub([]) },
  { slug: "figurines-sculptures", name: "Статуэтки и скульптуры", emoji: "🗿", group: "decor_home", desc: "Декоративные фигурки и авторские скульптуры.", subs: sub([]) },
  { slug: "paintings-posters-panels", name: "Картины, постеры и панно", emoji: "🖼️", group: "decor_home", desc: "Живопись, постеры и декоративные панно.", subs: sub([]) },
  { slug: "mirrors-frames", name: "Зеркала и рамы", emoji: "🪞", group: "decor_home", desc: "Зеркала в рамах и багетные изделия.", subs: sub([]) },
  { slug: "candles-holders", name: "Свечи и подсвечники", emoji: "🕯️", group: "decor_home", desc: "Ароматические свечи и декоративные подсвечники.", subs: sub([]) },
  { slug: "decorative-figures-souvenirs", name: "Декоративные фигурки и сувениры", emoji: "🎁", group: "decor_home", desc: "Авторские сувениры и интерьерные фигурки.", subs: sub([]) },
  { slug: "wall-ceiling-decor", name: "Настенный и потолочный декор", emoji: "🎨", group: "decor_home", desc: "Декор для стен и потолков.", subs: sub([]) },
  { slug: "3d-panels-author-decor", name: "3D-панели и авторский декор", emoji: "🧱", group: "decor_home", desc: "Объёмные панели и уникальный декор.", subs: sub([]) },
  { slug: "photo-frames-albums", name: "Фоторамки и альбомы", emoji: "📷", group: "decor_home", desc: "Рамки для фото и фотоальбомы.", subs: sub([]) },
  { slug: "home-aromas", name: "Ароматы для дома", emoji: "🌸", group: "decor_home", desc: "Диффузоры, саше и ароматизаторы.", subs: sub([]) },

  /* --- Одежда и обувь (10 подкатегорий) --- */
  { slug: "womens-clothing", name: "Женская одежда", emoji: "👗", group: "clothing_shoes", desc: "Платья, блузы, костюмы и другая женская одежда.", subs: sub([]) },
  { slug: "mens-clothing", name: "Мужская одежда", emoji: "👔", group: "clothing_shoes", desc: "Рубашки, брюки, свитеры и другая мужская одежда.", subs: sub([]) },
  { slug: "kids-clothing", name: "Детская одежда", emoji: "🧒", group: "clothing_shoes", desc: "Одежда для детей всех возрастов.", subs: sub([]) },
  { slug: "womens-shoes", name: "Обувь женская", emoji: "👠", group: "clothing_shoes", desc: "Туфли, ботинки, сапоги для женщин.", subs: sub([]) },
  { slug: "mens-shoes", name: "Обувь мужская", emoji: "👞", group: "clothing_shoes", desc: "Туфли, ботинки, кроссовки для мужчин.", subs: sub([]) },
  { slug: "kids-shoes", name: "Обувь детская", emoji: "👟", group: "clothing_shoes", desc: "Обувь для детей и подростков.", subs: sub([]) },
  { slug: "sport-clothing-shoes", name: "Спортивная одежда и обувь", emoji: "🏃", group: "clothing_shoes", desc: "Одежда и обувь для спорта и активного отдыха.", subs: sub([]) },
  { slug: "outerwear", name: "Верхняя одежда", emoji: "🧥", group: "clothing_shoes", desc: "Пальто, куртки, пуховики и плащи.", subs: sub([]) },
  { slug: "underwear-socks", name: "Нижнее бельё и носки", emoji: "🩲", group: "clothing_shoes", desc: "Бельё, носки и колготки.", subs: sub([]) },
  { slug: "workwear", name: "Спецодежда", emoji: "🦺", group: "clothing_shoes", desc: "Рабочая и защитная одежда.", subs: sub([]) },

  /* --- Аксессуары (10 подкатегорий) --- */
  { slug: "bags-backpacks-clutches", name: "Сумки, рюкзаки и клатчи", emoji: "👜", group: "accessories", desc: "Сумки, рюкзаки, клатчи и поясные сумки.", subs: sub([]) },
  { slug: "jewelry", name: "Украшения", emoji: "💍", group: "accessories", desc: "Золотые, серебряные и бижутерные украшения.", subs: sub([]) },
  { slug: "costume-jewelry", name: "Бижутерия", emoji: "📿", group: "accessories", desc: "Декоративные украшения и аксессуары.", subs: sub([]) },
  { slug: "wristwatches", name: "Часы наручные", emoji: "⌚", group: "accessories", desc: "Механические, кварцевые и умные часы.", subs: sub([]) },
  { slug: "belts-sashes", name: "Ремни и пояса", emoji: "🪢", group: "accessories", desc: "Кожаные и текстильные ремни.", subs: sub([]) },
  { slug: "scarves-shawls-pashminas", name: "Шарфы, платки и палантины", emoji: "🧣", group: "accessories", desc: "Шарфы, палантины и шейные платки.", subs: sub([]) },
  { slug: "headwear", name: "Головные уборы", emoji: "🧢", group: "accessories", desc: "Шапки, кепки, шляпы и береты.", subs: sub([]) },
  { slug: "glasses-frames", name: "Очки и оправы", emoji: "👓", group: "accessories", desc: "Оптические и солнцезащитные очки.", subs: sub([]) },
  { slug: "wallets-portmonees", name: "Кошельки и портмоне", emoji: "💼", group: "accessories", desc: "Кошельки, портмоне и визитницы.", subs: sub([]) },
  { slug: "umbrellas-caness", name: "Зонты и трости", emoji: "☂️", group: "accessories", desc: "Зонты, трости и аксессуары от дождя.", subs: sub([]) },

  /* --- Техника (10 подкатегорий) --- */
  { slug: "large-appliances", name: "Бытовая техника крупная", emoji: "🧊", group: "tech", desc: "Холодильники, стиральные машины, плиты.", subs: sub([]) },
  { slug: "small-appliances", name: "Бытовая техника мелкая", emoji: "🫖", group: "tech", desc: "Утюги, пылесосы, фены и мелкая техника.", subs: sub([]) },
  { slug: "kitchen-appliances", name: "Кухонная техника", emoji: "🍳", group: "tech", desc: "Миксеры, блендеры, мультиварки и кухонные приборы.", subs: sub([]) },
  { slug: "tvs-audio", name: "Телевизоры и аудиотехника", emoji: "📺", group: "tech", desc: "ТВ, домашние кинотеатры, Hi-Fi системы.", subs: sub([]) },
  { slug: "computers-laptops", name: "Компьютеры и ноутбуки", emoji: "💻", group: "tech", desc: "ПК, ноутбуки, моноблоки и рабочие станции.", subs: sub([]) },
  { slug: "smartphones-tablets", name: "Смартфоны и планшеты", emoji: "📱", group: "tech", desc: "Мобильные устройства и планшетные ПК.", subs: sub([]) },
  { slug: "headphones-speakers", name: "Наушники и колонки", emoji: "🎧", group: "tech", desc: "Наушники, гарнитуры, Bluetooth-колонки.", subs: sub([]) },
  { slug: "photo-video", name: "Фото- и видеотехника", emoji: "📷", group: "tech", desc: "Камеры, объективы, экшн-камеры и аксессуары.", subs: sub([]) },
  { slug: "gaming-consoles-electronics", name: "Игровые приставки и электроника", emoji: "🎮", group: "tech", desc: "Консоли, геймпады, VR-устройства.", subs: sub([]) },
  { slug: "smart-home", name: "Умный дом", emoji: "🏠", group: "tech", desc: "Умные розетки, датчики, хабы и системы управления.", subs: sub([]) },

  /* --- Фурнитура (10 подкатегорий) --- */
  { slug: "fasteners-hardware", name: "Крепёж и метизы", emoji: "🔩", group: "hardware", desc: "Болты, гайки, саморезы, анкеры.", subs: sub([]) },
  { slug: "furniture-fittings", name: "Мебельная фурнитура", emoji: "🪑", group: "hardware", desc: "Петли, направляющие, ручки для мебели.", subs: sub([]) },
  { slug: "door-fittings", name: "Дверная фурнитура", emoji: "🚪", group: "hardware", desc: "Замки, ручки, петли для дверей.", subs: sub([]) },
  { slug: "window-fittings", name: "Оконная фурнитура", emoji: "🪟", group: "hardware", desc: "Ручки, петли, уплотнители для окон.", subs: sub([]) },
  { slug: "plumbing-fittings", name: "Сантехническая фурнитура", emoji: "🔧", group: "hardware", desc: "Фитинги, переходники, сифоны.", subs: sub([]) },
  { slug: "electrical-installations", name: "Электроустановочные изделия", emoji: "⚡", group: "hardware", desc: "Розетки, выключатели, распредкоробки.", subs: sub([]) },
  { slug: "hand-tools", name: "Инструменты ручные", emoji: "🔨", group: "hardware", desc: "Молотки, отвёртки, ключи, плоскогубцы.", subs: sub([]) },
  { slug: "power-tools", name: "Инструменты электро", emoji: "🪚", group: "hardware", desc: "Дрели, шуруповёрты, пилы, шлифмашины.", subs: sub([]) },
  { slug: "consumables", name: "Расходные материалы", emoji: "📦", group: "hardware", desc: "Свёрла, диски, наждачная бумага.", subs: sub([]) },
  { slug: "measuring-tools", name: "Измерительный инструмент", emoji: "📏", group: "hardware", desc: "Рулетки, уровни, штангенциркули.", subs: sub([]) },

  /* --- Быт и сад (10 подкатегорий) --- */
  { slug: "cleaning-products", name: "Товары для уборки", emoji: "🧹", group: "home_garden", desc: "Щётки, швабры, тряпки, вёдра.", subs: sub([]) },
  { slug: "storage-organization", name: "Хранение и организация пространства", emoji: "📦", group: "home_garden", desc: "Контейнеры, органайзеры, коробки.", subs: sub([]) },
  { slug: "household-tableware", name: "Посуда хозяйственная", emoji: "🍲", group: "home_garden", desc: "Кастрюли, сковороды, формы для выпечки.", subs: sub([]) },
  { slug: "garden-furniture", name: "Садовая мебель", emoji: "🪑", group: "home_garden", desc: "Скамейки, столы, стулья для сада.", subs: sub([]) },
  { slug: "garden-tools", name: "Садовый инвентарь", emoji: "🌿", group: "home_garden", desc: "Лопаты, грабли, секаторы, тяпки.", subs: sub([]) },
  { slug: "irrigation-systems", name: "Системы полива", emoji: "💧", group: "home_garden", desc: "Шланги, распылители, автополив.", subs: sub([]) },
  { slug: "greenhouses-hotbeds", name: "Теплицы и парники", emoji: "🏡", group: "home_garden", desc: "Теплицы, парники, укрытия для растений.", subs: sub([]) },
  { slug: "bbq-grills", name: "Барбекю и мангалы", emoji: "🔥", group: "home_garden", desc: "Мангалы, грили, коптильни.", subs: sub([]) },
  { slug: "pet-products", name: "Товары для животных", emoji: "🐾", group: "home_garden", desc: "Лежанки, миски, игрушки, переноски.", subs: sub([]) },
  { slug: "pet-food", name: "Корма для животных", emoji: "🦴", group: "home_garden", desc: "Сухие и влажные корма, лакомства.", subs: sub([]) },

  /* --- Красота (10 подкатегорий) --- */
  { slug: "face-care", name: "Уход за лицом", emoji: "🧴", group: "beauty", desc: "Кремы, сыворотки, маски для лица.", subs: sub([]) },
  { slug: "body-care", name: "Уход за телом", emoji: "🛁", group: "beauty", desc: "Гели, лосьоны, скрабы для тела.", subs: sub([]) },
  { slug: "hair-care", name: "Уход за волосами", emoji: "💇", group: "beauty", desc: "Шампуни, кондиционеры, маски для волос.", subs: sub([]) },
  { slug: "decorative-cosmetics", name: "Декоративная косметика", emoji: "💄", group: "beauty", desc: "Помады, туши, тени, тональные средства.", subs: sub([]) },
  { slug: "perfumes-aromas", name: "Парфюмерия и ароматы", emoji: "🌺", group: "beauty", desc: "Духи, туалетная вода, одеколоны.", subs: sub([]) },
  { slug: "handmade-soap", name: "Мыло ручной работы", emoji: "🧼", group: "beauty", desc: "Авторское мыло и мыльные наборы.", subs: sub([]) },
  { slug: "natural-organic-cosmetics", name: "Натуральная и органическая косметика", emoji: "🌿", group: "beauty", desc: "Эко-косметика и натуральные средства.", subs: sub([]) },
  { slug: "beauty-accessories", name: "Аксессуары для красоты", emoji: "💅", group: "beauty", desc: "Кисти, спонжи, расчёски, зеркала.", subs: sub([]) },
  { slug: "manicure-pedicure", name: "Маникюр и педикюр", emoji: "💅", group: "beauty", desc: "Лаки, инструменты, наборы для ногтей.", subs: sub([]) },
  { slug: "mens-cosmetics-care", name: "Мужская косметика и уход", emoji: "🧔", group: "beauty", desc: "Средства для бритья, ухода за бородой.", subs: sub([]) },

  /* --- Хобби (10 подкатегорий) --- */
  { slug: "drawing-painting-materials", name: "Материалы для рисования и живописи", emoji: "🎨", group: "hobby", desc: "Краски, холсты, кисти, карандаши.", subs: sub([]) },
  { slug: "needlework", name: "Рукоделие", emoji: "🧶", group: "hobby", desc: "Наборы для вышивания, вязания, шитья.", subs: sub([]) },
  { slug: "sculpture-modeling", name: "Лепка и моделирование", emoji: "🏺", group: "hobby", desc: "Пластилин, глина, полимерная глина.", subs: sub([]) },
  { slug: "craft-kits", name: "Наборы для творчества", emoji: "✂️", group: "hobby", desc: "Готовые наборы для создания поделок.", subs: sub([]) },
  { slug: "board-games-puzzles", name: "Настольные игры и головоломки", emoji: "🎲", group: "hobby", desc: "Настольные игры, пазлы, кубики Рубика.", subs: sub([]) },
  { slug: "kids-toys", name: "Игрушки детские", emoji: "🧸", group: "hobby", desc: "Мягкие игрушки, куклы, машинки.", subs: sub([]) },
  { slug: "educational-toys", name: "Игрушки развивающие", emoji: "🔤", group: "hobby", desc: "Обучающие игры, конструкторы, сортеры.", subs: sub([]) },
  { slug: "collectibles", name: "Коллекционные изделия", emoji: "🏆", group: "hobby", desc: "Фигурки, монеты, марки для коллекционирования.", subs: sub([]) },
  { slug: "stationery-paper", name: "Канцелярия и бумага", emoji: "📝", group: "hobby", desc: "Блокноты, ручки, бумага, конверты.", subs: sub([]) },
  { slug: "fishing-hunting", name: "Товары для рыбалки и охоты", emoji: "🎣", group: "hobby", desc: "Удочки, снасти, экипировка.", subs: sub([]) },

  /* --- Стройматериалы и конструкции (13 подкатегорий) --- */
  { slug: "bricks-wall-blocks", name: "Кирпич и стеновые блоки", emoji: "🧱", group: "construction", desc: "Кирпич, газоблоки, пеноблоки.", subs: sub([]) },
  { slug: "cement-dry-mixes-plasters", name: "Цемент, смеси и штукатурки сухие", emoji: "🏗️", group: "construction", desc: "Цемент, штукатурки, кладочные смеси.", subs: sub([]) },
  { slug: "lumber-boards", name: "Пиломатериалы и доски", emoji: "🪵", group: "construction", desc: "Доски, брус, рейки, фанера.", subs: sub([]) },
  { slug: "roofing-materials", name: "Кровельные материалы", emoji: "🏠", group: "construction", desc: "Черепица, профнастил, рубероид.", subs: sub([]) },
  { slug: "gutter-systems", name: "Водосточные системы", emoji: "💧", group: "construction", desc: "Желоба, трубы, воронки водостока.", subs: sub([]) },
  { slug: "entrance-doors", name: "Двери входные", emoji: "🚪", group: "construction", desc: "Металлические и деревянные входные двери.", subs: sub([]) },
  { slug: "interior-doors", name: "Двери межкомнатные", emoji: "🚪", group: "construction", desc: "Межкомнатные двери и перегородки.", subs: sub([]) },
  { slug: "pvc-windows", name: "Окна ПВХ", emoji: "🪟", group: "construction", desc: "Пластиковые окна и профили.", subs: sub([]) },
  { slug: "wooden-windows", name: "Окна деревянные", emoji: "🪵", group: "construction", desc: "Деревянные окна и рамы.", subs: sub([]) },
  { slug: "gates-fences", name: "Ворота, калитки и заборы", emoji: "🚧", group: "construction", desc: "Ворота, ограждения, заборы.", subs: sub([]) },
  { slug: "insulation", name: "Утеплители", emoji: "🧣", group: "construction", desc: "Минвата, пенопласт, утеплители.", subs: sub([]) },
  { slug: "metal-rolling-rebar", name: "Металлопрокат и арматура", emoji: "🔩", group: "construction", desc: "Арматура, уголки, швеллеры.", subs: sub([]) },
  { slug: "dry-building-mixes", name: "Сухие строительные смеси", emoji: "🧪", group: "construction", desc: "Шпатлёвки, клеи, затирки.", subs: sub([]) },

  /* --- Отделка и ремонт (12 подкатегорий) --- */
  { slug: "wallpapers-frescos", name: "Обои и фрески", emoji: "🎨", group: "finishing", desc: "Обои, фотообои, фрески.", subs: sub([]) },
  { slug: "decorative-plaster", name: "Декоративная штукатурка", emoji: "🖌️", group: "finishing", desc: "Фактурные и гладкие штукатурки.", subs: sub([]) },
  { slug: "interior-paints", name: "Краски интерьерные", emoji: "🎨", group: "finishing", desc: "Краски для внутренних работ.", subs: sub([]) },
  { slug: "facade-paints", name: "Краски фасадные", emoji: "🏡", group: "finishing", desc: "Краски для наружных работ.", subs: sub([]) },
  { slug: "varnishes-stains", name: "Лаки и пропитки", emoji: "🪵", group: "finishing", desc: "Лаки, морилки, защитные пропитки.", subs: sub([]) },
  { slug: "flooring", name: "Напольные покрытия", emoji: "🪵", group: "finishing", desc: "Ламинат, паркет, линолеум, ковролин.", subs: sub([]) },
  { slug: "ceramic-tiles-porcelain", name: "Керамическая плитка и керамогранит", emoji: "🔲", group: "finishing", desc: "Плитка, мозаика, керамогранит.", subs: sub([]) },
  { slug: "drywall-profiles", name: "Гипсокартон и профили", emoji: "📐", group: "finishing", desc: "ГКЛ, профили, комплектующие.", subs: sub([]) },
  { slug: "stretch-ceilings", name: "Натяжные потолки и комплектующие", emoji: "✨", group: "finishing", desc: "Натяжные потолки, профили, заглушки.", subs: sub([]) },
  { slug: "moldings-baseboards-cornices", name: "Молдинги, плинтусы и карнизы", emoji: "📏", group: "finishing", desc: "Декоративные молдинги и плинтусы.", subs: sub([]) },
  { slug: "adhesives-sealants", name: "Клеи и герметики", emoji: "🧴", group: "finishing", desc: "Клеи, герметики, жидкие гвозди.", subs: sub([]) },
  { slug: "primers-impregnations", name: "Грунтовки и пропитки", emoji: "💧", group: "finishing", desc: "Грунтовки, антисептики, пропитки.", subs: sub([]) },

  /* --- Мебель и текстиль (14 подкатегорий) --- */
  { slug: "sofas-armchairs", name: "Диваны и кресла", emoji: "🛋️", group: "furniture_textile", desc: "Диваны, кресла, пуфы.", subs: sub([]) },
  { slug: "beds-mattresses", name: "Кровати и матрасы", emoji: "🛏️", group: "furniture_textile", desc: "Кровати, матрасы, основания.", subs: sub([]) },
  { slug: "wardrobes-shelves", name: "Шкафы и стеллажи", emoji: "🚪", group: "furniture_textile", desc: "Шкафы-купе, стеллажи, комоды.", subs: sub([]) },
  { slug: "tables-chairs", name: "Столы и стулья", emoji: "🪑", group: "furniture_textile", desc: "Обеденные, письменные столы, стулья.", subs: sub([]) },
  { slug: "kitchen-sets", name: "Кухонные гарнитуры", emoji: "🍽️", group: "furniture_textile", desc: "Кухонные гарнитуры и модули.", subs: sub([]) },
  { slug: "kids-furniture", name: "Детская мебель", emoji: "🧸", group: "furniture_textile", desc: "Детские кровати, столы, шкафы.", subs: sub([]) },
  { slug: "office-furniture", name: "Офисная мебель", emoji: "💼", group: "furniture_textile", desc: "Офисные столы, кресла, тумбы.", subs: sub([]) },
  { slug: "garden-outdoor-furniture", name: "Садовая и дачная мебель", emoji: "🏡", group: "furniture_textile", desc: "Мебель для сада и дачи.", subs: sub([]) },
  { slug: "curtains-tulle", name: "Шторы и тюль", emoji: "🎭", group: "furniture_textile", desc: "Шторы, тюль, портьеры.", subs: sub([]) },
  { slug: "throws-bedspreads", name: "Пледы и покрывала", emoji: "🧶", group: "furniture_textile", desc: "Пледы, покрывала, накидки.", subs: sub([]) },
  { slug: "decorative-pillows", name: "Декоративные подушки", emoji: "🛋️", group: "furniture_textile", desc: "Декоративные подушки и наволочки.", subs: sub([]) },
  { slug: "bed-linen", name: "Постельное бельё", emoji: "🛏️", group: "furniture_textile", desc: "Комплекты постельного белья.", subs: sub([]) },
  { slug: "towels", name: "Полотенца", emoji: "🧖", group: "furniture_textile", desc: "Полотенца для ванной, кухни, пляжа.", subs: sub([]) },
  { slug: "tablecloths-napkins", name: "Скатерти и салфетки", emoji: "🍽️", group: "furniture_textile", desc: "Скатерти, салфетки, раннеры.", subs: sub([]) },
  { slug: "rugs-carpets", name: "Ковры и коврики", emoji: "🧶", group: "furniture_textile", desc: "Ковры, паласы, коврики.", subs: sub([]) },

  /* --- Сантехника и коммуникации (17 подкатегорий) --- */
  { slug: "bathtubs-shower-enclosures", name: "Ванны и душевые кабины", emoji: "🛁", group: "plumbing_comms", desc: "Ванны, душевые кабины и поддоны.", subs: sub([]) },
  { slug: "shower-systems-heads", name: "Душевые системы и лейки", emoji: "🚿", group: "plumbing_comms", desc: "Душевые системы, лейки, стойки.", subs: sub([]) },
  { slug: "sinks-pedestals", name: "Раковины и пьедесталы", emoji: "🚰", group: "plumbing_comms", desc: "Умывальники, раковины, пьедесталы.", subs: sub([]) },
  { slug: "vanity-units", name: "Тумбы под раковину", emoji: "🗄️", group: "plumbing_comms", desc: "Тумбы и мойдодыры для ванной.", subs: sub([]) },
  { slug: "toilets-installations", name: "Унитазы и инсталляции", emoji: "🚽", group: "plumbing_comms", desc: "Унитазы, бачки, инсталляции.", subs: sub([]) },
  { slug: "bidets-urinals", name: "Биде и писсуары", emoji: "🚽", group: "plumbing_comms", desc: "Биде, писсуары, гигиенические души.", subs: sub([]) },
  { slug: "bathroom-faucets", name: "Смесители для ванной", emoji: "🚰", group: "plumbing_comms", desc: "Смесители для ванны и душа.", subs: sub([]) },
  { slug: "kitchen-faucets", name: "Смесители для кухни", emoji: "🚰", group: "plumbing_comms", desc: "Кухонные смесители и фильтры.", subs: sub([]) },
  { slug: "radiators-heating", name: "Радиаторы отопления", emoji: "🔥", group: "plumbing_comms", desc: "Батареи, радиаторы, конвекторы.", subs: sub([]) },
  { slug: "boilers-water-heaters", name: "Котлы и водонагреватели", emoji: "♨️", group: "plumbing_comms", desc: "Котлы, бойлеры, водонагреватели.", subs: sub([]) },
  { slug: "pipes-fittings", name: "Трубы и фитинги", emoji: "🔧", group: "plumbing_comms", desc: "Трубы, фитинги, соединения.", subs: sub([]) },
  { slug: "sewer-systems", name: "Канализационные системы", emoji: "🕳️", group: "plumbing_comms", desc: "Канализационные трубы, люки, септики.", subs: sub([]) },
  { slug: "ventilation-air-conditioning", name: "Вентиляция и кондиционирование", emoji: "💨", group: "plumbing_comms", desc: "Вентиляция, кондиционеры, рекуператоры.", subs: sub([]) },
  { slug: "sockets-switches", name: "Розетки и выключатели", emoji: "🔌", group: "plumbing_comms", desc: "Электроустановочные изделия.", subs: sub([]) },
  { slug: "cables-wiring", name: "Кабель и проводка", emoji: "⚡", group: "plumbing_comms", desc: "Кабели, провода, шнуры.", subs: sub([]) },
  { slug: "panels-circuit-breakers", name: "Щитки и автоматы", emoji: "🔋", group: "plumbing_comms", desc: "Электрощиты, автоматы, УЗО.", subs: sub([]) },
  { slug: "chandeliers-lighting", name: "Люстры и светильники", emoji: "💡", group: "plumbing_comms", desc: "Люстры, бра, точечные светильники.", subs: sub([]) },
  { slug: "garden-outdoor-lighting", name: "Садовое и уличное освещение", emoji: "🌙", group: "plumbing_comms", desc: "Уличные фонари, садовые светильники.", subs: sub([]) },
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
  data_processing: "1.0",
  market_rules: "1.0",
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
  {
    doc_type: "data_processing", version: LEGAL_VERSIONS.data_processing, title: "Политика обработки персональных данных",
    summary: "Порядок сбора, хранения и защиты персональных данных по 152-ФЗ.",
    content: `## 1. Общие положения\n\nНастоящая политика определяет порядок обработки персональных данных пользователей платформы УютАрт (оператор — ООО «СтартТехноПро») в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».\n\n## 2. Состав данных\n\nМы обрабатываем: обязательные данные (ФИО, телефон, email, адрес доставки), дополнительные (история заказов, фото для AI-подбора при согласии) и технические (IP, cookies).\n\n## 3. Цели обработки\n\nДанные используются для исполнения договоров купли-продажи, доставки, работы AI-сервисов (только при явном согласии) и соблюдения законодательства.\n\n## 4. Защита\n\nПрименяются шифрование TLS 1.3 и AES-256, политики контроля доступа (RLS). Оператор уведомляет Роскомнадзор об утечках в течение 24 часов.\n\n## 5. Права субъекта\n\nВы вправе запросить сведения об обработке, потребовать уточнения, блокирования или удаления данных, а также отозвать согласие в любой момент в личном кабинете.`,
  },
  {
    doc_type: "market_rules", version: LEGAL_VERSIONS.market_rules, title: "Правила биржи заказов",
    summary: "Порядок размещения индивидуальных заказов и откликов мастеров.",
    content: `## 1. Назначение\n\nБиржа заказов связывает покупателей, которым нужно изделие по индивидуальному заказу, с мастерами, готовыми его изготовить.\n\n## 2. Размещение заказа\n\nПокупатель заполняет заявку: тип изделия, материалы, габариты, бюджет, сроки, регион доставки и референсы. Заказ проходит модерацию платформы (запрещены контрафакт и копии известных брендов) и публикуется в бирже.\n\n## 3. Видимость и отклики\n\nЗаказ виден только мастерам, работающим с соответствующим типом изделий и доставляющим в регион покупателя. Мастер отправляет структурированное коммерческое предложение; на платных тарифах действует приоритет показа.\n\n## 4. Сделка\n\nПокупатель сравнивает предложения, при необходимости уточняет детали в закрытом чате заказа и принимает лучшее. Оплата проходит через безопасную сделку: средства резервируются и перечисляются мастеру после подтверждения отправки.\n\n## 5. Лимиты\n\nКоличество одновременных активных заказов зависит от тарифа покупателя. Изделия на заказ возврату не подлежат (абз. 4 п. 4 ст. 26.1 ЗоЗПП).`,
  },
];
export const legalDoc = (type: string) => LEGAL_DOCUMENTS.find((d) => d.doc_type === type);

/* ---------- форматирование ---------- */
export const fmt = (n: number) => n.toLocaleString("ru-RU") + " ₽";
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
