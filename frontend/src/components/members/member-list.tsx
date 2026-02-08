import type { Member } from "@/api/types";
import { Card, CardContent } from "@/components/ui/card";

export function MemberList({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return <p className="text-muted-foreground">No members yet.</p>;
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{m.name}</p>
              {m.city && (
                <p className="text-sm text-muted-foreground">{m.city}</p>
              )}
            </div>
            {m.phone && (
              <p className="text-sm text-muted-foreground">{m.phone}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
