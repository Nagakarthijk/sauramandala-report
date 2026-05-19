"""
Incoming message handler — parses user commands and replies.

Commands (case-insensitive):
  JOIN [name]      — subscribe (optional name)
  STOP / QUIT      — unsubscribe
  STORY [n]        — get story by number, or next story
  NEXT             — get your next scheduled story right now
  ACTIVITIES [n]   — get activities for story n (or your last story)
  LIST             — browse all stories
  STATUS           — see your progress
  HELP             — command list
"""

import os
import re
from sqlalchemy.ext.asyncio import AsyncSession

from content import (
    format_list_message,
    format_story_message,
    get_all_stories,
    get_story,
    get_story_by_index,
    story_count,
)
from database import (
    add_subscriber,
    advance_subscriber,
    get_subscriber,
    unsubscribe,
)
from messenger import send

BASE_URL = lambda: os.environ.get("BASE_URL", "http://localhost:8000")  # noqa: E731

HELP_TEXT = """\
📚 *Sauramandala Stories — Commands*

*JOIN [your name]* — Subscribe to weekly stories
*STOP* — Unsubscribe
*STORY [n]* — Get story number n (e.g. STORY 5)
*NEXT* — Get your next story right now
*ACTIVITIES [n]* — Get activities for story n
*LIST* — See all 60 stories
*STATUS* — See your progress

Stories are delivered twice a week (Mon & Thu at 9 AM). You can always ask for a story on demand anytime!"""


async def handle_message(phone: str, body: str, session: AsyncSession):
    text = body.strip()
    cmd = text.upper().split()[0] if text else ""
    rest = text[len(cmd):].strip()

    # ── JOIN ──────────────────────────────────────────────────────────
    if cmd == "JOIN":
        name = rest or ""
        sub = await add_subscriber(session, phone, name)
        next_story = get_story_by_index(sub.next_story_index)
        greeting = f"Welcome, {name}!" if name else "Welcome!"
        reply = (
            f"🌟 {greeting}\n\n"
            "You're now subscribed to *Sauramandala Stories*.\n"
            f"You'll receive 2 stories every week (Mon & Thu).\n\n"
            f"We have *{story_count()} stories* for you, each with activities!\n\n"
        )
        if next_story:
            reply += f"Your first story is *{next_story['title']}* — coming on your next delivery day.\n\n"
        reply += "Reply *NEXT* to get your first story right now, or *HELP* to see all commands."
        send(phone, reply)
        return

    # ── STOP / QUIT / UNSUBSCRIBE ─────────────────────────────────────
    if cmd in ("STOP", "QUIT", "UNSUBSCRIBE"):
        await unsubscribe(session, phone)
        send(phone, "You've been unsubscribed from Sauramandala Stories. Reply *JOIN* anytime to come back. 🌱")
        return

    # ── HELP ──────────────────────────────────────────────────────────
    if cmd == "HELP":
        send(phone, HELP_TEXT)
        return

    # ── LIST ──────────────────────────────────────────────────────────
    if cmd == "LIST":
        send(phone, format_list_message())
        return

    # ── STATUS ────────────────────────────────────────────────────────
    if cmd == "STATUS":
        sub = await get_subscriber(session, phone)
        if not sub or not sub.active:
            send(phone, "You're not subscribed yet. Reply *JOIN* to start!")
            return
        total = story_count()
        remaining = total - sub.stories_received
        last = sub.last_delivery_at
        last_str = last.strftime("%d %b %Y") if last else "none yet"
        msg = (
            f"📊 *Your Progress*\n\n"
            f"Stories received: {sub.stories_received} / {total}\n"
            f"Remaining: {remaining}\n"
            f"Last delivery: {last_str}\n\n"
            "Reply *NEXT* to get your next story now."
        )
        send(phone, msg)
        return

    # ── STORY [n] ─────────────────────────────────────────────────────
    if cmd == "STORY":
        sub = await get_subscriber(session, phone)
        if not sub or not sub.active:
            send(phone, "Please *JOIN* first to receive stories!")
            return
        if rest.isdigit():
            story = get_story(int(rest))
            if not story:
                send(phone, f"Story {rest} not found. We have stories 1–{story_count()}. Try *LIST* to browse.")
                return
        else:
            story = get_story_by_index(sub.next_story_index)
            if not story:
                send(phone, f"🎉 You've completed all {story_count()} stories! Reply *LIST* to revisit any story.")
                return
        body_text, media = format_story_message(story, BASE_URL())
        send(phone, body_text, media)
        await advance_subscriber(session, phone, story["id"], story["title"], "on_demand")
        return

    # ── NEXT ──────────────────────────────────────────────────────────
    if cmd == "NEXT":
        sub = await get_subscriber(session, phone)
        if not sub or not sub.active:
            send(phone, "Please *JOIN* first to receive stories!")
            return
        story = get_story_by_index(sub.next_story_index)
        if not story:
            send(phone, f"🎉 You've completed all {story_count()} stories! Reply *LIST* to revisit any.")
            return
        body_text, media = format_story_message(story, BASE_URL())
        send(phone, body_text, media)
        await advance_subscriber(session, phone, story["id"], story["title"], "on_demand")
        return

    # ── ACTIVITIES [n] ────────────────────────────────────────────────
    if cmd == "ACTIVITIES":
        if rest.isdigit():
            story = get_story(int(rest))
        else:
            sub = await get_subscriber(session, phone)
            idx = (sub.next_story_index - 1) if sub else 0
            story = get_story_by_index(max(0, idx))
        if not story:
            send(phone, "Couldn't find that story. Try *ACTIVITIES 3* for story 3.")
            return
        acts = story.get("activities", [])
        if not acts:
            send(phone, f"No activities found for *{story['title']}*.")
            return
        lines = [f"✏️ *Activities for: {story['title']}*", ""]
        for i, a in enumerate(acts, 1):
            lines.append(f"{i}. {a}")
        send(phone, "\n".join(lines))
        return

    # ── UNKNOWN / FREE TEXT ───────────────────────────────────────────
    sub = await get_subscriber(session, phone)
    if sub and sub.active:
        send(phone, f"I didn't understand that. Reply *HELP* to see all commands.")
    else:
        send(phone, "Hi! Reply *JOIN* to subscribe to weekly stories, or *HELP* for more options. 🌟")
