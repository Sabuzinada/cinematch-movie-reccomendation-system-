import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import Navbar from "@/components/Navbar";
import RecommendationCard from "@/components/RecommendationCard";
import {
  Film,
  Sparkles,
  Star,
  Users,
  Brain,
  ArrowRight,
  RefreshCw,
  Bookmark,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { usePosters } from "@/hooks/usePosters";

export default function Home() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [recCount, setRecCount] = useState(3);

  const ratingCount = trpc.ratings.count.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const recInput = useMemo(() => ({ count: recCount }), [recCount]);

  const recommendations = trpc.recommendations.get.useQuery(recInput, {
    enabled: isAuthenticated && (ratingCount.data ?? 0) >= 3,
    staleTime: 60_000,
  });

  const watchlistIds = trpc.watchlist.ids.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const watchlistCount = trpc.watchlist.count.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const watchlistSet = useMemo(
    () => new Set(watchlistIds.data ?? []),
    [watchlistIds.data]
  );

  // Fetch posters for recommendation movies
  const tmdbIds = useMemo(
    () => (recommendations.data ?? []).map((r) => r.movie.tmdbId),
    [recommendations.data]
  );
  const posterMap = usePosters(tmdbIds);

  const rateMutation = trpc.ratings.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating saved!");
      recommendations.refetch();
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
      watchlistCount.refetch();
    },
    onError: () => {
      toast.error("Failed to add to watchlist");
    },
  });

  const removeWatchlistMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed from watchlist");
      watchlistIds.refetch();
      watchlistCount.refetch();
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

  // Not logged in: show landing page
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <LandingHero />
      </div>
    );
  }

  // Loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Logged in but needs onboarding (fewer than 3 ratings)
  const needsOnboarding = (ratingCount.data ?? 0) < 3;

  if (needsOnboarding && !ratingCount.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8 page-enter">
          <div className="text-center mb-8">
            <h1
              className="text-3xl font-bold mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Welcome to CineMatch
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Rate at least 3 movies to get personalized recommendations.
              The more you rate, the better your recommendations become.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              You've rated{" "}
              <span className="font-semibold text-primary">
                {ratingCount.data ?? 0}
              </span>{" "}
              / 3 movies so far.
            </p>
          </div>
          <div className="text-center">
            <Button
              size="lg"
              onClick={() => navigate("/browse")}
              className="gap-2"
            >
              <Film className="w-5 h-5" />
              Browse & Rate Movies
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Main dashboard with recommendations
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-8 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your Recommendations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Based on your {ratingCount.data ?? 0} ratings
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Recommendation count slider */}
            <div className="flex items-center gap-2 bg-card border border-border/50 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Show:
              </span>
              <Slider
                value={[recCount]}
                onValueChange={([val]) => setRecCount(val)}
                min={1}
                max={10}
                step={1}
                className="w-24"
              />
              <span className="text-sm font-medium w-4 text-center">
                {recCount}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recommendations.refetch()}
              disabled={recommendations.isFetching}
              className="gap-1.5"
            >
              <RefreshCw
                className={`w-4 h-4 ${recommendations.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/browse")}
              className="gap-1.5"
            >
              <Film className="w-4 h-4" />
              Rate More
            </Button>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: recCount }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : recommendations.data && recommendations.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.data.map((rec) => (
              <RecommendationCard
                key={rec.movie.id}
                movie={rec.movie}
                predictedRating={rec.predictedRating}
                explanation={rec.explanation}
                method={rec.method}
                onRate={(rating) =>
                  rateMutation.mutate({ movieId: rec.movie.id, rating })
                }
                posterUrl={
                  rec.movie.tmdbId
                    ? posterMap[rec.movie.tmdbId]
                    : undefined
                }
                isInWatchlist={watchlistSet.has(rec.movie.id)}
                onToggleWatchlist={() => toggleWatchlist(rec.movie.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">
              Generating your recommendations...
            </p>
            <p className="text-sm mt-1">
              Rate more movies to improve your results.
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

        {/* Quick stats */}
        {!recommendations.isLoading && (
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-card border border-border/50 text-center">
              <Star
                className="w-6 h-6 mx-auto mb-2"
                style={{ color: "oklch(0.82 0.12 85)" }}
              />
              <p className="text-2xl font-bold">{ratingCount.data ?? 0}</p>
              <p className="text-xs text-muted-foreground">Movies Rated</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50 text-center">
              <Brain className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">
                {recommendations.data?.length ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Recommendations
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50 text-center">
              <Bookmark className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">
                {watchlistCount.data ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Watchlist
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">610+</p>
              <p className="text-xs text-muted-foreground">
                Community Profiles
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LandingHero() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container py-20 md:py-32 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Powered by Collaborative Filtering
            </div>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Discover Movies
              <br />
              <span style={{ color: "oklch(0.82 0.12 85)" }}>
                You'll Love
              </span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
              Rate your favorite films and our AI-powered recommendation engine
              finds hidden gems tailored to your unique taste.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="gap-2 text-base"
              >
                <Star className="w-5 h-5" />
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Star className="w-6 h-6" />}
            title="Rate Movies"
            description="Rate films on a 1-5 star scale. The more you rate, the smarter your recommendations become."
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Collaborative Filtering"
            description="Our algorithm finds users with similar taste and recommends movies they loved that you haven't seen."
          />
          <FeatureCard
            icon={<Brain className="w-6 h-6" />}
            title="Smart Explanations"
            description="Every recommendation comes with a personalized explanation of why it matches your preferences."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16 border-t border-border/50">
        <h2
          className="text-2xl font-bold text-center mb-12"
          style={{ fontFamily: "var(--font-display)" }}
        >
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <StepCard
            step={1}
            title="Sign In"
            description="Create an account to start building your movie profile."
          />
          <StepCard
            step={2}
            title="Rate Movies"
            description="Rate at least 3 movies you've seen. More ratings = better recommendations."
          />
          <StepCard
            step={3}
            title="Get Recommendations"
            description="Receive personalized picks with predicted ratings and explanations."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>
            Built with MovieLens dataset (100,000+ ratings) and collaborative
            filtering.
          </p>
          <p className="mt-1">
            A portfolio project demonstrating machine learning in web
            applications.
          </p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-card border border-border/50 text-center">
      <div
        className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4"
        style={{ color: "oklch(0.82 0.12 85)" }}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-bold"
        style={{
          backgroundColor: "oklch(0.82 0.12 85)",
          color: "oklch(0.15 0.01 260)",
        }}
      >
        {step}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
