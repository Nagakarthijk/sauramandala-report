"""
Scheduled story delivery.

Runs twice a week (configurable via DELIVERY_DAYS and DELIVERY_HOUR env vars).
For each active subscriber, sends 2 consecutive stories in their sequence.
"""

import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from content import format_story_message, get_story_by_index, story_count
from database import AsyncSessionLocal, advance_subscriber, get_active_subscribers
from messenger import send, send_admin

logger = logging.getLogger(__name__)


async def deliver_stories():
    """Send the next story to every active subscriber."""
    total = story_count()
    sent = 0
    errors = 0
    base_url = os.environ.get("BASE_URL", "http://localhost:8000")

    async with AsyncSessionLocal() as session:
        subscribers = await get_active_subscribers(session)
        logger.info(f"Scheduled delivery to {len(subscribers)} subscribers")

        for sub in subscribers:
            if sub.next_story_index >= total:
                # All stories done — send a completion message once
                if sub.stories_received == total:
                    send(
                        sub.phone,
                        f"🎉 *You've completed all {total} Sauramandala stories!*\n\n"
                        "What a journey! Reply *STORY 1* anytime to start over, or *LIST* to revisit favourites.",
                    )
                continue

            story = get_story_by_index(sub.next_story_index)
            if not story:
                continue

            try:
                body, media = format_story_message(story, base_url)
                send(sub.phone, body, media)
                await advance_subscriber(session, sub.phone, story["id"], story["title"], "scheduled")
                sent += 1
            except Exception as exc:
                logger.error(f"Failed to deliver to {sub.phone}: {exc}")
                errors += 1

    logger.info(f"Delivery complete: {sent} sent, {errors} errors")
    if errors:
        send_admin(f"Scheduled delivery had {errors} errors. {sent} succeeded.")


def build_scheduler() -> AsyncIOScheduler:
    days_env = os.getenv("DELIVERY_DAYS", "0,3")          # 0=Mon, 3=Thu
    hour = int(os.getenv("DELIVERY_HOUR", "9"))

    # Convert day numbers to APScheduler day_of_week names
    day_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
    day_names = ",".join(day_map[int(d)] for d in days_env.split(",") if d.strip().isdigit())

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        deliver_stories,
        CronTrigger(day_of_week=day_names, hour=hour, minute=0),
        id="weekly_delivery",
        replace_existing=True,
    )
    logger.info(f"Scheduler configured: day_of_week={day_names} hour={hour}:00 UTC")
    return scheduler
