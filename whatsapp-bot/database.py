import os
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, select, update
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
    phone = Column(String, unique=True, nullable=False)       # e.g. whatsapp:+919876543210
    name = Column(String, default="")
    active = Column(Boolean, default=True)
    next_story_index = Column(Integer, default=0)             # which story to send next (0-based)
    stories_received = Column(Integer, default=0)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)


class DeliveryLog(Base):
    __tablename__ = "delivery_log"

    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)
    story_id = Column(Integer, nullable=False)
    story_title = Column(String)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    delivery_type = Column(String, default="scheduled")       # scheduled | on_demand


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session


# ---------- subscriber helpers ----------

async def add_subscriber(session: AsyncSession, phone: str, name: str = "") -> Subscriber:
    existing = await session.scalar(select(Subscriber).where(Subscriber.phone == phone))
    if existing:
        existing.active = True
        existing.name = name or existing.name
        await session.commit()
        return existing
    sub = Subscriber(phone=phone, name=name)
    session.add(sub)
    await session.commit()
    await session.refresh(sub)
    return sub


async def get_subscriber(session: AsyncSession, phone: str) -> Subscriber | None:
    return await session.scalar(select(Subscriber).where(Subscriber.phone == phone))


async def get_active_subscribers(session: AsyncSession) -> list[Subscriber]:
    result = await session.scalars(select(Subscriber).where(Subscriber.active == True))
    return list(result)


async def unsubscribe(session: AsyncSession, phone: str):
    await session.execute(
        update(Subscriber).where(Subscriber.phone == phone).values(active=False)
    )
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
