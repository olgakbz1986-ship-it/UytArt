# Устранение частых проблем

## Подключение к базе данных

**`ECONNREFUSED` при `npm run migrate`**
- Проверьте, что PostgreSQL запущен: `sudo systemctl status postgresql`.
- Проверьте строку подключения:
  `psql "postgres://user:pass@localhost:5432/dbname" -c "select 1"`.
- Убедитесь, что `DATABASE_URL` задан в env или в `.env`/`.env.server`
  (скрипты миграций читают оба файла).

**`role ... does not exist` / `database ... does not exist`**
```bash
sudo -u postgres createuser uyart
sudo -u postgres createdb -O uyart uyart
```

**`permission for language plpgsql` / ошибка pgcrypto**
- Пользователь БД должен владеть базой или иметь `CREATE EXTENSION` права;
  расширение pgcrypto создаёт миграция 001 — при проблемах создайте вручную
  суперюзером: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.

**Миграции «уже применены», но таблиц нет**
- Кто-то удалил таблицы руками. Полный сброс: `npm run migrate:down -- all`
  (или `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) затем `npm run migrate`.

## Авторизация

**Везде 401 после апдейта кода**
- Прострочен access-токен — клиент должен вызвать `/api/auth/refresh`; если и он
  401 — залогиньтесь заново.
- Сменился `JWT_SECRET` — все прежние токены невалидны, это ожидаемо.

**Logout не «убивает» refresh-ку**
- Проверьте, что таблица `revoked_tokens` существует (миграция 012) и запись с
  `jti` появляется при logout.

**CORS блокирует запрос с localhost:5173**
- Добавьте origin в `ALLOWED_ORIGINS` сервера (см. ниже).

## CORS

**`No 'Access-Control-Allow-Origin' header`**
- Сервер: `ALLOWED_ORIGINS=http://localhost:5173,https://uyart.ru`.
- Запросы должны идти с `credentials: 'include'`, если используется refresh-cookie.
- Проверьте, что Nginx не перекрывает заголовки `proxy_hide_header`.

## Уведомления

**Письма не отправляются**
- Фоновый email-воркер запускается только при заданных `SMTP_HOST/USER/PASS`;
  без них уведомления остаются в таблице и видны в колоколе.
- Проверка транспорта: `node -e "..."` c `nodemailer.createTransport().verify()`.
- Папка «Спам» — настройте SPF/DKIM (docs/deployment.md → SMTP).

**Push не приходят**
- Нужны VAPID-ключи (`PUSH_VAPID_PUBLIC/PRIVATE`) и подписка Service Worker
  в браузере; проверьте `navigator.serviceWorker.ready` и permission = granted.

**Десять уведомлений об одном продавце**
- Это защита от спама: воркер группирует уведомления одного продавца за окно
  времени в одно письмо. Если группировки нет — обновите код воркера и
  убедитесь, что `notifications.type='alert'`.

## Тесты

**Vitest: `Cannot find module '../server/repo.cjs'`**
- Импорты `.cjs` из ESM-тестов требуют явного расширения и настроенного
  alias в `vitest.config.ts`; перезапустите с чистым кэшем: `vitest --clear-cache`.

**Интеграционные тесты падают на чистой машине**
- Сначала `npm run migrate && npm run seed` (или оставьте DATABASE_URL пустым —
  тесты пойдут в файловом режиме с временным каталогом).

**Playwright: `browserType.launch: Executable doesn't exist`**
```bash
npx playwright install --with-deps chromium
```

**Husky pre-commit не даёт коммитить из-за lint-ошибок**
- Исправьте: `npm run lint:fix && npm run format`; экстренный обход —
  `git commit --no-verify` (не для main).
