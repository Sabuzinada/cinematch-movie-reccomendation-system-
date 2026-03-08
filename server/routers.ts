import { COOKIE_NAME } from "../shared/const";
import { publicProcedure, protectedProcedure, router } from "./trpc";
import { z } from "zod";
import { SignJWT } from "jose";
import {
  searchMovies,
  getPopularMovies,
  getMovieById,
  upsertUserRating,
  getUserRatings,
  getUserRatingCount,
  setOnboardingComplete,
  addToWatchlist,
  removeFromWatchlist,
  getUserWatchlist,
  getUserWatchlistIds,
  getWatchlistCount,
  createUser,
  getUserByEmail,
  getUserById,
  updateLastSignedIn,
} from "./db";
import { getRecommendations } from "./recommend";
import { fetchPosterUrls, fetchMovieDetail } from "./tmdb";
import { TRPCError } from "@trpc/server";

// Simple password hashing using Web Crypto (no bcrypt dependency needed)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSessionToken(user: {
  id: number;
  email: string;
  name: string | null;
  role: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
  return new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(secret);
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: "/",
};

export const appRouter = router({
  auth: router({
    /** Get current user */
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const user = await getUserById(ctx.user.id);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
      };
    }),

    /** Register a new user */
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(6, "Password must be at least 6 characters"),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists",
          });
        }

        const passwordHash = await hashPassword(input.password);
        const user = await createUser(input.email, passwordHash, input.name);

        const token = await createSessionToken(user);
        ctx.res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }),

    /** Login with email/password */
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const passwordHash = await hashPassword(input.password);
        if (user.passwordHash !== passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        await updateLastSignedIn(user.id);
        const token = await createSessionToken(user);
        ctx.res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }),

    /** Logout */
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  movies: router({
    search: publicProcedure
      .input(
        z.object({
          query: z.string().default(""),
          genre: z.string().nullable().default(null),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          sortBy: z
            .enum(["popular", "highest_rated", "newest", "title_az"])
            .default("popular"),
        })
      )
      .query(async ({ input }) => {
        return searchMovies(
          input.query,
          input.genre,
          input.limit,
          input.offset,
          input.sortBy
        );
      }),

    popular: publicProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return getPopularMovies(input?.limit ?? 50);
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getMovieById(input.id);
      }),

    detail: publicProcedure
      .input(z.object({ tmdbId: z.number() }))
      .query(async ({ input }) => {
        return fetchMovieDetail(input.tmdbId);
      }),

    posters: publicProcedure
      .input(
        z.object({
          tmdbIds: z.array(z.number()).max(50),
        })
      )
      .query(async ({ input }) => {
        const posterMap = await fetchPosterUrls(input.tmdbIds);
        const result: Record<number, string> = {};
        for (const [id, url] of Array.from(posterMap.entries())) {
          result[id] = url;
        }
        return result;
      }),
  }),

  ratings: router({
    rate: protectedProcedure
      .input(
        z.object({
          movieId: z.number(),
          rating: z.number().min(1).max(5),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertUserRating(ctx.user.id, input.movieId, input.rating);
        return { success: true };
      }),

    myRatings: protectedProcedure.query(async ({ ctx }) => {
      return getUserRatings(ctx.user.id);
    }),

    count: protectedProcedure.query(async ({ ctx }) => {
      return getUserRatingCount(ctx.user.id);
    }),

    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await setOnboardingComplete(ctx.user.id);
      return { success: true };
    }),
  }),

  watchlist: router({
    add: protectedProcedure
      .input(z.object({ movieId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await addToWatchlist(ctx.user.id, input.movieId);
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ movieId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await removeFromWatchlist(ctx.user.id, input.movieId);
        return { success: true };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserWatchlist(ctx.user.id);
    }),

    ids: protectedProcedure.query(async ({ ctx }) => {
      return getUserWatchlistIds(ctx.user.id);
    }),

    count: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlistCount(ctx.user.id);
    }),
  }),

  recommendations: router({
    get: protectedProcedure
      .input(
        z
          .object({
            count: z.number().min(1).max(10).default(3),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const count = input?.count ?? 3;
        const recs = await getRecommendations(ctx.user.id, count);
        return recs.map((r) => ({
          movie: r.movie,
          predictedRating: r.predictedRating,
          explanation: r.explanation,
          method: r.method,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
