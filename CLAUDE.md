# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Festival Coordinator — a voice-based AI assistant that helps friend groups plan festival trips via phone calls. The system uses Pipecat for real-time voice pipelines, Anthropic Claude for conversation, Cartesia for STT/TTS, and Supabase (Postgres) for persistence.

## Development Commands

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
# Run the FastAPI server
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
LLM function-calling tools are created per-session via `create_tools(session_state)`, which closure-captures a mutable `session_state` dict. Tools: `end_call`, `save_group`, `save_member`, `save_festival`, `save_artist`, `get_group_info`, `lookup_caller`. Each tool is registered as a Pipecat "direct function" on the LLM service.

### Database Layer (`db.py`)
Synchronous Supabase client wrapper. Singleton pattern via `get_client()`. Tables: `groups`, `members`, `calls`, `festivals`, `artists`, `festival_catalog`. Schema defined in `schema.sql`, incremental changes in `migrations/`.

### REST API (`backend/`)
FastAPI CRUD API over the same Supabase tables. Pydantic models in `backend/models.py`, its own Supabase client in `backend/database.py`. This is a separate access layer from `db.py` — the bot uses `db.py` directly, while the API uses `backend/database.py`.

### Frontend (`frontend/`)
React + TypeScript SPA built with Vite, Tailwind CSS v4, and shadcn/ui. Routes: `/` (group grid + create-group wizard dialog) and `/groups/:id` (members + festivals detail). API layer in `frontend/src/api/` wraps fetch calls to the FastAPI backend. No global state — each page fetches on mount.

### Lineup Scraper (`client/`)
Node.js script using Stagehand (Browserbase) to scrape festival lineups. Tries AI-powered extraction first, falls back to parsing the official JSON feed. Outputs CSV and JSON.

## Environment Variables

Required in `.env` (root): `ANTHROPIC_API_KEY`, `CARTESIA_API_KEY`, `SUPABASE_URL`, `SUPABASE_API_KEY`, `ENABLE_TRACING`. Optional for telephony: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.

## Key Conventions

- Python: ruff for linting (only import sorting rules via `select = ["I"]`), line length 100
- Python ≥ 3.12 required (uses `X | Y` union syntax)
- The bot uses Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for both conversation and post-call summarization
- Database migrations are plain SQL files in `migrations/`, numbered sequentially
- Two separate Supabase client singletons exist: `db.get_client()` (bot) and `backend.database.get_client()` (API)
