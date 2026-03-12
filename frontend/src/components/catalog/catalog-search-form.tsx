import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  searchName: string;
  setSearchName: (v: string) => void;
  searchLat: string;
  setSearchLat: (v: string) => void;
  searchLon: string;
  setSearchLon: (v: string) => void;
  onSearch: () => void;
  idPrefix?: string;
}

export function CatalogSearchForm({
  searchName,
  setSearchName,
  searchLat,
  setSearchLat,
  searchLon,
  setSearchLon,
  onSearch,
  idPrefix = "catalog",
}: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onSearch();
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">Search by name or location</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-name`} className="text-xs">
            Name
          </Label>
          <Input
            id={`${idPrefix}-name`}
            type="text"
            placeholder="e.g. Coachella"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lat`} className="text-xs">
            Latitude
          </Label>
          <Input
            id={`${idPrefix}-lat`}
            type="number"
            step="any"
            placeholder="e.g. 40.7"
            value={searchLat}
            onChange={(e) => setSearchLat(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lon`} className="text-xs">
            Longitude
          </Label>
          <Input
            id={`${idPrefix}-lon`}
            type="number"
            step="any"
            placeholder="e.g. -74"
            value={searchLon}
            onChange={(e) => setSearchLon(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onSearch}>
        Search
      </Button>
    </div>
  );
}
