import { apiFetch } from "./client";
import type { FestivalCatalogEntry } from "./types";

export function listFestivalCatalog() {
  return apiFetch<FestivalCatalogEntry[]>("/festival-catalog");
}

export interface SearchFestivalCatalogParams {
  name?: string;
  latitude?: number;
  longitude?: number;
}

export function searchFestivalCatalog(params: SearchFestivalCatalogParams = {}) {
  const search = new URLSearchParams();
  if (params.name?.trim()) search.set("name", params.name.trim());
  const hasLat = params.latitude != null && !Number.isNaN(params.latitude);
  const hasLon = params.longitude != null && !Number.isNaN(params.longitude);
  if (hasLat && hasLon) {
    search.set("latitude", String(params.latitude));
    search.set("longitude", String(params.longitude));
  }
  const qs = search.toString();
  return apiFetch<FestivalCatalogEntry[]>(
    `/festival-catalog/search${qs ? `?${qs}` : ""}`
  );
}
