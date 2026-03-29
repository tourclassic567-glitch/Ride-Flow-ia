-- Database Schema for Ride Flow

CREATE TABLE IF NOT EXISTS rides (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  pickup TEXT NOT NULL,
  destination TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
