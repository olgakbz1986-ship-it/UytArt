-- 003: продавцы (ЗАДАЧА 1, п.2)
CREATE TABLE IF NOT EXISTS sellers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'self_employed',
  name        TEXT NOT NULL DEFAULT '',
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  city        TEXT,
  geography   JSONB,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sellers_user_id_idx ON sellers (user_id);
CREATE INDEX IF NOT EXISTS sellers_slug_idx    ON sellers (slug);
