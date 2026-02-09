from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


# --- Groups ---

class GroupCreate(BaseModel):
    name: str | None = None


class Group(BaseModel):
    id: UUID
    name: str | None = None
    created_at: datetime | None = None


# --- Members ---

class MemberCreate(BaseModel):
    group_id: UUID
    name: str
    city: str | None = None
    phone: str | None = None


class MemberUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    phone: str | None = None
    status: str | None = None


class Member(BaseModel):
    id: UUID
    group_id: UUID | None = None
    name: str
    city: str | None = None
    phone: str | None = None
    status: str | None = None


# --- Calls ---

class CallCreate(BaseModel):
    group_id: UUID
    summary: str | None = None
    transcript: list | dict | None = None


class Call(BaseModel):
    id: UUID
    group_id: UUID | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    summary: str | None = None
    transcript: list | dict | None = None


# --- Festivals ---

class FestivalCreate(BaseModel):
    group_id: UUID
    name: str
    location: str | None = None
    dates_start: date | None = None
    dates_end: date | None = None
    ticket_price: float | None = None
    on_sale_date: date | None = None
    status: str = "considering"


class Festival(BaseModel):
    id: UUID
    group_id: UUID | None = None
    name: str
    location: str | None = None
    dates_start: date | None = None
    dates_end: date | None = None
    ticket_price: float | None = None
    on_sale_date: date | None = None
    status: str | None = None


# --- Artists ---

class ArtistCreate(BaseModel):
    festival_id: UUID
    name: str
    priority: str = "want_to_see"


class Artist(BaseModel):
    id: UUID
    festival_id: UUID | None = None
    name: str
    priority: str | None = None


# --- Festival Catalog ---

class FestivalCatalogCreate(BaseModel):
    name: str
    location: str | None = None
    dates_start: date | None = None
    dates_end: date | None = None
    ticket_price: float | None = None
    on_sale_date: date | None = None


class FestivalCatalog(BaseModel):
    id: UUID
    name: str
    location: str | None = None
    dates_start: date | None = None
    dates_end: date | None = None
    ticket_price: float | None = None
    on_sale_date: date | None = None
