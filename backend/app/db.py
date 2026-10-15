import json
import sqlite3
import threading
from contextlib import contextmanager

from .config import DATA_DIR, DEFAULT_SETTINGS

DB_PATH = DATA_DIR / "app.db"
_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  mode TEXT NOT NULL,
  scenario TEXT,
  summary TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  audio_seconds REAL DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  wpm REAL,
  avg_confidence REAL,
  has_image INTEGER DEFAULT 0,
  correction TEXT
);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  wrong TEXT NOT NULL,
  right TEXT NOT NULL,
  type TEXT,
  why TEXT,
  sentence TEXT,
  corrected TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,               -- word | sentence
  front TEXT NOT NULL,
  back TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_at TEXT NOT NULL DEFAULT (datetime('now')),
  interval_days REAL NOT NULL DEFAULT 0,
  ease REAL NOT NULL DEFAULT 2.5,
  reps INTEGER NOT NULL DEFAULT 0,
  UNIQUE(kind, front)
);
CREATE TABLE IF NOT EXISTS course_progress (
  lesson TEXT PRIMARY KEY,          -- w3d2 = week 3, day 2 (Tuesday)
  done_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id INTEGER
);
CREATE TABLE IF NOT EXISTS pron_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  target TEXT NOT NULL,
  heard TEXT NOT NULL,
  word_score REAL NOT NULL,
  sound_score REAL,
  audio_seconds REAL DEFAULT 0
);
"""


def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


_conn = _connect()
_conn.executescript(SCHEMA)
# Upgrades for databases made by older versions.
for _sql in (
    "ALTER TABLE messages ADD COLUMN hidden INTEGER DEFAULT 0",
    "ALTER TABLE course_progress ADD COLUMN xp INTEGER DEFAULT 0",
):
    try:
        _conn.execute(_sql)
        _conn.commit()
    except sqlite3.OperationalError:
        pass  # already there


@contextmanager
def tx():
    with _lock:
        try:
            yield _conn
            _conn.commit()
        except Exception:
            _conn.rollback()
            raise


def query(sql, params=()):
    with _lock:
        return [dict(r) for r in _conn.execute(sql, params).fetchall()]


def query_one(sql, params=()):
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql, params=()):
    with tx() as c:
        cur = c.execute(sql, params)
        return cur.lastrowid


def get_settings():
    out = dict(DEFAULT_SETTINGS)
    for r in query("SELECT key, value FROM settings"):
        out[r["key"]] = json.loads(r["value"])
    return out


def save_settings(values: dict):
    with tx() as c:
        for k, v in values.items():
            if k in DEFAULT_SETTINGS:
                c.execute(
                    "INSERT INTO settings(key, value) VALUES(?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (k, json.dumps(v)),
                )
    return get_settings()
