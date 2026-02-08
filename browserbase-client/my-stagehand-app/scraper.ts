import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FestivalConfig {
  name: string;
  url: string;
  agentSystemPrompt: string;
  agentInstruction: string;
  extractInstruction: string;
  maxSteps?: number;
}

const ArtistSchema = z.object({
  artists: z.array(
    z.object({
      artist: z.string().describe("Artist or act name"),
      stage: z.string().describe("Stage name"),
      date: z.string().describe("Date of performance (e.g. Friday May 16)"),
      time: z.string().describe("Set time or 'TBA' if not listed"),
    })
  ),
});

export type Artist = z.infer<typeof ArtistSchema>["artists"][number];

function saveResults(name: string, artists: Artist[]) {
  const outputDir = join(__dirname, "output");
  mkdirSync(outputDir, { recursive: true });

  // Save JSON
  const jsonPath = join(outputDir, `${name}.json`);
  writeFileSync(jsonPath, JSON.stringify(artists, null, 2));
  console.log(`Saved ${artists.length} artists to ${jsonPath}`);

  // Save CSV
  const csvPath = join(outputDir, `${name}.csv`);
  const header = "Artist,Stage,Date,Time";
  const rows = artists.map(
    (a) =>
      `"${a.artist.replace(/"/g, '""')}","${a.stage.replace(/"/g, '""')}","${a.date.replace(/"/g, '""')}","${a.time.replace(/"/g, '""')}"`
  );
  writeFileSync(csvPath, [header, ...rows].join("\n"));
  console.log(`Saved ${artists.length} artists to ${csvPath}`);
}

export async function scrapeFestival(config: FestivalConfig): Promise<Artist[]> {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    model: "anthropic/claude-opus-4-6",
  });

  await stagehand.init();

  console.log(`\n--- Scraping: ${config.name} ---`);
  console.log(
    `Watch live: https://browserbase.com/sessions/${stagehand.browserbaseSessionId}`
  );

  const page = stagehand.context.pages()[0];
  await page.goto(config.url);
  await page.waitForLoadState("networkidle");

  const agent = stagehand.agent({
    systemPrompt: config.agentSystemPrompt,
  });

  const agentResult = await agent.execute({
    instruction: config.agentInstruction,
    maxSteps: config.maxSteps ?? 30,
  });

  console.log("Agent exploration done.");
  console.log("Agent message:", agentResult.message);

  const result = await stagehand.extract(config.extractInstruction, ArtistSchema);
  const artists = result.artists;

  console.log(`\n${config.name} Lineup (${artists.length} artists found):\n`);
  console.table(
    artists.map((a) => ({
      Artist: a.artist,
      Stage: a.stage,
      Date: a.date,
      Time: a.time,
    }))
  );

  saveResults(config.name, artists);

  await stagehand.close();
  return artists;
}
