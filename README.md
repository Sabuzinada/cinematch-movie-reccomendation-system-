# CineMatch — Intelligent Movie Recommender

A full-stack movie recommendation web app with collaborative filtering, TMDB poster integration, and LLM-powered recommendation explanations. Built with React 19, tRPC, Express, Drizzle ORM, and Tailwind CSS 4.

## Features

- **Collaborative Filtering** — Recommends movies based on rating patterns from 100K+ MovieLens community ratings
- **LLM-Powered Explanations** — Each recommendation includes a personalized explanation referencing your taste
- **TMDB Integration** — Real movie posters, synopses, cast photos, and trailer links
- **Watchlist** — Save movies for later with a dedicated watchlist page
- **Interactive Ratings** — 1-5 star rating system with instant feedback
- **Movie Detail Pages** — Full info with cast, trailers, similar movies
- **Browse & Sort** — Search, genre filter, and sort by popularity/rating/year/title
- **Adjustable Recommendations** — Slider to request 1-10 recommendations at once
- **Dark Cinema Theme** — Warm amber/gold accents on a dark background
- **Email/Password Auth** — JWT-based sessions with registration and login

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter |
| API | tRPC 11, Express 4, Superjson |
| Database | MySQL (Drizzle ORM) |
| Auth | JWT (jose), SHA-256 password hashing |
| LLM | OpenAI API (gpt-4o-mini) |
| Movie Data | TMDB API, MovieLens ml-latest-small |

---

## Prerequisites

- **Node.js 20+** and **pnpm** (or npm/yarn)
- **MySQL database** — Any MySQL-compatible database works:
  - [PlanetScale](https://planetscale.com/) (free tier available)
  - [TiDB Cloud](https://tidbcloud.com/) (free tier available)
  - [Railway MySQL](https://railway.app/)
  - Local MySQL 8+
- **OpenAI API key** — For recommendation explanations ([platform.openai.com](https://platform.openai.com/))
- **TMDB API key** — For movie posters and details ([themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))

---

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/cinematch.git
cd cinematch
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
DATABASE_URL=mysql://user:password@host:port/database?ssl={"rejectUnauthorized":true}
JWT_SECRET=your-random-secret-string-at-least-32-chars
OPENAI_API_KEY=sk-...
TMDB_API_KEY=your-tmdb-api-key
```

**Generating a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Push database schema

```bash
pnpm db:push
```

This creates all tables (users, movies, community_ratings, user_ratings, watchlist).

### 4. Seed the MovieLens dataset

Download the [ml-latest-small dataset](https://grouplens.org/datasets/movielens/latest/) and extract it:

```bash
mkdir -p data
cd data
wget https://files.grouplens.org/datasets/movielens/ml-latest-small.zip
unzip ml-latest-small.zip
cd ..
```

Run the seed script:

```bash
pnpm seed
```

This loads ~9,700 movies and ~60K community ratings for collaborative filtering.

### 5. Start development servers

```bash
pnpm dev
```

This starts both the Express API server (port 3000) and Vite dev server (port 5173) concurrently. Open **http://localhost:5173** in your browser.

---

## Git Repository Setup

### Initialize and push to GitHub

```bash
cd cinematch
git init
git add .
git commit -m "Initial commit: CineMatch movie recommender"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cinematch.git
git push -u origin main
```

### Recommended .gitignore (already included)

The `.gitignore` excludes `node_modules/`, `dist/`, `.env`, and `data/` (the MovieLens dataset).

---


## Project Structure

```
cinematch/
├── api/                    # Vercel serverless functions
│   └── trpc/[trpc].ts     # tRPC handler for Vercel
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # shadcn/ui components
│   │   │   ├── MovieCard.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── RecommendationCard.tsx
│   │   │   └── StarRating.tsx
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   └── usePosters.ts
│   │   ├── pages/          # Page components
│   │   │   ├── Home.tsx
│   │   │   ├── Browse.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── MovieDetail.tsx
│   │   │   ├── MyRatings.tsx
│   │   │   └── Watchlist.tsx
│   │   ├── App.tsx         # Routes
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Theme & global styles
│   └── index.html
├── drizzle/                # Database schema & migrations
│   └── schema.ts
├── server/                 # Backend
│   ├── index.ts            # Express server entry
│   ├── context.ts          # tRPC context (JWT auth)
│   ├── trpc.ts             # tRPC procedure definitions
│   ├── routers.ts          # All API endpoints
│   ├── db.ts               # Database query helpers
│   ├── llm.ts              # OpenAI API helper
│   ├── recommend.ts        # Recommendation engine
│   └── tmdb.ts             # TMDB API integration
├── shared/                 # Shared types & constants
├── seed-db.mjs             # Database seeding script
├── vercel.json             # Vercel deployment config
├── .env.example            # Environment variable template
└── package.json
```

---

## How It Works

### Collaborative Filtering

1. When you rate movies, the system compares your ratings against 100K+ MovieLens community ratings
2. It finds community users with similar taste (Pearson correlation > 0.1, minimum 3 overlapping ratings)
3. The top 30 most similar users' unrated movies are scored by weighted average
4. Movies with predicted rating >= 3.0 and confidence >= 2 are selected as candidates

### LLM Explanations

After selecting recommendation candidates, the system sends your rating history and the recommended movies to GPT-4o-mini, which generates personalized explanations referencing specific patterns in your preferences.

### Fallback Strategy

If collaborative filtering doesn't find enough candidates (e.g., new user with few ratings), the system falls back to genre-based recommendations using your highest-rated genres.

---

