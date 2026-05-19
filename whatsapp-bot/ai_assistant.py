"""
Claude API integration for personalised story tips and activity responses.
Uses prompt caching on story content to reduce token costs.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import anthropic
    _anthropic_available = True
except ImportError:
    _anthropic_available = False

_client: Optional["anthropic.AsyncAnthropic"] = None

MODEL = "claude-haiku-4-5-20251001"


def get_client():
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return None
        if not _anthropic_available:
            return None
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


# ── Role/age descriptions for prompts ─────────────────────────────────────────

ROLE_DESC = {
    "parent":    "a parent or caregiver at home",
    "teacher":   "a school teacher in a classroom",
    "anganwadi": "an Anganwadi early-childhood care worker",
    "volunteer": "a community volunteer running informal learning circles",
    "learner":   "a young learner reading on their own",
}

AGE_DESC = {
    "toddler": "toddlers aged 2–4",
    "early":   "children aged 5–7",
    "primary": "children aged 8–10",
    "upper":   "young people aged 11–13",
    "mixed":   "a mixed age group",
}

_BASE_SYSTEM = """\
You are a warm assistant for Sauramandala, a story-based learning program for children in India.
You help educators and parents use stories and activities to spark curiosity and joy in children.
Keep responses concise, warm, and practical. Write in simple clear English.
Never use jargon. Avoid bullet points — write naturally."""


async def get_role_tip(
    story: dict, role: str, age_group: str,
    session=None,  # AsyncSession for cache check
) -> str:
    """Return a role-specific tip for delivering this story. Falls back to empty string."""
    from database import get_cached_tip, save_tip_cache

    # Check DB cache first
    if session:
        cached = await get_cached_tip(session, story["id"], role, age_group)
        if cached:
            return cached

    client = get_client()
    if not client:
        return ""

    role_desc = ROLE_DESC.get(role, "an educator")
    age_desc = AGE_DESC.get(age_group, "children")
    activities_text = "\n".join(f"- {a}" for a in story.get("activities", []))

    try:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=180,
            system=[
                {
                    "type": "text",
                    "text": _BASE_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"You are advising {role_desc} who works with {age_desc}.\n"
                        f"Story: \"{story['title']}\" — {story.get('description', '')}\n"
                        f"Theme: {story.get('theme', '')}\n"
                        f"Activities:\n{activities_text}\n\n"
                        f"Give ONE specific, practical tip (2–3 sentences) for how they can use "
                        f"this story most effectively in their context."
                    ),
                }
            ],
        )
        tip = resp.content[0].text.strip()
        if session:
            await save_tip_cache(session, story["id"], role, age_group, tip)
        return tip
    except Exception as exc:
        logger.warning(f"AI tip failed: {exc}")
        return ""


async def respond_to_activity_share(
    story: dict, activity_text: str, user_share: str,
    name: str, role: str, age_group: str,
) -> str:
    """Generate an encouraging, personalised response to what the user shared."""
    client = get_client()
    if not client:
        return f"That sounds wonderful, {name}! Keep going — every small action plants a seed. 🌱"

    role_desc = ROLE_DESC.get(role, "an educator")
    age_desc = AGE_DESC.get(age_group, "children")

    try:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=220,
            system=[
                {
                    "type": "text",
                    "text": _BASE_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{name} is {role_desc} working with {age_desc}.\n"
                        f"Story they read: \"{story['title']}\"\n"
                        f"Activity they tried: {activity_text}\n"
                        f"What they shared: \"{user_share}\"\n\n"
                        f"Write a warm, specific response (3–4 sentences) that:\n"
                        f"1. Acknowledges exactly what they did\n"
                        f"2. Connects it back to the story theme\n"
                        f"3. Suggests one tiny next step they could try\n"
                        f"Address them by name. Be genuine, not generic."
                    ),
                }
            ],
        )
        return resp.content[0].text.strip()
    except Exception as exc:
        logger.warning(f"AI share response failed: {exc}")
        return f"Wonderful, {name}! Sharing what you tried makes it real for the children. Keep going! 🌟"


async def respond_to_photo(
    story: dict, name: str, role: str, age_group: str,
) -> str:
    """Generate a response when a user shares a photo of their activity."""
    client = get_client()
    if not client:
        return f"Amazing photo, {name}! Seeing it in action is the best proof. You've earned bonus points! 📸🌟"

    role_desc = ROLE_DESC.get(role, "an educator")
    age_desc = AGE_DESC.get(age_group, "children")

    try:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=150,
            system=_BASE_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{name} is {role_desc} working with {age_desc}.\n"
                        f"They just shared a photo of their activity from the story "
                        f"\"{story['title']}\".\n\n"
                        f"Write a warm 2-sentence celebration message. "
                        f"Mention that a photo is worth a thousand words. Address them by name."
                    ),
                }
            ],
        )
        return resp.content[0].text.strip()
    except Exception as exc:
        logger.warning(f"AI photo response failed: {exc}")
        return f"Amazing, {name}! A photo is worth a thousand words — you're making these stories come alive! 📸🌟"
