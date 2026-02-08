import { apiFetch } from "./client";
import type { FestivalCatalogEntry } from "./types";

export function listFestivalCatalog() {
  return apiFetch<FestivalCatalogEntry[]>("/festival-catalog");
}
