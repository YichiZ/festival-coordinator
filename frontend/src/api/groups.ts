import { apiFetch } from "./client";
import type { Group } from "./types";

export function listGroups() {
  return apiFetch<Group[]>("/groups");
}

export function getGroup(id: string) {
  return apiFetch<Group>(`/groups/${id}`);
}

export function createGroup(name: string) {
  return apiFetch<Group>("/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
