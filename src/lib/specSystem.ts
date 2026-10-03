export type SpecFieldType = "text" | "number" | "select" | "boolean" | "multiselect" | "range";
export interface SpecFieldDef { id: string; label: string; type: SpecFieldType; unit?: string; options?: string[]; placeholder?: string; hint?: string; important?: boolean; hideIf?: RegExp }
export interface SpecGroupDef { id: string; label: string; icon: string; defaultOpen?: boolean; fields: SpecFieldDef[] }

const identification: SpecGroupDef = { id: "ident", label: "Тех. идентификация (необязательно)", icon: "🏷", fields: [
  { id: "model", important: true, label: "Модель", type: "text", placeholder: "Например: Сmart 22" },
  { id: "series", label: "Серия / коллекция", type: "text" },
  { id: "country", label: "Страна производства", type: "text", placeholder: "Россия" },
  { id: "gtin", label: "Штрих-код (EAN/GTIN)", type: "text", placeholder: "4600000000000" },
]};
const packing: SpecGroupDef = { id: "pack", label: "Упаковка и комплект", icon: "📦", fields: [
  { id: "gross", label: "Вес в упаковке", type: "number", unit: "кг" },
  { id: "packsize", label: "Габариты упаковки (Д×Ш×В)", type: "text", placeholder: "400×300×200 мм" },
  { id: "packtype", label: "Тип упаковки", type: "select", options: ["Коробка", "Пакет", "Плёнка", "Обрешётка", "Блистер", "Без упаковки"] },
  { id: "setitems", label: "Предметов в комплекте", type: "number" },
]};
const compliance: SpecGroupDef = { id: "comp", label: "Гарантия и сертификация", icon: "🛡", fields: [
  { id: "warranty", important: true, label: "Гарантия", type: "select", options: ["Без гарантии", "6 месяцев", "1 год", "2 года", "5 лет", "Пожизненная"] },
  { id: "cert", label: "Сертификация", type: "select", options: ["Не требуется", "EAC", "CE", "ГОСТ Р", "Пожарный сертификат", "Декларация соответствия"] },
  { id: "lifetime", label: "Срок службы", type: "text", placeholder: "10 лет" },
  { id: "docs", label: "Документы в комплекте", type: "text", placeholder: "Паспорт изделия, инструкция" },
]};

const doors: SpecGroupDef = { id: "doors", label: "Дверная конструкция", icon: "🚪", defaultOpen: true, fields: [
  { id: "leaf", important: true, label: "Толщина полотна", type: "number", unit: "мм", hint: "Обычно 40–100 мм" },
  { id: "metal", important: true, label: "Толщина металла", type: "number", unit: "мм", hint: "1.2–2.0 мм для входных" },
  { id: "boxdepth", label: "Глубина коробки", type: "number", unit: "мм" },
  { id: "nalich", label: "Наличник: ширина / толщина", type: "text", placeholder: "70 / 10 мм" },
  { id: "contours", label: "Контуров уплотнения", type: "select", options: ["1", "2", "3"] },
  { id: "insul", label: "Утеплитель", type: "select", options: ["Минеральная вата", "Пенополистирол", "ППУ", "Без утепления"] },
  { id: "termo", label: "Терморазрыв", type: "boolean" },
  { id: "locks", important: true, label: "Типы замков", type: "multiselect", options: ["Сувальдный", "Цилиндровый", "Электронный", "Умный замок"] },
  { id: "side", important: true, label: "Сторона открывания", type: "select", options: ["Левая", "Правая", "Универсальная"] },
  { id: "finish", label: "Покрытие", type: "select", options: ["Порошковое", "МДФ-панель", "Массив", "Ламинат", "Эмаль"] },
]};

const electro: SpecGroupDef = { id: "electro", label: "Технические параметры", icon: "️", defaultOpen: true, fields: [
  { id: "power", important: true, label: "Мощность", type: "number", unit: "Вт" },
  { id: "volt", important: true, label: "Напряжение", type: "number", unit: "В" },
  { id: "battery", label: "Ёмкость батареи", type: "number", unit: "мА·ч" },
  { id: "screen", label: "Диагональ дисплея", type: "number", unit: "дюйм" },
  { id: "ports", label: "Разъёмы", type: "multiselect", options: ["USB-C", "USB-A", "HDMI", "3.5 мм", "RJ-45"] },
  { id: "ip", label: "Класс защиты", type: "select", options: ["IP20", "IP44", "IP54", "IP65", "IP67", "IP68"] },
  { id: "wire", label: "Беспроводные технологии", type: "multiselect", options: ["Wi-Fi", "Bluetooth", "NFC", "GPS"] },
  { id: "temp", label: "Рабочая температура", type: "range", unit: "°C" },
]};

const clothes: SpecGroupDef = { id: "clothes", label: "Одежда и обувь", icon: "👕", defaultOpen: true, fields: [
  { id: "sizes", important: true, label: "Доступные размеры", type: "multiselect", options: ["XS", "S", "M", "L", "XL", "XXL"] },
  { id: "gender", important: true, label: "Пол", type: "select", options: ["Женский", "Мужской", "Унисекс", "Детский"], hideIf: /мужск|женск/i },
  { id: "season", label: "Сезон", type: "multiselect", options: ["Лето", "Демисезон", "Зима", "Всесезон"] },
  { id: "fabric", label: "Состав ткани", type: "text", placeholder: "Хлопок 95%, эластан 5%" },
  { id: "care", label: "Уход", type: "select", options: ["Машинная стирка", "Ручная стирка", "Только химчистка"] },
]};

const ceramic: SpecGroupDef = { id: "ceramic", label: "Керамика и скульптура", icon: "🏺", defaultOpen: true, fields: [
  { id: "height", label: "Высота", type: "number", unit: "см" },
  { id: "diam", label: "Диаметр", type: "number", unit: "см" },
  { id: "wall", label: "Толщина стенки", type: "number", unit: "мм" },
  { id: "firing", label: "Тип обжига", type: "select", options: ["Молочная керамика", "Майолика", "Шамот", "Фарфор", "Фаянс"] },
  { id: "glaze", label: "Глазурь", type: "text", placeholder: "Прозрачная глянцевая" },
  { id: "foodsafe", label: "Контакт с пищей", type: "boolean" },
  { id: "dishwash", label: "Можно в посудомойку", type: "boolean" },
]};

const digital: SpecGroupDef = { id: "digital", label: "Цифровой товар", icon: "💾", defaultOpen: true, fields: [
  { id: "formats", label: "Форматы файлов", type: "multiselect", options: ["PDF", "PNG", "SVG", "ZIP", "MP4", "STL"] },
  { id: "license", label: "Лицензия", type: "select", options: ["Личное использование", "Коммерческая", "Расширенная"] },
  { id: "resolution", label: "Разрешение", type: "text", placeholder: "300 dpi / 4K" },
  { id: "size", important: true, label: "Объём файла", type: "number", unit: "МБ" },
  { id: "access", label: "Срок доступа", type: "select", options: ["Бессрочно", "1 год", "Подписка"] },
]};

const materials: SpecGroupDef = { id: "materials", label: "Материалы и прокат", icon: "🪵", defaultOpen: true, fields: [
  { id: "grade", label: "Сорт / марка", type: "text", placeholder: "Сорт 1, Ст3сп" },
  { id: "section", important: true, label: "Сечение", type: "text", placeholder: "50×100 мм" },
  { id: "length", label: "Длина", type: "number", unit: "м" },
  { id: "moist", label: "Влажность", type: "number", unit: "%" },
  { id: "treat", label: "Обработка", type: "multiselect", options: ["Сушка", "Строгание", "Покраска", "Цинкование", "Антисептик"] },
  { id: "unit", label: "Единица продажи", type: "select", options: ["шт", "м²", "м³", "пог. м", "тонна"] },
]};

const cosmetics: SpecGroupDef = { id: "cosmetics", label: "Косметика и парфюмерия", icon: "💄", defaultOpen: true, fields: [
  { id: "volume", label: "Объём", type: "number", unit: "мл" },
  { id: "skintype", label: "Тип кожи", type: "multiselect", options: ["Нормальная", "Сухая", "Жирная", "Комбинированная", "Чувствительная"] },
  { id: "ingredients", label: "Ключевые ингредиенты", type: "text", placeholder: "Гиалуроновая кислота, витамин С" },
  { id: "shelflife", label: "Срок годности", type: "number", unit: "мес" },
  { id: "storage", label: "Условия хранения", type: "text", placeholder: "При t° +5…+25°C, вдали от света" },
  { id: "cruelty", label: "Не тестируется на животных", type: "boolean" },
  { id: "vegan", label: "Веганский состав", type: "boolean" },
]};

const food: SpecGroupDef = { id: "food", label: "Продукты питания", icon: "🍫", defaultOpen: true, fields: [
  { id: "weight", label: "Вес нетто", type: "number", unit: "г" },
  { id: "calories", label: "Калорийность", type: "number", unit: "ккал/100г" },
  { id: "protein", label: "Белки", type: "number", unit: "г" },
  { id: "fat", label: "Жиры", type: "number", unit: "г" },
  { id: "carbs", label: "Углеводы", type: "number", unit: "г" },
  { id: "ingredients", label: "Состав", type: "text", placeholder: "Какао-бобы, сахар, какао-масло" },
  { id: "allergens", label: "Аллергены", type: "multiselect", options: ["Глютен", "Молоко", "Орехи", "Соя", "Яйца", "Рыба"] },
  { id: "shelflife", label: "Срок годности", type: "number", unit: "дней" },
  { id: "storage", label: "Условия хранения", type: "text", placeholder: "При t° +2…+6°C" },
]};

const jewelry: SpecGroupDef = { id: "jewelry", label: "Ювелирные изделия", icon: "💍", defaultOpen: true, fields: [
  { id: "metal", label: "Металл", type: "select", options: ["Золото", "Серебро", "Платина", "Палладий", "Титан"] },
  { id: "purity", label: "Проба", type: "select", options: ["375", "500", "585", "750", "925", "950"] },
  { id: "stone", label: "Тип камня", type: "select", options: ["Бриллиант", "Рубин", "Сапфир", "Изумруд", "Жемчуг", "Без камня"] },
  { id: "carats", label: "Караты", type: "number", unit: "кт" },
  { id: "ringsize", important: true, label: "Размер кольца", type: "number", unit: "мм" },
  { id: "clasp", label: "Тип застёжки", type: "select", options: ["Карабин", "Застёжка-петля", "Английская", "Без застёжки"] },
]};

const furniture: SpecGroupDef = { id: "furniture", label: "Мебель", icon: "", defaultOpen: true, fields: [
  { id: "mechanism", label: "Механизм трансформации", type: "select", options: ["Книжка", "Еврокнижка", "Дельфин", "Аккордеон", "Без механизма"] },
  { id: "upholstery", label: "Материал обивки", type: "select", options: ["Ткань", "Кожа", "Экокожа", "Велюр", "Микровелюр"] },
  { id: "frame", label: "Материал каркаса", type: "select", options: ["Массив", "МДФ", "ДСП", "Металл"] },
  { id: "filler", label: "Наполнитель", type: "select", options: ["Пенополиуретан", "Пружинный блок", "Холлофайбер", "Латекс"] },
  { id: "load", label: "Максимальная нагрузка", type: "number", unit: "кг" },
  { id: "sleepsize", important: true, label: "Размер спального места", type: "text", placeholder: "160×200 см" },
]};

const autoparts: SpecGroupDef = { id: "autoparts", label: "Автозапчасти", icon: "🚗", defaultOpen: true, fields: [
  { id: "oem", label: "OEM-номер", type: "text", placeholder: "1234567890" },
  { id: "brand", label: "Марка авто", type: "text", placeholder: "Toyota" },
  { id: "model", label: "Модель авто", type: "text", placeholder: "Camry" },
  { id: "year", label: "Год выпуска", type: "range", unit: "год" },
  { id: "side", label: "Сторона установки", type: "select", options: ["Левая", "Правая", "Универсальная"] },
  { id: "position", label: "Расположение", type: "select", options: ["Перед", "Зад", "Верх", "Низ"] },
]};

const sports: SpecGroupDef = { id: "sports", label: "Спорт и фитнес", icon: "⚽", defaultOpen: true, fields: [
  { id: "length", label: "Длина", type: "number", unit: "см" },
  { id: "diam", label: "Диаметр", type: "number", unit: "см" },
  { id: "weight", label: "Вес", type: "number", unit: "кг" },
  { id: "age", label: "Возрастная группа", type: "select", options: ["Дети 3–6", "Дети 7–12", "Подростки", "Взрослые", "Универсальный"] },
  { id: "load", label: "Максимальная нагрузка", type: "number", unit: "кг" },
  { id: "cert", label: "Сертификация", type: "select", options: ["ГОСТ", "CE", "Без сертификации"] },
]};

const construction: SpecGroupDef = { id: "construction", label: "Стройматериалы", icon: "", defaultOpen: true, fields: [
  { id: "grade", label: "Марка / класс", type: "text", placeholder: "М500, D400" },
  { id: "section", label: "Размеры", type: "text", placeholder: "250×120×65 мм" },
  { id: "weight", label: "Вес единицы", type: "number", unit: "кг" },
  { id: "strength", label: "Прочность", type: "number", unit: "МПа" },
  { id: "frost", label: "Морозостойкость", type: "number", unit: "циклов" },
  { id: "unit", label: "Единица продажи", type: "select", options: ["шт", "м²", "м³", "упаковка", "паллет"] },
]};

const music: SpecGroupDef = { id: "music", label: "Музыкальные инструменты", icon: "🎸", defaultOpen: true, fields: [
  { id: "type", label: "Тип инструмента", type: "select", options: ["Струнный", "Духовой", "Ударный", "Клавишный", "Электронный"] },
  { id: "material", label: "Материал корпуса", type: "text", placeholder: "Клён, палисандр" },
  { id: "tonality", label: "Тональность", type: "text", placeholder: "До мажор" },
  { id: "strings", label: "Количество струн", type: "number" },
  { id: "size", label: "Размер", type: "select", options: ["1/4", "1/2", "3/4", "4/4", "Полноразмерный"] },
]};

const kids: SpecGroupDef = { id: "kids", label: "Детские товары", icon: "🧸", defaultOpen: true, fields: [
  { id: "age", label: "Возраст", type: "select", options: ["0–1 год", "1–3 года", "3–6 лет", "6–12 лет", "12+ лет"] },
  { id: "safety", label: "Безопасность", type: "multiselect", options: ["Без мелких деталей", "Гипоаллергенно", "Сертификат ЕАС", "Безопасные краски"] },
  { id: "material", label: "Материал", type: "text", placeholder: "Натуральное дерево, пищевой силикон" },
  { id: "washable", label: "Можно мыть", type: "boolean" },
  { id: "batteries", label: "Требуются батарейки", type: "boolean" },
]};

const books: SpecGroupDef = { id: "books", label: "Книги и канцтовары", icon: "📚", defaultOpen: true, fields: [
  { id: "author", label: "Автор", type: "text" },
  { id: "publisher", label: "Издательство", type: "text" },
  { id: "year", label: "Год издания", type: "number", unit: "год" },
  { id: "pages", label: "Количество страниц", type: "number" },
  { id: "isbn", label: "ISBN", type: "text", placeholder: "978-5-17-123456-7" },
  { id: "language", label: "Язык", type: "select", options: ["Русский", "Английский", "Другой"] },
]};

const tools: SpecGroupDef = { id: "tools", label: "Инструменты", icon: "🔧", defaultOpen: true, fields: [
  { id: "power", label: "Мощность", type: "number", unit: "Вт" },
  { id: "rpm", label: "Обороты", type: "number", unit: "об/мин" },
  { id: "chuck", label: "Патрон", type: "select", options: ["Быстрозажимной", "Ключевой", "SDS-plus", "SDS-max"] },
  { id: "battery", label: "Тип питания", type: "select", options: ["Сетевой", "Аккумуляторный", "Пневматический"] },
  { id: "voltage", label: "Напряжение АКБ", type: "number", unit: "В" },
  { id: "case", label: "Кейс в комплекте", type: "boolean" },
]};

const garden: SpecGroupDef = { id: "garden", label: "Сад и огород", icon: "🌱", defaultOpen: true, fields: [
  { id: "area", label: "Площадь обработки", type: "number", unit: "м²" },
  { id: "season", label: "Сезон использования", type: "multiselect", options: ["Весна", "Лето", "Осень", "Зима"] },
  { id: "water", label: "Потребность в воде", type: "select", options: ["Минимальная", "Средняя", "Высокая"] },
  { id: "light", label: "Освещённость", type: "select", options: ["Тень", "Полутень", "Солнце"] },
  { id: "soil", label: "Тип почвы", type: "multiselect", options: ["Песчаная", "Глинистая", "Чернозём", "Торфяная"] },
]};


const decor: SpecGroupDef = { id: "decor", label: "Декор и интерьер", icon: "🏺", defaultOpen: true, fields: [
  { id: "style", label: "Стиль", type: "select", options: ["Классика", "Модерн", "Лофт", "Скандинавский", "Минимализм", "Бохо", "Прованс", "Ар-деко"] },
  { id: "room", label: "Комната", type: "multiselect", options: ["Гостиная", "Спальня", "Кухня", "Ванная", "Детская", "Прихожая", "Кабинет"] },
  { id: "mount", label: "Крепление", type: "select", options: ["Настенное", "Напольное", "Настольное", "Подвесное", "Без крепления"] },
  { id: "handmade", label: "Ручная работа", type: "boolean" },
]};

const accessories: SpecGroupDef = { id: "accessories", label: "Аксессуары", icon: "", defaultOpen: true, fields: [
  { id: "material", label: "Материал", type: "text", placeholder: "Натуральная кожа, текстиль, металл" },
  { id: "closure", label: "Застёжка", type: "select", options: ["Молния", "Кнопка", "Магнитная", "Шнурок", "Без застёжки"] },
  { id: "compartments", label: "Отделений", type: "number" },
  { id: "strap", label: "Длина ремня", type: "text", placeholder: "Регулируемый, 120 см" },
]};

const hardware: SpecGroupDef = { id: "hardware", label: "Фурнитура и крепёж", icon: "", defaultOpen: true, fields: [
  { id: "type", label: "Тип", type: "select", options: ["Петли", "Ручки", "Замки", "Крепёж", "Направляющие", "Конфирматы"] },
  { id: "load", label: "Нагрузка", type: "number", unit: "кг" },
  { id: "finish", label: "Покрытие", type: "select", options: ["Хром", "Латунь", "Чёрный матовый", "Нержавеющая сталь", "Бронза"] },
  { id: "mount_type", label: "Монтаж", type: "select", options: ["Накладной", "Врезной", "Скрытый"] },
]};

const home_goods: SpecGroupDef = { id: "home_goods", label: "Товары для дома", icon: "", defaultOpen: true, fields: [
  { id: "room", label: "Комната", type: "multiselect", options: ["Кухня", "Ванная", "Спальня", "Гостиная", "Прихожая"] },
  { id: "material", label: "Материал", type: "text", placeholder: "Пластик, металл, дерево" },
  { id: "washable", label: "Можно мыть", type: "boolean" },
  { id: "stackable", label: "Штабелируемый", type: "boolean" },
]};

const plumbing: SpecGroupDef = { id: "plumbing", label: "Сантехника", icon: "🚿", defaultOpen: true, fields: [
  { id: "type", label: "Тип", type: "select", options: ["Ванна", "Душевая кабина", "Раковина", "Унитаз", "Смеситель", "Биде"] },
  { id: "install", label: "Установка", type: "select", options: ["Настенная", "Напольная", "Встраиваемая", "Подвесная"] },
  { id: "pressure", label: "Рабочее давление", type: "number", unit: "атм" },
  { id: "connection", label: "Подключение", type: "select", options: ["1/2\"", "3/4\"", "3/8\"", "G1\"", "G1.5\""] },
]};

const finishing: SpecGroupDef = { id: "finishing", label: "Отделочные материалы", icon: "🖌️", defaultOpen: true, fields: [
  { id: "type", label: "Тип", type: "select", options: ["Обои", "Краска", "Штукатурка", "Плитка", "Ламинат", "Линолеум"] },
  { id: "coverage", label: "Расход", type: "text", placeholder: "10 м²/л, 1.5 кг/м²" },
  { id: "layers", label: "Слоёв", type: "number" },
  { id: "dry_time", label: "Время высыхания", type: "text", placeholder: "2 часа, 24 часа" },
]};

const services: SpecGroupDef = { id: "services", label: "Услуги", icon: "🛠️", defaultOpen: true, fields: [
  { id: "duration", label: "Срок выполнения", type: "text", placeholder: "1 день, 1 неделя, 1 месяц" },
  { id: "warranty", label: "Гарантия на работы", type: "text", placeholder: "6 месяцев, 1 год" },
  { id: "includes", label: "Включает", type: "multiselect", options: ["Замер", "Доставка", "Монтаж", "Уборка", "Консультация"] },
  { id: "payment", label: "Оплата", type: "select", options: ["Предоплата", "По факту", "Поэтапная"] },
]};

const RULES: { match: RegExp; group: SpecGroupDef }[] = [
  // Двери и окна
  { match: /двер|окон|ворот/i, group: doors },
  // Техника и электроника
  { match: /телефон|смартфон|компьютер|ноутбук|планшет|электро|прибор|инструмент|техник|освещ/i, group: electro },
  // Одежда и обувь
  { match: /одежд|обув|плать|куртк|футбол|пальто|текстил/i, group: clothes },
  // Керамика и посуда
  { match: /ваз|керам|статуэт|скульптур|горшк|посуд|фарфор|кашпо/i, group: ceramic },
  // Цифровые товары
  { match: /цифров(?!\s*панел)|файл(?!\s*для\s*печати)|софт|программ(?!\s*обеспеч)|лиценз|курс|урок|шаблон(?!\s*3d)|цифровой\s*товар|электронн(?!\s*книг)|pdf|mp3|mp4|wav|stl|obj|fbx/i, group: digital },
  // Стройматериалы
  { match: /лес|древ|металл|прокат|строймат|пиломат|фанер|кирпич|крепеж/i, group: materials },
  // Косметика и красота
  { match: /крем|духи|парфюм|космет|шампунь|мыло|лосьон|маск/i, group: cosmetics },
  // Еда и напитки
  { match: /шоколад|кофе|чай|мёд|конфет|печень|хлеб|молоко|сыр|мяс|рыб|фрукт|овощ|пицц|пирог|закус/i, group: food },
  // Ювелирные изделия
  { match: /кольц|серьг|браслет|кулон|цепочк|ювелир|бижутер/i, group: jewelry },
  // Мебель
  { match: /диван|кресл|стол|стул|шкаф|кровать|тумб|полк|мебел|матрас|пуф/i, group: furniture },
  // Автозапчасти
  { match: /автозапчаст|запчаст|тормозн|подвеск|двигател|фильтр|шина|диск/i, group: autoparts },
  // Спорт
  { match: /спорт|фитнес|тренажёр|гантел|штанг|мяч|лыж|велосипед|йога/i, group: sports },
  // Стройка и отделка
  { match: /кирпич|бетон|цемент|штукатур|краск|клей|плитк|обой|ламинат|линолеум/i, group: construction },
  // Музыка
  { match: /гитар|пианин|барабан|скрипк|саксофон|музык/i, group: music },
  // Детские товары
  { match: /игрушк|детск|кукл|машинк|конструктор|пазл|коляск|кроватк/i, group: kids },
  // Книги и канцелярия
  { match: /книг|тетрадь|ручк|карандаш|блокнот|ежедневник|канц/i, group: books },
  // Инструменты
  { match: /дрель|шуруповёрт|болгарк|пила|лобзик|фрезер|перфоратор/i, group: tools },
  // Сад и огород
  { match: /сад|огород|растен|семен|удобрени|газон|цветы|теплиц/i, group: garden },
  // Декор и интерьер (зеркала, картины, свечи, фоторамки, 3D-панели, ароматы)
  { match: /зеркал|картин|панно|свеч|подсвечн|фоторамк|альбом|аромат|диффузор|саше|панел|лепнин|розетк/i, group: decor },
  // Аксессуары (сумки, рюкзаки, часы, ремни, очки)
  { match: /сумк|рюкзак|клатч|часы|ремн|очк|кошел|портмоне|зонт|шарф/i, group: accessories },
  // Фурнитура и крепёж
  { match: /петл|ручк|замк|направляющ|конфирмат|шуруп|болт|гайк|винт|дюбель/i, group: hardware },
  // Товары для дома (уборка, хранение, для животных)
  { match: /уборк|хранен|животн|корм|лоток|лежак|миск|переноск|когтеточк/i, group: home_goods },
  // Сантехника
  { match: /ванн|душ|раковин|унитаз|смесит|биде|инсталляц|полотенцесуш/i, group: plumbing },
  // Отделочные материалы
  { match: /обои|штукатур|краск|плитк|ламинат|линолеум|паркет|плинтус|молдинг/i, group: finishing },
  // Услуги
  { match: /услуг|ремонт|монтаж|установк|пошив|дизайн|съёмк|внедрен|консульт/i, group: services },
];

export function getGroupsForCategory(category: string): SpecGroupDef[] {
  const specific = RULES.find((r) => r.match.test(category || ""))?.group;
  return specific ? [specific, identification, packing, compliance] : [identification, packing, compliance];
}
