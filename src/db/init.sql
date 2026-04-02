CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(100),
  age INTEGER,
  city VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  service_key VARCHAR(50),
  service_title VARCHAR(255),
  branch VARCHAR(50),
  photo_received BOOLEAN DEFAULT FALSE,
  photo_url TEXT,
  photo_media_id TEXT,
  preferred_date DATE,
  preferred_time VARCHAR(10),
  appointment_datetime TIMESTAMP,
  status VARCHAR(50) DEFAULT 'new',
  specialist VARCHAR(100),
  admin_comment TEXT,
  calendar_event_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(30) UNIQUE NOT NULL,
  step VARCHAR(50) NOT NULL,
  payload_json TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);