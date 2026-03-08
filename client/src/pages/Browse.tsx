import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Film, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { usePosters } from "@/hooks/usePosters";

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Children",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Fantasy",
  "Film-Noir",
  "Horror",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

type SortOption = "popular" | "highest_rated" | "newest" | "title_az";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "newest", label: "Newest First" },
  { value: "title_az", label: "Title A-Z" },
];

export default function Browse() {
  useAuth({ redirectOnUnauthenticated: true });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("popular");

  // Debounce search
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedQuery(value);
      setPage(0);
    }, 300);
    setDebounceTimer(timer);
  };

  const queryInput = useMemo(
    () => ({
      query: debouncedQuery,
      genre: selectedGenre,
      limit: 24,
      offset: page * 24,
      sortBy,
    }),
    [debouncedQuery, selectedGenre, page, sortBy]
  );

  const moviesQuery = trpc.movies.search.useQuery(queryInput);
  const myRatings = trpc.ratings.myRatings.useQuery();
  const ratingCount = trpc.ratings.count.useQuery();
  const watchlistIds = trpc.watchlist.ids.useQuery();

  const ratingsMap = useMemo(() => {
    const map = new Map<number, number>();
    if (myRatings.data) {
      for (const r of myRatings.data) {
        map.set(r.movieId, r.rating);
      }
    }
    return map;
  }, [myRatings.data]);

  const watchlistSet = useMemo(
    () => new Set(watchlistIds.data ?? []),
    [watchlistIds.data]
  );

  // Fetch posters for visible movies
  const tmdbIds = useMemo(
    () => (moviesQuery.data?.movies ?? []).map((m) => m.tmdbId),
    [moviesQuery.data]
  );
  const posterMap = usePosters(tmdbIds);

  const rateMutation = trpc.ratings.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating saved!");
      myRatings.refetch();
      ratingCount.refetch();
    },
    onError: () => {
      toast.error("Failed to save rating");
    },
  });

  const addWatchlistMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => {
      toast.success("Added to watchlist");
      watchlistIds.refetch();
    },
    onError: () => {
      toast.error("Failed to add to watchlist");
    },
  });

  const removeWatchlistMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed from watchlist");
      watchlistIds.refetch();
    },
    onError: () => {
      toast.error("Failed to remove from watchlist");
    },
  });

  const toggleWatchlist = (movieId: number) => {
    if (watchlistSet.has(movieId)) {
      removeWatchlistMutation.mutate({ movieId });
    } else {
      addWatchlistMutation.mutate({ movieId });
    }
  };

  const totalPages = Math.ceil((moviesQuery.data?.total ?? 0) / 24);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-6 page-enter">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Browse Movies
          </h1>
          <p className="text-sm text-muted-foreground">
            Search and rate movies from our collection of 9,700+ films.
            {ratingCount.data !== undefined && (
              <span>
                {" "}
                You've rated{" "}
                <span className="font-medium text-primary">
                  {ratingCount.data}
                </span>{" "}
                movies.
              </span>
            )}
          </p>
        </div>

        {/* Search + Sort row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search movies by title..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedQuery("");
                  setPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val as SortOption);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Genre filters */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          <Badge
            variant={selectedGenre === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setSelectedGenre(null);
              setPage(0);
            }}
          >
            All
          </Badge>
          {GENRES.map((genre) => (
            <Badge
              key={genre}
              variant={selectedGenre === genre ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                setSelectedGenre(selectedGenre === genre ? null : genre);
                setPage(0);
              }}
            >
              {genre}
            </Badge>
          ))}
        </div>

        {/* Movie grid */}
        {moviesQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : moviesQuery.data && moviesQuery.data.movies.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {moviesQuery.data.movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  userRating={ratingsMap.get(movie.id)}
                  onRate={(rating) =>
                    rateMutation.mutate({ movieId: movie.id, rating })
                  }
                  posterUrl={
                    movie.tmdbId ? posterMap[movie.tmdbId] : undefined
                  }
                  isInWatchlist={watchlistSet.has(movie.id)}
                  onToggleWatchlist={() => toggleWatchlist(movie.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No movies found</p>
            <p className="text-sm mt-1">
              Try adjusting your search or genre filter.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
