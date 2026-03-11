import { useCallback, useEffect, useRef, useState } from "react";
import { searchFestivalCatalog, type SearchFestivalCatalogParams } from "@/api/festival-catalog";
import type { FestivalCatalogEntry } from "@/api/types";

export function useFestivalSearch(
  fetchFn: (params: SearchFestivalCatalogParams) => Promise<FestivalCatalogEntry[]> = searchFestivalCatalog
) {
  const [catalog, setCatalog] = useState<FestivalCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchName, setSearchName] = useState("");
  const [searchLat, setSearchLat] = useState("");
  const [searchLon, setSearchLon] = useState("");

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const runSearch = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: SearchFestivalCatalogParams = {};
    if (searchName.trim()) params.name = searchName.trim();
    const lat = parseFloat(searchLat);
    const lon = parseFloat(searchLon);
    if (!Number.isNaN(lat)) params.latitude = lat;
    if (!Number.isNaN(lon)) params.longitude = lon;
    fetchFnRef.current(params)
      .then(setCatalog)
      .catch(() => setError("Failed to load festivals. Please try again."))
      .finally(() => setLoading(false));
  }, [searchName, searchLat, searchLon]);

  useEffect(() => {
    runSearch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  return {
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
  };
}
