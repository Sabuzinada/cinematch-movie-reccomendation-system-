import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Star, Film, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function MyRatings() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();

  const myRatings = trpc.ratings.myRatings.useQuery();

  const rateMutation = trpc.ratings.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating updated!");
      myRatings.refetch();
    },
    onError: () => {
      toast.error("Failed to update rating");
    },
  });

  const stats = useMemo(() => {
    if (!myRatings.data || myRatings.data.length === 0) return null;
    const ratings = myRatings.data.map((r) => r.rating);
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const genreCounts = new Map<string, number>();
    for (const r of myRatings.data) {
      for (const g of r.genres.split("|")) {
        if (g !== "(no genres listed)") {
          genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        }
      }
    }
    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);
    return {
      count: ratings.length,
      avg: avg.toFixed(1),
      topGenres,
    };
  }, [myRatings.data]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-6 page-enter">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              My Ratings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your complete rating history
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/browse")}
            className="gap-1.5"
          >
            <Film className="w-4 h-4" />
            Rate More
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">
                Total Ratings
              </p>
              <p className="text-2xl font-bold">{stats.count}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">
                Average Rating
              </p>
              <p className="text-2xl font-bold flex items-center gap-1">
                <Star
                  className="w-5 h-5"
                  style={{ color: "oklch(0.82 0.12 85)" }}
                  fill="oklch(0.82 0.12 85)"
                />
                {stats.avg}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">
                Top Genres
              </p>
              <p className="text-sm font-medium">
                {stats.topGenres.join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Ratings grid */}
        {myRatings.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : myRatings.data && myRatings.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {myRatings.data.map((r) => (
              <MovieCard
                key={r.movieId}
                movie={{
                  id: r.movieId,
                  title: r.title,
                  genres: r.genres,
                  year: r.year,
                  avgRating: r.avgRating,
                  tmdbId: r.tmdbId,
                }}
                userRating={r.rating}
                onRate={(rating) =>
                  rateMutation.mutate({ movieId: r.movieId, rating })
                }
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No ratings yet</p>
            <p className="text-sm mt-1 mb-4">
              Start rating movies to build your profile.
            </p>
            <Button onClick={() => navigate("/browse")} className="gap-2">
              Browse Movies
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
