from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.database import get_client
from backend.models import (
    ArtistCreate,
    CallCreate,
    FestivalCatalogCreate,
    FestivalCreate,
    GroupCreate,
    MemberCreate,
)

app = FastAPI(title="Festival Coordinator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Groups ───────────────────────────────────────────────────────────────────


@app.get("/groups")
def list_groups():
    result = get_client().table("groups").select("*").order("created_at", desc=True).execute()
    return result.data


@app.get("/groups/{group_id}")
def get_group(group_id: str):
    result = get_client().table("groups").select("*").eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return result.data[0]


@app.post("/groups", status_code=201)
def create_group(body: GroupCreate):
    data = body.model_dump(exclude_none=True)
    result = get_client().table("groups").insert(data).execute()
    return result.data[0]


@app.get("/groups/{group_id}/members")
def list_group_members(group_id: str):
    result = get_client().table("members").select("*").eq("group_id", group_id).execute()
    return result.data


@app.get("/groups/{group_id}/festivals")
def list_group_festivals(group_id: str):
    result = (
        get_client()
        .table("festivals")
        .select("*, artists(*)")
        .eq("group_id", group_id)
        .order("dates_start")
        .execute()
    )
    return result.data


# ── Members ──────────────────────────────────────────────────────────────────


@app.get("/members")
def list_members():
    result = get_client().table("members").select("*").execute()
    return result.data


@app.get("/members/{member_id}")
def get_member(member_id: str):
    result = get_client().table("members").select("*").eq("id", member_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Member not found")
    return result.data[0]


@app.post("/members", status_code=201)
def create_member(body: MemberCreate):
    data = body.model_dump(exclude_none=True)
    data["group_id"] = str(data["group_id"])
    result = get_client().table("members").insert(data).execute()
    return result.data[0]


# ── Calls ────────────────────────────────────────────────────────────────────


@app.get("/calls")
def list_calls():
    result = get_client().table("calls").select("*").order("started_at", desc=True).execute()
    return result.data


@app.get("/calls/{call_id}")
def get_call(call_id: str):
    result = get_client().table("calls").select("*").eq("id", call_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Call not found")
    return result.data[0]


@app.post("/calls", status_code=201)
def create_call(body: CallCreate):
    data = body.model_dump(exclude_none=True)
    data["group_id"] = str(data["group_id"])
    result = get_client().table("calls").insert(data).execute()
    return result.data[0]


# ── Festivals ────────────────────────────────────────────────────────────────


@app.get("/festivals")
def list_festivals():
    result = get_client().table("festivals").select("*").order("dates_start").execute()
    return result.data


@app.get("/festivals/{festival_id}")
def get_festival(festival_id: str):
    result = get_client().table("festivals").select("*").eq("id", festival_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Festival not found")
    return result.data[0]


@app.post("/festivals", status_code=201)
def create_festival(body: FestivalCreate):
    data = body.model_dump(exclude_none=True)
    data["group_id"] = str(data["group_id"])
    if "ticket_price" in data:
        data["ticket_price"] = str(data["ticket_price"])
    if "dates_start" in data:
        data["dates_start"] = str(data["dates_start"])
    if "dates_end" in data:
        data["dates_end"] = str(data["dates_end"])
    if "on_sale_date" in data:
        data["on_sale_date"] = str(data["on_sale_date"])
    result = get_client().table("festivals").insert(data).execute()
    return result.data[0]


# ── Artists ───────────────────────────────────────────────────────────────────


@app.get("/artists")
def list_artists():
    result = get_client().table("artists").select("*").execute()
    return result.data


@app.get("/artists/{artist_id}")
def get_artist(artist_id: str):
    result = get_client().table("artists").select("*").eq("id", artist_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Artist not found")
    return result.data[0]


@app.post("/artists", status_code=201)
def create_artist(body: ArtistCreate):
    data = body.model_dump(exclude_none=True)
    data["festival_id"] = str(data["festival_id"])
    result = get_client().table("artists").insert(data).execute()
    return result.data[0]


# ── Festival Catalog ─────────────────────────────────────────────────────────


@app.get("/festival-catalog")
def list_festival_catalog():
    result = (
        get_client()
        .table("festival_catalog")
        .select("*")
        .order("dates_start")
        .execute()
    )
    return result.data


@app.post("/festival-catalog", status_code=201)
def create_festival_catalog_entry(body: FestivalCatalogCreate):
    data = body.model_dump(exclude_none=True)
    if "ticket_price" in data:
        data["ticket_price"] = str(data["ticket_price"])
    if "dates_start" in data:
        data["dates_start"] = str(data["dates_start"])
    if "dates_end" in data:
        data["dates_end"] = str(data["dates_end"])
    if "on_sale_date" in data:
        data["on_sale_date"] = str(data["on_sale_date"])
    result = get_client().table("festival_catalog").insert(data).execute()
    return result.data[0]
