-- Схема для Yandex Managed PostgreSQL (применим один раз при переезде)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null default '',
  phone text not null default '',
  role text not null default 'buyer',
  legal_type text not null default 'self_employed',
  tier text not null default 'free',
  avatar_url text,
  email_confirmed boolean not null default false,
  confirm_token text,
  confirm_expires timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists users_email_idx on users (lower(email));

-- ==========================================
-- БИРЖА ИНДИВИДУАЛЬНЫХ ЗАКАЗОВ (Phase 1)
-- ==========================================
CREATE TABLE IF NOT EXISTS custom_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    budget_type VARCHAR(20) DEFAULT 'negotiable',
    deadline DATE,
    region VARCHAR(100),
    status VARCHAR(20) DEFAULT 'published',
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES custom_orders(id) ON DELETE CASCADE,
    master_id UUID NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    deadline_days INTEGER NOT NULL,
    comment TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES custom_orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    message TEXT NOT NULL,
    attachment_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
