-- 011: сообщения в заказах (ЗАДАЧА 1, п.10)
CREATE TABLE IF NOT EXISTS order_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID REFERENCES custom_orders(id) ON DELETE CASCADE,
  sender_id      UUID NOT NULL,
  message        TEXT NOT NULL,
  attachment_url VARCHAR(500),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS order_messages_order_id_idx ON order_messages (order_id);
