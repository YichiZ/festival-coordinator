import type { FestivalConfig } from "../scraper.js";
import edc from "./edc.js";
import coachella from "./coachella.js";
import tomorrowland from "./tomorrowland.js";

const festivals: Record<string, FestivalConfig> = {
  edc,
  coachella,
  tomorrowland,
};

export default festivals;
