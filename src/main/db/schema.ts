/**
 * Gerki SQLite Schema
 * Alle Daten bleiben lokal auf dem PC des Nutzers.
 */

export const SCHEMA = `
-- =====================================================
-- SETTINGS: API-Keys, Präferenzen
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- =====================================================
-- MEMORY: Dauerhaftes Gedächtnis über den Nutzer
-- Wird von ALLEN Skills gelesen und geschrieben.
-- =====================================================
CREATE TABLE IF NOT EXISTS memory (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,   -- 'person', 'preference', 'fact', 'task', 'learned'
  key        TEXT NOT NULL,   -- z.B. 'name', 'beruf', 'lieblingsfarbe'
  value      TEXT NOT NULL,   -- der tatsächliche Inhalt
  source     TEXT,            -- welcher Skill hat das gelernt
  confidence REAL DEFAULT 1.0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(category, key)
);

-- =====================================================
-- CONVERSATIONS: Gesprächshistorie
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  skill      TEXT DEFAULT 'general',  -- welcher Skill war aktiv
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  model           TEXT,           -- 'claude', 'gpt-4', etc.
  skill           TEXT,           -- aktiver Skill
  metadata        TEXT,           -- JSON: Dateireferenzen, Aktionen, etc.
  created_at      TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- FILES: Index aller freigegebenen Dateien
-- =====================================================
CREATE TABLE IF NOT EXISTS file_index (
  id           TEXT PRIMARY KEY,
  path         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  extension    TEXT,
  size         INTEGER,
  content_text TEXT,   -- extrahierter Text (PDFs, Docs)
  category     TEXT,   -- 'dokument', 'bild', 'tabelle', etc.
  tags         TEXT,   -- JSON-Array
  folder_id    TEXT,
  indexed_at   TEXT DEFAULT (datetime('now')),
  modified_at  TEXT
);

CREATE TABLE IF NOT EXISTS watched_folders (
  id         TEXT PRIMARY KEY,
  path       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  active     INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- SKILLS: Aktivierte Skills & Konfiguration
-- =====================================================
CREATE TABLE IF NOT EXISTS skills (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  active      INTEGER DEFAULT 0,
  config      TEXT,   -- JSON: Skill-spezifische Einstellungen
  last_used   TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TASKS: Aufgaben die der PA erledigen soll
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done','failed')),
  skill       TEXT,
  priority    INTEGER DEFAULT 2,
  due_at      TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- USERS: Lokale Nutzerkonten
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  plan          TEXT DEFAULT 'free' CHECK(plan IN ('free','pro','business')),
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_category ON memory(category);
CREATE INDEX IF NOT EXISTS idx_file_index_name ON file_index(name);
CREATE INDEX IF NOT EXISTS idx_file_index_extension ON file_index(extension);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`
