# Festival Coordinator

A voice-based AI assistant that helps friend groups plan festival trips together. Users call in via phone, and the AI helps them form groups, pick festivals, track members, and coordinate plans — all through natural conversation.

## Architecture

The system is split into three services:

### Voice Agent (`bot.py`)

The core of the product. A real-time voice pipeline built with **Pipecat** that handles phone calls end-to-end:

- **Telephony** via **Twilio** — receives inbound calls, identifies callers by phone number
- **Speech-to-Text / Text-to-Speech** via **Cartesia**
- **Conversation** via **Anthropic Claude** (Haiku 4.5) — the LLM drives the dialogue and calls tools to save groups, members, festivals, and artists to the database
- **Smart turn detection** using Pipecat's `LocalSmartTurnAnalyzerV3` + Silero VAD to know when the user has finished speaking
- **Local dev** via **Daily WebRTC** transport for browser-based testing without a phone

On disconnect, the bot summarizes the full transcript via a separate Claude API call and persists it.

### REST API (`backend/`)

A **FastAPI** server exposing CRUD endpoints over the database. Serves as the data layer for the frontend.

- Group-scoped endpoints: `/groups/{id}/members`, `/groups/{id}/festivals`
- Festival catalog: `/festival-catalog` for browsing available festivals
- Standard CRUD for groups, members, festivals, artists, and calls

### Frontend (`frontend/`)

A **React** + **TypeScript** single-page app for managing groups and festivals visually.

- **Vite** for builds and dev server
- **Tailwind CSS v4** + **shadcn/ui** for styling
- Home page with a group grid and a multi-step wizard to create new groups (name, members, festival selection)
- Group detail page showing members and festivals

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Voice pipeline | [Pipecat](https://github.com/pipecat-ai/pipecat) |
| Telephony | [Twilio](https://www.twilio.com/) |
| LLM | [Anthropic Claude](https://www.anthropic.com/) (Haiku 4.5) |
| Speech-to-Text / Text-to-Speech | [Cartesia](https://cartesia.ai/) |
| Database | [Supabase](https://supabase.com/) (Postgres) |
| Observability | [Langfuse](https://langfuse.com/) via OpenTelemetry (OTLP) |
| Backend API | [FastAPI](https://fastapi.tiangolo.com/) |
| Frontend | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/) |
| UI components | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) v4 |
| Python tooling | [uv](https://docs.astral.sh/uv/) (package manager), [ruff](https://docs.astral.sh/ruff/) (linter), [pyright](https://github.com/microsoft/pyright) (type checker) |

## Getting Started

### Prerequisites

- Python >= 3.12
- Node.js >= 18
- [uv](https://docs.astral.sh/uv/) package manager

### Environment Variables

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

See `.env.example` for the full list of variables. At minimum you need:

- `ANTHROPIC_API_KEY` — Claude API key
- `CARTESIA_API_KEY` — Cartesia STT/TTS key
- `SUPABASE_URL` / `SUPABASE_API_KEY` — Supabase project credentials

Optional variables for telephony (Twilio) and observability (Langfuse) are documented in the example file.

### Voice Agent

```bash
uv sync
uv run python bot.py
```

### REST API

```bash
uv run fastapi dev backend/main.py
```

Runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Database

Schema is defined in `schema.sql`. Incremental changes live in `migrations/`, numbered sequentially. Seed data for development is in `seed.sql`.

Tables: `groups`, `members`, `calls`, `festivals`, `artists`, `festival_catalog`.

## Observability

The voice pipeline supports tracing via [Langfuse](https://langfuse.com/) using the OpenTelemetry (OTLP) protocol. When `ENABLE_TRACING=true`, Pipecat spans (LLM calls, STT/TTS latency, tool invocations) are exported to Langfuse so you can inspect conversations, debug latency, and monitor costs.

To enable tracing, set the following in your `.env`:

```
ENABLE_TRACING=true
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
OTEL_EXPORTER_OTLP_ENDPOINT=https://us.cloud.langfuse.com/api/public/otel
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-encoded public:secret>
```

Sign up at [langfuse.com](https://langfuse.com/) and create a project to get your keys. The base64 header value is `base64(public_key:secret_key)`.

## Lineup Scraper

The `browserbase-client/` directory contains a Node.js scraper built with [Stagehand](https://github.com/browserbase/stagehand) (Browserbase) that extracts festival lineups from official websites. It uses an AI agent to navigate lineup pages and extract artist/stage/time data into CSV and JSON.

See [`browserbase-client/my-stagehand-app/README.md`](browserbase-client/my-stagehand-app/README.md) for setup and usage.
