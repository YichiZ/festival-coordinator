# Festival Coordinator

A voice-based AI assistant that helps friend groups plan festival trips together. Users call in via phone, and the AI helps them form groups, pick festivals, track members, and coordinate plans — all through natural conversation.

## Prerequisites

- Python >= 3.12
- Node.js >= 18
- [uv](https://docs.astral.sh/uv/) — Python package manager
- [Supabase CLI](https://supabase.com/docs/guides/cli) — for local database
- [pnpm](https://pnpm.io/) — for the lineup scraper

## Getting Started

### 1. Environment variables

```bash
cp .env.example .env
```

Fill in your keys. Required:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `CARTESIA_API_KEY` | Cartesia STT/TTS key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_API_KEY` | Supabase anon key |
| `ENABLE_TRACING` | `true` or `false` |

Optional (telephony):

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_NUMBER` | Your Twilio phone number |

Optional (frontend, non-localhost deployments):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (defaults to `http://localhost:8000`) |
| `CORS_ORIGINS` | Comma-separated origins the backend will accept (defaults to `http://localhost:5173`) |

### 2. Database

```bash
supabase start
supabase db reset   # runs supabase/migrations/* then supabase/seed.sql
```

Copy the printed URL and anon key into your `.env`:

```
SUPABASE_URL=http://localhost:54321
SUPABASE_API_KEY=<anon key>
```

### 3. Voice Agent

**Local dev (Daily WebRTC — no phone needed):**

```bash
uv sync
uv run python bot.py
```

**Twilio telephony (receive real phone calls):**

1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_NUMBER` in your `.env`.
2. Expose your local server with ngrok:
   ```bash
   ngrok http 7860
   ```
3. In the [Twilio Console](https://console.twilio.com/), create a TwiML Bin with:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Response>
     <Connect>
       <Stream url="wss://<your-ngrok-url>/ws" />
     </Connect>
   </Response>
   ```
   Then assign the bin to your Twilio phone number under **Voice Configuration**.
4. Start the bot with the Twilio transport:
   ```bash
   uv run python bot.py -t twilio
   ```

### 4. REST API

```bash
uv run fastapi dev backend/main.py
```

Runs at `http://localhost:8000`.

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Architecture

### Voice Pipeline (`bot.py`)

The core of the product. A real-time voice pipeline built with **Pipecat** that handles phone calls end-to-end:

- **Telephony** via **Twilio** — receives inbound calls, identifies callers by phone number
- **Speech-to-Text / Text-to-Speech** via **Cartesia**
- **Conversation** via **Anthropic Claude** (Haiku 4.5) — the LLM drives the dialogue and calls tools to save groups, members, festivals, and artists to the database
- **Smart turn detection** using Pipecat's `LocalSmartTurnAnalyzerV3` + Silero VAD to know when the user has finished speaking
- **Local dev** via **Daily WebRTC** transport for browser-based testing without a phone

On disconnect, the bot summarizes the full transcript via a separate Claude API call and persists it.

### Tools & Function Calling (`tools.py`)

LLM function-calling tools are created per-session via `create_tools(session_state)`, which closure-captures a mutable `session_state` dict. Tools: `end_call`, `save_group`, `save_member`, `save_festival`, `save_artist`, `get_group_info`, `lookup_caller`. Each tool is registered as a Pipecat "direct function" on the LLM service.

### Database Layer (`db.py`)

Synchronous Supabase client wrapper. Singleton pattern via `get_client()`. Tables: `groups`, `members`, `calls`, `festivals`, `artists`, `festival_catalog`. Schema defined in `supabase/migrations/`, seed data in `supabase/seed.sql`.

### REST API (`backend/`)

A **FastAPI** server exposing CRUD endpoints over the database. Serves as the data layer for the frontend.

- Group-scoped endpoints: `/groups/{id}/members`, `/groups/{id}/festivals`
- Festival catalog: `/festival-catalog` for browsing available festivals
- Standard CRUD for groups, members, festivals, artists, and calls

Note: the bot uses `db.py` directly while the frontend uses this API — they share the same Supabase credentials but are separate access layers.

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
| Python tooling | [uv](https://docs.astral.sh/uv/), [ruff](https://docs.astral.sh/ruff/), [pyright](https://github.com/microsoft/pyright) |
| Database tooling | [Supabase CLI](https://supabase.com/docs/guides/cli) |

## Deployment

All services are deployed to AWS and managed with Terraform in `infra/`.

| Service | URL |
|---------|-----|
| Frontend | https://d3jcnwi5h28nlo.cloudfront.net |
| Backend API | https://utpejmbpk7.us-east-1.awsapprunner.com |
| Voice Bot | https://9ppxkrcmy4.us-east-1.awsapprunner.com |

> These URLs reflect the current deployment. They will change if infrastructure is reprovisioned with `terraform apply`.

**Infrastructure:**
- Backend + bot → AWS App Runner (containerized, auto-deploy on ECR push)
- Frontend → S3 + CloudFront
- Secrets → AWS Secrets Manager (injected into App Runner at runtime)
- CI/CD → GitHub Actions (push to `main` builds images, runs `terraform apply`, syncs frontend)

**Monthly cost: ~$10.35** (backend ~$1.57, bot ~$6.28, Secrets Manager ~$2.40, CloudFront ~$0.10).

See `docs/plan/2026-03-12-terraform-deployment.md` for the full deployment plan and `docs/retro/2026-03-12-terraform-deployment.md` for lessons learned.

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

The base64 header value is generated with:

```bash
echo -n "pk-lf-...:sk-lf-..." | base64
```

Sign up at [langfuse.com](https://langfuse.com/) and create a project to get your keys.

## Lineup Scraper

`browserbase-client/my-stagehand-app/` contains a Node.js scraper built with [Stagehand](https://github.com/browserbase/stagehand) (Browserbase) that extracts festival lineups from official websites. It uses an AI agent to navigate lineup pages and extract artist/stage/time data into CSV and JSON.

Requires a [Browserbase](https://browserbase.com/) API key in addition to the variables above. See [`browserbase-client/my-stagehand-app/README.md`](browserbase-client/my-stagehand-app/README.md) for setup and usage.

```bash
cd browserbase-client/my-stagehand-app
npm install
npm start
```
