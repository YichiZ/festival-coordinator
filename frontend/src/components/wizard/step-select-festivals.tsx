import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import { searchFestivalCatalog } from "@/api/festival-catalog";
import type { FestivalCatalogEntry } from "@/api/types";
import { formatDate } from "@/lib/utils";

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
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
  const [searchName, setSearchName] = useState("");
  const [searchLat, setSearchLat] = useState("");
  const [searchLon, setSearchLon] = useState("");

  function runSearch() {
    setLoading(true);
    const params: { name?: string; latitude?: number; longitude?: number } = {};
    if (searchName.trim()) params.name = searchName.trim();
    const lat = parseFloat(searchLat);
    const lon = parseFloat(searchLon);
    if (!Number.isNaN(lat)) params.latitude = lat;
    if (!Number.isNaN(lon)) params.longitude = lon;
    searchFestivalCatalog(params)
      .then(setCatalog)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    searchFestivalCatalog({}).then(setCatalog).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  }

  return (
    <div className="space-y-4">
      <CatalogSearchForm
        searchName={searchName}
        setSearchName={setSearchName}
        searchLat={searchLat}
        setSearchLat={setSearchLat}
        searchLon={searchLon}
        setSearchLon={setSearchLon}
        onSearch={runSearch}
        idPrefix="wizard"
      />

      {loading ? (
        <p className="text-muted-foreground">Loading festivals...</p>
      ) : catalog.length === 0 ? (
        <p className="text-muted-foreground">No festivals match your search.</p>
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
