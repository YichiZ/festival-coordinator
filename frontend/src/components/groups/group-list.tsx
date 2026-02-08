import type { Group } from "@/api/types";
import { GroupCard } from "./group-card";

export function GroupList({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground">
        No groups yet. Create one to get started!
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
    </div>
  );
}
