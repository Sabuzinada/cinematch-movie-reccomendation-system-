import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Users table with email/password authentication.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  onboardingComplete: boolean("onboardingComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Movies table seeded from MovieLens dataset.
 */
export const movies = mysqlTable(
  "movies",
  {
    id: int("id").primaryKey(), // MovieLens movieId
    title: varchar("title", { length: 512 }).notNull(),
    genres: varchar("genres", { length: 512 }).notNull(), // pipe-separated
    year: int("year"), // extracted from title
    tmdbId: int("tmdbId"),
    imdbId: varchar("imdbId", { length: 20 }),
    avgRating: float("avgRating"), // pre-computed from community ratings
    ratingCount: int("ratingCount").default(0), // number of community ratings
  },
  (table) => [
    index("movies_title_idx").on(table.title),
    index("movies_genres_idx").on(table.genres),
    index("movies_avg_rating_idx").on(table.avgRating),
  ]
);

export type Movie = typeof movies.$inferSelect;
export type InsertMovie = typeof movies.$inferInsert;

/**
 * Community ratings from MovieLens dataset (used for collaborative filtering).
 */
export const communityRatings = mysqlTable(
  "community_ratings",
  {
    id: int("id").autoincrement().primaryKey(),
    mlUserId: int("mlUserId").notNull(), // MovieLens userId
    movieId: int("movieId").notNull(),
    rating: float("rating").notNull(), // 0.5 - 5.0
  },
  (table) => [
    index("cr_user_idx").on(table.mlUserId),
    index("cr_movie_idx").on(table.movieId),
    index("cr_user_movie_idx").on(table.mlUserId, table.movieId),
  ]
);

export type CommunityRating = typeof communityRatings.$inferSelect;

/**
 * User ratings - each authenticated user's movie ratings.
 */
export const userRatings = mysqlTable(
  "user_ratings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(), // references users.id
    movieId: int("movieId").notNull(), // references movies.id
    rating: float("rating").notNull(), // 1-5
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("ur_user_idx").on(table.userId),
    index("ur_movie_idx").on(table.movieId),
    index("ur_user_movie_idx").on(table.userId, table.movieId),
  ]
);

export type UserRating = typeof userRatings.$inferSelect;
export type InsertUserRating = typeof userRatings.$inferInsert;

/**
 * Watchlist - movies saved for later viewing.
 */
export const watchlist = mysqlTable(
  "watchlist",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    movieId: int("movieId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("wl_user_idx").on(table.userId),
    index("wl_user_movie_idx").on(table.userId, table.movieId),
  ]
);

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;
