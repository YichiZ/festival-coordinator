# Improvement Plan

## 1. Testing — Zero coverage today

The codebase has no test files. This is the highest-leverage gap.

- **Backend unit tests**: pytest + httpx `TestClient` for all FastAPI routes. Cover happy path, 404, and 422 (invalid UUID) for every endpoint.
- **Backend integration tests**: Spin up a real Postgres container (testcontainers-python or pytest-docker) and test the full stack including geospatial search.
- **Bot tool tests**: Unit test each function in `tools.py` with mocked `db` calls. Verify session_state mutations, error paths, and return messages.
- **Frontend component tests**: Vitest + React Testing Library for wizard steps, member dialogs, and search interactions.
- Target: 80%+ coverage per the project testing policy.

## 2. Unified database access layer

The bot (`db.py`) uses the Supabase Python SDK while the REST API (`backend/`) uses SQLAlchemy ORM against the same database. This splits type definitions and data access patterns across two entirely separate stacks, making schema changes require edits in two places.

**Options (pick one):**
- **Option A — Migrate bot to SQLAlchemy**: Replace `db.py` with direct calls using the existing `backend/orm_models.py`. Single source of truth for models. Supabase SDK dependency removed from bot.
- **Option B — Migrate API to Supabase SDK**: Align the API with the bot layer. Simpler if Supabase-specific features (RLS, realtime) are planned.

Option A is preferred since SQLAlchemy ORM is already defined and more testable.

## 3. Error handling in `db.py`

Every function in `db.py` lets exceptions propagate uncaught. A Supabase connection error or a constraint violation crashes the voice call with no user-facing recovery.

- Wrap DB calls with try/except and return typed `Result` objects or raise specific domain exceptions.
- Let the bot catch these and respond gracefully ("Sorry, I couldn't save that — want to try again?").

## 4. Fix bot persona mismatch

`bot.py` uses the persona name **Alex** in the system prompt, but the post-call summarization prompt in `tools.py` (inside `end_call`) references **Sophie**. This causes incoherent summaries.

- Search for "Sophie" in `tools.py` and replace with "Alex".
- Add a `BOT_NAME` constant at the top of `bot.py` and import it in `tools.py` to prevent future drift.

## 5. Production CORS configuration

`backend/main.py` hardcodes `allow_origins=["http://localhost:5173"]`. This will reject all requests in any non-local environment (staging, production, Vercel preview URLs).

- Read allowed origins from an env var: `CORS_ORIGINS=https://app.example.com,https://staging.example.com`
- Fall back to `localhost:5173` only when the env var is absent.

## 6. Rate limiting on API endpoints

The REST API has no rate limiting. All write endpoints (`POST /groups`, `POST /members`, etc.) and the geospatial search endpoint can be called without restriction.

- Add `slowapi` (built on `limits`) as a FastAPI middleware.
- Apply a per-IP limit to write endpoints (e.g. 60 req/min) and a tighter limit to the geospatial search (PostGIS queries are expensive).

## 7. Missing CRUD endpoints

Several resources are missing standard REST operations:

| Resource | Missing |
|----------|---------|
| Groups | `PATCH /groups/{id}`, `DELETE /groups/{id}` |
| Festivals | `PATCH /festivals/{id}`, `DELETE /festivals/{id}` |
| Artists | `PATCH /artists/{id}`, `DELETE /artists/{id}` |
| Reviews | `PATCH /reviews/{id}`, `DELETE /reviews/{id}` |
| Festival Catalog | `PATCH /festival-catalog/{id}`, `DELETE /festival-catalog/{id}` |

The frontend already has inline edit UI for members; similar patterns for festivals and artists would require these endpoints.

## 8. Pagination on list endpoints

All list endpoints (`GET /groups`, `GET /members`, `GET /festivals`, etc.) return the full table. As data grows, this becomes slow and expensive.

- Add `limit` + `offset` (or cursor-based) query params to all list endpoints.
- Return a consistent envelope: `{ data: [...], total: N, limit: 20, offset: 0 }`.
- Update the frontend API layer to pass pagination params and handle the envelope.

## 9. Phone number validation before insert

`members.phone` has a UNIQUE index in the database, but the API and bot both attempt the insert without checking for duplicates first. A constraint violation returns a raw Postgres error rather than a user-friendly message.

- In `POST /members`, check for an existing member with the same phone before inserting. Return `409 Conflict` with a clear message if found.
- In `db.py → add_member()`, catch the unique constraint exception and raise a domain error.

## 10. `query_database` tool security hardening

The `query_database` LLM tool in `tools.py` asks Haiku to generate SQL from natural language and then executes it via `execute_readonly_query`. Although the RPC function checks for `SELECT` prefix, this check is trivially bypassed (CTEs, semicolons).

- Replace the RPC-based dynamic SQL approach with a structured query builder: define a fixed set of allowed "questions" the bot can ask (e.g. `list_upcoming_festivals`, `get_group_stats`) and map them to parameterized SQLAlchemy queries.
- If freeform SQL is required, at minimum remove the `SECURITY DEFINER` from the RPC (already done in `scripts/init.sql` but still present in `migrations/003_add_execute_readonly_query.sql`) and run queries as a restricted read-only Postgres role.

## 11. Frontend: data fetching and caching

Each page independently fetches on mount with no caching, deduplication, or background revalidation. Navigating away and back re-fetches everything.

- Introduce **TanStack Query** (React Query) to replace raw `fetch` calls in `useEffect`.
- Benefits: automatic caching, background refetch, loading/error states, deduplication of concurrent requests.
- The existing `apiFetch` wrapper in `frontend/src/api/client.ts` can be used as the query function with minimal changes.

## 12. CI/CD pipeline

There is no CI configuration (GitHub Actions, CircleCI, etc.). PRs merge without any automated checks.

- Add a GitHub Actions workflow that runs on every PR:
  - `uv run ruff check .` and `uv run pyright` for Python
  - `cd frontend && npm run build` for TypeScript type checking
  - Python tests (once added)
  - Frontend tests (once added)
- Add a Dependabot config for Python and npm dependency updates.

## 13. Transcript storage size management

`calls.transcript` stores the full JSONB conversation transcript with no size limit. Long calls could produce very large rows.

- Add a max-turn truncation in `bot.py` before saving (keep last N turns, or summarize older turns).
- Or store transcripts in object storage (S3/Supabase Storage) and save only a reference URL in the DB.

## 14. Frontend environment configuration

The API base URL defaults to `http://localhost:8000` inside `frontend/src/api/client.ts`. There is no `frontend/.env.example` documenting this override.

- Add `frontend/.env.example` with `VITE_API_URL=http://localhost:8000`.
- Document this in CLAUDE.md (already done) and README.

---

## Product Features

### P1 — High value, fits existing architecture

#### F1. Ticket on-sale alerts (SMS via Twilio)
The database already stores `on_sale_date` for every festival. When a group commits to a festival, send each member an SMS reminder the day before on-sale opens.

**How to build:**
- Add a background job (APScheduler or a daily cron) that queries `SELECT * FROM festivals WHERE on_sale_date = CURRENT_DATE + 1 AND status = 'committed'` and sends Twilio SMS to all members in the festival's group.
- Add a `notified_onsale` boolean column to `festivals` to prevent duplicate sends.

**How to test:**
- Unit: mock Twilio client, assert `messages.create()` called with correct phone + text for each member.
- Integration: insert a festival with `on_sale_date = tomorrow`, run the job, assert `notified_onsale = true` and mock SMS was called.
- E2E: set `on_sale_date = today`, trigger job manually, verify SMS received in a Twilio test number.

---

#### F2. Group voting on festivals
Members vote thumbs-up/down on each festival the group is considering. The bot can report vote tallies and auto-commit when everyone is in.

**How to build:**
- Add a `votes` table: `(id, festival_id FK, member_id FK, vote TEXT CHECK IN ('yes','no','maybe'), created_at)` with a unique constraint on `(festival_id, member_id)`.
- Add bot tool `cast_vote(festival_id, vote)` and `get_votes(festival_id)`.
- Add `GET /festivals/{id}/votes` and `POST /festivals/{id}/votes` API endpoints.
- Frontend: show vote counts on festival cards; members can click to vote.

**How to test:**
- Unit: test `cast_vote` tool — mock db, assert correct vote written to session_state, assert idempotent (second vote replaces first).
- API integration: `POST /festivals/{id}/votes` twice with different votes, assert only the latest is stored, `GET` returns correct tally.
- E2E (Playwright): log in as two members, vote on a festival, verify the frontend shows updated counts.

---

#### F3. Artist schedule + clash detection
When viewing a festival with a lineup, show a day-by-day schedule and warn when two "must-see" artists overlap in time.

**How to build:**
- Add `stage`, `set_start`, `set_end` columns to the `artists` table.
- Add `GET /festivals/{id}/schedule` endpoint that returns artists ordered by `set_start`.
- Bot tool `add_artist` already exists — extend it to accept `stage`, `set_start`, `set_end`.
- Frontend: new `ScheduleView` component; highlight clashes in red when two must-see sets overlap.

**How to test:**
- Unit: write a pure `detectClashes(artists)` function and test it with overlapping/non-overlapping sets including edge cases (same start time, back-to-back).
- API: POST two artists with overlapping times, GET /schedule, assert clash flag in response.
- Frontend component: render `ScheduleView` with clashing artists, assert the clash indicator is visible (React Testing Library).

---

#### F4. Post-festival review call
After a festival's `dates_end` passes, the bot automatically calls group members to capture ratings and notes while the experience is fresh.

**How to build:**
- Add a background job that queries festivals where `dates_end = yesterday AND status = 'committed'` and no review exists yet for the member.
- Use the Twilio Programmable Voice API to initiate outbound calls to each member.
- Pass a `mode=review` flag to `bot.py` so the pipeline uses a shorter review-focused system prompt instead of the full planning prompt.
- Reviews already have `stars` and `text` columns; the bot uses the existing `save_review`-style tool.

**How to test:**
- Unit: mock the Twilio call-initiation client, assert it's called for each member with the correct `to` phone number.
- Bot tool: test a `save_review(festival_id, stars, text)` tool function — mock db, assert review written, assert `end_call` triggered after save.
- Integration: run the outbound call job against a test festival, assert the Twilio mock received calls for all active members.

---

#### F5. Call history page
Users can't currently view past calls in the frontend. A calls page would surface conversation summaries and let groups review what was discussed.

**How to build:**
- Add `GET /groups/{id}/calls` API endpoint (already fetches by `group_id` in the DB; just needs exposing).
- New frontend page `/groups/:id/calls` with a timeline of call summaries sorted by date.
- Expandable row to show the full transcript (rendered from the JSONB `transcript` field).

**How to test:**
- API: seed two calls for a group, `GET /groups/{id}/calls`, assert correct ordering and fields.
- Frontend: mock the API response, render `CallHistoryPage`, assert summaries are visible and transcript expands on click (React Testing Library).
- E2E: navigate to a group, click the Calls tab, assert the summary from seed data is visible (Playwright).

---

### P2 — Medium value, some new infrastructure

#### F6. Artist-based festival search
"Find me festivals where Tame Impala is playing" — search the catalog by artist name. Useful once the scraper populates lineup data into the catalog.

**How to build:**
- Add a `catalog_artists` table: `(id, catalog_entry_id FK, name, stage)` mirroring the `artists` table.
- Extend `GET /festival-catalog/search` with an `artist` query param that does an ILIKE join against `catalog_artists.name`.
- Frontend: add an Artist field to the `CatalogSearchForm`.
- Bot tool: extend `query_database` or add a dedicated `search_catalog_by_artist(name)` tool.

**How to test:**
- API: seed catalog entries with catalog_artists, search by artist name with partial match, assert only matching festivals returned.
- Frontend: add artist field to search form tests; assert the correct API call is made with the `artist` param.

---

#### F7. Budget tracker per festival
Track per-group spending per festival (tickets, accommodation, transport). Members can log expenses; the bot can report totals and per-person splits.

**How to build:**
- Add an `expenses` table: `(id, festival_id FK, member_id FK, category TEXT, amount NUMERIC, description TEXT, created_at)`.
- Add API endpoints: `GET /festivals/{id}/expenses`, `POST /festivals/{id}/expenses`.
- Bot tools: `log_expense(festival_id, category, amount, description)` and `get_budget_summary(festival_id)`.
- Frontend: expense list on festival cards with totals and per-person breakdown.

**How to test:**
- Unit: test a pure `splitExpenses(expenses, members)` function — various scenarios (even split, one member owes more).
- API: POST three expenses, GET summary, assert totals and per-member amounts.
- Bot tool: log an expense via tool, assert DB write, assert confirmation message returned.

---

#### F8. Member availability / blackout dates
Before committing to a festival, members can flag dates they're unavailable. The bot checks availability when recommending a commitment.

**How to build:**
- Add an `availability_blocks` table: `(id, member_id FK, date_start DATE, date_end DATE, reason TEXT)`.
- Bot tool `mark_unavailable(date_start, date_end, reason)` and extend `get_group_info()` to show conflicts.
- When the bot considers a festival commitment, call a `check_availability(festival_id)` function that returns members with conflicts.
- Frontend: calendar widget on member profile showing blocked dates.

**How to test:**
- Unit: test `check_availability(festival_dates, member_blocks)` with overlapping / non-overlapping date ranges.
- Bot tool: mock `session_state` with a festival and a member with a conflicting block, assert the tool returns the conflict.
- Integration: insert a block and a festival with overlapping dates, call the endpoint, assert the conflicting member is listed.

---

### Testing strategy overview

#### Backend (Python)
```
tests/
  unit/
    test_tools.py        # Each tool function, db mocked with unittest.mock
    test_orm_models.py   # orm_to_dict, edge cases (null UUID, null date)
    test_availability.py # Pure logic functions (clash detection, split calculator)
  integration/
    conftest.py          # pytest fixture: spin up Postgres via testcontainers, run init.sql
    test_api_groups.py
    test_api_members.py
    test_api_festivals.py
    test_api_reviews.py
    test_api_catalog.py  # Includes geospatial search
    test_jobs.py         # Background jobs (alerts, post-festival calls)
```

Run with: `uv run pytest tests/ --cov=backend --cov=tools --cov-report=term-missing`

#### Frontend (TypeScript)
```
src/
  __tests__/
    components/
      wizard/           # Step components, full wizard flow
      members/          # MemberDialog, MemberList
      festivals/        # FestivalCard, ScheduleView (F3)
    pages/
      home-page.test.tsx
      group-detail-page.test.tsx
      catalog-page.test.tsx
    hooks/
      use-festival-search.test.ts
    api/
      festival-catalog.test.ts  # searchFestivalCatalog lat/lon guard
```

Run with: `npm run test` (Vitest)

#### E2E (Playwright)
```
e2e/
  create-group.spec.ts        # Full wizard: name → members → festivals
  group-detail.spec.ts        # View members, edit, delete
  catalog-search.spec.ts      # Name search, lat/lon search
  voting.spec.ts              # F2: vote on festival, see tally update
  call-history.spec.ts        # F5: view past call summaries
```

Run with: `npx playwright test` against `npm run dev` + `uv run fastapi dev backend/main.py`

#### Voice bot (Pipecat tools)
Each tool in `tools.py` should be tested in isolation by:
1. Constructing a fake `session_state` dict
2. Calling the tool's inner async function directly (not through Pipecat)
3. Asserting the return string and any mutations to `session_state`
4. Using `unittest.mock.patch("db.<function>")` to avoid real DB calls

Example:
```python
async def test_save_group_sets_session_state():
    session_state = {}
    with patch("db.create_group", return_value={"id": "abc", "name": "Test Crew"}):
        with patch("db.start_call", return_value={"id": "call-1"}):
            tools = create_tools(session_state)
            result = await tools["save_group"](FunctionCallParams(arguments={"name": "Test Crew"}, ...))
    assert session_state["group_id"] == "abc"
    assert "Test Crew" in result
```

The API base URL defaults to `http://localhost:8000` inside `frontend/src/api/client.ts`. There is no `frontend/.env.example` documenting this override.

- Add `frontend/.env.example` with `VITE_API_URL=http://localhost:8000`.
- Document this in CLAUDE.md (already done) and README.
