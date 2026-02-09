# Festival Lineup Scraper

AI-powered scraper that extracts festival lineups (artist, stage, date, time) from official festival websites using [Stagehand](https://github.com/browserbase/stagehand) and [Browserbase](https://browserbase.com/).

## How It Works

1. A Stagehand agent navigates to the festival's lineup page and interacts with the UI (expanding tabs, scrolling, etc.) to surface the full schedule.
2. Stagehand's `extract()` method pulls structured artist data from the page.
3. Results are saved as both CSV and JSON in the `output/` directory.

## Setup

```bash
npm install
cp ../.env.example ../.env   # then fill in your keys
```

You need at minimum:

- `BROWSERBASE_PROJECT_ID` / `BROWSERBASE_API_KEY` — from [browserbase.com](https://browserbase.com/)
- `ANTHROPIC_API_KEY` — or another LLM provider key, depending on the model you configure in `scraper.ts`

## Usage

```bash
# List available festivals
npm start

# Scrape a specific festival
npm start -- coachella
npm start -- edc
npm start -- tomorrowland

# Scrape all festivals
npm start -- --all
```

Output lands in `output/` as `<festival-name>.csv` and `<festival-name>.json`.

## Adding a New Festival

Create a new file in `festivals/` exporting a `FestivalConfig` object:

```ts
import type { FestivalConfig } from "../scraper.js";

const myFest: FestivalConfig = {
  name: "my-fest-2026",
  url: "https://myfest.com/lineup",
  agentSystemPrompt: "You are navigating a festival lineup page...",
  agentInstruction: "Navigate to the full lineup and expand all days...",
  extractInstruction: "Extract every artist with their stage, date, and set time.",
};

export default myFest;
```

Then register it in `festivals/index.ts`.
