"""
Sauramandala WhatsApp Story Bot
FastAPI app — Twilio webhook, static file serving for PDFs, scheduler.

Deploy: Railway / Render
Webhook URL: https://<your-app>/webhook  (POST, set in Twilio console)
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

load_dotenv()

from bot import handle_message
from content import load_stories
from database import get_session, init_db
from scheduler import build_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

STORIES_DIR = Path(__file__).parent / "stories"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    load_stories()
    scheduler = build_scheduler()
    scheduler.start()
    logger.info("Bot started")
    yield
    scheduler.shutdown()


app = FastAPI(title="Sauramandala Story Bot", lifespan=lifespan)
app.mount("/stories", StaticFiles(directory=str(STORIES_DIR)), name="stories")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/webhook")
async def webhook(
    From: str = Form(...),
    Body: str = Form(default=""),
    NumMedia: int = Form(default=0),
    MediaUrl0: Optional[str] = Form(default=None),
    MediaContentType0: Optional[str] = Form(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Twilio webhook — handles both text messages and media (photos)."""
    logger.info(f"From={From} Body={Body!r} NumMedia={NumMedia}")
    try:
        await handle_message(
            phone=From,
            body=Body,
            session=session,
            num_media=NumMedia,
            media_url=MediaUrl0,
            media_type=MediaContentType0,
        )
    except Exception as exc:
        logger.exception(f"Unhandled error for {From}: {exc}")
    return Response(content="<Response/>", media_type="application/xml")


@app.get("/admin/subscribers")
async def list_subscribers(session: AsyncSession = Depends(get_session)):
    """Admin: view all subscribers. Add auth before going public."""
    from database import Subscriber
    from sqlalchemy import select
    result = await session.scalars(select(Subscriber).order_by(Subscriber.joined_at.desc()))
    subs = result.all()
    return [
        {
            "phone": s.phone,
            "name": s.name,
            "active": s.active,
            "stories_received": s.stories_received,
            "points": s.points,
            "streak_weeks": s.streak_weeks,
            "activities_completed": s.activities_completed,
            "joined_at": s.joined_at.isoformat() if s.joined_at else None,
            "last_delivery_at": s.last_delivery_at.isoformat() if s.last_delivery_at else None,
        }
        for s in subs
    ]


@app.post("/admin/trigger-delivery")
async def trigger_delivery():
    """Manually run a delivery cycle (for testing)."""
    from scheduler import deliver_stories
    await deliver_stories()
    return {"status": "delivery triggered"}


@app.post("/admin/trigger-engagement")
async def trigger_engagement():
    """Manually run the engagement prompt check (for testing)."""
    from scheduler import process_engagement_prompts
    await process_engagement_prompts()
    return {"status": "engagement prompts processed"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
