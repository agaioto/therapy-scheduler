-- therapy-scheduler schema

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  referred_by TEXT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  therapy TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(patient_id) REFERENCES patients(id),
  FOREIGN KEY(room_id) REFERENCES rooms(id)
);
