"""
Scheduled jobs:
  1. Twice-weekly story delivery (Mon & Thu, 9 AM UTC by default)
  2. Every-30-min engagement prompt checker
"""

import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from content import format_story_message, get_story_by_index, story_count
from database import (
    AsyncSessionLocal,
    advance_subscriber,
    get_active_subscribers,
    get_due_prompts,
    get_profile,
    get_subscriber,
    mark_prompt_sent,
    schedule_engagement_prompt,
)
from messenger import send, send_admin
from ai_assistant import get_role_tip

logger = logging.getLogger(__name__)


async def deliver_stories():
    """Send the next story to every active subscriber."""
    from datetime import datetime, timedelta, timezone
    from database import add_points
    from gamification import POINTS, check_and_award_badges, format_badge_announcements

    total = story_count()
    base_url = os.environ.get("BASE_URL", "http://localhost:8000")
    sent = errors = 0

    async with AsyncSessionLocal() as session:
        subscribers = await get_active_subscribers(session)
        logger.info(f"Scheduled delivery starting — {len(subscribers)} active subscribers")

        for sub in subscribers:
            if sub.next_story_index >= total:
                if sub.stories_received >= total:
                    send(
                        sub.phone,
                        f"🎉 *You've completed all {total} Sauramandala stories, {sub.name or 'friend'}!*\n\n"
                        "What a journey! Reply *STORY 1* to start over, or *LIST* to revisit favourites.",
                    )
                continue

            story = get_story_by_index(sub.next_story_index)
            if not story:
                continue

            try:
                profile = await get_profile(session, sub.phone)
                role = profile.role if profile else ""
                age = profile.age_group if profile else ""
                tip = await get_role_tip(story, role, age, session=session) if role else ""
                body, media = format_story_message(story, base_url, role_tip=tip)
                send(sub.phone, body, media)
                await advance_subscriber(session, sub.phone, story["id"], story["title"], "scheduled")
                await add_points(session, sub.phone, POINTS["story_received"])

                # Schedule engagement follow-up in 48h
                send_at = datetime.now(timezone.utc) + timedelta(hours=48)
                await schedule_engagement_prompt(session, sub.phone, story["id"], 0, send_at)

                new_badges = await check_and_award_badges(session, sub.phone, total)
                if new_badges:
                    send(sub.phone, format_badge_announcements(new_badges))

                sent += 1
            except Exception as exc:
                logger.error(f"Delivery failed for {sub.phone}: {exc}")
                errors += 1

    logger.info(f"Delivery done: {sent} sent, {errors} errors")
    if errors:
        send_admin(f"Scheduled delivery had {errors} errors ({sent} succeeded).")


async def process_engagement_prompts():
    """Check for due engagement prompts and send them."""
    from database import get_subscriber
    from engagement import send_engagement_prompt, nudge_text
    from content import get_story
    from messenger import send

    async with AsyncSessionLocal() as session:
        due = await get_due_prompts(session)
        for prompt in due:
            try:
                sub = await get_subscriber(session, prompt.phone)
                if not sub or not sub.active:
                    await mark_prompt_sent(session, prompt.id)
                    continue

                # Set conversation state so the next reply is handled as engagement
                from database import get_conv_state, set_conv_state
                state, _ = await get_conv_state(session, prompt.phone)
                if state == "idle":
                    ctx = {
                        "story_id": prompt.story_id,
                        "activity_index": prompt.activity_index,
                    }
                    await set_conv_state(session, prompt.phone, "awaiting_engagement", ctx)
                    await send_engagement_prompt(
                        prompt.phone, sub.name or "", prompt.story_id, prompt.activity_index
                    )

                await mark_prompt_sent(session, prompt.id)
            except Exception as exc:
                logger.error(f"Engagement prompt failed for {prompt.phone}: {exc}")


def build_scheduler() -> AsyncIOScheduler:
    days_env = os.getenv("DELIVERY_DAYS", "0,3")
    hour = int(os.getenv("DELIVERY_HOUR", "9"))

    day_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
    day_names = ",".join(day_map[int(d)] for d in days_env.split(",") if d.strip().isdigit())

    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        deliver_stories,
        CronTrigger(day_of_week=day_names, hour=hour, minute=0),
        id="weekly_delivery",
        replace_existing=True,
    )
    scheduler.add_job(
        process_engagement_prompts,
        IntervalTrigger(minutes=30),
        id="engagement_prompts",
        replace_existing=True,
    )

    logger.info(f"Scheduler: delivery on {day_names} at {hour}:00 UTC, engagement check every 30 min")
    return scheduler
