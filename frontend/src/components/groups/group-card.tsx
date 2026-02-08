import { Link } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { Group } from "@/api/types";

export function GroupCard({ group }: { group: Group }) {
  return (
    <Link to={`/groups/${group.id}`}>
      <Card className="transition-colors hover:bg-accent">
        <CardHeader>
          <CardTitle>{group.name ?? "Unnamed Group"}</CardTitle>
          <CardDescription>
            {group.created_at
              ? `Created ${new Date(group.created_at).toLocaleDateString()}`
              : ""}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
