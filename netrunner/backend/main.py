"""NETRUNNER — FastAPI Backend Application."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auth import create_token, verify_password, verify_token
from database import init_db
from game_engine import (
    add_inventory_item,
    advance_mission,
    award_xp,
    complete_challenge,
    complete_recovery_challenge,
    damage_hp,
    get_challenge_progress,
    get_current_session,
    get_inventory,
    get_map_data,
    get_mission,
    get_player,
    get_recovery_challenges,
    get_streak_bonus,
    heal_hp,
    increment_daily_challenges,
    load_story,
    log_daily_activity,
    record_attempt,
    record_hint_used,
    unlock_district,
    update_player,
    update_streak,
    validate_output,
)
from sandbox import execute_code
from spaced_rep import add_card, get_due_reviews, get_review_stats, update_sm2


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="NETRUNNER", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    password: str


class RunCodeRequest(BaseModel):
    code: str
    stdin: str = ""


class SubmitRequest(BaseModel):
    code: str


class SetHandleRequest(BaseModel):
    handle: str


class ReviewSubmitRequest(BaseModel):
    code: str
    quality: int = 3  # SM-2 quality rating 0-5


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.post("/api/login")
async def login(req: LoginRequest):
    if not verify_password(req.password):
        raise HTTPException(status_code=401, detail="Falsches Passwort")
    token = create_token()
    return {"token": token}


# ---------------------------------------------------------------------------
# Player routes
# ---------------------------------------------------------------------------

@app.get("/api/player")
async def get_player_data(_: str = Depends(verify_token)):
    player = await get_player()
    return player.to_dict()


@app.post("/api/player/handle")
async def set_handle(req: SetHandleRequest, _: str = Depends(verify_token)):
    player = await update_player(handle=req.handle)
    return player.to_dict()


# ---------------------------------------------------------------------------
# Session route
# ---------------------------------------------------------------------------

@app.get("/api/session")
async def get_session(_: str = Depends(verify_token)):
    return await get_current_session()


# ---------------------------------------------------------------------------
# Mission routes
# ---------------------------------------------------------------------------

@app.get("/api/mission/{mission_id}")
async def get_mission_data(mission_id: str, _: str = Depends(verify_token)):
    mission = await get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission nicht gefunden")

    # Enrich challenges with progress
    for challenge in mission.get("challenges", []):
        progress = await get_challenge_progress(challenge["id"])
        challenge["progress"] = progress or {
            "completed": False,
            "attempts": 0,
            "hints_used": 0,
        }

    return mission


# ---------------------------------------------------------------------------
# Code execution
# ---------------------------------------------------------------------------

@app.post("/api/run")
async def run_code(req: RunCodeRequest, _: str = Depends(verify_token)):
    result = execute_code(req.code, req.stdin)
    return result


# ---------------------------------------------------------------------------
# Challenge submission
# ---------------------------------------------------------------------------

@app.post("/api/submit/{challenge_id}")
async def submit_challenge(
    challenge_id: str,
    req: SubmitRequest,
    _: str = Depends(verify_token),
):
    # Find the challenge in story data
    story = load_story()
    challenge = None
    mission_data = None

    for chapter in story.get("chapters", []):
        for mission in chapter.get("missions", []):
            for ch in mission.get("challenges", []):
                if ch["id"] == challenge_id:
                    challenge = ch
                    mission_data = mission
                    break

    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")

    # Check if already completed
    progress = await get_challenge_progress(challenge_id)
    if progress and progress["completed"]:
        return {
            "already_completed": True,
            "message": "Challenge bereits abgeschlossen.",
        }

    # Execute code
    result = execute_code(req.code, challenge.get("stdin_input", ""))

    # Record attempt
    attempts = await record_attempt(challenge_id, req.code)

    # Validate
    success = validate_output(challenge, result["output"], req.code)

    player = await get_player()

    if success:
        # Mark complete
        await complete_challenge(challenge_id, req.code)

        # Track daily challenges + streak
        await increment_daily_challenges()
        streak = await update_streak(challenge_completed=True)

        # Award XP
        xp_amount = challenge.get("xp", 50)
        streak_bonus = await get_streak_bonus()
        xp_result = await award_xp(xp_amount + streak_bonus)

        # Heal HP
        new_hp = await heal_hp()

        # Add to spaced repetition
        concept = challenge.get("concept", challenge_id)
        await add_card(challenge_id, concept)

        # Log daily activity
        await log_daily_activity(xp=xp_amount + streak_bonus)

        # Add inventory item if mission reward
        reward = challenge.get("reward")
        if reward:
            await add_inventory_item(
                reward["item_id"], reward["name"], reward["description"]
            )

        # Check if all challenges in mission are complete
        all_complete = True
        for ch in mission_data.get("challenges", []):
            ch_progress = await get_challenge_progress(ch["id"])
            if not ch_progress or not ch_progress["completed"]:
                all_complete = False
                break

        mission_complete = False
        next_mission = None
        if all_complete:
            mission_complete = True
            next_mission = await advance_mission()
            # Unlock district if specified
            district = mission_data.get("unlocks_district")
            if district:
                await unlock_district(district["id"], district["name"])

        return {
            "success": True,
            "output": result["output"],
            "xp_gained": xp_amount + streak_bonus,
            "streak_bonus": streak_bonus,
            "streak": streak,
            "level_up": xp_result.get("leveled_up", False),
            "new_level": xp_result.get("new_level"),
            "new_title": xp_result.get("new_title"),
            "hp": new_hp,
            "mission_complete": mission_complete,
            "next_mission_id": next_mission["id"] if next_mission else None,
            "reward": challenge.get("reward"),
        }
    else:
        # Failed attempt
        response = {
            "success": False,
            "output": result["output"],
            "error": result.get("error", ""),
            "attempts": attempts,
        }

        # HP loss after too many attempts (based on STEALTH stat)
        max_free = player.max_attempts_before_hp_loss
        if attempts >= max_free:
            hp_result = await damage_hp()
            response["hp"] = hp_result["hp"]
            response["hp_lost"] = 10

            if hp_result["crashed"]:
                response["system_crash"] = True

        return response


# ---------------------------------------------------------------------------
# Recovery challenge submission
# ---------------------------------------------------------------------------

@app.post("/api/submit/recovery/{challenge_id}")
async def submit_recovery(
    challenge_id: str,
    req: SubmitRequest,
    _: str = Depends(verify_token),
):
    # Find recovery challenge
    recovery_challenges = get_recovery_challenges()
    challenge = None
    for ch in recovery_challenges:
        if ch["id"] == challenge_id:
            challenge = ch
            break

    # Also check the full RECOVERY_CHALLENGES list
    if not challenge:
        from game_engine import RECOVERY_CHALLENGES
        for ch in RECOVERY_CHALLENGES:
            if ch["id"] == challenge_id:
                challenge = ch
                break

    if not challenge:
        raise HTTPException(status_code=404, detail="Recovery-Challenge nicht gefunden")

    # Execute code
    result = execute_code(req.code, challenge.get("stdin_input", ""))

    # Validate
    success = validate_output(challenge, result["output"], req.code)

    if success:
        recovery_result = await complete_recovery_challenge()
        return {
            "success": True,
            "output": result["output"],
            "recovery_complete": recovery_result["recovery_complete"],
            "recovery_remaining": recovery_result["remaining"],
            "echo_success": challenge.get("echo_success", ""),
        }
    else:
        return {
            "success": False,
            "output": result["output"],
            "error": result.get("error", ""),
            "echo_fail": challenge.get("echo_fail", ""),
        }


# ---------------------------------------------------------------------------
# Review submission (Spaced Repetition)
# ---------------------------------------------------------------------------

@app.post("/api/submit/review/{challenge_id}")
async def submit_review(
    challenge_id: str,
    req: ReviewSubmitRequest,
    _: str = Depends(verify_token),
):
    # Find the original challenge
    story = load_story()
    challenge = None
    for chapter in story.get("chapters", []):
        for mission in chapter.get("missions", []):
            for ch in mission.get("challenges", []):
                if ch["id"] == challenge_id:
                    challenge = ch
                    break

    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")

    # Execute code
    result = execute_code(req.code, challenge.get("stdin_input", ""))

    # Validate
    success = validate_output(challenge, result["output"], req.code)

    player = await get_player()

    # Determine quality for SM-2 (auto-rate based on success)
    quality = req.quality if success else min(req.quality, 2)

    # Update spaced rep with MEMORY stat bonus
    await update_sm2(challenge_id, quality, memory_bonus=player.memory_bonus)

    # Log as review
    await log_daily_activity(xp=0, is_review=True)

    if success:
        # Small XP reward for reviews
        xp_amount = 10
        xp_result = await award_xp(xp_amount)

        return {
            "success": True,
            "output": result["output"],
            "is_review": True,
            "xp_gained": xp_amount,
            "quality": quality,
        }
    else:
        return {
            "success": False,
            "output": result["output"],
            "error": result.get("error", ""),
            "is_review": True,
            "quality": quality,
        }


# ---------------------------------------------------------------------------
# Hint system
# ---------------------------------------------------------------------------

@app.post("/api/hint/{challenge_id}")
async def get_hint(challenge_id: str, _: str = Depends(verify_token)):
    story = load_story()
    challenge = None
    for chapter in story.get("chapters", []):
        for mission in chapter.get("missions", []):
            for ch in mission.get("challenges", []):
                if ch["id"] == challenge_id:
                    challenge = ch
                    break

    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")

    hints = challenge.get("hints", [])
    hint_index = await record_hint_used(challenge_id)

    player = await get_player()
    max_hints = min(len(hints), player.max_hints)

    if hint_index > max_hints:
        hint_index = max_hints

    if hint_index <= len(hints):
        return {
            "hint": hints[hint_index - 1],
            "hint_number": hint_index,
            "hints_total": max_hints,
        }
    else:
        return {
            "hint": hints[-1] if hints else "Keine Hints verfügbar.",
            "hint_number": len(hints),
            "hints_total": max_hints,
        }


# ---------------------------------------------------------------------------
# Map & Inventory
# ---------------------------------------------------------------------------

@app.get("/api/map")
async def get_map(_: str = Depends(verify_token)):
    return {"districts": await get_map_data()}


@app.get("/api/inventory")
async def get_inventory_data(_: str = Depends(verify_token)):
    return {"items": await get_inventory()}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/api/stats")
async def get_stats(_: str = Depends(verify_token)):
    player = await get_player()
    review_stats = await get_review_stats()
    return {
        "player": player.to_dict(),
        "streak": player.streak,
        "reviews": review_stats,
    }
