# Вклад в проект (Contributing)

## Код поведения

- Уважение к участникам; обсуждения — о коде, не о людях.
- Русский/английский в issues и PR; технический код и комментарии — по возможности
  на русском (проект русскоязычный).
- Не публикуйте чужие персональные данные, токены и ключи нигде: ни в issue,
  ни в логах, ни в диффах. При случайной утечке — немедленно сообщите мейнтейнеру
  и ротация секрета обязательна.

## Стиль кода

- TypeScript строго (`npm run typecheck` обязан проходить).
- Форматирование — Prettier (singleQuote, semi, tabWidth 2, trailingComma es5);
  импорты и качество — ESLint. Запускать локально: `npm run lint:fix && npm run format`.
- Серверный код — CommonJS (`.cjs`) в `server/`; клиентский — ESM/TS в `src/`.
- Названия: коммиты — Conventional Commits (`feat:`/`fix:`/`docs:`/`chore:`),
  ветки — `feat/<slug>`, таблицы БД — только через миграции (никогда руками).
- UI: доступность обязательна (aria-роли, клавиатура, alt у изображений,
  тач-цели ≥ 44px, контраст ≥ 4.5:1).

## Процесс ревью

1. Откройте PR в `main`; заполните шаблон `.github/pull_request_template.md`.
2. CI должен быть зелёным (typecheck, lint, unit, integration, build).
3. Минимум один approve; правки по комментариям — отдельными коммитами,
   squash при мерже.
4. Ревьюер проверяет тесты, схему БД/API, безопасность (нет секретов,
   параметризованные SQL) и доступность.

## Процесс мержа

- Squash-and-merge с заголовком PR; ветка удаляется после мержа.
- Прямые пуши в `main` запрещены защитой ветки.

## Процесс релиза

1. Релиз = тег `vMAJOR.MINOR.PATCH` на HEAD `main` (semver).
2. Перед тегом — деплой на staging и зелёный e2e-прогон
   (`PLAYWRIGHT_BASE_URL=… npm run test:e2e`).
3. GitHub Release с changelog по заголовкам коммитов; миграции применяются
   автоматически скриптом деплоя (`npm run migrate`).
4. Откат релиза — revert-PR + повторный деплой (миграции имеют down-скрипты).

## Как начать

```bash
git clone … && cd UytArt && npm install
npm run migrate && npm run seed   # или без DATABASE_URL — файловый режим
npm run dev                       # фронт :5173, API: node server/index.cjs
npm run test                      # убедитесь, что всё зелёно до правок
```

Ищите задачи с лейблом `good first issue` в GitHub Issues.
