# Схема базы данных UytArt (PostgreSQL)

Все таблицы создаются миграциями в `server/db/migrations/` (порядок применения —
по возрастанию имени файла). Учёт применённых миграций ведёт таблица
`schema_migrations`.

## Таблицы

### users
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | gen_random_uuid() |
| email | text UNIQUE NOT NULL | |
| password_hash | text NOT NULL | bcrypt |
| name | text | |
| phone | text | |
| role | text | buyer / seller / admin |
| legal_type | text | fiz / ip / oo |
| tier | text | тарифный план |
| avatar_url | text | |
| email_confirmed | boolean | по умолчанию false |
| confirm_token | text | токен подтверждения email |
| confirm_expires | timestamptz | |
| city | text | гео-привязка покупателя |
| created_at / updated_at | timestamptz | |

Индексы: уникальный по `email`; `users_email_lower_idx ON users (lower(email))`.

### sellers
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| user_id | uuid FK → users ON DELETE CASCADE | |
| type | text | shop / master / author |
| name | text NOT NULL | |
| slug | text UNIQUE NOT NULL | |
| description | text | |
| avatar_url | text | |
| city | text | |
| geography | jsonb | |
| is_active | boolean | |
| created_at / updated_at | timestamptz | |

Индексы: `sellers_user_id_idx`, `sellers_slug_idx`.

### products
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| seller_id | uuid FK → sellers ON DELETE CASCADE | |
| name | text NOT NULL | |
| description | text | |
| price | numeric(12,2) | |
| "group" | text | группа товара |
| category | text | |
| geography | jsonb | |
| status | text | draft / active / archived |
| media | jsonb | массив медиа |
| city | text | денормализация для гео-индекса |
| created_at / updated_at | timestamptz | |

Индексы: по `seller_id`, `created_at`, `status`, `"group"`, `city`.

### subscriptions
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| target_type | text | shop / master / author |
| target_id | uuid | id продавца |
| last_seen_at | timestamptz NULL | точка «прочитано» новинок |
| created_at / updated_at | timestamptz | |

Индексы: **уникальный** `(user_id, target_type, target_id)`; по `user_id`; по `target_id`.

### notifications
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| type | text | alert / info / … |
| title | text | |
| text | text | |
| link | text | |
| read | boolean | по умолчанию false |
| created_at | timestamptz | |

Индексы: по `user_id`, по `created_at`.

### purchases
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| user_id | uuid FK → users | |
| product_id | uuid FK → products | |
| seller_id | uuid FK → sellers | |
| order_number | text | |
| amount | numeric(12,2) | |
| status | text | pending / paid / refunded |
| purchased_at / updated_at | timestamptz | |

Индекс: по `user_id`.

### market_reviews
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| order_id | uuid FK → purchases | |
| reviewer_id | uuid FK → users | |
| reviewee_id | uuid FK → users | |
| product_id | uuid FK → products | |
| rating | int | CHECK 1..5 |
| text | text | |
| created_at | timestamptz | |

Индексы: **уникальный** `(reviewer_id, order_id)`; по `reviewee_id`; по `product_id`.

### custom_orders
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| title / description | text | |
| category | text | |
| budget_min / budget_max | numeric | |
| budget_type | text | fixed / range / offer |
| deadline | date | |
| region | text | |
| status | text | open / in_progress / done / cancelled |
| attachments | jsonb | |
| created_at / updated_at | timestamptz | |

Индекс: по `user_id`.

### order_responses
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| order_id | uuid FK → custom_orders **ON DELETE CASCADE** | |
| master_id | uuid FK → users | |
| price | numeric | |
| deadline_days | int | |
| comment | text | |
| status | text | pending / accepted / rejected |
| created_at | timestamptz | |

Индекс: по `order_id`.

### order_messages
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| order_id | uuid FK → custom_orders **ON DELETE CASCADE** | |
| sender_id | uuid FK → users | |
| message | text | |
| attachment_url | text | |
| created_at | timestamptz | |

Индекс: по `order_id`.

### revoked_tokens
| Поле | Тип | Примечание |
|------|-----|-----------|
| jti | text **PRIMARY KEY** | id отозванного JWT |
| user_id | uuid | |
| expires_at | timestamptz | срок жизни токена |
| created_at | timestamptz | |

Индекс: по `expires_at` (для чистки протухших записей).

### consents
| Поле | Тип | Примечание |
|------|-----|-----------|
| id | uuid PK | |
| user_id | uuid FK → users | |
| document | text | название согласия (152-ФЗ и т.п.) |
| version | text | версия документа |
| timestamp | timestamptz | момент принятия |
| source | text | ip/устройство/канал |

Индекс: по `user_id`.

### notification_preferences
Настройки каналов уведомлений пользователя (email/push включены/выключены),
используются фоновыми обработчиками (миграция 014).

## Связи (FK)

```
users 1─┬─* sellers ─* products ─* purchases *─ sellers
        ├─* subscriptions            *─ market_reviews ─* purchases
        ├─* notifications            *─ custom_orders ─┬─* order_responses
        ├─* purchases                └──────────────────┴─* order_messages
        ├─* consents
        └─* revoked_tokens (user_id, без жёсткого FK-ограничения на удаление)
```

## Миграции

Файлы: `NNN_name.sql` (up) и `NNN_name.down.sql` (down), применяются строго по порядку имён.

```bash
# Применение всех миграций (читает DATABASE_URL из env или .env/.env.server)
npm run migrate

# Откат последней применённой миграции
npm run migrate:down
# Откат всех миграций начиная с версии 012
npm run migrate:down -- 012
# Полный откат
npm run migrate:down -- all

# Сидирование тестовых данных (идемпотентно)
npm run seed
```

Каждая up/down-миграция выполняется в отдельной транзакции; уже применённые
миграции пропускаются по таблице `schema_migrations`.
