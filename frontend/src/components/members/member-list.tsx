import { Pencil, Trash2 } from "lucide-react";
import type { Member } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  inactive: {
    label: "Inactive",
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
};

interface Props {
  members: Member[];
  onEdit?: (member: Member) => void;
  onDelete?: (memberId: string) => void;
}

export function MemberList({ members, onEdit, onDelete }: Props) {
  if (members.length === 0) {
    return <p className="text-muted-foreground">No members yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => {
        const status = statusConfig[m.status ?? ""] ?? null;
        return (
          <Card key={m.id} className="group">
            <CardContent className="flex items-center justify-between px-4 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{m.name}</p>
                {m.city && (
                  <p className="text-xs text-muted-foreground truncate">{m.city}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {status && (
                  <Badge variant="secondary" className={status.className}>
                    {status.label}
                  </Badge>
                )}
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onEdit(m)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Remove ${m.name} from this group?`)) {
                        onDelete(m.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
