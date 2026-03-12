import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import {
  listFestivalCatalog,
  searchFestivalCatalog,
  type SearchFestivalCatalogParams,
} from "@/api/festival-catalog";
import { useFestivalSearch } from "@/hooks/use-festival-search";
import { formatDate, formatPrice } from "@/lib/utils";

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

      <CatalogSearchForm
        searchName={searchName}
        setSearchName={setSearchName}
        searchLat={searchLat}
        setSearchLat={setSearchLat}
        searchLon={searchLon}
        setSearchLon={setSearchLon}
        onSearch={runSearch}
      />

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
                  {f.latitude != null && f.longitude != null && (
                    <p className="text-muted-foreground text-xs">
                      {Number(f.latitude).toFixed(4)}, {Number(f.longitude).toFixed(4)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
