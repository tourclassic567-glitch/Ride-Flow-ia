-- 001_initial.sql – Ride-Flow IA AI Agents initial schema
-- Run: psql $DATABASE_URL -f migrations/001_initial.sql

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    uuid        UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    role        VARCHAR(20)  NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'driver', 'admin')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Drivers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
    id              SERIAL PRIMARY KEY,
    user_id         INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_available    BOOLEAN      NOT NULL DEFAULT FALSE,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    eta_minutes     INT          DEFAULT 5,
    rating          NUMERIC(3,2) DEFAULT 5.00,
    total_rides     INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Rides ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
    id                  SERIAL PRIMARY KEY,
    passenger_id        INT          NOT NULL REFERENCES users(id),
    driver_id           INT          REFERENCES drivers(id),
    pickup_location     TEXT         NOT NULL,
    dropoff_location    TEXT         NOT NULL,
    ride_type           VARCHAR(20)  NOT NULL DEFAULT 'standard',
    status              VARCHAR(30)  NOT NULL DEFAULT 'requested'
                            CHECK (status IN ('requested','matched','in_progress','completed','cancelled')),
    estimated_price     NUMERIC(10,2),
    actual_price        NUMERIC(10,2),
    surge_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    distance_miles      NUMERIC(8,2),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id                  SERIAL PRIMARY KEY,
    ride_id             INT          NOT NULL REFERENCES rides(id),
    stripe_intent_id    VARCHAR(255),
    amount_usd          NUMERIC(10,2) NOT NULL,
    currency            VARCHAR(10)   NOT NULL DEFAULT 'usd',
    status              VARCHAR(30)   NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','succeeded','failed','refunded')),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Agent events log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_events (
    id          BIGSERIAL    PRIMARY KEY,
    agent_name  VARCHAR(50)  NOT NULL,
    event_type  VARCHAR(50)  NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rides_status       ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger    ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver       ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at   ON rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_available  ON drivers(is_available) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_payments_ride      ON payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON agent_events(agent_name, created_at DESC);

-- ── Update trigger ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_drivers_updated_at') THEN
        CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rides_updated_at') THEN
        CREATE TRIGGER trg_rides_updated_at   BEFORE UPDATE ON rides   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_updated_at') THEN
        CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;
