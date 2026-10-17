# Цифровые товары в витрине каталога (паттерн адаптера)

## Архитектура
Две подсистемы связаны единым адаптером. Витрина каталога не знает о
`DigitalProduct` напрямую — она видит только формат `Product` с префиксом id `dp-`.

```
server/digital.cjs ──GET /api/digital/products──▶ useDigitalStore (mergeFromServer)
                                                        │  status === "published"
                                                        ▼
                                          digitalToMarketProduct()   ← src/lib/market.ts
                                          (единственное место преобразования)
                                                        ▼
                                  useMarketProducts() = PRODUCTS + sp-* + dp-*
                                                        ▼
                                  src/pages/catalog.tsx (фильтр по префиксам, двойной рендер карточки)
                                                        ▼
                                  клик dp-* → #/digital/:id (DigitalProductView, без дублирования)
```

## Карта маппинга типов (DIGITAL_TYPE_TO_CATEGORY, src/lib/market.ts)
| Тип DigitalProduct | Категория витрины (slug) | Подкатегория |
|---|---|---|
| site | sites_templates («Сайты и шаблоны») | сайты-экосистемы |
| prompt | prompts («Промты и промт-наборы») | библиотеки-промтов |
| skill | ai_agents («ИИ-агенты и скиллы») | скиллы-для-голосовых-ассистентов |
| agent | ai_agents | готовые-ии-агенты |
| subscription | subscriptions («Подписки и доступы») | подписка-на-ии-агентов-и-скиллы |

Константа является единственным источником истины соответствия типов.

## Адаптер digitalToMarketProduct()
Заполняет обязательные поля Product (title→name, price, previewUrl→image,
createdAt) и добавляет опциональные маркеры: `digitalType`, `digitalId`,
`digitalVersion`, `digitalSalesCount`, `testDriveLimit`. Id: `"dp-" + d.id`.
stock=99 для published (цифровой товар всегда «в наличии»), гео-фильтр для
`dp-*` не применяется (мгновенная выдача).

## Рендер и переходы
- Карточка (`src/components/product.tsx`) определяет тип по `p.digitalId`
  и добавляет: бейдж типа с иконкой DIGITAL_TYPE_META, версию вместо наличия,
  бейдж «Тест-драйв» (prompt/agent с testDriveLimit>0), рейтинг, продажи,
  иконку скачивания, текст мгновенной выдачи.
- Клик по dp-* ведёт на `/digital/:id` (оригинальный id без префикса).
- Кнопка «Тест-драйв» → `/digital/:id?section=test-drive`; DigitalProductView
  отслеживает search params и выполняет scrollIntoView к секции тест-драйва.

## Бэкенд
Новых эндпоинтов нет. GET /api/digital/products возвращает только published
и проецирует секретные поля продавца (systemPrompt, agentConfig, fileUrl).

## Как добавить новый тип цифрового товара
1. Добавить значение в `DigitalProductType` (src/types/digital.ts) и мету в DIGITAL_TYPE_META.
2. Добавить строку в `DIGITAL_TYPE_TO_CATEGORY` (src/lib/market.ts) — единственная правка маппинга.
3. При необходимости создать slug подкатегории в CATEGORIES (src/data/seed.ts, group="digital").
4. Отрисовка карточки, фильтры, поиск и сортировка подхватят тип автоматически.

## Изменённые файлы
- src/lib/market.ts — адаптер, карта маппинга, ensureDigitalCatalog, объединение в useMarketProducts
- src/lib/digital.ts — mergeFromServer(d, serverWins) синхронизирует статусы витринных товаров (архивация исчезает из каталога). Для витринной загрузки ensureDigitalCatalog() вызывает merge с serverWins=true: серверный published-снимок актуальнее локального persist-кэша и не содержит секретов (systemPrompt/agentConfig/fileUrl спроецированы на сервере); приватные поля локальных продуктов владельца при этом сохраняются. Обычный merge (seller-sync) оставляет приоритет за локальным объектом владельца.
- src/types (Product) — опциональные digital-маркеры
- src/pages/catalog.tsx — фильтр `sp- || dp-`, переход dp-* → /digital/:id
- src/components/product.tsx — двойной рендер карточки, кнопки «Тест-драйв»/«Купить»
- src/pages/DigitalProductView.tsx — автофокус секции тест-драйва через ?section=test-drive
