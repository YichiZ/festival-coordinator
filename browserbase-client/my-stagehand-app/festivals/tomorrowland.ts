import type { FestivalConfig } from "../scraper.js";

const tomorrowland: FestivalConfig = {
  name: "tomorrowland-2026",
  url: "https://www.tomorrowland.com/en/festival/line-up",
  agentSystemPrompt:
    "You are a data extraction assistant. Your goal is to scrape the complete Tomorrowland 2026 lineup from this page. Navigate through ALL available days and stages. Click on each day tab, expand any filters or sections, and ensure you see every artist. After you have navigated through everything and have a comprehensive view, report done.",
  agentInstruction:
    "Navigate the Tomorrowland 2026 lineup page. Click through each day and each stage to ensure all artists are loaded. Scroll down to see all artists. Once you have explored all days and stages, report what you found: list every artist with their stage, date, and set time.",
  extractInstruction:
    "Extract ALL artists from the lineup page. For each artist include: artist name, stage name, date of performance, and set time. If set times are not shown, use 'TBA'. Include every single artist visible.",
  maxSteps: 30,
};

export default tomorrowland;
