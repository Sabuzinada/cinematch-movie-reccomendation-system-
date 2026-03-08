import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Sparkles, TrendingUp, Calendar, Bookmark, BookmarkCheck } from "lucide-react";
import StarRating from "./StarRating";
import { cn } from "@/lib/utils";

type RecommendationCardProps = {
  movie: {
    id: number;
    title: string;
    genres: string;
    year?: number | null;
    avgRating?: number | null;
    tmdbId?: number | null;
  };
  predictedRating: number;
  explanation: string;
  method: string;
  onRate?: (rating: number) => void;
  userRating?: number;
  posterUrl?: string;
  isInWatchlist?: boolean;
  onToggleWatchlist?: () => void;
};

function getCleanTitle(title: string): string {
  return title.replace(/\s*\(\d{4}\)\s*$/, "");
}

export default function RecommendationCard({
  movie,
  predictedRating,
  explanation,
  method,
  onRate,
  userRating,
  posterUrl,
  isInWatchlist,
  onToggleWatchlist,
}: RecommendationCardProps) {
  const genres = movie.genres
    .split("|")
    .filter((g) => g !== "(no genres listed)")
    .slice(0, 4);
  const cleanTitle = getCleanTitle(movie.title);

  return (
    <Card className="movie-card overflow-hidden bg-card border-border/50 relative group">
      {/* Method badge */}
      <div className="absolute top-3 right-3 z-10">
        <Badge
          variant="outline"
          className="text-[10px] border-primary/30 text-primary bg-background/80 backdrop-blur-sm"
        >
          {method === "collaborative" ? (
            <>
              <TrendingUp className="w-3 h-3 mr-1" />
              Collaborative
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              Genre Match
            </>
          )}
        </Badge>
      </div>

      {/* Poster area */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/10 via-secondary to-accent flex items-center justify-center">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={cleanTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Film className="w-12 h-12 text-muted-foreground/20" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card to-transparent h-16" />
        {/* Watchlist button overlay */}
        {onToggleWatchlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchlist();
            }}
            className={cn(
              "absolute top-3 left-3 p-1.5 rounded-md backdrop-blur-sm transition-all z-10",
              isInWatchlist
                ? "bg-primary/80 text-primary-foreground"
                : "bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground opacity-0 group-hover:opacity-100"
            )}
            title={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          >
            {isInWatchlist ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      <CardContent className="p-4 -mt-6 relative">
        <h3 className="text-lg font-semibold leading-tight line-clamp-2 mb-1">
          {cleanTitle}
        </h3>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {movie.year && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {movie.year}
            </span>
          )}
          {movie.avgRating && (
            <span className="flex items-center gap-1">
              <span style={{ color: "oklch(0.82 0.12 85)" }}>★</span>
              {movie.avgRating.toFixed(1)} avg
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {genres.map((genre) => (
            <Badge
              key={genre}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {genre}
            </Badge>
          ))}
        </div>

        {/* Predicted rating */}
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
          <span className="text-xs font-medium text-muted-foreground">
            Predicted for you:
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: "oklch(0.82 0.12 85)" }}
          >
            {predictedRating.toFixed(1)}/5
          </span>
        </div>

        {/* Explanation */}
        {explanation && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 italic">
            "{explanation}"
          </p>
        )}

        {/* Rate this movie */}
        {onRate && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-1.5">
              Rate this movie:
            </p>
            <StarRating
              value={userRating || 0}
              onChange={onRate}
              size="md"
              showLabel
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
