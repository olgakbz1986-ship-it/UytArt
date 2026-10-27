-- 002: пользователи (ЗАДАЧА 1, п.1)
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'buyer',
  legal_type      TEXT NOT NULL DEFAULT 'self_employed',
  tier            TEXT NOT NULL DEFAULT 'free',
  avatar_url      TEXT,
  email_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirm_token   TEXT,
  confirm_expires TIMESTAMPTZ,
  city            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индекс по email в нижнем регистре (уникальность email обеспечивается ограничением UNIQUE)
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
