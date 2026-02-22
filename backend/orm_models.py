import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, DateTime, Float, ForeignKey, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _uuid_fk(name: str, *, ondelete: str = "cascade") -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey(name, ondelete=ondelete), type_=UUID(as_uuid=True))


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )

    members: Mapped[list["Member"]] = relationship("Member", back_populates="group")
    calls: Mapped[list["Call"]] = relationship("Call", back_populates="group")
    festivals: Mapped[list["Festival"]] = relationship("Festival", back_populates="group")


class Member(Base):
    __tablename__ = "members"

    id: Mapped[uuid.UUID] = _uuid_pk()
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("groups.id", ondelete="cascade"), type_=UUID(as_uuid=True), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="active")

    group: Mapped["Group | None"] = relationship("Group", back_populates="members")
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="user")


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = _uuid_pk()
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("groups.id", ondelete="cascade"), type_=UUID(as_uuid=True), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    from_number: Mapped[str | None] = mapped_column(String, nullable=True)

    group: Mapped["Group | None"] = relationship("Group", back_populates="calls")


class Festival(Base):
    __tablename__ = "festivals"

    id: Mapped[uuid.UUID] = _uuid_pk()
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("groups.id", ondelete="cascade"), type_=UUID(as_uuid=True), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    dates_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    dates_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    ticket_price: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    on_sale_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="considering")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    group: Mapped["Group | None"] = relationship("Group", back_populates="festivals")
    artists: Mapped[list["Artist"]] = relationship("Artist", back_populates="festival")
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="festival")


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[uuid.UUID] = _uuid_pk()
    festival_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("festivals.id", ondelete="cascade"), type_=UUID(as_uuid=True), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    priority: Mapped[str] = mapped_column(String, nullable=False, server_default="want_to_see")

    festival: Mapped["Festival | None"] = relationship("Festival", back_populates="artists")


class FestivalCatalog(Base):
    __tablename__ = "festival_catalog"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    dates_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    dates_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    ticket_price: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    on_sale_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("members.id", ondelete="cascade"), type_=UUID(as_uuid=True), nullable=False
    )
    festival_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("festivals.id", ondelete="cascade"), type_=UUID(as_uuid=True), nullable=False
    )
    stars: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )

    user: Mapped["Member"] = relationship("Member", back_populates="reviews")
    festival: Mapped["Festival"] = relationship("Festival", back_populates="reviews")


def orm_to_dict(row: Base, *, exclude: set[str] | None = None) -> dict[str, Any]:
    """Turn an ORM model instance into a dict for JSON response (e.g. UUID/date/datetime as str)."""
    exclude = exclude or set()
    d: dict[str, Any] = {}
    for c in row.__table__.columns:
        if c.name in exclude:
            continue
        v = getattr(row, c.name)
        if hasattr(v, "hex"):  # UUID
            d[c.name] = str(v)
        elif isinstance(v, (date, datetime)):
            d[c.name] = v.isoformat() if v else None
        elif isinstance(v, Decimal):
            d[c.name] = float(v) if v is not None else None
        else:
            d[c.name] = v
    return d
