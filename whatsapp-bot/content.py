import json
import os
from pathlib import Path
from typing import Optional

STORIES_DIR = Path(__file__).parent / "stories"
MANIFEST_PATH = STORIES_DIR / "manifest.json"

_stories: list[dict] = []


def load_stories() -> list[dict]:
    global _stories
    with open(MANIFEST_PATH) as f:
        _stories = json.load(f)
    return _stories


def get_all_stories() -> list[dict]:
    if not _stories:
        load_stories()
    return _stories


def get_story(story_id: int) -> Optional[dict]:
    for s in get_all_stories():
        if s["id"] == story_id:
            return s
    return None


def get_story_by_index(index: int) -> Optional[dict]:
    stories = get_all_stories()
    if 0 <= index < len(stories):
        return stories[index]
    return None


def story_count() -> int:
    return len(get_all_stories())


def pdf_url(story: dict, base_url: str) -> Optional[str]:
    pdf_file = story.get("pdf_file", "")
    if pdf_file and (STORIES_DIR / pdf_file).exists():
        return f"{base_url.rstrip('/')}/stories/{pdf_file}"
    return None


def format_story_message(
    story: dict,
    base_url: str,
    role_tip: str = "",
    include_activities: bool = True,
) -> tuple[str, Optional[str]]:
    """Return (text_body, media_url_or_None)."""
    lines = [
        f"📖 *{story['title']}*",
        "",
        story.get("description", ""),
    ]

    if story.get("theme"):
        lines += ["", f"_Theme: {story['theme']}_"]

    if include_activities and story.get("activities"):
        lines += ["", "✏️ *Activities:*"]
        for i, act in enumerate(story["activities"], 1):
            lines.append(f"{i}. {act}")

    if story.get("video_url"):
        lines += ["", f"🎬 *Watch the story video:* {story['video_url']}"]

    if role_tip:
        lines += ["", f"💡 *Tip for you:* {role_tip}"]

    total = story_count()
    lines += ["", f"_(Story {story['id']} of {total})_"]
    lines += [
        "",
        "Reply *NEXT* for the next story · *LIST* to browse all · *STOP* to unsubscribe",
    ]

    media = pdf_url(story, base_url)
    return "\n".join(lines), media


def format_list_message() -> str:
    stories = get_all_stories()
    lines = [f"📚 *All {len(stories)} Stories:*", ""]
    for s in stories:
        lines.append(f"{s['id']}. *{s['title']}* — _{s.get('theme', '')}_")
    lines += ["", "Reply *STORY [number]* to get any story, e.g. *STORY 5*"]
    return "\n".join(lines)
