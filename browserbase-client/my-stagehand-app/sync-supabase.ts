import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

type JsonRow = Record<string, unknown>;

type FestivalConfig = {
  name: string;
  location?: string;
  dates_start?: string;
  dates_end?: string;
};

const FESTIVAL_MAP: Record<string, FestivalConfig> = {
  "coachella-2026": {
    name: "Coachella 2026",
    location: "Indio, CA",
    dates_start: "2026-04-10",
    dates_end: "2026-04-19",
  },
  "tomorrowland-2026": {
    name: "Tomorrowland 2026",
    location: "Boom, Belgium",
    dates_start: "2026-07-17",
    dates_end: "2026-07-26",
  },
  edc_lineup_2026: {
    name: "EDC Las Vegas 2026",
    location: "Las Vegas, NV",
    dates_start: "2026-05-15",
    dates_end: "2026-05-17",
  },
};

function parseArgs(argv: string[]) {
  const args = {
    inputDir: join(process.cwd(), "output"),
    groupId: "",
    groupName: "Stagehand Imports",
    status: "considering",
    dryRun: false,
    festivals: [] as string[],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input-dir") {
      args.inputDir = argv[i + 1] ?? args.inputDir;
      i += 1;
      continue;
    }
    if (token === "--group-id") {
      args.groupId = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--group-name") {
      args.groupName = argv[i + 1] ?? args.groupName;
      i += 1;
      continue;
    }
    if (token === "--status") {
      args.status = argv[i + 1] ?? args.status;
      i += 1;
      continue;
    }
    if (token === "--festival") {
      const value = argv[i + 1];
      if (value) args.festivals.push(value);
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseDotEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const eqIndex = trimmed.indexOf("=");
  if (eqIndex <= 0) return null;

  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

async function loadRootDotEnv() {
  const rootEnvPath = join(process.cwd(), "..", "..", ".env");
  try {
    const raw = await readFile(rootEnvPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseDotEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional; explicit env vars still work.
  }
}

class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(url: string, key: string) {
    this.baseUrl = `${url.replace(/\/$/, "")}/rest/v1`;
    this.apiKey = key;
  }

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.apiKey);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("Content-Type", "application/json");

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase request failed ${res.status} ${res.statusText}: ${text}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    return res.json();
  }
}

function toFestivalName(slug: string): string {
  const mapped = FESTIVAL_MAP[slug];
  if (mapped) return mapped.name;
  return slug
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getArtistName(row: JsonRow): string {
  const raw = row.artist ?? row.Artist ?? row.name ?? row.Name;
  if (typeof raw !== "string") return "";
  return raw.trim();
}

async function getOrCreateGroupId(
  client: SupabaseRestClient,
  groupId: string,
  groupName: string,
): Promise<string> {
  if (groupId) return groupId;

  const existing = await client.request(
    `/groups?select=id&name=eq.${encodeURIComponent(groupName)}&limit=1`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    return existing[0].id as string;
  }

  const created = await client.request("/groups?select=id,name", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: groupName }),
  });
  if (!Array.isArray(created) || created.length === 0) {
    throw new Error(`Failed to create group "${groupName}"`);
  }
  return created[0].id as string;
}

async function upsertFestival(
  client: SupabaseRestClient,
  groupId: string,
  slug: string,
  status: string,
): Promise<string> {
  const mapped = FESTIVAL_MAP[slug];
  const name = toFestivalName(slug);

  const existing = await client.request(
    `/festivals?select=id&group_id=eq.${groupId}&name=eq.${encodeURIComponent(name)}&limit=1`,
  );

  const payload: Record<string, unknown> = {
    group_id: groupId,
    name,
    status,
  };
  if (mapped?.location) payload.location = mapped.location;
  if (mapped?.dates_start) payload.dates_start = mapped.dates_start;
  if (mapped?.dates_end) payload.dates_end = mapped.dates_end;

  if (Array.isArray(existing) && existing.length > 0) {
    const festivalId = existing[0].id as string;
    await client.request(`/festivals?id=eq.${festivalId}&select=id`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    return festivalId;
  }

  const created = await client.request("/festivals?select=id,name", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!Array.isArray(created) || created.length === 0) {
    throw new Error(`Failed to insert festival "${name}"`);
  }
  return created[0].id as string;
}

async function replaceArtists(
  client: SupabaseRestClient,
  festivalId: string,
  rows: JsonRow[],
): Promise<number> {
  const unique = new Set<string>();
  for (const row of rows) {
    const artist = getArtistName(row);
    if (artist) unique.add(artist);
  }

  const artistPayload = Array.from(unique).map((name) => ({
    festival_id: festivalId,
    name,
    priority: "want_to_see",
  }));

  await client.request(`/artists?festival_id=eq.${festivalId}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (artistPayload.length === 0) return 0;

  await client.request("/artists?select=id", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(artistPayload),
  });

  return artistPayload.length;
}

async function listFestivalJsonFiles(inputDir: string): Promise<string[]> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".json")
    .map((entry) => join(inputDir, entry.name))
    .sort();
}

async function readJsonRows(path: string): Promise<JsonRow[]> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array JSON in ${path}`);
  }
  return parsed as JsonRow[];
}

async function main() {
  await loadRootDotEnv();
  const args = parseArgs(process.argv);
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseApiKey = requireEnv("SUPABASE_API_KEY");
  const client = new SupabaseRestClient(supabaseUrl, supabaseApiKey);

  const files = await listFestivalJsonFiles(args.inputDir);
  const selected = args.festivals.length
    ? files.filter((f) => args.festivals.includes(basename(f, ".json")))
    : files;

  if (selected.length === 0) {
    throw new Error(`No JSON files found to sync in ${args.inputDir}`);
  }

  const groupId = args.dryRun
    ? args.groupId || "<dry-run-group-id>"
    : await getOrCreateGroupId(client, args.groupId, args.groupName);

  let festivalCount = 0;
  let artistCount = 0;

  for (const file of selected) {
    const slug = basename(file, ".json");
    const rows = await readJsonRows(file);
    const uniqueArtists = new Set(rows.map(getArtistName).filter(Boolean)).size;

    if (args.dryRun) {
      console.log(`[dry-run] ${slug}: festival="${toFestivalName(slug)}", artists=${uniqueArtists}`);
      continue;
    }

    const festivalId = await upsertFestival(client, groupId, slug, args.status);
    const insertedArtists = await replaceArtists(client, festivalId, rows);
    festivalCount += 1;
    artistCount += insertedArtists;

    console.log(`Synced ${slug} -> festival_id=${festivalId}, artists=${insertedArtists}`);
  }

  if (args.dryRun) {
    console.log(`Dry run complete. Files inspected: ${selected.length}`);
    return;
  }

  console.log(`Sync complete. Festivals synced: ${festivalCount}, artists inserted: ${artistCount}`);
}

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
