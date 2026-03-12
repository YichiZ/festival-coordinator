import { useState, useEffect, useCallback, useRef } from "react";

interface UseQueryOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: UseQueryOptions<T>
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep refs so refetch never needs fetcher/options in its dep array
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
      optionsRef.current?.onSuccess?.(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      optionsRef.current?.onError?.(e);
    } finally {
      setLoading(false);
    }
  }, []); // stable — uses refs

  useEffect(() => {
    if (optionsRef.current?.enabled !== false) {
      refetch();
    }
  }, [key, refetch]); // re-runs when key changes (e.g. route param)

  return { data, error, loading, refetch };
}
