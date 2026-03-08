import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";

// Global client-side poster cache
const posterCache = new Map<number, string>();

/**
 * Hook that fetches TMDB poster URLs for a list of tmdbIds.
 * Returns a map of tmdbId -> poster URL.
 * Uses a global cache to avoid re-fetching.
 */
export function usePosters(tmdbIds: (number | null | undefined)[]) {
  const [posterMap, setPosterMap] = useState<Record<number, string>>({});

  // Filter out null/undefined and already-cached IDs
  const validIds = tmdbIds.filter((id): id is number => id != null && id > 0);
  const uncachedIds = validIds.filter((id) => !posterCache.has(id));

  const postersQuery = trpc.movies.posters.useQuery(
    { tmdbIds: uncachedIds },
    {
      enabled: uncachedIds.length > 0,
      staleTime: Infinity, // Posters don't change
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (postersQuery.data) {
      // Update global cache
      for (const [idStr, url] of Object.entries(postersQuery.data)) {
        posterCache.set(Number(idStr), url);
      }
    }

    // Build result from cache
    const result: Record<number, string> = {};
    for (const id of validIds) {
      const cached = posterCache.get(id);
      if (cached) {
        result[id] = cached;
      }
    }
    setPosterMap(result);
  }, [postersQuery.data, validIds.join(",")]);

  return posterMap;
}

/**
 * Get a single poster URL from the cache (synchronous).
 * Returns undefined if not yet fetched.
 */
export function getCachedPoster(tmdbId: number | null | undefined): string | undefined {
  if (!tmdbId) return undefined;
  return posterCache.get(tmdbId);
}
