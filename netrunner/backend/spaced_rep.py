"""SM-2 Spaced Repetition algorithm for NETRUNNER.

MEMORY stat integration: higher MEMORY → faster interval growth → fewer reviews needed.
"""

from __future__ import annotations

from datetime import date, timedelta

from database import get_db


async def add_card(challenge_id: str, concept: str):
    """Add a new spaced repetition card when a challenge is first completed."""
    db = await get_db()
    try:
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        await db.execute(
            """INSERT OR IGNORE INTO spaced_rep
               (challenge_id, concept, ease_factor, interval, repetitions, next_review, last_quality)
               VALUES (?, ?, 2.5, 1, 0, ?, 0)""",
            (challenge_id, concept, tomorrow),
        )
        await db.commit()
    finally:
        await db.close()


async def update_sm2(challenge_id: str, quality: int, memory_bonus: float = 1.0):
    """Update a card using the SM-2 algorithm.

    Args:
        challenge_id: The challenge to update
        quality: 0-5 rating (0-2 = incorrect, 3-5 = correct)
        memory_bonus: Player's MEMORY stat multiplier (1.0 = base, higher = faster mastery)
    """
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM spaced_rep WHERE challenge_id = ?", (challenge_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return

        ease_factor = row["ease_factor"]
        interval = row["interval"]
        repetitions = row["repetitions"]

        if quality >= 3:  # Correct
            if repetitions == 0:
                interval = 1
            elif repetitions == 1:
                interval = 3
            else:
                # MEMORY stat: multiply interval growth for faster mastery
                interval = round(interval * ease_factor * memory_bonus)
            repetitions += 1
        else:  # Incorrect
            repetitions = 0
            interval = 1

        # Update ease factor
        ease_factor = max(
            1.3,
            ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
        )

        next_review = (date.today() + timedelta(days=interval)).isoformat()

        await db.execute(
            """UPDATE spaced_rep
               SET ease_factor = ?, interval = ?, repetitions = ?,
                   next_review = ?, last_quality = ?
               WHERE challenge_id = ?""",
            (ease_factor, interval, repetitions, next_review, quality, challenge_id),
        )
        await db.commit()
    finally:
        await db.close()


async def get_due_reviews() -> list[dict]:
    """Get all challenges due for review today."""
    db = await get_db()
    try:
        today = date.today().isoformat()
        cursor = await db.execute(
            """SELECT sr.*, p.completed
               FROM spaced_rep sr
               JOIN progress p ON sr.challenge_id = p.challenge_id
               WHERE sr.next_review <= ? AND p.completed = 1
               ORDER BY sr.next_review ASC""",
            (today,),
        )
        rows = await cursor.fetchall()
        return [
            {
                "challenge_id": r["challenge_id"],
                "concept": r["concept"],
                "ease_factor": r["ease_factor"],
                "interval": r["interval"],
                "repetitions": r["repetitions"],
                "next_review": r["next_review"],
            }
            for r in rows
        ]
    finally:
        await db.close()


async def get_review_stats() -> dict:
    """Get spaced repetition statistics."""
    db = await get_db()
    try:
        today = date.today().isoformat()

        cursor = await db.execute("SELECT COUNT(*) as total FROM spaced_rep")
        total = (await cursor.fetchone())["total"]

        cursor = await db.execute(
            "SELECT COUNT(*) as due FROM spaced_rep WHERE next_review <= ?", (today,)
        )
        due = (await cursor.fetchone())["due"]

        cursor = await db.execute(
            "SELECT COUNT(*) as mastered FROM spaced_rep WHERE repetitions >= 5"
        )
        mastered = (await cursor.fetchone())["mastered"]

        return {"total_cards": total, "due_today": due, "mastered": mastered}
    finally:
        await db.close()
