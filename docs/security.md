# Политика безопасности UytArt

## Аутентификация: JWT, двухтокенная схема

- **Access-токен** — JWT (HS256, `JWT_SECRET`), TTL 15 минут
  (`ACCESS_TOKEN_TTL_SEC=900`). Хранится только в памяти клиента
  (никогда не в localStorage). Передаётся как `Authorization: Bearer …`.
- **Refresh-токен** — JWT с типом `refresh`, TTL 7 дней
  (`REFRESH_TOKEN_TTL_SEC=604800`). Хранится в **HttpOnly + Secure +
  SameSite=Lax cookie**, недоступен JS. Обновление пары — `POST /api/auth/refresh`.
- При logout/смене пароля refresh отзывается: `jti` записывается в таблицу
  `revoked_tokens(jti PK, user_id, expires_at)`; сервер проверяет каждый токен
  по этой таблице. Периодическая чистка по индексу `expires_at`.
- Пароли — bcrypt (`bcryptjs`), стоимость ≥ 10. Одинаковый ответ 401 при
  неверном email и пароле (без утечки существования аккаунта).

## Хранение секретов

- Секреты только в переменных окружения (`.env.server`, не коммитится —
  проверено `.gitignore`); шаблон — `.env.example`.
- `SUPABASE_SERVICE_ROLE_KEY`, `YOOKASSA_SECRET_KEY`, `SMTP_PASS`, `JWT_SECRET`
  никогда не отдаются клиенту и не попадают в логи.
- В production отсутствие `JWT_SECRET` — фатальная ошибка старта.

## CORS

- Строгий белый список origin (`ALLOWED_ORIGINS`), без `*` в продакшене.
- `credentials: true` только для доверенных origin; методы и заголовки ограничены
  фактически используемыми.

## Rate limiting

- `express-rate-limit`: общий лимит на IP для `/api/*`, ужесточённые лимиты для
  `/api/auth/login|register` (защита от брутфорса) и POST-эндпоинтов.
- Ответ 429 с заголовком `Retry-After`.
- Отдельный rate-limit для AI-эндпоинтов (`AI_DESIGNER_RATE_MAX` запросов/мин
  на пользователя).

## Защита от CSRF

- API работает через `Authorization: Bearer` (не cookie-автосending для access),
  поэтому CSRF-поверхность минимальна.
- Refresh-cookie — `SameSite=Lax`; эндпоинт `/api/auth/refresh` принимает только
  POST и дополнительно сверяет заголовок `X-Requested-With`/origin.
- `helmet` включает CSP/HSTS/X-Frame-Options=nosniff заголовки.

## Обработка персональных данных

- Минимизация: храним email, имя, телефон, город, адрес(а) доставки.
- Согласия на обработку ПД (152-ФЗ) фиксируются в таблице
  `consents(user_id, document, version, timestamp, source)`.
- Подтверждение email (`email_confirmed`, `confirm_token` с TTL).
- Право на удаление: DELETE-запрос пользователя → анонимизация/удаление строк
  `users` (каскадно удаляются подписки, уведомления, заказы).
- Логи не содержат паролей, токенов и полных PII (красные поля вырезаются logger).

## Ротация секретов

- `JWT_SECRET` ротируется по графику (рекомендуется ≤ 90 дней) и немедленно при
  компрометации: новый секрет инвалидирует все токены; пользователи перелогинятся
  по refresh-ку. Для zero-downtime поддерживается список `JWT_SECRET_PREVIOUS`
  (verify по очереди, подпись всегда новым).
- Ключи YooKassa и SMTP-пароли меняются в соответствующих кабинетах; значения
  обновляются в env и сервис перезапускается.
- Все секреты хранятся в менеджере секретов хостинга/CI (GitHub Actions
  Secrets), доступ к журналу ротации ограничен.
