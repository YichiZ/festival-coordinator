import type { Festival } from "@/api/types";
import { FestivalCard } from "./festival-card";

export function FestivalList({ festivals }: { festivals: Festival[] }) {
  if (festivals.length === 0) {
    return <p className="text-muted-foreground">No festivals yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {festivals.map((f) => (
        <FestivalCard key={f.id} festival={f} />
      ))}
    </div>
  );
}
