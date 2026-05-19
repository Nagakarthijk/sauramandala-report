"""
Sauramandala WhatsApp Story Bot
FastAPI app — receives Twilio webhooks, serves PDF files, runs scheduler.

Deploy on Railway or Render:
  1. Set env vars from .env.example
  2. Point Twilio WhatsApp sandbox/number webhook to: https://<your-app>/webhook
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

load_dotenv()

from bot import handle_message
from content import load_stories
from database import get_session, init_db
from scheduler import build_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

STORIES_DIR = Path(__file__).parent / "stories"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    load_stories()
    scheduler = build_scheduler()
    scheduler.start()
    logger.info("Bot started — scheduler running")
    yield
    scheduler.shutdown()


app = FastAPI(title="Sauramandala Story Bot", lifespan=lifespan)

# Serve PDFs publicly so Twilio can fetch them as media attachments
app.mount("/stories", StaticFiles(directory=str(STORIES_DIR)), name="stories")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/webhook")
async def webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(default=""),
    session: AsyncSession = Depends(get_session),
):
    """Twilio sends a POST with From (sender's WhatsApp number) and Body (message text)."""
    logger.info(f"Message from {From}: {Body!r}")
    try:
        await handle_message(phone=From, body=Body, session=session)
    except Exception as exc:
        logger.exception(f"Error handling message from {From}: {exc}")
    # Twilio expects a 200 with empty TwiML (we send messages via API, not TwiML)
    return Response(content="<Response/>", media_type="application/xml")


@app.get("/admin/subscribers")
async def list_subscribers(session: AsyncSession = Depends(get_session)):
    """Quick admin endpoint to view subscribers (protect with auth in production)."""
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
            "joined_at": s.joined_at.isoformat() if s.joined_at else None,
            "last_delivery_at": s.last_delivery_at.isoformat() if s.last_delivery_at else None,
        }
        for s in subs
    ]


@app.post("/admin/trigger-delivery")
async def trigger_delivery():
    """Manually trigger a delivery run (for testing)."""
    from scheduler import deliver_stories
    await deliver_stories()
    return {"status": "delivery triggered"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
