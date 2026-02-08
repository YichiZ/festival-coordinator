import { apiFetch } from "./client";
import type { Festival } from "./types";

export function listGroupFestivals(groupId: string) {
  return apiFetch<Festival[]>(`/groups/${groupId}/festivals`);
}

export function createFestival(data: {
  group_id: string;
  name: string;
  location?: string;
  dates_start?: string;
  dates_end?: string;
  ticket_price?: number;
  on_sale_date?: string;
  status?: string;
}) {
  return apiFetch<Festival>("/festivals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
