-- ============================================================
--  IBA FACILITY BOOKING SYSTEM — Supabase SQL Schema
--  Run this entire file in: Supabase → SQL Editor → New Query
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('student', 'programoffice', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE room_type      AS ENUM ('Classroom', 'Seminar Hall', 'Computer Lab', 'Meeting Room');

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp         VARCHAR(50)  UNIQUE NOT NULL,   -- ERP ID for students, username for others
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,           -- bcrypt hashed
  role        user_role    NOT NULL DEFAULT 'student',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── BUILDINGS ────────────────────────────────────────────────
CREATE TABLE buildings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  location    VARCHAR(200),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── ROOMS ────────────────────────────────────────────────────
CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  UUID        NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  capacity     INTEGER      NOT NULL CHECK (capacity > 0),
  type         room_type    NOT NULL DEFAULT 'Classroom',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── TIME SLOTS (static reference table) ─────────────────────
CREATE TABLE time_slots (
  id         INTEGER PRIMARY KEY,
  start_time VARCHAR(5) NOT NULL,   -- e.g. "08:30"
  end_time   VARCHAR(5) NOT NULL,   -- e.g. "09:45"
  label      VARCHAR(30) NOT NULL   -- e.g. "8:30 – 9:45"
);

INSERT INTO time_slots (id, start_time, end_time, label) VALUES
  (1, '08:30', '09:45',  '8:30 – 9:45'),
  (2, '10:00', '11:15',  '10:00 – 11:15'),
  (3, '11:30', '12:45',  '11:30 – 12:45'),
  (4, '13:00', '14:15',  '1:00 – 2:15'),
  (5, '14:30', '15:45',  '2:30 – 3:45'),
  (6, '16:00', '17:15',  '4:00 – 5:15'),
  (7, '17:30', '18:45',  '5:30 – 6:45');

-- ── BOOKINGS ─────────────────────────────────────────────────
CREATE TABLE bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  room_id      UUID         NOT NULL REFERENCES rooms(id)      ON DELETE CASCADE,
  slot_id      INTEGER      NOT NULL REFERENCES time_slots(id),
  date         DATE         NOT NULL,
  purpose      TEXT         NOT NULL,
  status       booking_status NOT NULL DEFAULT 'pending',
  reviewed_by  UUID         REFERENCES users(id),              -- PO or admin who actioned it
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Prevent double-booking same room+date+slot
  UNIQUE (room_id, date, slot_id)
);

-- ── BLOCKED SLOTS ────────────────────────────────────────────
CREATE TABLE blocked_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slot_id     INTEGER      NOT NULL REFERENCES time_slots(id),
  date        DATE         NOT NULL,
  reason      VARCHAR(200),
  blocked_by  UUID         NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (room_id, date, slot_id)
);

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_bookings_user_id  ON bookings(user_id);
CREATE INDEX idx_bookings_room_id  ON bookings(room_id);
CREATE INDEX idx_bookings_date     ON bookings(date);
CREATE INDEX idx_bookings_status   ON bookings(status);
CREATE INDEX idx_blocked_room_date ON blocked_slots(room_id, date);
CREATE INDEX idx_rooms_building    ON rooms(building_id);

-- ── SEED DATA ────────────────────────────────────────────────
-- Admin user (password: admin123)
INSERT INTO users (erp, name, email, password, role) VALUES
  ('admin', 'System Admin', 'admin@iba.edu.pk',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Program Office (password: password)
INSERT INTO users (erp, name, email, password, role) VALUES
  ('po001', 'Dr. Fatima Zahra', 'fatima@iba.edu.pk',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'programoffice');

-- Students (password: password)
INSERT INTO users (erp, name, email, password, role) VALUES
  ('12345', 'Ali Hassan', 'ali@iba.edu.pk',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student'),
  ('22222', 'Sara Khan', 'sara@iba.edu.pk',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student');

-- Buildings
INSERT INTO buildings (id, name, location) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Main Academic Block', 'North Campus'),
  ('22222222-2222-2222-2222-222222222222', 'Business School',     'East Wing'),
  ('33333333-3333-3333-3333-333333333333', 'Technology Block',    'West Campus');

-- Rooms
INSERT INTO rooms (building_id, name, capacity, type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Room 101',          40, 'Classroom'),
  ('11111111-1111-1111-1111-111111111111', 'Room 102',          35, 'Classroom'),
  ('11111111-1111-1111-1111-111111111111', 'Seminar Hall A',    80, 'Seminar Hall'),
  ('11111111-1111-1111-1111-111111111111', 'Computer Lab 1',    30, 'Computer Lab'),
  ('22222222-2222-2222-2222-222222222222', 'BS Conference Room',20, 'Meeting Room'),
  ('22222222-2222-2222-2222-222222222222', 'Lecture Hall B1',   60, 'Classroom'),
  ('33333333-3333-3333-3333-333333333333', 'Tech Lab 01',       25, 'Computer Lab'),
  ('33333333-3333-3333-3333-333333333333', 'Innovation Hub',    15, 'Meeting Room');

-- ── ROW LEVEL SECURITY (RLS) — disable for service role ──────
-- We use the service role key in the backend so RLS won't block us.
-- But enable it on all tables for safety:
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots    ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS (this is the default in Supabase)
-- No additional policies needed since we use service_role key server-side.
