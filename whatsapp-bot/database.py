import json
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, String, Text,
    select, update,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./stories.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True)
    phone = Column(String, unique=True, nullable=False)
    name = Column(String, default="")
    active = Column(Boolean, default=True)
    next_story_index = Column(Integer, default=0)
    stories_received = Column(Integer, default=0)
    # Gamification
    points = Column(Integer, default=0)
    streak_weeks = Column(Integer, default=0)
    activities_completed = Column(Integer, default=0)
    activities_shared = Column(Integer, default=0)
    last_engagement_week = Column(String, default="")   # ISO week string "2024-W12"
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)


class UserProfile(Base):
    """Role + demographic profile collected at sign-up."""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True)
    phone = Column(String, unique=True, nullable=False)
    role = Column(String, default="")           # parent|teacher|anganwadi|volunteer|learner
    age_group = Column(String, default="")      # toddler|early|primary|upper|mixed
    language = Column(String, default="en")


class ConversationState(Base):
    """Tracks multi-step conversations (signup flow, engagement responses)."""
    __tablename__ = "conversation_state"

    id = Column(Integer, primary_key=True)
    phone = Column(String, unique=True, nullable=False)
    state = Column(String, default="idle")
    # JSON blob: stores context like {story_id, activity_index, activity_text}
    context_json = Column(Text, default="{}")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ActivityResponse(Base):
    __tablename__ = "activity_responses"

    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)
    story_id = Column(Integer, nullable=False)
    activity_index = Column(Integer, default=0)
    response_type = Column(String, default="yes")   # yes|share|skip
    response_text = Column(Text, default="")
    ai_feedback = Column(Text, default="")
    points_earned = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)
    badge_id = Column(String, nullable=False)
    earned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DeliveryLog(Base):
    __tablename__ = "delivery_log"

    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)
    story_id = Column(Integer, nullable=False)
    story_title = Column(String)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    delivery_type = Column(String, default="scheduled")


class EngagementPrompt(Base):
    """Tracks scheduled follow-up prompts after story delivery."""
    __tablename__ = "engagement_prompts"

    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)
    story_id = Column(Integer, nullable=False)
    activity_index = Column(Integer, default=0)
    scheduled_for = Column(DateTime(timezone=True), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    nudge_sent_at = Column(DateTime(timezone=True), nullable=True)


class RoleTipCache(Base):
    """Caches AI-generated role tips per story to avoid regenerating."""
    __tablename__ = "role_tip_cache"

    id = Column(Integer, primary_key=True)
    story_id = Column(Integer, nullable=False)
    role = Column(String, nullable=False)
    age_group = Column(String, nullable=False)
    tip_text = Column(Text, nullable=False)
    cached_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session


# ── Subscriber ────────────────────────────────────────────────────────────────

async def add_subscriber(session: AsyncSession, phone: str, name: str = "") -> Subscriber:
    existing = await session.scalar(select(Subscriber).where(Subscriber.phone == phone))
    if existing:
        existing.active = True
        if name:
            existing.name = name
        await session.commit()
        return existing
    sub = Subscriber(phone=phone, name=name)
    session.add(sub)
    await session.commit()
    await session.refresh(sub)
    return sub


async def get_subscriber(session: AsyncSession, phone: str) -> Optional[Subscriber]:
    return await session.scalar(select(Subscriber).where(Subscriber.phone == phone))


async def get_active_subscribers(session: AsyncSession) -> list[Subscriber]:
    result = await session.scalars(select(Subscriber).where(Subscriber.active == True))
    return list(result)


async def unsubscribe(session: AsyncSession, phone: str):
    await session.execute(update(Subscriber).where(Subscriber.phone == phone).values(active=False))
    await session.commit()


async def advance_subscriber(session: AsyncSession, phone: str, story_id: int, story_title: str, delivery_type: str = "scheduled"):
    sub = await get_subscriber(session, phone)
    if sub:
        sub.next_story_index += 1
        sub.stories_received += 1
        sub.last_delivery_at = datetime.now(timezone.utc)
        log = DeliveryLog(phone=phone, story_id=story_id, story_title=story_title, delivery_type=delivery_type)
        session.add(log)
        await session.commit()


# ── Profile ───────────────────────────────────────────────────────────────────

async def get_profile(session: AsyncSession, phone: str) -> Optional[UserProfile]:
    return await session.scalar(select(UserProfile).where(UserProfile.phone == phone))


async def save_profile(session: AsyncSession, phone: str, role: str = "", age_group: str = ""):
    existing = await get_profile(session, phone)
    if existing:
        if role:
            existing.role = role
        if age_group:
            existing.age_group = age_group
        await session.commit()
    else:
        profile = UserProfile(phone=phone, role=role, age_group=age_group)
        session.add(profile)
        await session.commit()


# ── Conversation state ────────────────────────────────────────────────────────

async def get_conv_state(session: AsyncSession, phone: str) -> tuple[str, dict]:
    row = await session.scalar(select(ConversationState).where(ConversationState.phone == phone))
    if not row:
        return "idle", {}
    return row.state, json.loads(row.context_json or "{}")


async def set_conv_state(session: AsyncSession, phone: str, state: str, context: dict = {}):
    row = await session.scalar(select(ConversationState).where(ConversationState.phone == phone))
    if row:
        row.state = state
        row.context_json = json.dumps(context)
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = ConversationState(phone=phone, state=state, context_json=json.dumps(context))
        session.add(row)
    await session.commit()


# ── Gamification ──────────────────────────────────────────────────────────────

async def add_points(session: AsyncSession, phone: str, pts: int):
    sub = await get_subscriber(session, phone)
    if sub:
        sub.points = (sub.points or 0) + pts
        await session.commit()


async def record_activity_response(
    session: AsyncSession, phone: str, story_id: int,
    activity_index: int, response_type: str, response_text: str = "",
    ai_feedback: str = "", points_earned: int = 0,
):
    sub = await get_subscriber(session, phone)
    if sub:
        if response_type in ("yes", "share"):
            sub.activities_completed = (sub.activities_completed or 0) + 1
        if response_type == "share":
            sub.activities_shared = (sub.activities_shared or 0) + 1
        # Streak: mark engagement for this ISO week
        week_str = datetime.now(timezone.utc).strftime("%G-W%V")
        if sub.last_engagement_week != week_str:
            sub.last_engagement_week = week_str
            sub.streak_weeks = (sub.streak_weeks or 0) + 1

    resp = ActivityResponse(
        phone=phone, story_id=story_id, activity_index=activity_index,
        response_type=response_type, response_text=response_text,
        ai_feedback=ai_feedback, points_earned=points_earned,
    )
    session.add(resp)
    await session.commit()


async def get_earned_badge_ids(session: AsyncSession, phone: str) -> set[str]:
    result = await session.scalars(select(UserBadge).where(UserBadge.phone == phone))
    return {b.badge_id for b in result}


async def award_badge(session: AsyncSession, phone: str, badge_id: str):
    badge = UserBadge(phone=phone, badge_id=badge_id)
    session.add(badge)
    await session.commit()


# ── Engagement prompts ────────────────────────────────────────────────────────

async def schedule_engagement_prompt(
    session: AsyncSession, phone: str, story_id: int,
    activity_index: int, send_at: datetime,
):
    prompt = EngagementPrompt(
        phone=phone, story_id=story_id,
        activity_index=activity_index, scheduled_for=send_at,
    )
    session.add(prompt)
    await session.commit()


async def get_due_prompts(session: AsyncSession) -> list[EngagementPrompt]:
    now = datetime.now(timezone.utc)
    result = await session.scalars(
        select(EngagementPrompt).where(
            EngagementPrompt.sent_at == None,
            EngagementPrompt.scheduled_for <= now,
        )
    )
    return list(result)


async def mark_prompt_sent(session: AsyncSession, prompt_id: int):
    await session.execute(
        update(EngagementPrompt).where(EngagementPrompt.id == prompt_id)
        .values(sent_at=datetime.now(timezone.utc))
    )
    await session.commit()


# ── Role tip cache ────────────────────────────────────────────────────────────

async def get_cached_tip(session: AsyncSession, story_id: int, role: str, age_group: str) -> Optional[str]:
    row = await session.scalar(
        select(RoleTipCache).where(
            RoleTipCache.story_id == story_id,
            RoleTipCache.role == role,
            RoleTipCache.age_group == age_group,
        )
    )
    return row.tip_text if row else None


async def save_tip_cache(session: AsyncSession, story_id: int, role: str, age_group: str, tip: str):
    row = RoleTipCache(story_id=story_id, role=role, age_group=age_group, tip_text=tip)
    session.add(row)
    await session.commit()
