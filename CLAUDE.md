# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Festival Coordinator — a voice-based AI assistant that helps friend groups plan festival trips via phone calls. The system uses Pipecat for real-time voice pipelines, Anthropic Claude for conversation, Cartesia for STT/TTS, and PostgreSQL (via Supabase or Docker) for persistence.

## Development Commands

### Local Database (Docker)
```bash
# Start PostgreSQL + PostGIS locally (required for REST API)
docker compose up -d

# The init script (scripts/init.sql) runs automatically on first start
# It creates schema, extensions, and seeds test data
```

### Voice Bot (Python, root directory)
```bash
# Install dependencies (uses uv)
uv sync

# Run the voice bot locally (Daily WebRTC transport)
uv run python bot.py

# Lint (ruff, import sorting only)
uv run ruff check .
uv run ruff check --fix .

# Type check
uv run pyright
```

### REST API (FastAPI, backend/)
```bash
# Run the FastAPI server (requires DATABASE_URL in .env)
uv run fastapi dev backend/main.py
```

### Frontend (React, frontend/)
```bash
cd frontend && npm install
npm run dev    # starts Vite dev server on http://localhost:5173
npm run build  # production build to frontend/dist/
```

### Lineup Scraper (Node.js, client/)
```bash
cd client && pnpm install
pnpm scrape:tomorrowland                          # default day
node scrape-tomorrowland.mjs --day 2026-07-18     # specific day
```

## Architecture

### Voice Pipeline (`bot.py`)
Entry point for the Pipecat voice agent. Builds a pipeline: **Transport → STT → User Aggregator → LLM → TTS → Transport → Assistant Aggregator**. Supports two transports:
- **Twilio telephony**: Parses incoming websocket, uses `TwilioFrameSerializer`, identifies callers via `get_call_info()`
- **Daily/WebRTC**: For local development and browser-based calls

The bot uses smart turn detection (`LocalSmartTurnAnalyzerV3` + Silero VAD) to know when the user has finished speaking. On disconnect, it summarizes the transcript via a separate Anthropic API call and saves it to the DB.

### Tools & Function Calling (`tools.py`)
LLM function-calling tools are created per-session via `create_tools(session_state)`, which closure-captures a mutable `session_state` dict. Tools: `end_call`, `save_group`, `save_member`, `save_festival`, `save_artist`, `get_group_info`, `lookup_caller`, `query_database`. Each tool is registered as a Pipecat "direct function" on the LLM service.

`query_database` asks Haiku to generate a SQL SELECT from natural language, then executes it via the `execute_readonly_query` Supabase RPC.

### Bot Database Layer (`db.py`)
Synchronous Supabase client wrapper used exclusively by the voice bot. Singleton pattern via `get_client()`. Tables: `groups`, `members`, `calls`, `festivals`, `artists`, `festival_catalog`. Schema defined in `schema.sql`, incremental changes in `migrations/`.

### REST API (`backend/`)
FastAPI CRUD API using **SQLAlchemy ORM** against a direct PostgreSQL connection (not Supabase SDK).

- `backend/database.py` — SQLAlchemy engine + session factory, reads `DATABASE_URL` from env
- `backend/orm_models.py` — SQLAlchemy ORM model definitions + `orm_to_dict()` helper
- `backend/models.py` — Pydantic request/response schemas
- `backend/main.py` — Route handlers (UUID path/query params validated by FastAPI)

**This is a separate access layer from `db.py`** — the bot uses `db.py` (Supabase SDK), the REST API uses `backend/database.py` (SQLAlchemy + direct Postgres).

**Endpoints:**
- `GET/POST /groups`, `GET /groups/{id}`, `GET /groups/{id}/members`, `GET /groups/{id}/festivals`
- `GET/POST /members`, `GET /members/{id}`, `PATCH /members/{id}`, `DELETE /members/{id}`
- `GET/POST /calls`, `GET /calls/{id}`
- `GET/POST /festivals`, `GET /festivals/{id}`
- `GET/POST /artists`, `GET /artists/{id}`
- `GET/POST /festival-catalog`, `GET /festival-catalog/search` (supports name + geospatial distance ordering via PostGIS)
- `GET/POST /reviews`, `GET /reviews/{id}`

### Frontend (`frontend/`)
React + TypeScript SPA built with Vite, Tailwind CSS v4, and shadcn/ui.

**Routes:**
- `/` — Group grid + create-group wizard dialog
- `/groups/:id` — Members + festivals detail tabs
- `/catalog` — Searchable festival catalog (name + lat/lon proximity search)

**Key patterns:**
- API layer in `frontend/src/api/` wraps fetch calls to the FastAPI backend
- `useFestivalSearch` hook (`frontend/src/hooks/`) shared between CatalogPage and the wizard's festival selection step
- No global state — each page fetches on mount
- `VITE_API_URL` env var overrides the default `http://localhost:8000` base URL

### Lineup Scraper (`client/`)
Node.js script using Stagehand (Browserbase) to scrape festival lineups. Tries AI-powered extraction first, falls back to parsing the official JSON feed. Outputs CSV and JSON.

## Environment Variables

**Bot (root `.env`):** `ANTHROPIC_API_KEY`, `CARTESIA_API_KEY`, `SUPABASE_URL`, `SUPABASE_API_KEY`, `ENABLE_TRACING`. Optional for telephony: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.

**REST API (root `.env`):** `DATABASE_URL` (PostgreSQL connection string, e.g. `postgresql+psycopg://user:pass@localhost:5432/postgres`).

**Frontend (`.env` in `frontend/`):** `VITE_API_URL` (optional, defaults to `http://localhost:8000`).

See `.env.example` in root and `frontend/.env.example` for templates.

## Database

Schema is defined in `schema.sql` (canonical reference) with incremental migrations in `migrations/`. The `scripts/init.sql` is a consolidated init + seed script used by Docker Compose to initialize the local Postgres container.

**Tables:** `groups`, `members`, `calls`, `festivals`, `artists`, `festival_catalog`, `reviews`

**Extensions:** PostGIS (geospatial distance search), pg_trgm (text search)

To apply migrations manually against Supabase or another Postgres instance, run the numbered SQL files in order.

## Key Conventions

- Python: ruff for linting (only import sorting rules via `select = ["I"]`), line length 100
- Python ≥ 3.12 required (uses `X | Y` union syntax)
- The bot uses Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for both conversation and post-call summarization
- Database migrations are plain SQL files in `migrations/`, numbered sequentially
- Two separate database client singletons:
  - `db.get_client()` — Supabase SDK, used by the voice bot
  - `backend.database.get_db()` — SQLAlchemy session, used by the REST API
- All UUID path and query parameters in the REST API are typed as `UUID` (FastAPI validates, returns 422 on invalid format)
- `stars` field on reviews is validated 1–5 via Pydantic `Field(ge=1, le=5)`
