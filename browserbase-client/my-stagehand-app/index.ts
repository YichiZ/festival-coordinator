import festivals from "./festivals/index.js";
import { scrapeFestival } from "./scraper.js";

async function main() {
  const args = process.argv.slice(2);

  // No args → list available festivals
  if (args.length === 0) {
    console.log("Available festivals:");
    for (const key of Object.keys(festivals)) {
      console.log(`  - ${key}  (${festivals[key].name})`);
    }
    console.log("\nUsage:");
    console.log("  npm start -- <festival>    Scrape a single festival");
    console.log("  npm start -- --all         Scrape all festivals");
    return;
  }

  // --all → scrape every registered festival
  if (args.includes("--all")) {
    for (const [key, config] of Object.entries(festivals)) {
      console.log(`\nStarting: ${key}`);
      await scrapeFestival(config);
    }
    return;
  }

  // Specific festival(s) by name
  for (const arg of args) {
    const config = festivals[arg];
    if (!config) {
      console.error(`Unknown festival: "${arg}". Run without args to see available festivals.`);
      process.exit(1);
    }
    await scrapeFestival(config);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
