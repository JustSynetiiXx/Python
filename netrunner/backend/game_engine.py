"""Game engine for NETRUNNER — XP, HP, Level, Streak, Session logic."""

from __future__ import annotations

import json
import os
import random
import re
from datetime import date, datetime

from database import get_db
from models import (
    HP_GAIN_ON_SUCCESS,
    HP_LOSS_PER_FAIL,
    HP_MAX,
    MAX_NEW_CHALLENGES_PER_DAY,
    RECOVERY_CHALLENGE_COUNT,
    Player,
    compute_stats,
    title_for_level,
    xp_needed_for_level,
)

STORY_PATH = os.path.join(os.path.dirname(__file__), "content", "story.json")

# Recovery challenges — simple review tasks for after a System Crash
RECOVERY_CHALLENGES = [
    {
        "id": "recovery_print_1",
        "type": "exact_output",
        "concept": "print_basic",
        "difficulty": "easy",
        "xp": 0,
        "title": "System-Reboot: Signal senden",
        "description": "ECHO: System-Crash erkannt. Notfall-Reboot l\u00e4uft.\nSende ein Signal, um die Verbindung wiederherzustellen.\n\nprint(\"Reboot\")",
        "expected_output": "Reboot",
        "starter_code": "",
        "solution": "print(\"Reboot\")",
        "hints": ["Nutze print() mit dem Text \"Reboot\".", "print(\"Reboot\")", "Exakt: print(\"Reboot\")"],
        "echo_success": "Signal empfangen. System stabilisiert sich.",
        "echo_fail": "Kein Signal. Versuch es nochmal.",
    },
    {
        "id": "recovery_print_2",
        "type": "exact_output",
        "concept": "print_basic",
        "difficulty": "easy",
        "xp": 0,
        "title": "System-Reboot: Status pr\u00fcfen",
        "description": "ECHO: Sende eine Status-Meldung.\n\nprint(\"Status: Online\")",
        "expected_output": "Status: Online",
        "starter_code": "",
        "solution": "print(\"Status: Online\")",
        "hints": ["print() mit dem genauen Text.", "print(\"Status: Online\")", "Exakt: print(\"Status: Online\")"],
        "echo_success": "Status best\u00e4tigt. Systeme kommen zur\u00fcck.",
        "echo_fail": "Status unklar. Achte auf den genauen Text.",
    },
    {
        "id": "recovery_math_1",
        "type": "exact_output",
        "concept": "math_addition",
        "difficulty": "easy",
        "xp": 0,
        "title": "System-Reboot: Prozessor-Check",
        "description": "ECHO: Teste den Prozessor.\n\nprint(10 + 5)",
        "expected_output": "15",
        "starter_code": "",
        "solution": "print(10 + 5)",
        "hints": ["Rechne 10 + 5 mit print().", "print(10 + 5)", "Exakt: print(10 + 5)"],
        "echo_success": "Prozessor antwortet korrekt.",
        "echo_fail": "Falsches Ergebnis. 10 + 5 = ?",
    },
    {
        "id": "recovery_var_1",
        "type": "exact_output",
        "concept": "variables_string",
        "difficulty": "easy",
        "xp": 0,
        "title": "System-Reboot: Ged\u00e4chtnis-Check",
        "description": "ECHO: Teste den Speicher. Erstelle eine Variable und zeige sie an.\n\nstatus = \"OK\"\nprint(status)",
        "expected_output": "OK",
        "starter_code": "",
        "solution": "status = \"OK\"\nprint(status)",
        "hints": ["Speichere \"OK\" in einer Variable.", "status = \"OK\" und dann print(status)", "Exakt: status = \"OK\"\nprint(status)"],
        "echo_success": "Speicher intakt. System wiederhergestellt.",
        "echo_fail": "Speicher reagiert nicht. Variable = Wert, dann print().",
    },
    {
        "id": "recovery_math_2",
        "type": "exact_output",
        "concept": "math_multiplication",
        "difficulty": "easy",
        "xp": 0,
        "title": "System-Reboot: Kalibrierung",
        "description": "ECHO: Letzte Kalibrierung. Berechne:\n\nprint(3 * 7)",
        "expected_output": "21",
        "starter_code": "",
        "solution": "print(3 * 7)",
        "hints": ["3 mal 7 mit print().", "print(3 * 7)", "Exakt: print(3 * 7)"],
        "echo_success": "Kalibrierung abgeschlossen. Du bist zur\u00fcck.",
        "echo_fail": "Falsches Ergebnis. 3 * 7 = ?",
    },
]

# Intrusion Alert story wrappers for spaced repetition reviews
INTRUSION_ALERTS = [
    "WARNUNG: Feindlicher Scan erkannt! Neutralisiere den Angriff!",
    "ALERT: Unbekannte Signatur im Netzwerk. Identifiziere und eliminiere!",
    "INTRUSION DETECTED: Abwehrsystem aktiviert. Bestätige deine Fähigkeiten!",
    "ECHO: Etwas tastet sich durch die Firewall. Zeig, dass du noch weißt, wie's geht.",
    "NETZWERK-ALARM: Alte Bedrohung kehrt zurück. Reaktiviere deine Gegenmaßnahmen!",
]

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
# XP / Level
# ---------------------------------------------------------------------------

async def award_xp(amount: int) -> dict:
    """Award XP and handle level-ups. Returns level-up info."""
    player = await get_player()
    new_xp = player.xp + amount
    new_level = player.level
    leveled_up = False
    old_title = player.title

    while new_xp >= xp_needed_for_level(new_level) and new_level < 30:
        new_xp -= xp_needed_for_level(new_level)
        new_level += 1
        leveled_up = True

    new_level = min(new_level, 30)
    stats = compute_stats(new_level)

    player = await update_player(
        xp=new_xp,
        level=new_level,
        stat_logic=stats["logic"],
        stat_memory=stats["memory"],
        stat_stealth=stats["stealth"],
        total_xp_earned=player.total_xp_earned + amount,
    )

    result = {"xp_gained": amount, "leveled_up": leveled_up}
    if leveled_up:
        result["new_level"] = new_level
        result["new_title"] = title_for_level(new_level)
        result["old_title"] = old_title

    return result


# ---------------------------------------------------------------------------
# HP System — No frustration design
# ---------------------------------------------------------------------------

async def heal_hp(amount: int = HP_GAIN_ON_SUCCESS) -> int:
    """Heal HP on correct answer. Returns new HP."""
    player = await get_player()
    new_hp = min(HP_MAX, player.hp + amount)
    await update_player(hp=new_hp)
    return new_hp


async def damage_hp(amount: int = HP_LOSS_PER_FAIL) -> dict:
    """Damage HP on repeated failures. Returns HP info + crash status."""
    player = await get_player()
    new_hp = max(0, player.hp - amount)
    await update_player(hp=new_hp)

    crashed = new_hp <= 0
    if crashed:
        await enter_recovery_mode()

    return {"hp": new_hp if not crashed else HP_MAX, "crashed": crashed}


async def enter_recovery_mode():
    """Enter System Crash recovery — 3 simple challenges to recover."""
    await update_player(
        recovery_mode=1,
        recovery_remaining=RECOVERY_CHALLENGE_COUNT,
        hp=HP_MAX,
    )


async def complete_recovery_challenge() -> dict:
    """Complete one recovery challenge. Returns remaining count."""
    player = await get_player()
    remaining = max(0, player.recovery_remaining - 1)

    if remaining <= 0:
        # Recovery complete — exit recovery mode
        await update_player(recovery_mode=0, recovery_remaining=0)
        return {"recovery_complete": True, "remaining": 0}
    else:
        await update_player(recovery_remaining=remaining)
        return {"recovery_complete": False, "remaining": remaining}


def get_recovery_challenges() -> list[dict]:
    """Get a random set of recovery challenges."""
    return random.sample(RECOVERY_CHALLENGES, min(RECOVERY_CHALLENGE_COUNT, len(RECOVERY_CHALLENGES)))


# ---------------------------------------------------------------------------
# Streak System
# ---------------------------------------------------------------------------

async def update_streak(challenge_completed: bool = False) -> int:
    """Update streak. Streak only increments when a challenge is completed.

    Called on session load to check for streak break,
    and again when a challenge is completed to increment.
    """
    player = await get_player()
    today = date.today().isoformat()
    yesterday = date.fromordinal(date.today().toordinal() - 1).isoformat()

    if player.last_active_date == today:
        # Already active today
        if challenge_completed and player.streak == 0:
            # First challenge of the day after a break
            await update_player(streak=1)
            return 1
        return player.streak

    # New day
    if player.last_active_date == yesterday:
        if challenge_completed:
            new_streak = player.streak + 1
            await update_player(streak=new_streak, last_active_date=today)
            return new_streak
        else:
            # Just checking in, don't break streak yet (give them the day)
            return player.streak
    else:
        # Missed a day — reset streak
        new_streak = 1 if challenge_completed else 0
        await update_player(streak=new_streak, last_active_date=today)
        return new_streak


async def get_streak_bonus() -> int:
    """Streak XP bonus: consecutive days * 10."""
    player = await get_player()
    return player.streak * 10


# ---------------------------------------------------------------------------
# Daily challenge tracking
# ---------------------------------------------------------------------------

async def increment_daily_challenges() -> int:
    """Increment today's challenge counter. Returns new count."""
    player = await get_player()
    today = date.today().isoformat()

    if player.challenges_today_date != today:
        # New day — reset counter
        await update_player(
            challenges_today=1,
            challenges_today_date=today,
            total_challenges_completed=player.total_challenges_completed + 1,
        )
        return 1
    else:
        new_count = player.challenges_today + 1
        await update_player(
            challenges_today=new_count,
            total_challenges_completed=player.total_challenges_completed + 1,
        )
        return new_count


async def log_daily_activity(xp: int = 0, is_review: bool = False):
    """Log daily activity for stats."""
    db = await get_db()
    try:
        today = date.today().isoformat()
        player = await get_player()

        await db.execute(
            """INSERT INTO daily_log (log_date, challenges_completed, xp_earned, reviews_completed, streak_day)
               VALUES (?, 1, ?, ?, ?)
               ON CONFLICT(log_date) DO UPDATE SET
               challenges_completed = challenges_completed + 1,
               xp_earned = xp_earned + ?,
               reviews_completed = reviews_completed + ?""",
            (today, xp, 1 if is_review else 0, player.streak, xp, 1 if is_review else 0),
        )
        await db.commit()
    finally:
        await db.close()


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

def validate_output(challenge: dict, actual_output: str, submitted_code: str = "") -> bool:
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
        required_constructs = challenge.get("required_constructs", [])
        return all(construct in submitted_code for construct in required_constructs)

    elif vtype == "function_test":
        return True

    return False


# ---------------------------------------------------------------------------
# Session / Mission flow
# ---------------------------------------------------------------------------

async def get_current_session() -> dict:
    """Get the current daily session: mix of new missions + reviews.

    Implements:
    - Max 5 new challenges per day
    - Reviews mixed in as "Intrusion Alerts"
    - Recovery mode if HP crashed
    """
    player = await get_player()
    story = load_story()

    # Check streak (don't increment yet, just check for break)
    streak = await update_streak(challenge_completed=False)

    # Recovery mode: return recovery challenges instead of normal session
    if player.in_recovery:
        recovery = get_recovery_challenges()
        return {
            "player": player.to_dict(),
            "mode": "recovery",
            "current_mission": None,
            "recovery_challenges": recovery[:player.recovery_remaining],
            "recovery_remaining": player.recovery_remaining,
            "reviews_due": 0,
            "review_challenges": [],
            "streak": streak,
            "streak_bonus": await get_streak_bonus(),
        }

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

    # Build review challenges with intrusion alert wrappers
    review_challenges = []
    for review in reviews[:5]:
        challenge = _find_challenge(review["challenge_id"])
        if challenge:
            review_challenges.append({
                **challenge,
                "is_review": True,
                "intrusion_alert": random.choice(INTRUSION_ALERTS),
                "review_info": review,
            })

    # Check daily cap
    daily_cap_reached = player.reached_daily_cap

    mode = "normal"
    if daily_cap_reached and review_challenges:
        mode = "reviews_only"
    elif daily_cap_reached:
        mode = "daily_cap"

    return {
        "player": player.to_dict(),
        "mode": mode,
        "current_mission": current,
        "reviews_due": len(reviews),
        "review_challenges": review_challenges,
        "daily_cap_reached": daily_cap_reached,
        "streak": streak,
        "streak_bonus": await get_streak_bonus(),
    }


def _find_challenge(challenge_id: str) -> dict | None:
    """Find a challenge by ID in story data."""
    story = load_story()
    for chapter in story.get("chapters", []):
        for mission in chapter.get("missions", []):
            for ch in mission.get("challenges", []):
                if ch["id"] == challenge_id:
                    return ch
    return None


async def advance_mission():
    """Advance to the next mission after completing all challenges."""
    player = await get_player()
    story = load_story()

    chapters = story.get("chapters", [])
    found_current = False

    for chapter in chapters:
        for mission in chapter["missions"]:
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


# ---------------------------------------------------------------------------
# Map & Inventory
# ---------------------------------------------------------------------------

async def get_map_data() -> list:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM unlocked_districts")
        rows = await cursor.fetchall()
        return [{"district_id": r["district_id"], "name": r["name"]} for r in rows]
    finally:
        await db.close()


async def get_inventory() -> list:
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
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO unlocked_districts (district_id, name) VALUES (?, ?)",
            (district_id, name),
        )
        await db.commit()
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_daily_history(days: int = 7) -> list[dict]:
    """Get daily activity history."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM daily_log ORDER BY log_date DESC LIMIT ?", (days,)
        )
        rows = await cursor.fetchall()
        return [
            {
                "date": r["log_date"],
                "challenges": r["challenges_completed"],
                "xp": r["xp_earned"],
                "reviews": r["reviews_completed"],
                "streak": r["streak_day"],
            }
            for r in rows
        ]
    finally:
        await db.close()
