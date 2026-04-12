-- Migration: 002_agent_tables.sql
-- Tables required by the autonomous AI agent system

CREATE TABLE IF NOT EXISTS agent_logs (
  id          SERIAL PRIMARY KEY,
  agent_name  VARCHAR(50)  NOT NULL,
  event_type  VARCHAR(50)  NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name ON agent_logs (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs (created_at);

CREATE TABLE IF NOT EXISTS demand_metrics (
  id               SERIAL PRIMARY KEY,
  online_drivers   INT     NOT NULL DEFAULT 0,
  pending_rides    INT     NOT NULL DEFAULT 0,
  surge_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (surge_multiplier >= 1.00),
  recorded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demand_metrics_recorded_at ON demand_metrics (recorded_at);
