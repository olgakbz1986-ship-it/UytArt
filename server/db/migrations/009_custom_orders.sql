-- 009: индивидуальные заказы (биржа) (ЗАДАЧА 1, п.8)
CREATE TABLE IF NOT EXISTS custom_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category    VARCHAR(100) NOT NULL,
  budget_min  DECIMAL(10, 2),
  budget_max  DECIMAL(10, 2),
  budget_type VARCHAR(20) DEFAULT 'negotiable',
  deadline    DATE,
  region      VARCHAR(100),
  status      VARCHAR(20) DEFAULT 'published',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS custom_orders_user_id_idx ON custom_orders (user_id);
