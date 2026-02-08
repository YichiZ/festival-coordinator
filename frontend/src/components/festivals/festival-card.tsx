import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Festival } from "@/api/types";

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString();
}

export function FestivalCard({ festival }: { festival: Festival }) {
  const dateRange = [
    formatDate(festival.dates_start),
    formatDate(festival.dates_end),
  ]
    .filter(Boolean)
    .join(" – ");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">{festival.name}</CardTitle>
        {festival.status && (
          <Badge variant={festival.status === "going" ? "default" : "secondary"}>
            {festival.status}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        {festival.location && <p>{festival.location}</p>}
        {dateRange && <p>{dateRange}</p>}
        {festival.ticket_price != null && <p>${festival.ticket_price}</p>}
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
