-- Migration: 003_security_tables.sql
-- Tables required by the SecurityAgent and API key system

CREATE TABLE IF NOT EXISTS blocked_ips (
  id         SERIAL PRIMARY KEY,
  ip         VARCHAR(45)  NOT NULL UNIQUE,
  reason     TEXT,
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip         ON blocked_ips (ip);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at ON blocked_ips (expires_at);

CREATE TABLE IF NOT EXISTS security_events (
  id         SERIAL PRIMARY KEY,
  event_type VARCHAR(50)  NOT NULL,
  ip         VARCHAR(45),
  user_id    INT,
  payload    JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_ip         ON security_events (ip);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id         SERIAL PRIMARY KEY,
  key_hash   VARCHAR(128) NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
