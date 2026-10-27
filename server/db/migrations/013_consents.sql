-- 013: согласия пользователей (ЗАДАЧА 1, п.12)
CREATE TABLE IF NOT EXISTS consents (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document  TEXT NOT NULL,           -- 'privacy' | 'terms' | 'offer' | ...
  version   TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  source    TEXT                     -- откуда принято согласие (web/app/api)
);

CREATE INDEX IF NOT EXISTS consents_user_id_idx ON consents (user_id);
