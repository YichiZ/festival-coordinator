import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Festival } from "@/api/types";
import { formatDate, formatPrice } from "@/lib/utils";

const festivalStatusConfig: Record<string, { label: string; className: string }> = {
  committed: {
    label: "Committed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  considering: {
    label: "Considering",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  },
  passed: {
    label: "Passed",
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export function FestivalCard({ festival }: { festival: Festival }) {
  const dateRange = [
    formatDate(festival.dates_start),
    formatDate(festival.dates_end),
  ]
    .filter(Boolean)
    .join(" – ");

  const status = festivalStatusConfig[festival.status ?? ""] ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2">
        <CardTitle className="text-sm font-semibold">{festival.name}</CardTitle>
        {status && (
          <Badge variant="secondary" className={status.className}>
            {status.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-1 px-4 pb-4 pt-0 text-xs text-muted-foreground">
        {festival.location && <p>{festival.location}</p>}
        {dateRange && <p>{dateRange}</p>}
        {festival.ticket_price != null && <p>{formatPrice(festival.ticket_price)}</p>}
        {festival.artists && festival.artists.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {festival.artists.map((a) => (
              <Badge key={a.id} variant="outline" className="text-xs">
                {a.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
