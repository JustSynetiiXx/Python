"""Database initialization and connection management for NETRUNNER."""

import aiosqlite
import os

DB_PATH = os.environ.get("NETRUNNER_DB_PATH", "netrunner.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS player (
    id INTEGER PRIMARY KEY DEFAULT 1,
    handle TEXT NOT NULL DEFAULT 'Runner',
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL DEFAULT 100,
    stat_logic INTEGER NOT NULL DEFAULT 1,
    stat_memory INTEGER NOT NULL DEFAULT 1,
    stat_stealth INTEGER NOT NULL DEFAULT 1,
    current_chapter INTEGER NOT NULL DEFAULT 0,
    current_mission TEXT NOT NULL DEFAULT '0.1',
    streak INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id TEXT NOT NULL UNIQUE,
    completed INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    hints_used INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    code_submitted TEXT
);

CREATE TABLE IF NOT EXISTS spaced_rep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id TEXT NOT NULL UNIQUE,
    concept TEXT NOT NULL,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval INTEGER NOT NULL DEFAULT 1,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review TEXT NOT NULL,
    last_quality INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    obtained_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unlocked_districts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def get_db() -> aiosqlite.Connection:
    """Get a database connection."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    return db


async def init_db():
    """Initialize the database schema and seed default player."""
    db = await get_db()
    try:
        await db.executescript(SCHEMA)

        # Seed default player if not exists
        cursor = await db.execute("SELECT COUNT(*) FROM player")
        row = await cursor.fetchone()
        if row[0] == 0:
            await db.execute(
                "INSERT INTO player (id, handle) VALUES (1, 'Runner')"
            )

        # Seed starting district
        await db.execute(
            """INSERT OR IGNORE INTO unlocked_districts (district_id, name)
               VALUES ('boot_sequence', 'Boot Sequence')"""
        )

        await db.commit()
    finally:
        await db.close()
