import os
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.database import get_client
from backend.models import (
    ArtistCreate,
    CallCreate,
    FestivalCatalogCreate,
    FestivalCreate,
    GroupCreate,
    MemberCreate,
    MemberUpdate,
    ReviewCreate,
)

app = FastAPI(title="Festival Coordinator API")

_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATUS_ORDER = {"active": 0, "pending": 1, "inactive": 2}


# ── Groups ───────────────────────────────────────────────────────────────────


@app.get("/groups")
def list_groups():
    client = get_client()
    result = client.table("groups").select("*").order("created_at", desc=True).execute()
    return result.data


@app.get("/groups/{group_id}")
def get_group(group_id: UUID):
    client = get_client()
    result = client.table("groups").select("*").eq("id", str(group_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return result.data[0]


@app.post("/groups", status_code=201)
def create_group(body: GroupCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    result = client.table("groups").insert(data).execute()
    return result.data[0]


@app.get("/groups/{group_id}/members")
def list_group_members(group_id: UUID):
    client = get_client()
    result = (
        client.table("members")
        .select("*")
        .eq("group_id", str(group_id))
        .order("name")
        .execute()
    )
    rows = result.data
    return sorted(
        rows,
        key=lambda m: (_STATUS_ORDER.get(m.get("status", ""), 9), m.get("name", "")),
    )


@app.get("/groups/{group_id}/festivals")
def list_group_festivals(group_id: UUID):
    client = get_client()
    result = (
        client.table("festivals")
        .select("*, artists(*)")
        .eq("group_id", str(group_id))
        .order("dates_start")
        .execute()
    )
    return result.data


# ── Members ──────────────────────────────────────────────────────────────────


@app.get("/members")
def list_members():
    client = get_client()
    result = client.table("members").select("*").execute()
    return result.data


@app.get("/members/{member_id}")
def get_member(member_id: UUID):
    client = get_client()
    result = client.table("members").select("*").eq("id", str(member_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Member not found")
    return result.data[0]


@app.post("/members", status_code=201)
def create_member(body: MemberCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    data["group_id"] = str(data["group_id"])
    result = client.table("members").insert(data).execute()
    return result.data[0]


@app.patch("/members/{member_id}")
def update_member(member_id: UUID, body: MemberUpdate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    check = client.table("members").select("id").eq("id", str(member_id)).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Member not found")
    result = client.table("members").update(data).eq("id", str(member_id)).execute()
    return result.data[0]


@app.delete("/members/{member_id}", status_code=204)
def delete_member(member_id: UUID):
    client = get_client()
    check = client.table("members").select("id").eq("id", str(member_id)).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Member not found")
    client.table("members").delete().eq("id", str(member_id)).execute()


# ── Calls ────────────────────────────────────────────────────────────────────


@app.get("/calls")
def list_calls():
    client = get_client()
    result = client.table("calls").select("*").order("started_at", desc=True).execute()
    return result.data


@app.get("/calls/{call_id}")
def get_call(call_id: UUID):
    client = get_client()
    result = client.table("calls").select("*").eq("id", str(call_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Call not found")
    return result.data[0]


@app.post("/calls", status_code=201)
def create_call(body: CallCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    data["group_id"] = str(data["group_id"])
    result = client.table("calls").insert(data).execute()
    return result.data[0]


# ── Festivals ────────────────────────────────────────────────────────────────


@app.get("/festivals")
def list_festivals():
    client = get_client()
    result = client.table("festivals").select("*").order("dates_start").execute()
    return result.data


@app.get("/festivals/{festival_id}")
def get_festival(festival_id: UUID):
    client = get_client()
    result = client.table("festivals").select("*").eq("id", str(festival_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Festival not found")
    return result.data[0]


@app.post("/festivals", status_code=201)
def create_festival(body: FestivalCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    data["group_id"] = str(data["group_id"])
    result = client.table("festivals").insert(data).execute()
    return result.data[0]


# ── Artists ───────────────────────────────────────────────────────────────────


@app.get("/artists")
def list_artists():
    client = get_client()
    result = client.table("artists").select("*").execute()
    return result.data


@app.get("/artists/{artist_id}")
def get_artist(artist_id: UUID):
    client = get_client()
    result = client.table("artists").select("*").eq("id", str(artist_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Artist not found")
    return result.data[0]


@app.post("/artists", status_code=201)
def create_artist(body: ArtistCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    data["festival_id"] = str(data["festival_id"])
    result = client.table("artists").insert(data).execute()
    return result.data[0]


# ── Festival Catalog ─────────────────────────────────────────────────────────


@app.get("/festival-catalog")
def list_festival_catalog():
    client = get_client()
    result = client.table("festival_catalog").select("*").order("dates_start").execute()
    return result.data


@app.get("/festival-catalog/search")
def search_festival_catalog(
    name: str | None = Query(None, description="Filter by name (partial, case-insensitive)"),
    latitude: float | None = Query(None, description="Latitude for distance ordering"),
    longitude: float | None = Query(None, description="Longitude for distance ordering"),
):
    client = get_client()
    params: dict = {}
    if name is not None and name.strip():
        params["p_name"] = name.strip()
    if latitude is not None and longitude is not None:
        params["p_lat"] = latitude
        params["p_lon"] = longitude
    result = client.rpc("search_festival_catalog", params).execute()
    return result.data


@app.post("/festival-catalog", status_code=201)
def create_festival_catalog_entry(body: FestivalCatalogCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    result = client.table("festival_catalog").insert(data).execute()
    return result.data[0]


# ── Reviews ───────────────────────────────────────────────────────────────────


@app.get("/reviews")
def list_reviews(
    festival_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
):
    client = get_client()
    q = client.table("reviews").select("*")
    if festival_id is not None:
        q = q.eq("festival_id", str(festival_id))
    if user_id is not None:
        q = q.eq("user_id", str(user_id))
    result = q.order("created_at", desc=True).execute()
    return result.data


@app.get("/reviews/{review_id}")
def get_review(review_id: UUID):
    client = get_client()
    result = client.table("reviews").select("*").eq("id", str(review_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Review not found")
    return result.data[0]


@app.post("/reviews", status_code=201)
def create_review(body: ReviewCreate):
    client = get_client()
    data = body.model_dump(exclude_none=True)
    data["user_id"] = str(data["user_id"])
    data["festival_id"] = str(data["festival_id"])
    result = client.table("reviews").insert(data).execute()
    return result.data[0]
