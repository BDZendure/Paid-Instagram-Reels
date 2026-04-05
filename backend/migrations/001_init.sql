CREATE TABLE IF NOT EXISTS wallets (
  id            UUID        PRIMARY KEY,
  balance_cents INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deductions (
  id         SERIAL      PRIMARY KEY,
  uuid       UUID        NOT NULL REFERENCES wallets(id),
  slug       TEXT        NOT NULL,
  charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(uuid, slug)
);
