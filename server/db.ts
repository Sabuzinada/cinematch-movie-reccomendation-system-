import { and, desc, eq, like, inArray, sql, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users,
  movies,
  communityRatings,
  userRatings,
  watchlist,
  type Movie,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ---- User helpers ----

export async function createUser(email: string, passwordHash: string, name?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values({
    email,
    passwordHash,
    name: name || null,
    lastSignedIn: new Date(),
  });
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

// ---- Movie helpers ----

export type SortOption = "popular" | "highest_rated" | "newest" | "title_az";

export async function searchMovies(
  query: string,
  genre: string | null,
  limit: number = 20,
  offset: number = 0,
  sortBy: SortOption = "popular"
) {
  const db = await getDb();
  if (!db) return { movies: [], total: 0 };

  const conditions = [];
  if (query) {
    conditions.push(like(movies.title, `%${query}%`));
  }
  if (genre) {
    conditions.push(like(movies.genres, `%${genre}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  let orderByClause;
  switch (sortBy) {
    case "highest_rated":
      orderByClause = [desc(movies.avgRating), desc(movies.ratingCount)];
      break;
    case "newest":
      orderByClause = [desc(movies.year), desc(movies.ratingCount)];
      break;
    case "title_az":
      orderByClause = [asc(movies.title)];
      break;
    case "popular":
    default:
      orderByClause = [desc(movies.ratingCount)];
      break;
  }

  const [results, countResult] = await Promise.all([
    db
      .select()
      .from(movies)
      .where(where)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(movies)
      .where(where),
  ]);

  return { movies: results, total: countResult[0].count };
}

export async function getPopularMovies(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(movies)
    .where(sql`${movies.ratingCount} >= 100`)
    .orderBy(desc(movies.ratingCount))
    .limit(limit);
}

export async function getMovieById(movieId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);
  return result[0] ?? null;
}

export async function getMoviesByIds(movieIds: number[]) {
  const db = await getDb();
  if (!db || movieIds.length === 0) return [];
  return db.select().from(movies).where(inArray(movies.id, movieIds));
}

// ---- User Rating helpers ----

export async function upsertUserRating(
  userId: number,
  movieId: number,
  rating: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(userRatings)
    .where(and(eq(userRatings.userId, userId), eq(userRatings.movieId, movieId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userRatings)
      .set({ rating })
      .where(eq(userRatings.id, existing[0].id));
  } else {
    await db.insert(userRatings).values({ userId, movieId, rating });
  }
}

export async function getUserRatings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: userRatings.id,
      movieId: userRatings.movieId,
      rating: userRatings.rating,
      title: movies.title,
      genres: movies.genres,
      year: movies.year,
      tmdbId: movies.tmdbId,
      avgRating: movies.avgRating,
      createdAt: userRatings.createdAt,
    })
    .from(userRatings)
    .innerJoin(movies, eq(userRatings.movieId, movies.id))
    .where(eq(userRatings.userId, userId))
    .orderBy(desc(userRatings.updatedAt));
}

export async function getUserRatingCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userRatings)
    .where(eq(userRatings.userId, userId));
  return result[0].count;
}

export async function setOnboardingComplete(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ onboardingComplete: true })
    .where(eq(users.id, userId));
}

// ---- Collaborative Filtering helpers ----

export async function findSimilarUsersAndCandidates(
  userId: number,
  limit: number = 3
) {
  const db = await getDb();
  if (!db) return { candidates: [], userRatedIds: [] };

  const myRatings = await db
    .select({ movieId: userRatings.movieId, rating: userRatings.rating })
    .from(userRatings)
    .where(eq(userRatings.userId, userId));

  if (myRatings.length === 0) return { candidates: [], userRatedIds: [] };

  const userRatedIds = myRatings.map((r) => r.movieId);
  const userRatingMap = new Map(myRatings.map((r) => [r.movieId, r.rating]));

  const overlapUsers = await db
    .select({
      mlUserId: communityRatings.mlUserId,
      overlapCount: sql<number>`COUNT(*)`,
    })
    .from(communityRatings)
    .where(inArray(communityRatings.movieId, userRatedIds))
    .groupBy(communityRatings.mlUserId)
    .having(sql`COUNT(*) >= 3`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(50);

  if (overlapUsers.length === 0) return { candidates: [], userRatedIds };

  const mlUserIds = overlapUsers.map((u) => u.mlUserId);

  const similarRatings = await db
    .select()
    .from(communityRatings)
    .where(inArray(communityRatings.mlUserId, mlUserIds));

  type SimilarUser = {
    mlUserId: number;
    similarity: number;
    ratings: Map<number, number>;
  };

  const userGroups = new Map<number, Map<number, number>>();
  for (const r of similarRatings) {
    if (!userGroups.has(r.mlUserId)) userGroups.set(r.mlUserId, new Map());
    userGroups.get(r.mlUserId)!.set(r.movieId, r.rating);
  }

  const similarUsers: SimilarUser[] = [];
  for (const [mlUserId, ratingsMap] of Array.from(userGroups.entries())) {
    const overlap: { mine: number; theirs: number }[] = [];
    for (const [movieId, myRating] of Array.from(userRatingMap.entries())) {
      if (ratingsMap.has(movieId)) {
        overlap.push({ mine: myRating, theirs: ratingsMap.get(movieId)! });
      }
    }
    if (overlap.length < 3) continue;

    const myMean = overlap.reduce((s, o) => s + o.mine, 0) / overlap.length;
    const theirMean =
      overlap.reduce((s, o) => s + o.theirs, 0) / overlap.length;

    let numerator = 0;
    let denomA = 0;
    let denomB = 0;
    for (const o of overlap) {
      const a = o.mine - myMean;
      const b = o.theirs - theirMean;
      numerator += a * b;
      denomA += a * a;
      denomB += b * b;
    }
    const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
    const similarity = denom === 0 ? 0 : numerator / denom;

    if (similarity > 0.1) {
      similarUsers.push({ mlUserId, similarity, ratings: ratingsMap });
    }
  }

  similarUsers.sort((a, b) => b.similarity - a.similarity);
  const topUsers = similarUsers.slice(0, 30);

  const predictions = new Map<
    number,
    { weightedSum: number; weightTotal: number; count: number }
  >();

  for (const su of topUsers) {
    for (const [movieId, rating] of Array.from(su.ratings.entries())) {
      if (userRatedIds.includes(movieId)) continue;
      if (!predictions.has(movieId)) {
        predictions.set(movieId, { weightedSum: 0, weightTotal: 0, count: 0 });
      }
      const p = predictions.get(movieId)!;
      p.weightedSum += su.similarity * rating;
      p.weightTotal += Math.abs(su.similarity);
      p.count += 1;
    }
  }

  const candidates = Array.from(predictions.entries())
    .map(([movieId, p]) => ({
      movieId,
      predictedRating:
        p.weightTotal > 0
          ? Math.round((p.weightedSum / p.weightTotal) * 100) / 100
          : 0,
      confidence: p.count,
    }))
    .filter((c) => c.predictedRating >= 3.0 && c.confidence >= 2)
    .sort((a, b) => {
      if (Math.abs(b.predictedRating - a.predictedRating) > 0.3)
        return b.predictedRating - a.predictedRating;
      return b.confidence - a.confidence;
    })
    .slice(0, limit);

  return { candidates, userRatedIds };
}

// ---- Watchlist helpers ----

export async function addToWatchlist(userId: number, movieId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.movieId, movieId)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(watchlist).values({ userId, movieId });
}

export async function removeFromWatchlist(userId: number, movieId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.movieId, movieId)));
}

export async function getUserWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: watchlist.id,
      movieId: watchlist.movieId,
      title: movies.title,
      genres: movies.genres,
      year: movies.year,
      tmdbId: movies.tmdbId,
      avgRating: movies.avgRating,
      ratingCount: movies.ratingCount,
      createdAt: watchlist.createdAt,
    })
    .from(watchlist)
    .innerJoin(movies, eq(watchlist.movieId, movies.id))
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt));
}

export async function getUserWatchlistIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ movieId: watchlist.movieId })
    .from(watchlist)
    .where(eq(watchlist.userId, userId));
  return rows.map((r) => r.movieId);
}

export async function getWatchlistCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(watchlist)
    .where(eq(watchlist.userId, userId));
  return result[0].count;
}

// ---- Genre-based fallback recommendations ----

export async function getGenreBasedRecommendations(
  userId: number,
  limit: number = 3
) {
  const db = await getDb();
  if (!db) return [];

  const topRated = await db
    .select({ movieId: userRatings.movieId, rating: userRatings.rating, genres: movies.genres })
    .from(userRatings)
    .innerJoin(movies, eq(userRatings.movieId, movies.id))
    .where(and(eq(userRatings.userId, userId), sql`${userRatings.rating} >= 4`));

  if (topRated.length === 0) {
    return db
      .select()
      .from(movies)
      .where(sql`${movies.ratingCount} >= 100 AND ${movies.avgRating} >= 4.0`)
      .orderBy(desc(movies.avgRating))
      .limit(limit);
  }

  const genreCounts = new Map<string, number>();
  for (const r of topRated) {
    for (const g of r.genres.split("|")) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
  }

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const allUserRatings = await db
    .select({ movieId: userRatings.movieId })
    .from(userRatings)
    .where(eq(userRatings.userId, userId));
  const allRatedIds = allUserRatings.map((r) => r.movieId);

  const genreConditions = topGenres.map((g) => like(movies.genres, `%${g}%`));

  const candidates = await db
    .select()
    .from(movies)
    .where(
      and(
        sql`${movies.ratingCount} >= 50`,
        sql`${movies.avgRating} >= 3.5`,
        sql`(${genreConditions.map((c) => sql`${c}`).reduce((a, b) => sql`${a} OR ${b}`)})`
      )
    )
    .orderBy(desc(movies.avgRating))
    .limit(limit + allRatedIds.length + 10);

  return candidates
    .filter((m) => !allRatedIds.includes(m.id))
    .slice(0, limit);
}
