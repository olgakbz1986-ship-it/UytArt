# UytArt

Маркетплейс цифровых и ремесленных товаров: витрины продавцов (магазины,
мастера, авторы), подписки на новинки, лента, индивидуальные заказы, отзывы,
оплата через YooKassa.

## Ключевые возможности

- Подписки на продавцов с обогащённой лентой новинок (`new_count`, `is_new`);
- Лента подписок `/api/feed` и лента продавца с пагинацией по cursor;
- Уведомления in-app + фоновые email/push-обработчики (60 с, группировка от спама,
  персональные настройки каналов);
- Двухтокенная JWT-аутентификация (access + HttpOnly refresh, отзыв через
  `revoked_tokens`);
- Полная схема PostgreSQL (14 миграций up/down) + файловый режим для разработки;
- Клиент на React 18 + TanStack Query (кэш, мутации, infinite scroll);
- Тесты: Vitest (unit), Supertest (integration), Playwright (e2e); ESLint,
  Prettier, Husky pre-commit.

## Быстрый старт

```bash
git clone https://github.com/olgakbz1986-ship-it/UytArt.git && cd UytArt
npm install

# Вариант A — без БД (файловый режим разработки)
node server/index.cjs &     # API http://localhost:8787
npm run dev                 # фронтенд http://localhost:5173

# Вариант B — PostgreSQL
cp .env.example .env.server # заполните DATABASE_URL
npm run migrate && npm run seed
node server/index.cjs &
npm run dev

# Docker (БД + сервер + фронтенд)
docker compose up -d --build   # фронт :8080, API :8787
```

Тестовые аккаунты после `seed`: `buyer1@test.local / demo1234`,
`seller1@test.local / demo1234`.

Проверка качества:

```bash
npm run test            # модульные тесты
npm run test:coverage   # покрытие
npm run test:integration
npm run test:e2e        # Playwright
npm run lint && npm run typecheck && npm run build
```

## Документация

| Файл | Содержание |
|------|-----------|
| [docs/architecture.md](docs/architecture.md) | архитектура, потоки данных |
| [docs/database.md](docs/database.md) | схема БД, миграции, сид |
| [docs/api.md](docs/api.md) | все эндпоинты с примерами |
| [docs/security.md](docs/security.md) | JWT, CORS, CSRF, ПД, ротация секретов |
| [docs/deployment.md](docs/deployment.md) | прод: env, PostgreSQL, SMTP, YooKassa, SSL |
| [docs/development.md](docs/development.md) | локальная разработка, Git, PR, staging |
| [docs/troubleshooting.md](docs/troubleshooting.md) | частые проблемы и решения |
| [docs/contributing.md](docs/contributing.md) | код-стайл, ревью, релизы |

## CI

![CI](https://github.com/olgakbz1986-ship-it/UytArt/actions/workflows/ci.yml/badge.svg)
[История запусков](https://github.com/olgakbz1986-ship-it/UytArt/actions/workflows/ci.yml)

## Технологии

React 18 · TypeScript · Vite · TanStack Query · Zustand · Tailwind CSS 4 ·
Node.js 20 · Express 5 · PostgreSQL 15 · JWT/bcrypt · nodemailer · web-push ·
YooKassa · Vitest · Supertest · Playwright · ESLint · Prettier · Husky ·
Docker · GitHub Actions
