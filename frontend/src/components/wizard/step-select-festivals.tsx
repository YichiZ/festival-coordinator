import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFestivalSearch } from "@/hooks/use-festival-search";
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
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Search catalog</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="search-name" className="text-xs">
              Name
            </Label>
            <Input
              id="search-name"
              type="text"
              placeholder="e.g. Coachella"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="search-lat" className="text-xs">
              Latitude
            </Label>
            <Input
              id="search-lat"
              type="number"
              step="any"
              placeholder="e.g. 40.7"
              value={searchLat}
              onChange={(e) => setSearchLat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="search-lon" className="text-xs">
              Longitude
            </Label>
            <Input
              id="search-lon"
              type="number"
              step="any"
              placeholder="e.g. -74"
              value={searchLon}
              onChange={(e) => setSearchLon(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={runSearch}>
          Search
        </Button>
      </div>

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
