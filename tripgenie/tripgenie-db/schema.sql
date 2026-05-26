-- ============================================================
--  TripGenie PostgreSQL Schema
--  Run this once to set up the full database.
--  psql -U <user> -d <dbname> -f schema.sql
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

-- ============================================================
--  1. USERS & AUTH
-- ============================================================

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT      NOT NULL UNIQUE,
  password_hash TEXT,                          -- NULL for OAuth-only accounts
  full_name     TEXT        NOT NULL,
  avatar_initials TEXT      GENERATED ALWAYS AS (
                  upper(left(full_name, 1))
                ) STORED,
  provider      TEXT        NOT NULL DEFAULT 'local', -- 'local' | 'google'
  provider_id   TEXT,                          -- OAuth provider user ID
  is_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,   -- hashed session/JWT refresh token
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_resets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  2. TRIPS
-- ============================================================

CREATE TABLE trips (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  destination   TEXT        NOT NULL,
  cover_image   TEXT,                          -- URL (Unsplash, upload, etc.)
  start_date    DATE,
  end_date      DATE,
  status        TEXT        NOT NULL DEFAULT 'upcoming'
                            CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  planning_pct  SMALLINT    NOT NULL DEFAULT 0
                            CHECK (planning_pct BETWEEN 0 AND 100),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE trip_interests (
  id       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id  UUID  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  interest TEXT  NOT NULL                      -- e.g. 'Culture', 'Food', 'Adventure'
);

-- ============================================================
--  3. BUDGET & EXPENSES
-- ============================================================

CREATE TABLE budgets (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID    NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budget_categories (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID    NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,                -- 'Flights', 'Hotels', 'Food', etc.
  color       CHAR(7) NOT NULL DEFAULT '#068cdf', -- hex color for UI dot
  allocated   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID    NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  trip_id     UUID    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description TEXT    NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  spent_on    DATE    NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convenience view: spending per category
CREATE VIEW category_spending AS
SELECT
  bc.id            AS category_id,
  bc.budget_id,
  bc.name,
  bc.color,
  bc.allocated,
  COALESCE(SUM(e.amount), 0)               AS spent,
  bc.allocated - COALESCE(SUM(e.amount),0) AS remaining,
  CASE WHEN bc.allocated > 0
       THEN ROUND(COALESCE(SUM(e.amount),0) / bc.allocated * 100)
       ELSE 0 END                           AS pct_used
FROM budget_categories bc
LEFT JOIN expenses e ON e.category_id = bc.id
GROUP BY bc.id;

-- ============================================================
--  4. CHECKLISTS & REMINDERS
-- ============================================================

CREATE TABLE checklists (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title       TEXT  NOT NULL,
  icon        TEXT  NOT NULL DEFAULT '📋',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID    NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  label        TEXT    NOT NULL,
  is_checked   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reminders (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID    REFERENCES trips(id) ON DELETE CASCADE, -- optional link
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT,
  remind_at   TIMESTAMPTZ NOT NULL,
  priority    TEXT    NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high')),
  category    TEXT,                            -- 'Preparation', 'Booking', etc.
  is_done     BOOLEAN NOT NULL DEFAULT FALSE,
  done_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  INDEXES
-- ============================================================

CREATE INDEX idx_sessions_user      ON sessions(user_id);
CREATE INDEX idx_sessions_token     ON sessions(token_hash);
CREATE INDEX idx_trips_user         ON trips(user_id);
CREATE INDEX idx_trips_status       ON trips(status);
CREATE INDEX idx_expenses_trip      ON expenses(trip_id);
CREATE INDEX idx_expenses_category  ON expenses(category_id);
CREATE INDEX idx_checklist_trip     ON checklists(trip_id);
CREATE INDEX idx_items_checklist    ON checklist_items(checklist_id);
CREATE INDEX idx_reminders_user     ON reminders(user_id);
CREATE INDEX idx_reminders_remind   ON reminders(remind_at);

-- ============================================================
--  AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','trips','budgets','expenses','checklist_items','reminders']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END;
$$;
