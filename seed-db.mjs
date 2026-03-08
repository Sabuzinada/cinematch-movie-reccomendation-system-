/**
 * Seed script: loads MovieLens ml-latest-small dataset into the database.
 *
 * Usage:
 *   1. Download ml-latest-small.zip from https://grouplens.org/datasets/movielens/
 *   2. Extract to ./data/ml-latest-small/ (so you have ./data/ml-latest-small/movies.csv etc.)
 *   3. Set DATABASE_URL in .env
 *   4. Run: node seed-db.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- tiny CSV parser (no external deps) ----
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ---- extract year from title like "Toy Story (1995)" ----
function extractYear(title) {
  const match = title.match(/\((\d{4})\)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

// ---- main ----
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required. Set it in your .env file.");
    process.exit(1);
  }

  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection(databaseUrl);

  console.log("Connected to database");

  // Check if movies table already has data
  const [rows] = await connection.execute("SELECT COUNT(*) as cnt FROM movies");
  if (rows[0].cnt > 0) {
    console.log(`Movies table already has ${rows[0].cnt} rows. Skipping seed.`);
    await connection.end();
    return;
  }

  // Look for data in ./data/ml-latest-small/ or ../ml-latest-small/
  let dataDir = path.join(__dirname, "data", "ml-latest-small");
  if (!fs.existsSync(dataDir)) {
    dataDir = path.join(__dirname, "data");
  }
  if (!fs.existsSync(path.join(dataDir, "movies.csv"))) {
    console.error(`Data directory not found or missing movies.csv in: ${dataDir}`);
    console.error("");
    console.error("To seed the database:");
    console.error("  1. Download ml-latest-small.zip from https://grouplens.org/datasets/movielens/latest/");
    console.error("  2. Extract it so you have: ./data/ml-latest-small/movies.csv");
    console.error("  3. Run this script again: node seed-db.mjs");
    process.exit(1);
  }

  // ---- Load links.csv for TMDB/IMDB IDs ----
  console.log("Loading links.csv...");
  const linksData = parseCSV(path.join(dataDir, "links.csv"));
  const linksMap = {};
  for (const row of linksData) {
    linksMap[row.movieId] = {
      imdbId: row.imdbId || null,
      tmdbId: row.tmdbId ? parseInt(row.tmdbId, 10) : null,
    };
  }

  // ---- Load and compute average ratings ----
  console.log("Loading ratings.csv and computing averages...");
  const ratingsData = parseCSV(path.join(dataDir, "ratings.csv"));
  const ratingAgg = {};
  for (const row of ratingsData) {
    const mid = parseInt(row.movieId, 10);
    if (!ratingAgg[mid]) ratingAgg[mid] = { sum: 0, count: 0 };
    ratingAgg[mid].sum += parseFloat(row.rating);
    ratingAgg[mid].count += 1;
  }

  // ---- Load movies.csv and insert ----
  console.log("Loading movies.csv...");
  const moviesData = parseCSV(path.join(dataDir, "movies.csv"));

  console.log(`Inserting ${moviesData.length} movies...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < moviesData.length; i += BATCH_SIZE) {
    const batch = moviesData.slice(i, i + BATCH_SIZE);
    const values = batch.map((m) => {
      const mid = parseInt(m.movieId, 10);
      const link = linksMap[mid] || {};
      const agg = ratingAgg[mid];
      const avgRating = agg ? Math.round((agg.sum / agg.count) * 100) / 100 : null;
      const ratingCount = agg ? agg.count : 0;
      return [
        mid,
        m.title,
        m.genres,
        extractYear(m.title),
        link.tmdbId || null,
        link.imdbId || null,
        avgRating,
        ratingCount,
      ];
    });

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const flat = values.flat();
    await connection.execute(
      `INSERT INTO movies (id, title, genres, year, tmdbId, imdbId, avgRating, ratingCount) VALUES ${placeholders}`,
      flat
    );
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, moviesData.length)}/${moviesData.length}\r`);
  }
  console.log("\nMovies inserted.");

  // ---- Insert community ratings (top 200 most-rated movies for collaborative filtering) ----
  const topMovieIds = Object.entries(ratingAgg)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 200)
    .map(([id]) => parseInt(id, 10));
  const topMovieSet = new Set(topMovieIds);

  const filteredRatings = ratingsData.filter((r) =>
    topMovieSet.has(parseInt(r.movieId, 10))
  );

  console.log(
    `Inserting ${filteredRatings.length} community ratings (top 200 movies)...`
  );
  const RATING_BATCH = 2000;
  for (let i = 0; i < filteredRatings.length; i += RATING_BATCH) {
    const batch = filteredRatings.slice(i, i + RATING_BATCH);
    const values = batch.map((r) => [
      parseInt(r.userId, 10),
      parseInt(r.movieId, 10),
      parseFloat(r.rating),
    ]);
    const placeholders = values.map(() => "(?, ?, ?)").join(", ");
    const flat = values.flat();
    await connection.execute(
      `INSERT INTO community_ratings (mlUserId, movieId, rating) VALUES ${placeholders}`,
      flat
    );
    process.stdout.write(
      `  ${Math.min(i + RATING_BATCH, filteredRatings.length)}/${filteredRatings.length}\r`
    );
  }
  console.log("\nCommunity ratings inserted.");

  // Verify
  const [movieCount] = await connection.execute("SELECT COUNT(*) as cnt FROM movies");
  const [ratingCount] = await connection.execute("SELECT COUNT(*) as cnt FROM community_ratings");
  console.log(`\nSeed complete: ${movieCount[0].cnt} movies, ${ratingCount[0].cnt} community ratings`);

  await connection.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
