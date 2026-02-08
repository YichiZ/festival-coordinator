import fs from "node:fs/promises";
import dotenv from "dotenv";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

dotenv.config();

const DEFAULT_URL =
  "https://belgium.tomorrowland.com/en/line-up/?page=stages&day=2026-07-17";

const MIN_EXTRACT_ROWS = 20;

const ExtractSchema = z.object({
  performances: z.array(
    z.object({
      artist: z.string(),
      stage: z.string().nullable().optional(),
      time: z.string().nullable().optional(),
      date: z.string().optional(),
    }),
  ),
});

const ConfigSchema = z.object({
  config: z.object({
    weekends: z.array(
      z.object({
        name: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      }),
    ),
    withTimetable: z.boolean().optional(),
  }),
});

const StagesSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
    }),
  ),
});

const PerformancesSchema = z.object({
  performances: z.array(
    z.object({
      name: z.string(),
      artists: z.array(z.object({ name: z.string() })).optional(),
      stage: z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          name: z.string().optional(),
        })
        .optional(),
      date: z.string(),
      startTime: z.string().optional(),
    }),
  ),
});

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, day: null, out: null };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--url") {
      args.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--day") {
      args.day = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1];
      i += 1;
    }
  }

  const urlDay = new URL(args.url).searchParams.get("day");
  args.day = args.day || urlDay || "2026-07-17";
  args.out = args.out || `tomorrowland-lineup-${args.day}`;

  return args;
}

function detectStagehandEnv() {
  if (process.env.STAGEHAND_ENV === "BROWSERBASE") return "BROWSERBASE";
  if (process.env.STAGEHAND_ENV === "LOCAL") return "LOCAL";
  if (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID) {
    return "BROWSERBASE";
  }
  return "LOCAL";
}

function extractDatePart(dateTime) {
  return (dateTime || "").split(" ")[0];
}

function isDateInWeekend(day, weekend) {
  const start = extractDatePart(weekend.startDate);
  const end = extractDatePart(weekend.endDate);
  return day >= start && day <= end;
}

function extractTimeHHMM(dateTime) {
  const m = String(dateTime || "").match(/\s(\d{2}:\d{2}):\d{2}/);
  return m ? m[1] : null;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  return res.json();
}

async function extractWithStagehand(stagehand, page, day) {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    window.scrollTo(0, 0);
  });

  const extracted = await stagehand.extract(
    `Extract all Tomorrowland performances visible for ${day}. Return one item per performance with: artist, stage, time (HH:mm if shown), and date (${day} when implied).`,
    ExtractSchema,
  );

  const rows = extracted.performances
    .map((row) => ({
      artist: row.artist.trim(),
      stage: row.stage?.trim() || null,
      time: row.time?.trim() || null,
      date: (row.date || day).trim(),
    }))
    .filter((row) => row.artist.length > 0)
    .filter((row) => row.date === day || !row.date);

  if (rows.length < MIN_EXTRACT_ROWS) {
    throw new Error(`Stagehand extract returned only ${rows.length} rows`);
  }

  return rows;
}

async function extractFromOfficialFeed(page, day) {
  const nextDataText = await page.evaluate(() => {
    const el = document.querySelector("#__NEXT_DATA__");
    return el?.textContent || null;
  });

  if (!nextDataText) {
    throw new Error("Could not find __NEXT_DATA__ on the line-up page.");
  }

  const nextData = JSON.parse(nextDataText);
  const blocks = nextData?.props?.pageProps?.doc?.blocks || [];
  const lineupBlock = blocks.find(
    (block) => block?.type === "line-up" && block?.event && block?.uuid,
  );

  if (!lineupBlock) {
    throw new Error("Could not find line-up event metadata in page data.");
  }

  const eventCode = lineupBlock.event;
  const uuid = lineupBlock.uuid;

  const configUrl = `https://artist-lineup-cdn.tomorrowland.com/config-${eventCode}-${uuid}.json`;
  const stagesUrl = `https://artist-lineup-cdn.tomorrowland.com/stages-${eventCode}-${uuid}.json`;

  const [rawConfig, rawStages] = await Promise.all([
    fetchJson(configUrl),
    fetchJson(stagesUrl),
  ]);

  const config = ConfigSchema.parse(rawConfig);
  const stages = StagesSchema.parse(rawStages);
  const weekend = config.config.weekends.find((w) => isDateInWeekend(day, w));

  if (!weekend) {
    throw new Error(`No weekend mapping found for day ${day}.`);
  }

  const perfUrl = `https://artist-lineup-cdn.tomorrowland.com/${eventCode}-${weekend.name}-${uuid}.json`;
  const rawPerf = await fetchJson(perfUrl);
  const perf = PerformancesSchema.parse(rawPerf);

  const stageById = new Map(
    stages.stages.filter((s) => s.id).map((s) => [String(s.id), s.name]),
  );

  const rows = perf.performances
    .filter((p) => p.date === day)
    .map((p) => {
      const artist = p.artists?.length
        ? p.artists.map((a) => a.name).join(", ")
        : p.name;
      return {
        artist,
        stage: p.stage?.name || stageById.get(String(p.stage?.id || "")) || null,
        time: extractTimeHHMM(p.startTime),
        date: p.date,
      };
    })
    .sort((a, b) => {
      const t1 = a.time || "";
      const t2 = b.time || "";
      if (t1 !== t2) return t1.localeCompare(t2);
      return a.artist.localeCompare(b.artist);
    });

  return { rows, meta: { eventCode, weekend: weekend.name, withTimetable: Boolean(config.config.withTimetable) } };
}

async function writeOutputs(out, rows) {
  const sortedRows = [...rows].sort((a, b) => {
    const t1 = a.time || "";
    const t2 = b.time || "";
    if (t1 !== t2) return t1.localeCompare(t2);
    return a.artist.localeCompare(b.artist);
  });

  const jsonPath = `${out}.json`;
  const csvPath = `${out}.csv`;

  await fs.writeFile(jsonPath, `${JSON.stringify(sortedRows, null, 2)}\n`, "utf8");

  const header = ["artist", "stage", "time", "date"];
  const csvLines = [
    header.join(","),
    ...sortedRows.map((row) =>
      [csvEscape(row.artist), csvEscape(row.stage), csvEscape(row.time), csvEscape(row.date)].join(","),
    ),
  ];

  await fs.writeFile(csvPath, `${csvLines.join("\n")}\n`, "utf8");
  return { jsonPath, csvPath, count: sortedRows.length };
}

async function main() {
  const { url, day, out } = parseArgs(process.argv);
  const env = detectStagehandEnv();
  const stagehand = new Stagehand({ env, verbose: 0 });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0] || (await stagehand.context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded" });

    let rows;
    let source;
    let meta = null;

    try {
      rows = await extractWithStagehand(stagehand, page, day);
      source = "stagehand.extract";
    } catch (err) {
      console.warn(`Stagehand extract unavailable or weak (${err.message}). Falling back to official feed.`);
      const fallback = await extractFromOfficialFeed(page, day);
      rows = fallback.rows;
      meta = fallback.meta;
      source = "official-feed";
    }

    const output = await writeOutputs(out, rows);

    console.log(`Scraped ${output.count} performances for ${day}`);
    console.log(`Source: ${source}`);
    if (meta) {
      console.log(`Event: ${meta.eventCode}, weekend: ${meta.weekend}`);
      console.log(`Timetable published: ${meta.withTimetable}`);
    }
    console.log(`Wrote ${output.jsonPath}`);
    console.log(`Wrote ${output.csvPath}`);
  } finally {
    await stagehand.close();
  }
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
