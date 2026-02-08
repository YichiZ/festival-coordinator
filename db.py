import os
from typing import Any
from supabase import create_client, Client
from loguru import logger
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_API_KEY"]

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


# --- Groups ---

def create_group(name: str) -> Any:
    client = get_client()
    result = client.table("groups").insert({"name": name}).execute()
    logger.info(f"Created group: {name}")
    return result.data[0]


def get_group(group_id: str) -> Any:
    client = get_client()
    result = client.table("groups").select("*").eq("id", group_id).execute()
    return result.data[0] if result.data else None


def list_groups() -> list[Any]:
    client = get_client()
    result = client.table("groups").select("*").order("created_at", desc=True).execute()
    return result.data


# --- Members ---

def add_member(group_id: str, name: str, city: str | None = None, phone: str | None = None) -> Any:
    client = get_client()
    data: dict[str, Any] = {"group_id": group_id, "name": name}
    if city:
        data["city"] = city
    if phone:
        data["phone"] = phone
    result = client.table("members").insert(data).execute()
    logger.info(f"Added member: {name} to group {group_id}")
    return result.data[0]


def get_member_by_phone(phone: str) -> Any:
    client = get_client()
    result = client.table("members").select("*, groups(*)").eq("phone", phone).execute()
    return result.data[0] if result.data else None


def list_members(group_id: str) -> list[Any]:
    client = get_client()
    result = client.table("members").select("*").eq("group_id", group_id).execute()
    return result.data


def update_member(member_id: str, **kwargs: Any) -> Any:
    client = get_client()
    result = client.table("members").update(kwargs).eq("id", member_id).execute()
    return result.data[0]


# --- Calls ---

def start_call(group_id: str) -> Any:
    client = get_client()
    result = client.table("calls").insert({"group_id": group_id}).execute()
    logger.info(f"Started call for group {group_id}")
    return result.data[0]


def end_call_record(call_id: str, summary: str, transcript: list | None = None) -> Any:
    client = get_client()
    data: dict[str, Any] = {"ended_at": "now()", "summary": summary}
    if transcript is not None:
        data["transcript"] = transcript
    result = (
        client.table("calls")
        .update(data)
        .eq("id", call_id)
        .execute()
    )
    logger.info(f"Ended call {call_id}")
    return result.data[0]


def get_recent_calls(group_id: str, limit: int = 5) -> list[Any]:
    client = get_client()
    result = (
        client.table("calls")
        .select("*")
        .eq("group_id", group_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


# --- Festivals ---

def add_festival(
    group_id: str,
    name: str,
    location: str | None = None,
    dates_start: str | None = None,
    dates_end: str | None = None,
    ticket_price: float | None = None,
    on_sale_date: str | None = None,
    status: str = "considering",
) -> Any:
    client = get_client()
    data = {"group_id": group_id, "name": name, "status": status}
    if location:
        data["location"] = location
    if dates_start:
        data["dates_start"] = dates_start
    if dates_end:
        data["dates_end"] = dates_end
    if ticket_price is not None:
        data["ticket_price"] = str(ticket_price)
    if on_sale_date:
        data["on_sale_date"] = on_sale_date
    result = client.table("festivals").insert(data).execute()
    logger.info(f"Added festival: {name}")
    return result.data[0]


def list_festivals(group_id: str) -> list[Any]:
    client = get_client()
    result = client.table("festivals").select("*, artists(*)").eq("group_id", group_id).execute()
    return result.data


def update_festival(festival_id: str, **kwargs: Any) -> Any:
    client = get_client()
    result = client.table("festivals").update(kwargs).eq("id", festival_id).execute()
    return result.data[0]


# --- Artists ---

def add_artist(festival_id: str, name: str, priority: str = "want_to_see") -> Any:
    client = get_client()
    result = (
        client.table("artists")
        .insert({"festival_id": festival_id, "name": name, "priority": priority})
        .execute()
    )
    logger.info(f"Added artist: {name} to festival {festival_id}")
    return result.data[0]


def list_artists(festival_id: str) -> list[Any]:
    client = get_client()
    result = client.table("artists").select("*").eq("festival_id", festival_id).execute()
    return result.data
