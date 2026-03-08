import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bookmark, Film, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { usePosters } from "@/hooks/usePosters";

export default function Watchlist() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();

  const watchlistQuery = trpc.watchlist.list.useQuery();
  const myRatings = trpc.ratings.myRatings.useQuery();

  const ratingsMap = useMemo(() => {
    const map = new Map<number, number>();
    if (myRatings.data) {
      for (const r of myRatings.data) {
        map.set(r.movieId, r.rating);
      }
    }
    return map;
  }, [myRatings.data]);

  // Fetch posters for watchlist movies
  const tmdbIds = useMemo(
    () => (watchlistQuery.data ?? []).map((m) => m.tmdbId),
    [watchlistQuery.data]
  );
  const posterMap = usePosters(tmdbIds);

  const rateMutation = trpc.ratings.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating saved!");
      myRatings.refetch();
    },
    onError: () => {
      toast.error("Failed to save rating");
    },
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed from watchlist");
      watchlistQuery.refetch();
    },
    onError: () => {
      toast.error("Failed to remove from watchlist");
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-6 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              My Watchlist
            </h1>
            <p className="text-sm text-muted-foreground">
              Movies you've saved to watch later.
              {watchlistQuery.data && (
                <span>
                  {" "}
                  <span className="font-medium text-primary">
                    {watchlistQuery.data.length}
                  </span>{" "}
                  {watchlistQuery.data.length === 1 ? "movie" : "movies"} saved.
                </span>
              )}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/browse")}
            className="gap-1.5"
          >
            <Film className="w-4 h-4" />
            Browse Movies
          </Button>
        </div>

        {/* Watchlist grid */}
        {watchlistQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : watchlistQuery.data && watchlistQuery.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {watchlistQuery.data.map((item) => (
              <div key={item.id} className="relative group/wl">
                <MovieCard
                  movie={{
                    id: item.movieId,
                    title: item.title,
                    genres: item.genres,
                    year: item.year,
                    avgRating: item.avgRating,
                    tmdbId: item.tmdbId,
                  }}
                  userRating={ratingsMap.get(item.movieId)}
                  onRate={(rating) =>
                    rateMutation.mutate({ movieId: item.movieId, rating })
                  }
                  posterUrl={item.tmdbId ? posterMap[item.tmdbId] : undefined}
                  isInWatchlist={true}
                  onToggleWatchlist={() =>
                    removeMutation.mutate({ movieId: item.movieId })
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Your watchlist is empty</p>
            <p className="text-sm mt-1">
              Browse movies and click the bookmark icon to save them for later.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/browse")}
            >
              Browse Movies
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
