import type { FestivalConfig } from "../scraper.js";

const tomorrowland: FestivalConfig = {
  name: "tomorrowland-2026",
  url: "https://belgium.tomorrowland.com/en/line-up/",
  agentSystemPrompt:
    "You are a data extraction assistant. Your goal is to scrape the Tomorrowland 2026 lineup. Work quickly — click each day tab to load artists, but do NOT click into individual artists or stages. Just load each day's full list and report done. Set times are not available on this site, so skip looking for them.",
  agentInstruction:
    "Navigate the Tomorrowland 2026 lineup page. Accept any cookie banners. Click through each day tab (Week 1: Fri, Sat, Sun; Week 2: Fri, Sat, Sun) to load the artist lists. Do NOT expand individual stages or click individual artists. Just ensure each day's lineup is loaded. Then report done.",
  extractInstruction:
    "Extract ALL artists from the lineup page. For each artist include: artist name, stage name, date of performance, and set time. If set times are not shown, use 'TBA'. Include every single artist visible.",
  maxSteps: 15,
};

export default tomorrowland;
