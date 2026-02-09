import { apiFetch } from "./client";
import type { Member } from "./types";

export function listGroupMembers(groupId: string) {
  return apiFetch<Member[]>(`/groups/${groupId}/members`);
}

export function createMember(data: {
  group_id: string;
  name: string;
  phone?: string;
  city?: string;
  status?: string;
}) {
  return apiFetch<Member>("/members", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMember(
  id: string,
  data: { name?: string; city?: string; phone?: string; status?: string }
) {
  return apiFetch<Member>(`/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMember(id: string) {
  return apiFetch<void>(`/members/${id}`, { method: "DELETE" });
}
