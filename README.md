# SwipeLog

SwipeLog is an Expo app for discovering movies, building a watchlist, logging watched films, and organizing personal movie lists.

## What It Does

- Browse and search movies with TMDB data
- Save movies to a watchlist
- Log watched movies with ratings and notes
- Keep a diary of watch history
- Create custom lists and tier lists
- Import Letterboxd data
- Optionally sync app state with Supabase

## Tech Stack

- Expo 56
- React Native
- Expo Router
- NativeWind
- Supabase
- TMDB API

## Getting Started

Install dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in the environment values you need:

```bash
EXPO_PUBLIC_ENABLE_AUTH=false
EXPO_PUBLIC_ENABLE_CLOUD_SYNC=false
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_TMDB_API_KEY=
EXPO_PUBLIC_TMDB_BASE_URL=https://api.themoviedb.org/3
```

Start the app:

```bash
npm run start
```

Run checks:

```bash
npm run check
```

## Git Workflow

Create a branch for each focused change:

```bash
git switch -c feature/my-change
```

Commit the change:

```bash
git add .
git commit -m "Describe the change"
```

Push the branch:

```bash
git push -u origin feature/my-change
```

Then open a pull request on GitHub.
