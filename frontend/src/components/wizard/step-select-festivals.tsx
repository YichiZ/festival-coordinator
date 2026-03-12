import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import { useFestivalSearch } from "@/hooks/use-festival-search";
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
  const {
    catalog,
    loading,
    error,
    searchName,
    setSearchName,
    searchLat,
    setSearchLat,
    searchLon,
    setSearchLon,
    runSearch,
  } = useFestivalSearch();

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
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : catalog.length === 0 ? (
        <p className="text-muted-foreground">No festivals match your search.</p>
      ) : (
        <div className="space-y-3">
          {catalog.map((f: FestivalCatalogEntry) => {
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
