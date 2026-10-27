-- 008: отзывы на маркетплейсе (ЗАДАЧА 1, п.7)
CREATE TABLE IF NOT EXISTS market_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Один отзыв на одного покупателя/заказ: уникальность reviewer_id + order_id
CREATE UNIQUE INDEX IF NOT EXISTS market_reviews_reviewer_order_ux
  ON market_reviews (reviewer_id, order_id);
CREATE INDEX IF NOT EXISTS market_reviews_reviewee_id_idx ON market_reviews (reviewee_id);
CREATE INDEX IF NOT EXISTS market_reviews_product_id_idx  ON market_reviews (product_id);
