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
