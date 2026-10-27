# Процесс разработки UytArt

## Настройка локального окружения

```bash
git clone https://github.com/olgakbz1986-ship-it/UytArt.git && cd UytArt
npm install
cp .env.example .env.server         # заполните DATABASE_URL, JWT_SECRET
npm run migrate && npm run seed     # чистая БД с тестовыми данными
node server/index.cjs &             # API :8787 (файловый режим, если DATABASE_URL пуст)
npm run dev                         # Vite :5173
```

Тестовые аккаунты после `seed`: `buyer1@test.local / demo1234`,
`seller1@test.local / demo1234`, `admin@test.local / demo1234`.

Без PostgreSQL возможна работа в файловом режиме (данные в JSON-файлах) —
просто не задавайте `DATABASE_URL`.

## Работа с Git

- Основная ветка — `main` (защищена, см. ниже). Рабочие ветки:
  `feat/<имя>`, `fix/<имя>`, `chore/<имя>`.
- Коммиты в стиле Conventional Commits: `feat: …`, `fix: …`, `docs: …`.
- Перед коммитом автоматически запускаются husky pre-commit: `npm run lint`
  и `npm run test`.

### Создание ветки и PR

```bash
git switch -c feat/subscriptions-feed main
# …изменения…
git commit -am "feat: описание"
git push -u origin feat/subscriptions-feed
gh pr create --base main --title "feat: описание" --body "…"
```

## Ревью кода

- Минимум **1 approve**; автор не может аппрувить свой PR.
- Ревьюер проверяет: корректность, тесты, отсутствие секретов в диффе,
  согласованность со схемой БД/API, доступность UI (aria/клавиатура).
- Обсуждение — в PR; после всех правок CI обязан быть зелёным.

## Тестирование

| Команда | Что делает |
|---------|-----------|
| `npm run test` | модульные тесты Vitest |
| `npm run test:coverage` | тесты + отчёт покрытия |
| `npm run test:integration` | интеграционные API-тесты (Supertest) |
| `npm run test:e2e` | пользовательские сценарии Playwright |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |

Интеграционные/e2e тесты требуют запущенного миграциями чистого БД-контура
(файловый режим допускается для части тестов).

## Деплой на staging

1. Слить PR в `main` → CI собирает артефакты.
2. На staging-сервере: `git pull && npm ci && npm run build && npm run migrate`.
3. Прогнать smoke-сценарии Playwright против staging:
   `PLAYWRIGHT_BASE_URL=https://staging.uyart.ru npm run test:e2e`.
4. Только после зелёного staging — релиз в прод (см. docs/deployment.md).

## Защита ветки main (настраивается один раз через GitHub Settings)

Settings → Branches → Add branch protection rule → `main`:
- ☑ Restrict pushes (запрет прямых пушей);
- ☑ Require a pull request before merging → Require approvals = 1;
- ☑ Require status checks to pass (CI job «checks»).
