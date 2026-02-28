import { useEffect, useState } from "react";
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
import { searchFestivalCatalog } from "@/api/festival-catalog";
import type { FestivalCatalogEntry } from "@/api/types";
import { formatDate, formatPrice } from "@/lib/utils";

export function CatalogPage() {
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
    searchFestivalCatalog({}).then(setCatalog).finally(() => setLoading(false));
  }, []);

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
