# Архитектура UytArt

## Общая структура проекта

```
.
├── src/                  # Фронтенд (React 18 + TypeScript + Vite)
│   ├── pages/            # Страницы (кабинет, лента, карточка товара)
│   ├── components/       # Переиспользуемые UI-компоненты
│   ├── hooks/            # Хуки TanStack Query (useSubscriptions, useFeed, ...)
│   └── lib/              # Клиентская логика (userFeed, geo, лимиты)
├── server/               # Бэкенд (Node.js + Express 5, CommonJS)
│   ├── index.cjs         # Точка входа, CORS, rate-limit, JWT-мидлвар
│   ├── subscriptions.cjs # Эндпоинты подписок
│   ├── feed.cjs          # Лента подписок, лента продавца, уведомления
│   ├── repo.cjs          # Репозиторный слой (PostgreSQL / файловый режим)
│   ├── db/               # Миграции, скрипты migrate / migrate-down / seed
│   └── workers/          # Фоновые обработчики email/push
├── shared/               # Общий код (валидация запрещённых товаров, тарифы)
├── tests/                # unit / integration / e2e
└── docs/                 # Документация
```

## Разделение фронтенд / бэкенд

- **Фронтенд** — SPA на React + TypeScript, собирается Vite. Управление серверным
  кэшем — TanStack Query (staleTime 5 мин, retry 1, refetchOnWindowFocus).
  State клиента — Zustand. Стилизация — Tailwind CSS 4.
- **Бэкенд** — Express 5 (`server/index.cjs`), отдаёт REST API `/api/*` и в
  продакшене статику собранного фронтенда из `dist/`.
- **Данные** — PostgreSQL (продакшен) или JSON-файлы (локальная разработка).
  Режим выбирается наличием переменной окружения `DATABASE_URL`
  (см. `server/repo.cjs`).

## Используемые технологии

| Слой        | Технологии |
|-------------|------------|
| Frontend    | React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind, lucide-react |
| Backend     | Node.js 20+, Express 5, helmet, cors, express-rate-limit, cookie-parser |
| Auth        | JWT (access + refresh), bcryptjs, jsonwebtoken |
| DB          | PostgreSQL 15 (pg), миграции SQL |
| Email/Push  | nodemailer (SMTP), web-push |
| Оплата      | YooKassa |
| Тесты       | Vitest, Supertest, Playwright |
| Качество    | ESLint, Prettier, Husky |

## Схема взаимодействия компонентов

```
Browser (React SPA)
   │  fetch /api/* (HttpOnly refresh-cookie + Bearer access)
   ▼
Express API (index.cjs)
   ├─ auth (JWT verify, revoke-проверка)
   ├─ subscriptions.cjs ─┐
   ├─ feed.cjs ──────────┼─► repo.cjs ─► PostgreSQL (pg Pool)
   ├─ admin.cjs ─────────┘        │
   └─ workers/email-worker.cjs ◄──┴── таблица notifications
                     └─► SMTP
      workers/push-worker.cjs ─► Web Push сервис
```

## Потоки данных для ключевых сценариев

### Регистрация
1. `POST /api/auth/register` → валидация zod → bcrypt-хеш пароля.
2. INSERT в `users` (role=buyer, email_confirmed=false, confirm_token/expires).
3. Письмо подтверждения на email; после `GET /api/auth/confirm?token=` флаг
   `email_confirmed=true`.
4. Выдаётся пара токенов: access (15 мин, в памяти клиента) и refresh
   (7 дней, HttpOnly cookie); jti хранится, отзыв — в `revoked_tokens`.

### Подписка
1. Клик «Подписаться» → `useMutation` → `POST /api/subscriptions {target_type,target_id}`.
2. Сервер проверяет существование продавца в `sellers`; при отсутствии — 400
   «Продавец не найден»; при дубликате — уникальный индекс
   `(user_id,target_type,target_id)` → ответ «Уже подписаны».
3. `GET /api/subscriptions` возвращает enriched-список: target_name/slug/avatar/url
   + new_count (тователи новее last_seen_at). Пагинация cursor, сортировка, поиск.

### Покупка
1. `POST /api/products` у продавца → транзакционный метод репозитория создаёт
   товар И записи `notifications` для всех подписчиков (группировка по продавцу).
2. Покупка цифрового товара → запись в `purchases` (order_number, amount, status).
3. Оплата через YooKassa, webhook подтверждает статус.

### Уведомление
1. Событие (новый товар подписного продавца) → INSERT `notifications (type='alert')`.
2. Каждые 60 с фоновые воркеры выбирают до 100 непрочитанных `alert`,
   группируют по продавцу/времени, проверяют настройки пользователя
   (`notification_preferences`) и отправляют email/push.
3. Успешная отправка → `read=true`. Пользователь также может прочитать
   список через `GET /api/notifications` и отметить прочитанным.
