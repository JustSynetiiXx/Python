"""Data models / helpers for NETRUNNER."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date


TITLES = {
    (1, 3): "Script Kiddie",
    (4, 7): "Byte Punk",
    (8, 12): "Code Runner",
    (13, 17): "Net Ghost",
    (18, 23): "Zero Day",
    (24, 30): "Daemon Lord",
}

MAX_NEW_CHALLENGES_PER_DAY = 5
RECOVERY_CHALLENGE_COUNT = 3
HP_LOSS_PER_FAIL = 10
HP_GAIN_ON_SUCCESS = 20
HP_MAX = 100


def title_for_level(level: int) -> str:
    for (lo, hi), title in TITLES.items():
        if lo <= level <= hi:
            return title
    return "Daemon Lord"


def xp_needed_for_level(level: int) -> int:
    return level * 200


def compute_stats(level: int) -> dict:
    """Compute LOGIC, MEMORY, STEALTH from level."""
    return {
        "logic": 1 + (level - 1) // 3,
        "memory": 1 + (level - 1) // 4,
        "stealth": 1 + (level - 1) // 5,
    }


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
    recovery_mode: int = 0
    recovery_remaining: int = 0
    challenges_today: int = 0
    challenges_today_date: str | None = None
    total_challenges_completed: int = 0
    total_xp_earned: int = 0

    @property
    def title(self) -> str:
        return title_for_level(self.level)

    @property
    def xp_to_next_level(self) -> int:
        return xp_needed_for_level(self.level)

    @property
    def in_recovery(self) -> bool:
        return bool(self.recovery_mode)

    @property
    def max_attempts_before_hp_loss(self) -> int:
        """STEALTH stat: more attempts before HP loss. Base = 3 (index 0,1,2 free)."""
        return 2 + self.stat_stealth

    @property
    def max_hints(self) -> int:
        """LOGIC stat: access to more hints. Base 2, max 3."""
        return min(3, 1 + self.stat_logic)

    @property
    def memory_bonus(self) -> float:
        """MEMORY stat: multiplier for spaced-rep interval growth. Higher = faster mastery."""
        return 1.0 + (self.stat_memory - 1) * 0.15

    @property
    def reached_daily_cap(self) -> bool:
        """Check if player hit the daily new-challenge cap."""
        if self.challenges_today_date != date.today().isoformat():
            return False  # New day, counter resets
        return self.challenges_today >= MAX_NEW_CHALLENGES_PER_DAY

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
            "recovery_mode": self.in_recovery,
            "recovery_remaining": self.recovery_remaining,
            "challenges_today": self.challenges_today,
            "daily_cap": MAX_NEW_CHALLENGES_PER_DAY,
            "total_challenges": self.total_challenges_completed,
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
