"""Points, badges and streak logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    add_points, award_badge, get_earned_badge_ids, get_subscriber,
)

# ── Point values ──────────────────────────────────────────────────────────────

POINTS = {
    "story_received":    5,
    "activity_yes":      10,
    "activity_share":    15,
    "activity_photo":    20,    # photo evidence bonus
    "streak_bonus":      10,    # per week of continuous engagement
}

# ── Badge definitions ─────────────────────────────────────────────────────────

BADGES: dict[str, dict] = {
    # Story milestones
    "story_1":   {"name": "Seed Planter 🌱",      "desc": "Received your first story",     "pts": 0},
    "story_5":   {"name": "Explorer 🗺️",          "desc": "Completed 5 stories",           "pts": 25},
    "story_10":  {"name": "Story Weaver 📖",       "desc": "Completed 10 stories",          "pts": 50},
    "story_25":  {"name": "Wisdom Keeper 🦉",      "desc": "Completed 25 stories",          "pts": 100},
    "story_50":  {"name": "Story Guardian 🏆",     "desc": "Completed 50 stories",          "pts": 200},
    "story_all": {"name": "Sauramandala Master ⭐","desc": "Completed all 60 stories",      "pts": 500},
    # Activity milestones
    "act_1":     {"name": "First Doer 💪",         "desc": "Completed your first activity", "pts": 10},
    "act_5":     {"name": "Active Learner 🎯",     "desc": "Completed 5 activities",        "pts": 50},
    "act_10":    {"name": "Activity Champion 🥇",  "desc": "Completed 10 activities",       "pts": 100},
    # Photo sharing
    "photo_1":   {"name": "Memory Maker 📸",       "desc": "Shared your first activity photo", "pts": 20},
    "photo_5":   {"name": "Visual Storyteller 🎞️","desc": "Shared 5 activity photos",      "pts": 60},
    # Sharing / community
    "share_3":   {"name": "Storyteller 🗣️",       "desc": "Shared 3 activity experiences", "pts": 30},
    "share_10":  {"name": "Community Star 🌟",     "desc": "Shared 10 experiences",         "pts": 80},
    # Streak
    "streak_4":  {"name": "Committed 🔥",          "desc": "4-week engagement streak",      "pts": 40},
    "streak_8":  {"name": "Dedicated 🌟",          "desc": "8-week engagement streak",      "pts": 80},
    "streak_12": {"name": "Champion 🏆",           "desc": "12-week engagement streak",     "pts": 120},
}

# ── Badge eligibility checks ──────────────────────────────────────────────────

def _eligible_badges(stories_received: int, activities_completed: int,
                     activities_shared: int, photos_shared: int,
                     streak_weeks: int, total_stories: int) -> list[str]:
    earned = []

    story_thresholds = [(1, "story_1"), (5, "story_5"), (10, "story_10"),
                        (25, "story_25"), (50, "story_50"), (total_stories, "story_all")]
    for threshold, bid in story_thresholds:
        if stories_received >= threshold:
            earned.append(bid)

    act_thresholds = [(1, "act_1"), (5, "act_5"), (10, "act_10")]
    for threshold, bid in act_thresholds:
        if activities_completed >= threshold:
            earned.append(bid)

    if activities_shared >= 3:
        earned.append("share_3")
    if activities_shared >= 10:
        earned.append("share_10")

    if photos_shared >= 1:
        earned.append("photo_1")
    if photos_shared >= 5:
        earned.append("photo_5")

    streak_thresholds = [(4, "streak_4"), (8, "streak_8"), (12, "streak_12")]
    for threshold, bid in streak_thresholds:
        if streak_weeks >= threshold:
            earned.append(bid)

    return earned


async def check_and_award_badges(
    session: AsyncSession, phone: str, total_stories: int, photos_shared: int = 0
) -> list[dict]:
    """Return list of newly earned badge dicts."""
    sub = await get_subscriber(session, phone)
    if not sub:
        return []

    already = await get_earned_badge_ids(session, phone)
    eligible = _eligible_badges(
        sub.stories_received, sub.activities_completed or 0,
        sub.activities_shared or 0, photos_shared,
        sub.streak_weeks or 0, total_stories,
    )

    new_badges = []
    for bid in eligible:
        if bid not in already:
            await award_badge(session, phone, bid)
            b = BADGES[bid]
            await add_points(session, phone, b["pts"])
            new_badges.append(b)

    return new_badges


def format_badge_announcements(new_badges: list[dict]) -> str:
    if not new_badges:
        return ""
    lines = ["\n🏅 *New Badge(s) Earned!*"]
    for b in new_badges:
        lines.append(f"  {b['name']} — {b['desc']}")
    return "\n".join(lines)


def format_score_summary(sub, earned_badge_ids: set[str]) -> str:
    badges = [BADGES[bid] for bid in earned_badge_ids if bid in BADGES]
    streak = sub.streak_weeks or 0
    lines = [
        f"📊 *Your Score — {sub.name or 'Learner'}*\n",
        f"⭐ Points: *{sub.points or 0}*",
        f"📖 Stories: *{sub.stories_received}* received",
        f"✅ Activities: *{sub.activities_completed or 0}* completed",
        f"🔥 Streak: *{streak} week{'s' if streak != 1 else ''}*\n",
    ]
    if badges:
        lines.append("🏅 *Badges:*")
        for b in badges:
            lines.append(f"  {b['name']}")
    else:
        lines.append("No badges yet — complete your first activity to earn one!")
    lines.append("\nReply *NEXT* to keep going!")
    return "\n".join(lines)
