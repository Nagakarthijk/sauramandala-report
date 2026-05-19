"""
Message handler — state machine covering signup, engagement, and commands.

Conversation states:
  idle                  — normal command mode
  signup_name           — asked for name, waiting
  signup_role           — asked for role (1-5), waiting
  signup_age_group      — asked for age group (1-5), waiting
  awaiting_engagement   — engagement follow-up sent, waiting for YES/SHARE/SKIP/photo
  awaiting_share        — user chose SHARE, now waiting for their text

Commands (idle state, case-insensitive):
  JOIN                  — start sign-up flow
  STOP / QUIT           — unsubscribe
  NEXT                  — get next story now
  STORY [n]             — specific story by number
  ACTIVITIES [n]        — activities for story n
  LIST                  — browse all story titles
  SCORE / POINTS        — gamification summary
  BADGES                — badge list
  STATUS                — delivery progress
  HELP                  — command menu
"""

import logging
import os
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ai_assistant import get_role_tip, respond_to_activity_share, respond_to_photo
from content import (
    format_list_message,
    format_story_message,
    get_all_stories,
    get_story,
    get_story_by_index,
    story_count,
)
from database import (
    add_points,
    add_subscriber,
    advance_subscriber,
    get_conv_state,
    get_earned_badge_ids,
    get_profile,
    get_subscriber,
    record_activity_response,
    save_profile,
    schedule_engagement_prompt,
    set_conv_state,
    unsubscribe,
)
from engagement import engagement_prompt_text, nudge_text
from gamification import (
    POINTS,
    check_and_award_badges,
    format_badge_announcements,
    format_score_summary,
)
from messenger import send
from profiles import AGE_GROUPS, ROLES, age_menu, role_menu, welcome_message

logger = logging.getLogger(__name__)

BASE_URL = lambda: os.environ.get("BASE_URL", "http://localhost:8000")  # noqa: E731

HELP_TEXT = """\
📚 *Sauramandala Stories*

*JOIN* — Subscribe & set your profile
*STOP* — Unsubscribe
*NEXT* — Get your next story now
*STORY [n]* — Get story number n (e.g. STORY 5)
*ACTIVITIES [n]* — Activities for story n
*LIST* — Browse all stories
*SCORE* — Your points & streak
*BADGES* — Your earned badges
*STATUS* — Delivery progress

Stories arrive *Mon & Thu* automatically.
Send a 📸 *photo* when you do an activity for bonus points!"""


# ── Entry point ───────────────────────────────────────────────────────────────

async def handle_message(
    phone: str,
    body: str,
    session: AsyncSession,
    num_media: int = 0,
    media_url: Optional[str] = None,
    media_type: Optional[str] = None,
):
    state, ctx = await get_conv_state(session, phone)

    # ── Photo received — handle before text parsing ───────────────────────────
    if num_media > 0 and media_type and media_type.startswith("image/"):
        await _handle_photo(phone, session, state, ctx)
        return

    text = body.strip()
    cmd = text.upper().split()[0] if text else ""
    rest = text[len(cmd):].strip()

    # ── State-machine: mid-conversation flows ─────────────────────────────────
    if state == "signup_name":
        await _signup_got_name(phone, text, session)
        return

    if state == "signup_role":
        await _signup_got_role(phone, text, session, ctx)
        return

    if state == "signup_age_group":
        await _signup_got_age(phone, text, session, ctx)
        return

    if state == "awaiting_engagement":
        if cmd in ("YES", "DONE", "✅"):
            await _engagement_yes(phone, session, ctx)
        elif cmd == "SHARE":
            await set_conv_state(session, phone, "awaiting_share", ctx)
            name = (await get_subscriber(session, phone) or type("", (), {"name": ""})()).name
            send(phone, f"Great, {name or 'there'}! Tell us what happened — what did you and the children do? 📝")
        elif cmd == "SKIP":
            await _engagement_skip(phone, session, ctx)
        else:
            # Treat any free text as an implicit SHARE
            await _engagement_share_text(phone, text, session, ctx)
        return

    if state == "awaiting_share":
        await _engagement_share_text(phone, text, session, ctx)
        return

    # ── Normal command parsing (idle) ─────────────────────────────────────────
    if cmd == "JOIN":
        await _cmd_join(phone, session)
    elif cmd in ("STOP", "QUIT", "UNSUBSCRIBE"):
        await unsubscribe(session, phone)
        send(phone, "You've been unsubscribed. Reply *JOIN* anytime to come back. 🌱")
    elif cmd == "HELP":
        send(phone, HELP_TEXT)
    elif cmd == "LIST":
        send(phone, format_list_message())
    elif cmd in ("SCORE", "POINTS", "MY SCORE"):
        await _cmd_score(phone, session)
    elif cmd == "BADGES":
        await _cmd_badges(phone, session)
    elif cmd == "STATUS":
        await _cmd_status(phone, session)
    elif cmd == "NEXT":
        await _cmd_next(phone, session)
    elif cmd == "STORY":
        await _cmd_story(phone, rest, session)
    elif cmd == "ACTIVITIES":
        await _cmd_activities(phone, rest, session)
    else:
        sub = await get_subscriber(session, phone)
        if sub and sub.active:
            send(phone, "I didn't catch that. Reply *HELP* to see all commands.")
        else:
            send(phone, "Hi! 👋 Reply *JOIN* to subscribe to weekly stories, or *HELP* for options. 🌟")


# ── Sign-up flow ──────────────────────────────────────────────────────────────

async def _cmd_join(phone: str, session: AsyncSession):
    sub = await get_subscriber(session, phone)
    if sub and sub.active:
        send(phone, f"You're already subscribed, {sub.name or 'friend'}! Reply *HELP* for commands or *NEXT* for a story.")
        return
    await set_conv_state(session, phone, "signup_name")
    send(phone, "Welcome to *Sauramandala Stories*! 🌟\n\nWhat's your name?")


async def _signup_got_name(phone: str, name: str, session: AsyncSession):
    if not name or len(name) > 60:
        send(phone, "Please share your name so we can personalise your experience!")
        return
    await add_subscriber(session, phone, name.strip().title())
    await set_conv_state(session, phone, "signup_role", {"name": name.strip().title()})
    send(phone, f"Hi *{name.strip().title()}*! 👋\n\n{role_menu()}")


async def _signup_got_role(phone: str, text: str, session: AsyncSession, ctx: dict):
    choice = text.strip()
    if choice not in ROLES:
        send(phone, f"Please reply with a number 1–5.\n\n{role_menu()}")
        return
    role_key = ROLES[choice]["key"]
    ctx["role"] = role_key
    await set_conv_state(session, phone, "signup_age_group", ctx)
    send(phone, age_menu())


async def _signup_got_age(phone: str, text: str, session: AsyncSession, ctx: dict):
    choice = text.strip()
    if choice not in AGE_GROUPS:
        send(phone, f"Please reply with a number 1–5.\n\n{age_menu()}")
        return
    age_key = AGE_GROUPS[choice]["key"]
    role_key = ctx.get("role", "parent")
    name = ctx.get("name", "")

    await save_profile(session, phone, role=role_key, age_group=age_key)
    await set_conv_state(session, phone, "idle")

    total = story_count()
    msg = welcome_message(name, role_key, age_key, total)
    send(phone, msg)

    # Award sign-up points & check first badge
    await add_points(session, phone, 5)
    new_badges = await check_and_award_badges(session, phone, total)
    if new_badges:
        send(phone, format_badge_announcements(new_badges))


# ── Story delivery (shared by NEXT, STORY, and the scheduler) ─────────────────

async def _deliver_story(
    phone: str, session: AsyncSession, story: dict,
    delivery_type: str = "on_demand",
) -> bool:
    """Send story + schedule engagement prompt. Returns True on success."""
    profile = await get_profile(session, phone)
    sub = await get_subscriber(session, phone)
    role = profile.role if profile else ""
    age_group = profile.age_group if profile else ""

    tip = await get_role_tip(story, role, age_group, session=session) if role else ""
    body, media = format_story_message(story, BASE_URL(), role_tip=tip)
    send(phone, body, media)

    await advance_subscriber(session, phone, story["id"], story["title"], delivery_type)
    await add_points(session, phone, POINTS["story_received"])

    # Schedule engagement follow-up in 48 hours
    from datetime import datetime, timedelta, timezone
    send_at = datetime.now(timezone.utc) + timedelta(hours=48)
    await schedule_engagement_prompt(session, phone, story["id"], 0, send_at)

    total = story_count()
    new_badges = await check_and_award_badges(session, phone, total)
    if new_badges:
        send(phone, format_badge_announcements(new_badges))

    return True


# ── Commands ──────────────────────────────────────────────────────────────────

async def _cmd_next(phone: str, session: AsyncSession):
    sub = await get_subscriber(session, phone)
    if not sub or not sub.active:
        send(phone, "Please *JOIN* first to receive stories!")
        return
    total = story_count()
    story = get_story_by_index(sub.next_story_index)
    if not story:
        send(phone, f"🎉 You've completed all {total} stories! Reply *STORY 1* to start over, or *LIST* to revisit favourites.")
        return
    await _deliver_story(phone, session, story, "on_demand")


async def _cmd_story(phone: str, rest: str, session: AsyncSession):
    sub = await get_subscriber(session, phone)
    if not sub or not sub.active:
        send(phone, "Please *JOIN* first!")
        return
    if rest.isdigit():
        story = get_story(int(rest))
        if not story:
            send(phone, f"Story {rest} not found. We have stories 1–{story_count()}. Try *LIST*.")
            return
    else:
        story = get_story_by_index(sub.next_story_index)
        if not story:
            send(phone, f"🎉 You've completed all {story_count()} stories!")
            return
    await _deliver_story(phone, session, story, "on_demand")


async def _cmd_activities(phone: str, rest: str, session: AsyncSession):
    if rest.isdigit():
        story = get_story(int(rest))
    else:
        sub = await get_subscriber(session, phone)
        idx = max(0, (sub.next_story_index - 1)) if sub else 0
        story = get_story_by_index(idx)
    if not story:
        send(phone, "Couldn't find that story. Try *ACTIVITIES 3* for story 3.")
        return
    acts = story.get("activities", [])
    if not acts:
        send(phone, f"No activities listed for *{story['title']}* yet.")
        return
    lines = [f"✏️ *Activities — {story['title']}*", ""]
    for i, a in enumerate(acts, 1):
        lines.append(f"{i}. {a}")
    lines += ["", "Done an activity? Reply *YES* or share a 📸 photo for points!"]
    send(phone, "\n".join(lines))


async def _cmd_score(phone: str, session: AsyncSession):
    sub = await get_subscriber(session, phone)
    if not sub:
        send(phone, "You're not subscribed yet. Reply *JOIN* to start!")
        return
    earned = await get_earned_badge_ids(session, phone)
    send(phone, format_score_summary(sub, earned))


async def _cmd_badges(phone: str, session: AsyncSession):
    sub = await get_subscriber(session, phone)
    if not sub:
        send(phone, "Reply *JOIN* to start earning badges!")
        return
    earned = await get_earned_badge_ids(session, phone)
    from gamification import BADGES
    if not earned:
        send(phone, "No badges yet — complete your first activity to earn one! Reply *NEXT* to get a story.")
        return
    lines = ["🏅 *Your Badges:*", ""]
    for bid in earned:
        if bid in BADGES:
            b = BADGES[bid]
            lines.append(f"{b['name']} — {b['desc']}")
    send(phone, "\n".join(lines))


async def _cmd_status(phone: str, session: AsyncSession):
    sub = await get_subscriber(session, phone)
    if not sub or not sub.active:
        send(phone, "You're not subscribed. Reply *JOIN* to start!")
        return
    total = story_count()
    lines = [
        f"📊 *Progress — {sub.name or 'Learner'}*\n",
        f"Stories received: {sub.stories_received} / {total}",
        f"Remaining: {total - sub.stories_received}",
        f"Last delivery: {sub.last_delivery_at.strftime('%d %b %Y') if sub.last_delivery_at else 'none yet'}",
        "",
        "Reply *NEXT* to get your next story now.",
    ]
    send(phone, "\n".join(lines))


# ── Engagement responses ───────────────────────────────────────────────────────

async def _engagement_yes(phone: str, session: AsyncSession, ctx: dict):
    sub = await get_subscriber(session, phone)
    story = get_story(ctx.get("story_id", 0))
    profile = await get_profile(session, phone)
    name = sub.name if sub else ""

    pts = POINTS["activity_yes"]
    await add_points(session, phone, pts)
    await record_activity_response(
        session, phone, ctx.get("story_id", 0),
        ctx.get("activity_index", 0), "yes", points_earned=pts,
    )
    await set_conv_state(session, phone, "idle")

    total = story_count()
    new_badges = await check_and_award_badges(session, phone, total)
    badge_msg = format_badge_announcements(new_badges)

    sub = await get_subscriber(session, phone)  # refresh after points update
    msg = (
        f"Amazing, {name or 'there'}! ✅\n\n"
        f"You earned *{pts} points* — you're on a *{sub.streak_weeks or 1}-week streak* 🔥\n"
        f"Total: *{sub.points} points*\n"
        f"{badge_msg}\n"
        f"Reply *NEXT* for your next story!"
    )
    send(phone, msg.strip())


async def _engagement_skip(phone: str, session: AsyncSession, ctx: dict):
    sub = await get_subscriber(session, phone)
    await record_activity_response(
        session, phone, ctx.get("story_id", 0),
        ctx.get("activity_index", 0), "skip",
    )
    await set_conv_state(session, phone, "idle")
    name = sub.name if sub else "there"
    send(phone, f"No worries, {name}! Whenever you're ready. Reply *NEXT* when you want the next story. 🌱")


async def _engagement_share_text(phone: str, text: str, session: AsyncSession, ctx: dict):
    sub = await get_subscriber(session, phone)
    story = get_story(ctx.get("story_id", 0))
    profile = await get_profile(session, phone)
    name = sub.name if sub else ""
    role = profile.role if profile else "parent"
    age_group = profile.age_group if profile else "mixed"

    activities = story.get("activities", []) if story else []
    act_index = ctx.get("activity_index", 0)
    activity_text = activities[act_index] if activities and act_index < len(activities) else "the activity"

    ai_reply = await respond_to_activity_share(
        story or {}, activity_text, text, name, role, age_group
    ) if story else f"Wonderful, {name}! Keep going! 🌟"

    pts = POINTS["activity_share"]
    await add_points(session, phone, pts)
    await record_activity_response(
        session, phone, ctx.get("story_id", 0),
        act_index, "share", response_text=text,
        ai_feedback=ai_reply, points_earned=pts,
    )
    await set_conv_state(session, phone, "idle")

    total = story_count()
    new_badges = await check_and_award_badges(session, phone, total)
    badge_msg = format_badge_announcements(new_badges)

    sub = await get_subscriber(session, phone)
    msg = (
        f"{ai_reply}\n\n"
        f"⭐ *+{pts} points* for sharing! Total: *{sub.points}*\n"
        f"🔥 *{sub.streak_weeks or 1}-week streak*\n"
        f"{badge_msg}\n"
        "Reply *NEXT* to continue your journey!"
    )
    send(phone, msg.strip())


async def _handle_photo(phone: str, session: AsyncSession, state: str, ctx: dict):
    sub = await get_subscriber(session, phone)
    if not sub or not sub.active:
        send(phone, "Reply *JOIN* to subscribe and earn points for sharing! 🌟")
        return

    profile = await get_profile(session, phone)
    name = sub.name or "there"
    role = profile.role if profile else "parent"
    age_group = profile.age_group if profile else "mixed"

    # Figure out which story this photo is for
    story_id = ctx.get("story_id") if state in ("awaiting_engagement", "awaiting_share") else None
    if not story_id and sub.next_story_index > 0:
        # Default to their most recently received story
        from content import get_story_by_index
        recent = get_story_by_index(sub.next_story_index - 1)
        story_id = recent["id"] if recent else None

    story = get_story(story_id) if story_id else None

    ai_reply = await respond_to_photo(story or {}, name, role, age_group)

    pts = POINTS["activity_photo"]
    await add_points(session, phone, pts)

    # Track as a share + increment photos counter on subscriber (reuse activities_shared)
    if story_id:
        await record_activity_response(
            session, phone, story_id,
            ctx.get("activity_index", 0), "share",
            response_text="[photo]", points_earned=pts,
        )
    # Also bump a pseudo-field via activities_shared (photos count as shares for badges)
    if sub:
        sub.activities_shared = (sub.activities_shared or 0) + 1
        await session.commit()

    # Clear engagement state if we were in one
    if state in ("awaiting_engagement", "awaiting_share"):
        await set_conv_state(session, phone, "idle")

    total = story_count()
    # Pass photos_shared for photo badge check
    new_badges = await check_and_award_badges(session, phone, total, photos_shared=sub.activities_shared or 1)
    badge_msg = format_badge_announcements(new_badges)

    sub = await get_subscriber(session, phone)
    msg = (
        f"📸 {ai_reply}\n\n"
        f"⭐ *+{pts} bonus points* for the photo! Total: *{sub.points}*\n"
        f"{badge_msg}"
    )
    send(phone, msg.strip())
