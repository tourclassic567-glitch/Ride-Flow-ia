CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver')),
  rating DECIMAL(3,2) DEFAULT 5.00,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'on_ride')),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rides (
  id SERIAL PRIMARY KEY,
  passenger_id INT REFERENCES users(id),
  driver_id INT REFERENCES drivers(id),
  status VARCHAR(20) DEFAULT 'requested' CHECK (status IN ('requested', 'matched', 'in_progress', 'completed', 'cancelled')),
  pickup_location VARCHAR(255) NOT NULL,
  dropoff_location VARCHAR(255) NOT NULL,
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  ride_id INT REFERENCES rides(id),
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent system tables
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
