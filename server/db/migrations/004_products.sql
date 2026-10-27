-- 004: товары (ЗАДАЧА 1, п.3)
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "group"     TEXT,
  category    TEXT,
  geography   JSONB,
  status      TEXT NOT NULL DEFAULT 'active',
  media       JSONB NOT NULL DEFAULT '[]'::jsonb,
  city        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_seller_id_idx  ON products (seller_id);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON products (created_at);
CREATE INDEX IF NOT EXISTS products_status_idx     ON products (status);
CREATE INDEX IF NOT EXISTS products_group_idx      ON products ("group");
CREATE INDEX IF NOT EXISTS products_city_idx       ON products (city);
