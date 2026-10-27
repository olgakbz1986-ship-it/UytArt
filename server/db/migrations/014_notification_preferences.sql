-- 014: настройки уведомлений пользователей (ЗАДАЧА 2, п.14)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email      BOOLEAN NOT NULL DEFAULT true,
  push       BOOLEAN NOT NULL DEFAULT true,
  in_app     BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
