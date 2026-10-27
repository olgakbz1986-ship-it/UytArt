-- 010: отклики на индивидуальные заказы (ЗАДАЧА 1, п.9)
CREATE TABLE IF NOT EXISTS order_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES custom_orders(id) ON DELETE CASCADE,
  master_id     UUID NOT NULL,
  price         DECIMAL(10, 2) NOT NULL,
  deadline_days INTEGER NOT NULL,
  comment       TEXT,
  status        VARCHAR(20) DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS order_responses_order_id_idx ON order_responses (order_id);
