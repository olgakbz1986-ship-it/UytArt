# API UytArt

Базовый URL: `http://localhost:8787` (dev). Все защищённые маршруты требуют
заголовок `Authorization: Bearer <access_token>`. Формат ответов — JSON.

## Коды ошибок (общие)

| Код | Ситуация |
|-----|----------|
| 400 | невалидные параметры / цель не найдена |
| 401 | отсутствует/просрочен access-токен (`{"error":"unauthorized"}`) |
| 403 | нет прав на ресурс |
| 404 | ресурс не найден |
| 429 | превышен rate limit |
| 500 | внутренняя ошибка сервера |

---

## Подписки

### GET /api/subscriptions
Список подписок пользователя с обогащением.

Параметры запроса:
- `limit` — int, по умолчанию 20;
- `cursor` — id последней подписки предыдущей страницы;
- `sort_by` — `date` (по умолчанию) | `new_count` | `name`;
- `search` — подстрока для фильтра по `target_name` (LIKE `%…%`).

Ответ 200:
```json
{
  "subscriptions": [
    {
      "id": "uuid", "user_id": "uuid",
      "target_type": "shop", "target_id": "uuid",
      "target_name": "Мастерская керамики",
      "target_slug": "ceramics",
      "target_avatar": "https://…/a.png",
      "target_url": "/sellers/ceramics",
      "created_at": "2026-10-01T10:00:00Z",
      "updated_at": "2026-10-01T10:00:00Z",
      "last_seen_at": null,
      "new_count": 3
    }
  ],
  "next_cursor": "uuid-или-null"
}
```
Поля `target_*` равны `null`, если продавец удалён. Ошибки: 401.

### POST /api/subscriptions
Создание подписки. Тело:
```json
{ "target_type": "shop", "target_id": "uuid продавца" }
```
- `target_type` ∈ shop | master | author; сервер проверяет существование
  `target_id` в таблице `sellers`.

Ответ 200 (создано): `{"ok":true,"subscription":{...}}`
Ответ 200 (дубликат, обрабатывается уникальным индексом): `{"ok":true,"message":"Уже подписаны"}`
Ответ 400: `{"error":"Продавец не найден"}`. Ошибки: 400, 401.

### DELETE /api/subscriptions/:targetType/:targetId
Удаление подписки текущего пользователя.
Ответ 200: `{"ok":true}`; 404 — подписки нет; 401 — без авторизации.

### POST /api/subscriptions/:targetType/:targetId/read
Обновляет `last_seen_at` подписки на текущее время (пользователь открыл ленту
продавца или раздел подписок). Ответ 200: `{"ok":true}`; 404 — подписки нет; 401.

---

## Лента

### GET /api/feed
Лента новых товаров от всех подписок пользователя.

Параметры: `limit` (по умолчанию 20), `cursor`, `target_type` (фильтр по типу подписки).

Правило отбора: товары из `products`, где `seller_id ∈ target_id` подписок, а
`created_at > COALESCE(last_seen_at, subscriptions.created_at)`. Сортировка —
`created_at DESC`. После получения ленты `last_seen_at` затронутых подписок
обновляется.

Ответ 200:
```json
{
  "items": [
    {
      "id": "uuid", "name": "Чайник", "price": 1500,
      "created_at": "2026-10-27T09:00:00Z",
      "is_new": true,
      "seller": { "id": "uuid", "name": "…", "slug": "…", "avatar_url": "…" }
    }
  ],
  "next_cursor": null
}
```
Ошибки: 401.

### GET /api/sellers/:id/feed
Лента товаров конкретного продавца. Параметры: `limit`, `cursor`.
Товары `created_at DESC`; если пользователь подписан на продавца, после выдачи
ленты обновляется `last_seen_at` этой подписки. Ошибки: 401, 404.

---

## Уведомления

### GET /api/notifications
Параметры: `limit` (по умолчанию 20), `cursor`, `unread_only` (bool, по умолчанию false).
Сортировка `created_at DESC`.
Ответ 200: `{"notifications":[{id,type,title,text,link,read,created_at}],"next_cursor":null}`.
Ошибки: 401.

### PUT /api/notifications/:id/read
Отметка уведомления прочитанным. Проверяется принадлежность текущему
пользователю. Ответ 200 `{"ok":true}`; 404 — не своё/нет; 401.

### PUT /api/notifications/read-all
Отметить все уведомления пользователя прочитанными.
Ответ 200: `{"ok":true,"updated":N}`; 401.

---

## Товары

### POST /api/products
Создание товара продавцом. В транзакции создаёт запись `products` и
`notifications` для всех подписчиков продавца (метод репозитория, группировка
по продавцу/времени, учёт настроек каналов). Ответ 201 с товаром; 400 при
валидации запрещённых слов; 401/403.

---

## Аутентификация (существующие маршруты)

- `POST /api/auth/register` — регистрация;
- `POST /api/auth/login` — вход, выдача access+refresh;
- `POST /api/auth/refresh` — обновление пары по refresh-cookie;
- `POST /api/auth/logout` — отзыв refresh (jti → `revoked_tokens`).
