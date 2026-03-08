import { invokeLLM } from "./llm";
import {
  findSimilarUsersAndCandidates,
  getGenreBasedRecommendations,
  getUserRatings,
  getMoviesByIds,
} from "./db";
import type { Movie } from "../drizzle/schema";

export type Recommendation = {
  movie: Movie;
  predictedRating: number;
  explanation: string;
  method: "collaborative" | "genre-based" | "popular";
};

/**
 * Generate personalized movie recommendations for a user.
 * Uses collaborative filtering first, falls back to genre-based.
 */
export async function getRecommendations(
  userId: number,
  count: number = 3
): Promise<Recommendation[]> {
  const { candidates, userRatedIds } = await findSimilarUsersAndCandidates(
    userId,
    count + 5
  );

  let recommendations: Recommendation[] = [];

  if (candidates.length >= count) {
    const movieIds = candidates.slice(0, count).map((c) => c.movieId);
    const movieList = await getMoviesByIds(movieIds);
    const movieMap = new Map(movieList.map((m) => [m.id, m]));

    for (const c of candidates.slice(0, count)) {
      const movie = movieMap.get(c.movieId);
      if (movie) {
        recommendations.push({
          movie,
          predictedRating: c.predictedRating,
          explanation: "",
          method: "collaborative",
        });
      }
    }
  }

  if (recommendations.length < count) {
    const needed = count - recommendations.length;
    const genreRecs = await getGenreBasedRecommendations(userId, needed + 5);
    const existingIds = new Set(recommendations.map((r) => r.movie.id));

    for (const movie of genreRecs) {
      if (existingIds.has(movie.id)) continue;
      if (recommendations.length >= count) break;
      recommendations.push({
        movie,
        predictedRating: movie.avgRating ?? 3.5,
        explanation: "",
        method: "genre-based",
      });
    }
  }

  if (recommendations.length > 0) {
    const userRatingsData = await getUserRatings(userId);
    recommendations = await addExplanations(recommendations, userRatingsData);
  }

  return recommendations;
}

async function addExplanations(
  recommendations: Recommendation[],
  userRatings: Array<{
    title: string;
    genres: string;
    rating: number;
  }>
): Promise<Recommendation[]> {
  const topRated = userRatings
    .filter((r) => r.rating >= 4)
    .slice(0, 10)
    .map((r) => `${r.title} (${r.rating}/5, ${r.genres})`)
    .join("; ");

  const lowRated = userRatings
    .filter((r) => r.rating <= 2)
    .slice(0, 5)
    .map((r) => `${r.title} (${r.rating}/5)`)
    .join("; ");

  const recsInfo = recommendations
    .map(
      (r, i) =>
        `${i + 1}. "${r.movie.title}" (${r.movie.genres}, predicted: ${r.predictedRating}/5, method: ${r.method})`
    )
    .join("\n");

  const prompt = `You are a movie recommendation engine. Based on a user's rating history, explain why each recommended movie would appeal to them.

User's highly-rated movies: ${topRated || "None yet"}
${lowRated ? `User's low-rated movies: ${lowRated}` : ""}

Recommended movies:
${recsInfo}

For each recommendation, write a concise 1-2 sentence explanation of why this movie matches the user's taste. Reference specific patterns in their preferences (genres, themes, directors, era). Be specific and insightful, not generic.

Return a JSON array of objects with "index" (1-based) and "explanation" fields.`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a knowledgeable movie recommendation assistant. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "explanations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              explanations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" },
                    explanation: { type: "string" },
                  },
                  required: ["index", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["explanations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      const explanations = parsed.explanations || parsed;

      for (const exp of explanations) {
        const idx = exp.index - 1;
        if (idx >= 0 && idx < recommendations.length) {
          recommendations[idx].explanation = exp.explanation;
        }
      }
    }
  } catch (error) {
    console.error("[Recommend] LLM explanation failed:", error);
    for (const rec of recommendations) {
      if (!rec.explanation) {
        rec.explanation = generateFallbackExplanation(rec, userRatings);
      }
    }
  }

  for (const rec of recommendations) {
    if (!rec.explanation) {
      rec.explanation = generateFallbackExplanation(rec, userRatings);
    }
  }

  return recommendations;
}

function generateFallbackExplanation(
  rec: Recommendation,
  userRatings: Array<{ title: string; genres: string; rating: number }>
): string {
  const recGenres = rec.movie.genres.split("|");
  const likedGenres = new Set<string>();
  for (const r of userRatings.filter((r) => r.rating >= 4)) {
    for (const g of r.genres.split("|")) likedGenres.add(g);
  }
  const matchingGenres = recGenres.filter((g) => likedGenres.has(g));

  if (matchingGenres.length > 0) {
    return `Recommended because you enjoy ${matchingGenres.join(" and ")} movies. This film has a ${rec.predictedRating.toFixed(1)}/5 predicted rating based on similar viewers' preferences.`;
  }
  return `Highly rated by viewers with similar taste (predicted ${rec.predictedRating.toFixed(1)}/5). A well-regarded ${recGenres[0]} film worth exploring.`;
}
