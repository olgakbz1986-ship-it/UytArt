-- 006: уведомления (ЗАДАЧА 1, п.5)
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL DEFAULT '',
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at);
