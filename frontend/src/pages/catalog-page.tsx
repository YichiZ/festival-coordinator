import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listFestivalCatalog,
  searchFestivalCatalog,
  type SearchFestivalCatalogParams,
} from "@/api/festival-catalog";
import { useFestivalSearch } from "@/hooks/use-festival-search";

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString();
}

function formatPrice(n: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CatalogPage() {
  const fetchFn = useCallback((params: SearchFestivalCatalogParams) => {
    const hasFilters =
      params.name != null ||
      params.latitude != null ||
      params.longitude != null;
    return hasFilters ? searchFestivalCatalog(params) : listFestivalCatalog();
  }, []);

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
  } = useFestivalSearch(fetchFn);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Browse Festival Catalog</h1>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">Search by name or location</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="catalog-search-name" className="text-xs">
              Name
            </Label>
            <Input
              id="catalog-search-name"
              type="text"
              placeholder="e.g. Coachella"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catalog-search-lat" className="text-xs">
              Latitude
            </Label>
            <Input
              id="catalog-search-lat"
              type="number"
              step="any"
              placeholder="e.g. 40.7"
              value={searchLat}
              onChange={(e) => setSearchLat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catalog-search-lon" className="text-xs">
              Longitude
            </Label>
            <Input
              id="catalog-search-lon"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((f) => {
            const dateRange = [formatDate(f.dates_start), formatDate(f.dates_end)]
              .filter(Boolean)
              .join(" – ");
            const price = formatPrice(f.ticket_price);

            return (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  {f.location && (
                    <CardDescription>{f.location}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {dateRange && (
                    <p className="text-muted-foreground">Dates: {dateRange}</p>
                  )}
                  {price != null && (
                    <p className="text-muted-foreground">
                      From {price}
                      {f.on_sale_date && (
                        <span>
                          {" "}
                          (on sale{" "}
                          {formatDate(f.on_sale_date) ?? f.on_sale_date})
                        </span>
                      )}
                    </p>
                  )}
                  {(() => {
                    if (f.latitude == null || f.longitude == null) return null;
                    const lat = Number(f.latitude);
                    const lon = Number(f.longitude);
                    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
                    return (
                      <p className="text-muted-foreground text-xs">
                        {lat.toFixed(4)}, {lon.toFixed(4)}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
