-- 005: подписки (ЗАДАЧА 1, п.4)
CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,           -- 'seller' | 'product'
  target_id   UUID NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Уникальный индекс по комбинации user_id + target_type + target_id
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_target_ux
  ON subscriptions (user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx   ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_target_id_idx ON subscriptions (target_id);
