"""Data models / helpers for NETRUNNER."""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date


TITLES = {
    (1, 3): "Script Kiddie",
    (4, 7): "Byte Punk",
    (8, 12): "Code Runner",
    (13, 17): "Net Ghost",
    (18, 23): "Zero Day",
    (24, 30): "Daemon Lord",
}


def title_for_level(level: int) -> str:
    for (lo, hi), title in TITLES.items():
        if lo <= level <= hi:
            return title
    return "Daemon Lord"


def xp_needed_for_level(level: int) -> int:
    return level * 200


@dataclass
class Player:
    id: int = 1
    handle: str = "Runner"
    level: int = 1
    xp: int = 0
    hp: int = 100
    stat_logic: int = 1
    stat_memory: int = 1
    stat_stealth: int = 1
    current_chapter: int = 0
    current_mission: str = "0.1"
    streak: int = 0
    last_active_date: str | None = None

    @property
    def title(self) -> str:
        return title_for_level(self.level)

    @property
    def xp_to_next_level(self) -> int:
        return xp_needed_for_level(self.level)

    @property
    def max_attempts_before_hp_loss(self) -> int:
        """STEALTH stat gives more attempts before HP loss (base 3)."""
        return 2 + self.stat_stealth

    @property
    def max_hints(self) -> int:
        """LOGIC stat gives access to more hints (base 3)."""
        return min(3, 1 + self.stat_logic)

    def to_dict(self) -> dict:
        return {
            "handle": self.handle,
            "level": self.level,
            "xp": self.xp,
            "hp": self.hp,
            "xp_to_next_level": self.xp_to_next_level,
            "title": self.title,
            "stats": {
                "logic": self.stat_logic,
                "memory": self.stat_memory,
                "stealth": self.stat_stealth,
            },
            "current_chapter": self.current_chapter,
            "current_mission": self.current_mission,
            "streak": self.streak,
        }


@dataclass
class ChallengeProgress:
    challenge_id: str
    completed: bool = False
    attempts: int = 0
    hints_used: int = 0
    completed_at: str | None = None
    code_submitted: str | None = None


@dataclass
class SpacedRepCard:
    challenge_id: str
    concept: str
    ease_factor: float = 2.5
    interval: int = 1
    repetitions: int = 0
    next_review: str = ""
    last_quality: int = 0

    def __post_init__(self):
        if not self.next_review:
            self.next_review = date.today().isoformat()
