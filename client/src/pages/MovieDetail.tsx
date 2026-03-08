import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import StarRating from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Clock,
  ExternalLink,
  Film,
  Play,
  Star,
  Users,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const movieId = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  // Fetch movie from our DB
  const movieQuery = trpc.movies.byId.useQuery(
    { id: movieId },
    { enabled: !isNaN(movieId) }
  );

  const tmdbId = movieQuery.data?.tmdbId;

  // Fetch TMDB details
  const tmdbInput = useMemo(() => ({ tmdbId: tmdbId! }), [tmdbId]);
  const detailQuery = trpc.movies.detail.useQuery(tmdbInput, {
    enabled: !!tmdbId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // User ratings
  const myRatings = trpc.ratings.myRatings.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const ratingsMap = useMemo(() => {
    const map = new Map<number, number>();
    if (myRatings.data) {
      for (const r of myRatings.data) {
        map.set(r.movieId, r.rating);
      }
    }
    return map;
  }, [myRatings.data]);

  // Watchlist
  const watchlistIds = trpc.watchlist.ids.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const watchlistSet = useMemo(
    () => new Set(watchlistIds.data ?? []),
    [watchlistIds.data]
  );

  const rateMutation = trpc.ratings.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating saved!");
      myRatings.refetch();
    },
    onError: () => toast.error("Failed to save rating"),
  });

  const addWatchlistMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => {
      toast.success("Added to watchlist");
      watchlistIds.refetch();
    },
    onError: () => toast.error("Failed to add to watchlist"),
  });

  const removeWatchlistMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed from watchlist");
      watchlistIds.refetch();
    },
    onError: () => toast.error("Failed to remove from watchlist"),
  });

  const movie = movieQuery.data;
  const detail = detailQuery.data;
  const isInWatchlist = movie ? watchlistSet.has(movie.id) : false;

  const toggleWatchlist = () => {
    if (!movie) return;
    if (isInWatchlist) {
      removeWatchlistMutation.mutate({ movieId: movie.id });
    } else {
      addWatchlistMutation.mutate({ movieId: movie.id });
    }
  };

  function getCleanTitle(title: string): string {
    return title.replace(/\s*\(\d{4}\)\s*$/, "");
  }

  if (movieQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-6 text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">
            Movie not found
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/browse")}
          >
            Back to Browse
          </Button>
        </main>
      </div>
    );
  }

  const cleanTitle = getCleanTitle(movie.title);
  const genres = movie.genres
    .split("|")
    .filter((g) => g !== "(no genres listed)");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Backdrop */}
      {detail?.backdropUrl && (
        <div className="relative h-48 md:h-72 overflow-hidden">
          <img
            src={detail.backdropUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
      )}

      <main
        className={`flex-1 container py-6 page-enter ${detail?.backdropUrl ? "-mt-24 relative z-10" : ""}`}
      >
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
          {/* Poster */}
          <div className="space-y-4">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br from-secondary to-accent flex items-center justify-center shadow-xl">
              {detail?.posterUrl ? (
                <img
                  src={detail.posterUrl}
                  alt={cleanTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Film className="w-20 h-20 text-muted-foreground/20" />
              )}
            </div>

            {/* Actions */}
            {isAuthenticated && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1.5">
                    Your Rating
                  </p>
                  <StarRating
                    value={ratingsMap.get(movie.id) || 0}
                    onChange={(rating) =>
                      rateMutation.mutate({ movieId: movie.id, rating })
                    }
                    size="lg"
                    showLabel
                  />
                </div>
                <Button
                  variant={isInWatchlist ? "secondary" : "outline"}
                  className="w-full gap-2"
                  onClick={toggleWatchlist}
                >
                  {isInWatchlist ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      In Watchlist
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      Add to Watchlist
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Title & Meta */}
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cleanTitle}
              </h1>
              {detail?.tagline && (
                <p className="text-muted-foreground italic mb-3">
                  "{detail.tagline}"
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {movie.year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {movie.year}
                  </span>
                )}
                {detail?.runtime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {Math.floor(detail.runtime / 60)}h {detail.runtime % 60}m
                  </span>
                )}
                {movie.avgRating && (
                  <span className="flex items-center gap-1">
                    <Star
                      className="w-4 h-4"
                      style={{ color: "oklch(0.82 0.12 85)" }}
                    />
                    <span className="font-medium text-foreground">
                      {movie.avgRating.toFixed(1)}
                    </span>
                    <span className="text-xs">
                      ({movie.ratingCount} ratings)
                    </span>
                  </span>
                )}
                {detail?.voteAverage ? (
                  <span className="flex items-center gap-1">
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                      TMDB {detail.voteAverage.toFixed(1)}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <Badge key={genre} variant="secondary">
                  {genre}
                </Badge>
              ))}
            </div>

            {/* Synopsis */}
            {detail?.overview && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Synopsis</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {detail.overview}
                </p>
              </div>
            )}

            {/* Trailers */}
            {detail?.trailers && detail.trailers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Trailers</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detail.trailers.map((trailer) => (
                    <a
                      key={trailer.id}
                      href={`https://www.youtube.com/watch?v=${trailer.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-md bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                        <Play className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          {trailer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {trailer.type} · YouTube
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Cast */}
            {detail?.cast && detail.cast.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {detail.cast.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border/50"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                        {member.profilePath ? (
                          <img
                            src={member.profilePath}
                            alt={member.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Users className="w-5 h-5 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {member.character}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Movies */}
            {detail?.similar && detail.similar.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Similar Movies</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {detail.similar.map((sim) => (
                    <Card
                      key={sim.id}
                      className="overflow-hidden bg-card border-border/50 cursor-default"
                    >
                      <div className="aspect-[2/3] overflow-hidden bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                        {sim.posterPath ? (
                          <img
                            src={sim.posterPath}
                            alt={sim.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Film className="w-10 h-10 text-muted-foreground/20" />
                        )}
                      </div>
                      <CardContent className="p-2.5">
                        <p className="text-sm font-medium line-clamp-2 leading-tight">
                          {sim.title}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          {sim.releaseDate && (
                            <span>{sim.releaseDate.slice(0, 4)}</span>
                          )}
                          {sim.voteAverage > 0 && (
                            <span className="flex items-center gap-0.5">
                              <span
                                style={{ color: "oklch(0.82 0.12 85)" }}
                              >
                                ★
                              </span>
                              {sim.voteAverage.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* TMDB loading state */}
            {detailQuery.isLoading && tmdbId && (
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            )}

            {/* IMDB link */}
            {movie.imdbId && (
              <div>
                <a
                  href={`https://www.imdb.com/title/tt${movie.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on IMDb
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
