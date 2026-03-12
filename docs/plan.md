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
