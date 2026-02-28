from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
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
from backend.orm_models import (
    Artist,
    Call,
    Festival,
    FestivalCatalog,
    Group,
    Member,
    Review,
    orm_to_dict,
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
def list_groups(db: Session = Depends(get_db)):
    rows = db.execute(select(Group).order_by(Group.created_at.desc())).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/groups/{group_id}")
def get_group(group_id: str, db: Session = Depends(get_db)):
    row = db.execute(select(Group).where(Group.id == UUID(group_id))).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Group not found")
    return orm_to_dict(row)


@app.post("/groups", status_code=201)
def create_group(body: GroupCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    row = Group(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


@app.get("/groups/{group_id}/members")
def list_group_members(group_id: str, db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(Member).where(Member.group_id == UUID(group_id)).order_by(Member.name)
        )
        .scalars()
        .all()
    )
    status_order = {"active": 0, "pending": 1, "inactive": 2}
    out = [orm_to_dict(r) for r in rows]
    return sorted(out, key=lambda m: (status_order.get(m.get("status", ""), 9), m.get("name", "")))


@app.get("/groups/{group_id}/festivals")
def list_group_festivals(group_id: str, db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(Festival)
            .where(Festival.group_id == UUID(group_id))
            .options(selectinload(Festival.artists))
            .order_by(Festival.dates_start)
        )
        .scalars()
        .all()
    )
    return [
        {**orm_to_dict(f), "artists": [orm_to_dict(a) for a in f.artists]}
        for f in rows
    ]


# ── Members ──────────────────────────────────────────────────────────────────


@app.get("/members")
def list_members(db: Session = Depends(get_db)):
    rows = db.execute(select(Member)).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/members/{member_id}")
def get_member(member_id: str, db: Session = Depends(get_db)):
    row = db.execute(select(Member).where(Member.id == UUID(member_id))).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    return orm_to_dict(row)


@app.post("/members", status_code=201)
def create_member(body: MemberCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    row = Member(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


@app.patch("/members/{member_id}")
def update_member(member_id: str, body: MemberUpdate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    row = db.execute(select(Member).where(Member.id == UUID(member_id))).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


@app.delete("/members/{member_id}", status_code=204)
def delete_member(member_id: str, db: Session = Depends(get_db)):
    row = db.execute(select(Member).where(Member.id == UUID(member_id))).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(row)
    db.commit()


# ── Calls ────────────────────────────────────────────────────────────────────


@app.get("/calls")
def list_calls(db: Session = Depends(get_db)):
    rows = db.execute(select(Call).order_by(Call.started_at.desc())).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/calls/{call_id}")
def get_call(call_id: str, db: Session = Depends(get_db)):
    row = db.execute(select(Call).where(Call.id == UUID(call_id))).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    return orm_to_dict(row)


@app.post("/calls", status_code=201)
def create_call(body: CallCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    row = Call(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


# ── Festivals ────────────────────────────────────────────────────────────────


@app.get("/festivals")
def list_festivals(db: Session = Depends(get_db)):
    rows = db.execute(select(Festival).order_by(Festival.dates_start)).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/festivals/{festival_id}")
def get_festival(festival_id: str, db: Session = Depends(get_db)):
    row = db.execute(
        select(Festival).where(Festival.id == UUID(festival_id))
    ).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Festival not found")
    return orm_to_dict(row)


@app.post("/festivals", status_code=201)
def create_festival(body: FestivalCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    row = Festival(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


# ── Artists ───────────────────────────────────────────────────────────────────


@app.get("/artists")
def list_artists(db: Session = Depends(get_db)):
    rows = db.execute(select(Artist)).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/artists/{artist_id}")
def get_artist(artist_id: str, db: Session = Depends(get_db)):
    row = db.execute(
        select(Artist).where(Artist.id == UUID(artist_id))
    ).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Artist not found")
    return orm_to_dict(row)


@app.post("/artists", status_code=201)
def create_artist(body: ArtistCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    row = Artist(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


# ── Festival Catalog ─────────────────────────────────────────────────────────


@app.get("/festival-catalog")
def list_festival_catalog(db: Session = Depends(get_db)):
    rows = db.execute(
        select(FestivalCatalog).order_by(FestivalCatalog.dates_start)
    ).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/festival-catalog/search")
def search_festival_catalog(
    db: Session = Depends(get_db),
    name: str | None = Query(None, description="Filter by name (partial, case-insensitive)"),
    latitude: float | None = Query(None, description="Latitude for distance ordering"),
    longitude: float | None = Query(None, description="Longitude for distance ordering"),
):
    q = select(FestivalCatalog)
    if name is not None and name.strip():
        q = q.where(FestivalCatalog.name.ilike(f"%{name.strip()}%"))
    params: dict = {}
    if latitude is not None and longitude is not None:
        q = q.where(
            FestivalCatalog.latitude.isnot(None),
            FestivalCatalog.longitude.isnot(None),
        ).order_by(
            text(
                "ST_Distance("
                "ST_MakePoint(festival_catalog.longitude, festival_catalog.latitude)::geography, "
                "ST_MakePoint(:lon, :lat)::geography"
                ")"
            )
        )
        params = {"lat": latitude, "lon": longitude}
    else:
        q = q.order_by(FestivalCatalog.dates_start)
    rows = db.execute(q, params).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.post("/festival-catalog", status_code=201)
def create_festival_catalog_entry(
    body: FestivalCatalogCreate, db: Session = Depends(get_db)
):
    data = body.model_dump(exclude_none=True)
    row = FestivalCatalog(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)


# ── Reviews ───────────────────────────────────────────────────────────────────


@app.get("/reviews")
def list_reviews(
    db: Session = Depends(get_db),
    festival_id: str | None = Query(None),
    user_id: str | None = Query(None),
):
    q = select(Review)
    if festival_id is not None:
        q = q.where(Review.festival_id == UUID(festival_id))
    if user_id is not None:
        q = q.where(Review.user_id == UUID(user_id))
    q = q.order_by(Review.created_at.desc())
    rows = db.execute(q).scalars().all()
    return [orm_to_dict(r) for r in rows]


@app.get("/reviews/{review_id}")
def get_review(review_id: str, db: Session = Depends(get_db)):
    row = db.execute(
        select(Review).where(Review.id == UUID(review_id))
    ).scalars().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    return orm_to_dict(row)


@app.post("/reviews", status_code=201)
def create_review(body: ReviewCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    row = Review(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_to_dict(row)
