import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listFestivalCatalog } from "@/api/festival-catalog";
import type { FestivalCatalogEntry } from "@/api/types";

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString();
}

export function StepSelectFestivals({
  selected,
  onChange,
  onSubmit,
  onBack,
  submitting,
}: Props) {
  const [catalog, setCatalog] = useState<FestivalCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFestivalCatalog()
      .then(setCatalog)
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading festivals...</p>;
  }

  return (
    <div className="space-y-4">
      {catalog.length === 0 ? (
        <p className="text-muted-foreground">No festivals in catalog.</p>
      ) : (
        <div className="space-y-3">
          {catalog.map((f) => {
            const dateRange = [formatDate(f.dates_start), formatDate(f.dates_end)]
              .filter(Boolean)
              .join(" – ");

            return (
              <div key={f.id} className="flex items-start gap-3">
                <Checkbox
                  id={f.id}
                  checked={selected.includes(f.id)}
                  onCheckedChange={() => toggle(f.id)}
                />
                <Label htmlFor={f.id} className="cursor-pointer leading-snug">
                  <span className="font-medium">{f.name}</span>
                  {f.location && (
                    <span className="text-muted-foreground"> — {f.location}</span>
                  )}
                  {dateRange && (
                    <span className="block text-xs text-muted-foreground">
                      {dateRange}
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1"
        >
          {submitting ? "Creating..." : "Create Group"}
        </Button>
      </div>
    </div>
  );
}
