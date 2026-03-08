import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StarRating from "./StarRating";
import { Film, Calendar, Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type MovieCardProps = {
  movie: {
    id: number;
    title: string;
    genres: string;
    year?: number | null;
    avgRating?: number | null;
    tmdbId?: number | null;
  };
  userRating?: number;
  onRate?: (rating: number) => void;
  posterUrl?: string;
  isInWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  compact?: boolean;
  className?: string;
};

function getCleanTitle(title: string): string {
  return title.replace(/\s*\(\d{4}\)\s*$/, "");
}

export default function MovieCard({
  movie,
  userRating,
  onRate,
  posterUrl,
  isInWatchlist,
  onToggleWatchlist,
  compact = false,
  className,
}: MovieCardProps) {
  const genres = movie.genres
    .split("|")
    .filter((g) => g !== "(no genres listed)")
    .slice(0, 3);
  const cleanTitle = getCleanTitle(movie.title);

  return (
    <Card
      className={cn(
        "movie-card overflow-hidden bg-card border-border/50 group",
        compact ? "flex flex-row" : "",
        className
      )}
    >
      {/* Poster area - clickable to detail page */}
      <Link href={`/movie/${movie.id}`}>
        <div
          className={cn(
            "relative overflow-hidden bg-gradient-to-br from-secondary to-accent flex items-center justify-center cursor-pointer",
            compact ? "w-20 shrink-0" : "aspect-[2/3] w-full"
          )}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={cleanTitle}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <Film
              className={cn(
                "text-muted-foreground/20",
                compact ? "w-8 h-8" : "w-16 h-16"
              )}
            />
          )}
          {movie.avgRating && !compact && (
            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs font-medium flex items-center gap-1">
              <span style={{ color: "oklch(0.82 0.12 85)" }}>★</span>
              {movie.avgRating.toFixed(1)}
            </div>
          )}
          {/* Watchlist button overlay */}
          {onToggleWatchlist && !compact && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleWatchlist();
              }}
              className={cn(
                "absolute top-2 left-2 p-1.5 rounded-md backdrop-blur-sm transition-all",
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
      </Link>

      <CardContent className={cn("p-3", compact ? "flex-1 py-2" : "")}>
        <Link href={`/movie/${movie.id}`}>
          <h3
            className={cn(
              "font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors",
              compact ? "text-sm" : "text-base mb-1"
            )}
            title={movie.title}
          >
            {cleanTitle}
          </h3>
        </Link>

        {movie.year && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" />
            {movie.year}
          </div>
        )}

        {!compact && (
          <div className="flex flex-wrap gap-1 mt-2">
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
        )}

        {onRate && (
          <div className={cn("mt-2", compact ? "mt-1" : "mt-3")}>
            <StarRating
              value={userRating || 0}
              onChange={onRate}
              size={compact ? "sm" : "md"}
              showLabel={!compact}
            />
          </div>
        )}

        {userRating && !onRate && (
          <div className="mt-2">
            <StarRating value={userRating} readonly size="sm" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
