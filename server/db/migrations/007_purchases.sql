-- 007: покупки (ЗАДАЧА 1, п.6)
CREATE TABLE IF NOT EXISTS purchases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  seller_id    UUID REFERENCES sellers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL UNIQUE,
  amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'paid',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON purchases (user_id);
