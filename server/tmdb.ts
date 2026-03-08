/**
 * TMDB API integration for fetching movie poster paths.
 * Poster URLs are constructed as: https://image.tmdb.org/t/p/{size}/{poster_path}
 * Available sizes: w92, w154, w185, w342, w500, w780, original
 */

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// In-memory cache to avoid repeated API calls
const posterCache = new Map<number, string | null>();

function getApiKey(): string {
  return process.env.TMDB_API_KEY ?? "";
}

/**
 * Fetch poster path for a single movie by TMDB ID.
 */
export async function fetchPosterPath(tmdbId: number): Promise<string | null> {
  if (posterCache.has(tmdbId)) {
    return posterCache.get(tmdbId)!;
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`);
    if (!res.ok) {
      posterCache.set(tmdbId, null);
      return null;
    }
    const data = await res.json();
    const posterPath = data.poster_path || null;
    posterCache.set(tmdbId, posterPath);
    return posterPath;
  } catch {
    posterCache.set(tmdbId, null);
    return null;
  }
}

/**
 * Fetch poster paths for multiple movies in batch.
 * Returns a map of tmdbId -> full poster URL (w342 size).
 */
export async function fetchPosterUrls(
  tmdbIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const apiKey = getApiKey();
  if (!apiKey) return result;

  const uncached = tmdbIds.filter((id) => !posterCache.has(id));

  // Fetch uncached posters in parallel (max 5 concurrent)
  const batchSize = 5;
  for (let i = 0; i < uncached.length; i += batchSize) {
    const batch = uncached.slice(i, i + batchSize);
    await Promise.all(batch.map((id) => fetchPosterPath(id)));
  }

  // Build result from cache
  for (const tmdbId of tmdbIds) {
    const posterPath = posterCache.get(tmdbId);
    if (posterPath) {
      result.set(tmdbId, `${TMDB_IMAGE_BASE}/w342${posterPath}`);
    }
  }

  return result;
}

/**
 * Get the full poster URL for a given poster path.
 */
export function getPosterUrl(
  posterPath: string,
  size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w342"
): string {
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

// ---- TMDB Movie Detail types ----

export type TmdbCastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
};

export type TmdbVideo = {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
};

export type TmdbSimilarMovie = {
  id: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
  overview: string;
};

export type TmdbMovieDetail = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  runtime: number | null;
  voteAverage: number;
  voteCount: number;
  tagline: string | null;
  cast: TmdbCastMember[];
  trailers: TmdbVideo[];
  similar: TmdbSimilarMovie[];
};

// In-memory cache for movie details
const detailCache = new Map<number, TmdbMovieDetail | null>();

/**
 * Fetch full movie details from TMDB including cast, videos, and similar movies.
 */
export async function fetchMovieDetail(
  tmdbId: number
): Promise<TmdbMovieDetail | null> {
  if (detailCache.has(tmdbId)) {
    return detailCache.get(tmdbId)!;
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}&append_to_response=credits,videos,similar`
    );
    if (!res.ok) {
      detailCache.set(tmdbId, null);
      return null;
    }
    const data = await res.json();

    const cast: TmdbCastMember[] = (data.credits?.cast ?? [])
      .slice(0, 12)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path
          ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}`
          : null,
      }));

    const trailers: TmdbVideo[] = (data.videos?.results ?? [])
      .filter(
        (v: any) =>
          v.site === "YouTube" &&
          (v.type === "Trailer" || v.type === "Teaser")
      )
      .slice(0, 3)
      .map((v: any) => ({
        id: v.id,
        key: v.key,
        name: v.name,
        site: v.site,
        type: v.type,
      }));

    const similar: TmdbSimilarMovie[] = (data.similar?.results ?? [])
      .slice(0, 8)
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        posterPath: m.poster_path
          ? `${TMDB_IMAGE_BASE}/w185${m.poster_path}`
          : null,
        releaseDate: m.release_date || null,
        voteAverage: m.vote_average ?? 0,
        overview: m.overview ?? "",
      }));

    const detail: TmdbMovieDetail = {
      id: data.id,
      title: data.title,
      overview: data.overview ?? "",
      posterUrl: data.poster_path
        ? `${TMDB_IMAGE_BASE}/w500${data.poster_path}`
        : null,
      backdropUrl: data.backdrop_path
        ? `${TMDB_IMAGE_BASE}/w1280${data.backdrop_path}`
        : null,
      releaseDate: data.release_date || null,
      runtime: data.runtime || null,
      voteAverage: data.vote_average ?? 0,
      voteCount: data.vote_count ?? 0,
      tagline: data.tagline || null,
      cast,
      trailers,
      similar,
    };

    detailCache.set(tmdbId, detail);
    return detail;
  } catch {
    detailCache.set(tmdbId, null);
    return null;
  }
}
