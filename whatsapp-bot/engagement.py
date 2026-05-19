"""
Builds and sends engagement follow-up prompts after story delivery.
"""

from content import get_story
from messenger import send


def engagement_prompt_text(name: str, story: dict, activity_index: int) -> str:
    """Message sent 48h after a story asking the user to try an activity."""
    activities = story.get("activities", [])
    if not activities:
        return ""

    activity = activities[activity_index % len(activities)]
    return (
        f"Hi {name or 'there'}! 🌱\n\n"
        f"It's been a couple of days since you received *{story['title']}*.\n\n"
        f"Here's an activity to try:\n"
        f"✏️ _{activity}_\n\n"
        f"Reply:\n"
        f"✅ *YES* — I did it!\n"
        f"📝 *SHARE* — Tell us what happened\n"
        f"📸 Send a *photo* of what you made / did!\n"
        f"⏭️ *SKIP* — Maybe later"
    )


def nudge_text(name: str, story_title: str) -> str:
    return (
        f"Just a gentle nudge, {name or 'there'} 🤗\n\n"
        f"Did you get a chance to try the activity from *{story_title}*?\n"
        f"Even 5 minutes counts. Reply *YES*, *SHARE* a photo, or *SKIP* — no pressure!"
    )


async def send_engagement_prompt(phone: str, name: str, story_id: int, activity_index: int):
    story = get_story(story_id)
    if not story:
        return
    text = engagement_prompt_text(name, story, activity_index)
    if text:
        send(phone, text)
