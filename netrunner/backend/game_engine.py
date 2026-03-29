"""Game engine for NETRUNNER — XP, HP, Level, Streak, Session logic."""

from __future__ import annotations

import json
import os
import re
from datetime import date, datetime

from database import get_db
from models import Player, title_for_level, xp_needed_for_level

STORY_PATH = os.path.join(os.path.dirname(__file__), "content", "story.json")

# ---------------------------------------------------------------------------
# Story content loading
# ---------------------------------------------------------------------------

_story_cache: dict | None = None


def load_story() -> dict:
    global _story_cache
    if _story_cache is None:
        with open(STORY_PATH, "r", encoding="utf-8") as f:
            _story_cache = json.load(f)
    return _story_cache


# ---------------------------------------------------------------------------
# Player helpers
# ---------------------------------------------------------------------------

async def get_player() -> Player:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM player WHERE id = 1")
        row = await cursor.fetchone()
        if not row:
            return Player()
        fields = {f.name for f in Player.__dataclass_fields__.values()}
        return Player(**{k: row[k] for k in row.keys() if k in fields})
    finally:
        await db.close()


async def update_player(**kwargs) -> Player:
    db = await get_db()
    try:
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        vals = list(kwargs.values())
        await db.execute(f"UPDATE player SET {sets} WHERE id = 1", vals)
        await db.commit()
    finally:
        await db.close()
    return await get_player()


# ---------------------------------------------------------------------------
# XP / Level / HP
# ---------------------------------------------------------------------------

async def award_xp(amount: int) -> dict:
    """Award XP and handle level-ups. Returns level-up info."""
    player = await get_player()
    new_xp = player.xp + amount
    new_level = player.level
    leveled_up = False
    old_title = player.title

    while new_xp >= xp_needed_for_level(new_level):
        new_xp -= xp_needed_for_level(new_level)
        new_level += 1
        leveled_up = True

    new_level = min(new_level, 30)

    # Stats increase every 3 levels
    stat_logic = 1 + (new_level - 1) // 3
    stat_memory = 1 + (new_level - 1) // 4
    stat_stealth = 1 + (new_level - 1) // 5

    player = await update_player(
        xp=new_xp,
        level=new_level,
        stat_logic=stat_logic,
        stat_memory=stat_memory,
        stat_stealth=stat_stealth,
    )

    result = {"xp_gained": amount, "leveled_up": leveled_up}
    if leveled_up:
        result["new_level"] = new_level
        result["new_title"] = title_for_level(new_level)
        result["old_title"] = old_title

    return result


async def apply_hp_change(delta: int) -> int:
    """Change HP by delta (positive = heal, negative = damage). Returns new HP."""
    player = await get_player()
    new_hp = max(0, min(100, player.hp + delta))
    await update_player(hp=new_hp)
    return new_hp


async def check_system_crash() -> bool:
    """Check if player HP is 0 (system crash)."""
    player = await get_player()
    return player.hp <= 0


async def recover_from_crash():
    """Reset HP to 100 after crash recovery."""
    await update_player(hp=100)


# ---------------------------------------------------------------------------
# Streak
# ---------------------------------------------------------------------------

async def update_streak() -> int:
    """Update daily streak. Returns new streak count."""
    player = await get_player()
    today = date.today().isoformat()

    if player.last_active_date == today:
        return player.streak

    yesterday = date.fromordinal(date.today().toordinal() - 1).isoformat()

    if player.last_active_date == yesterday:
        new_streak = player.streak + 1
    else:
        new_streak = 1

    await update_player(streak=new_streak, last_active_date=today)
    return new_streak


async def get_streak_bonus() -> int:
    """Calculate streak XP bonus."""
    player = await get_player()
    return player.streak * 10


# ---------------------------------------------------------------------------
# Challenge progress
# ---------------------------------------------------------------------------

async def get_challenge_progress(challenge_id: str) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM progress WHERE challenge_id = ?", (challenge_id,)
        )
        row = await cursor.fetchone()
        if row:
            return {k: row[k] for k in row.keys()}
        return None
    finally:
        await db.close()


async def record_attempt(challenge_id: str, code: str) -> int:
    """Record a challenge attempt. Returns attempt count."""
    db = await get_db()
    try:
        existing = await get_challenge_progress(challenge_id)
        if existing:
            new_attempts = existing["attempts"] + 1
            await db.execute(
                "UPDATE progress SET attempts = ?, code_submitted = ? WHERE challenge_id = ?",
                (new_attempts, code, challenge_id),
            )
            await db.commit()
            return new_attempts
        else:
            await db.execute(
                "INSERT INTO progress (challenge_id, attempts, code_submitted) VALUES (?, 1, ?)",
                (challenge_id, code),
            )
            await db.commit()
            return 1
    finally:
        await db.close()


async def complete_challenge(challenge_id: str, code: str):
    """Mark a challenge as completed."""
    db = await get_db()
    try:
        now = datetime.now().isoformat()
        await db.execute(
            """INSERT INTO progress (challenge_id, completed, attempts, code_submitted, completed_at)
               VALUES (?, 1, 1, ?, ?)
               ON CONFLICT(challenge_id) DO UPDATE SET
               completed = 1, code_submitted = ?, completed_at = ?""",
            (challenge_id, code, now, code, now),
        )
        await db.commit()
    finally:
        await db.close()


async def record_hint_used(challenge_id: str) -> int:
    """Record hint usage. Returns hints used count."""
    db = await get_db()
    try:
        existing = await get_challenge_progress(challenge_id)
        if existing:
            new_hints = existing["hints_used"] + 1
            await db.execute(
                "UPDATE progress SET hints_used = ? WHERE challenge_id = ?",
                (new_hints, challenge_id),
            )
            await db.commit()
            return new_hints
        else:
            await db.execute(
                "INSERT INTO progress (challenge_id, hints_used) VALUES (?, 1)",
                (challenge_id,),
            )
            await db.commit()
            return 1
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_output(challenge: dict, actual_output: str) -> bool:
    """Validate player output against challenge requirements."""
    vtype = challenge.get("type", "exact_output")
    actual = actual_output.strip()

    if vtype == "exact_output":
        expected = challenge.get("expected_output", "").strip()
        return actual == expected

    elif vtype == "contains_output":
        required = challenge.get("expected_output", "")
        if isinstance(required, list):
            return all(r.strip() in actual for r in required)
        return required.strip() in actual

    elif vtype == "regex_output":
        pattern = challenge.get("expected_output", "")
        return bool(re.search(pattern, actual))

    elif vtype == "code_check":
        # Check that certain constructs appear in the submitted code
        required_constructs = challenge.get("required_constructs", [])
        code = challenge.get("_submitted_code", "")
        return all(construct in code for construct in required_constructs)

    elif vtype == "function_test":
        # Handled separately in the submit endpoint
        return True

    return False


# ---------------------------------------------------------------------------
# Session / Mission flow
# ---------------------------------------------------------------------------

async def get_current_session() -> dict:
    """Get the current daily session: mix of new missions + reviews."""
    player = await get_player()
    story = load_story()
    streak = await update_streak()

    # Find current mission
    current = None
    for chapter in story.get("chapters", []):
        for mission in chapter.get("missions", []):
            if mission["id"] == player.current_mission:
                current = mission
                break
        if current:
            break

    # Get due reviews
    from spaced_rep import get_due_reviews
    reviews = await get_due_reviews()

    return {
        "player": player.to_dict(),
        "current_mission": current,
        "reviews_due": len(reviews),
        "review_challenges": reviews[:5],  # Max 5 reviews per session
        "streak": streak,
        "streak_bonus": await get_streak_bonus(),
    }


async def advance_mission():
    """Advance to the next mission after completing all challenges."""
    player = await get_player()
    story = load_story()

    chapters = story.get("chapters", [])
    found_current = False

    for chapter in chapters:
        for i, mission in enumerate(chapter["missions"]):
            if found_current:
                await update_player(
                    current_mission=mission["id"],
                    current_chapter=chapter["id"],
                )
                return mission
            if mission["id"] == player.current_mission:
                found_current = True

    return None  # No more missions


async def get_mission(mission_id: str) -> dict | None:
    """Get a specific mission by ID."""
    story = load_story()
    for chapter in story.get("chapters", []):
        for mission in chapter.get("missions", []):
            if mission["id"] == mission_id:
                return mission
    return None


async def get_map_data() -> list:
    """Get unlocked districts for the map."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM unlocked_districts")
        rows = await cursor.fetchall()
        return [{"district_id": r["district_id"], "name": r["name"]} for r in rows]
    finally:
        await db.close()


async def get_inventory() -> list:
    """Get player inventory."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM inventory ORDER BY obtained_at")
        rows = await cursor.fetchall()
        return [
            {"item_id": r["item_id"], "name": r["name"], "description": r["description"]}
            for r in rows
        ]
    finally:
        await db.close()


async def add_inventory_item(item_id: str, name: str, description: str):
    """Add an item to inventory."""
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO inventory (item_id, name, description) VALUES (?, ?, ?)",
            (item_id, name, description),
        )
        await db.commit()
    finally:
        await db.close()


async def unlock_district(district_id: str, name: str):
    """Unlock a new district on the map."""
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO unlocked_districts (district_id, name) VALUES (?, ?)",
            (district_id, name),
        )
        await db.commit()
    finally:
        await db.close()
