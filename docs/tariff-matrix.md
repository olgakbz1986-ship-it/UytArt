# Матрица соответствия тарифов UytArt

Живой документ. Правило: **любая** правка тарифа обязана пройти по всем трём слоям:
карточка в `src/lib/seller.ts` → флаги в `server/tariffs.cjs` → видимость в кабинете
(`src/pages/extras.tsx` / `src/pages/profile.tsx`). Строка «✓/✗» = сверка этой матрицы.

## Уровни (PLAN_LEVEL)

| Уровень | Продавец | Покупатель |
|---|---|---|
| 0 | free | free |
| 1 | master, business, corp | start |
| 2 | master-pro, business-pro, corp-pro, profi | designer |
| 3 | master-premium, business-premium, corp-premium, top | premium |
| 4 | legend (2500), business-legend (9999), corp-legend (99999) | collector |

Словари уровней: `server/tariffs.cjs` (PLAN_LEVEL), `src/lib/seller.ts` (PLAN_LEVEL),
визуальные ярусы: `SELLER_LEVEL` в extras.tsx, `BUYER_TIER` в profile.tsx (акцент уровня 4: #5b3fa8, фон #221540).

## Продавец: флаги tier3/tier4

| Флаг | tier3 | tier4 | Видимость |
|---|---|---|---|
| weeklyReport | ✓ | ✓ | кабинет (отчёт) |
| b2bClosed | ✓ | ✓ | кабинет (B2B) |
| roundTheClock, topPositions, promoMailout, customReports, whiteLabel | ✓ | ✓ | кабинет (условия тарифа) |
| priorityModeration | — | ✓ | шапка: «приоритетная модерация активна» |
| cohortAnalytics | — | ✓ | блок «Когортная аналитика» (демо) |
| legendBadge | — | ✓ | бейдж «Легенда платформы» |

## Покупатель: флаги по ярусам

| Флаг | free | start | designer | premium | collector |
|---|---|---|---|---|---|
| qualityFilters | ✗ | ✓ | ✓ | ✓ | ✓ |
| earlyAccess | ✗ | ✗ | ✓ | ✓ | ✓ |
| discountPct | 0 | 3 | 5 | 7 | 10 |
| premiumSales / curator / vip | ✗ | ✗ | ✗ | ✓ | ✓ |
| collectorStatus | ✗ | ✗ | ✗ | ✗ | ✓ |

## Кросс-роль (Симметрия)

- Кабинет продавца показывает чип «Вы также покупатель — тариф …» (акцент по ярусу, скидка 10% у Коллекционера).
- Гейты кабинета: `minLevel` в `SettingsSection` (extras.tsx 2277+, profile.tsx 498+).
- Даунгрейд-защита сервера: тариф не понижается до конца оплаченного периода (строка с prev.planId в tariffs.cjs).

## Техдолг (осознанный)

- `PLAN_LEVEL` дублируется на сервере и в `src/lib/seller.ts` — унифицировать при рефакторинге тарифов.
- Когортная аналитика: демо-данные, подключить расчёт к реальным заказам.
