-- Users (synced from Clerk)
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,    -- Clerk user ID
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Session results for each cognitive task attempt
CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  task_type     TEXT NOT NULL,    -- 'memory_span' | 'pattern_recognition' | 'verbal_fluency' | 'processing_speed'
  accuracy      NUMERIC(5,2),    -- average normalized attempt score
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

-- Attempt results for each one full round within a session
-- score is normalized to 0.00–100.00 regardless of task type, calculated by backend when attempt ends
CREATE TABLE IF NOT EXISTS attempts (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  difficulty    INTEGER DEFAULT 1,    -- adaptive difficulty level (1–10)
  score         NUMERIC(5,2),
  response_time INTEGER,    -- total attempt duration in milliseconds
  attempted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Individual item responses within a memory span\verbal fluency attempt
-- used by backend to calculate the attempt score before inserting into attempts
CREATE TABLE IF NOT EXISTS attempt_items (
  id            SERIAL PRIMARY KEY,
  attempt_id    INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
  item_index    INTEGER NOT NULL,    -- position in the sequence\word flow (0-based)
  item_value    TEXT NOT NULL,    -- the actual item tapped\word produced by the user
  is_correct    BOOLEAN NOT NULL,    -- whether this specific item was recalled correctly
  responded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Cognitive profile snapshot per user (updated after each session)
CREATE TABLE IF NOT EXISTS profiles (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  task_type     TEXT NOT NULL,
  score         NUMERIC(5,2) DEFAULT 50,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_type)    -- one row per task type per user
);

-- Activity metadata per user
CREATE TABLE IF NOT EXISTS user_stats (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak  INTEGER DEFAULT 0,
  longest_streak  INTEGER DEFAULT 0,
  last_active     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Badges earned by users
CREATE TABLE IF NOT EXISTS badges (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  badge_type  TEXT NOT NULL,    -- 'first_win' | 'streak_7' | 'memory_master' etc.
  earned_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)    -- no duplicate badges
);