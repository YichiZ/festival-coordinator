import { apiFetch } from "./client";
import type { Member } from "./types";

export function listGroupMembers(groupId: string) {
  return apiFetch<Member[]>(`/groups/${groupId}/members`);
}

export function createMember(data: {
  group_id: string;
  name: string;
  phone: string;
  city?: string;
}) {
  return apiFetch<Member>("/members", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
