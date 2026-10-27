# Деплой UytArt

## Требования к серверу

- Linux (Ubuntu 22.04+), 2 CPU / 2 GB RAM минимум (dev-проект — 1 GB достаточно).
- Node.js **20 LTS**+, npm 10+, PostgreSQL **15**+, Nginx, Docker (опционально).
- Открытые порты: 80/443 (Nginx), 8787 (внутренний API).

## Переменные окружения

Полный список — `.env.example`; на сервере создаётся `/etc/uyart/.env.server`
(права 600, владелец — сервисный пользователь):

```
NODE_ENV=production
PORT=8787
DATABASE_URL=postgres://uyart:STRONGPASS@localhost:5432/uyart
JWT_SECRET=<openssl rand -hex 32>
ACCESS_TOKEN_TTL_SEC=900
REFRESH_TOKEN_TTL_SEC=604800
ALLOWED_ORIGINS=https://uyart.ru
SMTP_HOST=smtp.yandex.ru SMTP_PORT=465 SMTP_USER=… SMTP_PASS=… MAIL_FROM=…
YOOKASSA_SHOP_ID=… YOOKASSA_SECRET_KEY=… YOOKASSA_WEBHOOK_SECRET=…
PUSH_VAPID_PUBLIC=… PUSH_VAPID_PRIVATE=…   # web-push keys
API_URL=https://api.uyart.ru
```

## Установка и запуск

```bash
git clone https://github.com/olgakbz1986-ship-it/UytArt.git && cd UytArt
npm ci --omit=dev               # прод-зависимости
npm run build                   # Vite-сборка фронтенда в dist/
npm run migrate                 # схема БД
npm run seed                    # ТОЛЬКО на staging!
node server/index.cjs           # или systemd-юнит / docker compose up -d
```

Продакшн через systemd (`uyart.service`): `ExecStart=/usr/bin/node server/index.cjs`,
`EnvironmentFile=/etc/uyart/.env.server`, `Restart=always`.

Через Docker: `docker compose up -d --build` (см. корневой `Dockerfile`,
`Dockerfile.frontend`, `docker-compose.yml`).

## Настройка PostgreSQL

```bash
sudo -u postgres createuser uyart && sudo -u postgres createdb -O uyart uyart
sudo -u postgres psql -c "ALTER USER uyart PASSWORD 'STRONGPASS';"
# pg_hba.conf: scram-sha-256 для локальных подключений
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"  # делает миграция 001
npm run migrate
```
Ежедневный дамп: `pg_dump uyart | gzip > /backups/uyart-$(date +%F).sql.gz`.

## Настройка SMTP

- Завести ящик no-reply у провайдера (Yandex/Mail/SES), включить пароль
  приложения, указать SMTP_* в env.
- Проверка: `node -e "require('nodemailer').createTransport({...}).verify()"`.
- SPF/DKIM/DMARC для домена отправителя — обязательны, иначе письма в спам.

## Настройка YooKassa

1. Кабинет ЮKassa → магазин → получить Shop ID и секретный ключ (test/prod).
2. Записать `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`.
3. Webhook `https://api.uyart.ru/api/payments/webhook` + общий секрет HMAC
   `YOOKASSA_WEBHOOK_SECRET` (сервер проверяет подпись каждого события).
4. Прогон сценария оплаты на test-режиме перед включением prod-ключей.

## Домен и SSL

- DNS: `A uyart.ru → IP`, `CNAME api.uyart.ru → IP`.
- `sudo certbot --nginx -d uyart.ru -d api.uyart.ru` (авто-renew встроен).
- В Nginx: `proxy_pass http://127.0.0.1:8787` для `/api/`, статика SPA из
  `dist/` с `try_files $uri /index.html`.

## Мониторинг и логирование

- Логи приложения — pino (JSON) → stdout/journald; ротация logrotate.
- Healthcheck: `GET /api/health` (uptime, ping БД) — внешний мониторинг
  (UptimeRobot/BetterStack) каждые 60 с.
- Метрики PostgreSQL (`pg_stat_statements`), место на диске, очереди фоновых
  обработчиков (размер unread `notifications`) — алерты при аномалиях.
- Оповещения об ошибках 5xx — в Telegram-канал дежурного.
