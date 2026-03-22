-- Database Schema for Ride Flow

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    ride_id INT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'completed')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Remove real-time ride matching logic
-- Add necessary constraints and foreign keys if required

-- other existing tables and their schema...
