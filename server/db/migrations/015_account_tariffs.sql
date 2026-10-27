-- 015: карта тарифов аккаунта (server/tariffs.cjs в postgres-режиме)
CREATE TABLE IF NOT EXISTS account_tariffs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_type text,
  seller_plan_id text,
  buyer_plan_id text,
  commission_rate numeric(6,4),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_tariffs_seller_plan_idx ON account_tariffs (seller_plan_id);
