# SwipeLog

SwipeLog is an Expo app for discovering movies, building a watchlist, logging watched films, and organizing personal movie lists.

## What It Does

- Browse and search movies with TMDB data
- Save movies to a watchlist
- Log watched movies with ratings and notes
- Keep a diary of watch history
- Create custom lists and tier lists
- Import Letterboxd data
- Optionally sync app state with Firebase

## Tech Stack

- Expo 56
- React Native
- Expo Router
- NativeWind
- Firebase Auth and Firestore
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
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_TMDB_PROXY_URL=
# Optional for local development only:
EXPO_PUBLIC_TMDB_API_KEY=
EXPO_PUBLIC_TMDB_BASE_URL=https://api.themoviedb.org/3
```

Production and preview builds should not expose a TMDB token through `EXPO_PUBLIC_*`.
Set `EXPO_PUBLIC_TMDB_PROXY_URL` to a backend endpoint that injects the TMDB token server-side.
The local `EXPO_PUBLIC_TMDB_API_KEY` fallback is only for developer machines and should not be
set in EAS preview or production environments.

Start the app:

```bash
npm run start
```

Run checks:

```bash
npm run check
```

## Cloud Sync

Cloud sync requires Firebase Auth, Firestore, and environment variables. See [Cloud Sync Setup](docs/cloud-sync-setup.md).

## Release Observability

Crash reporting is wired through Sentry when `EXPO_PUBLIC_SENTRY_DSN` is present.
Before store submission, run the real-device crash and performance pass in
[Release Observability Checklist](docs/release-observability-checklist.md).

## Product Strategy

The future roadmap, premium positioning, platform plan, and monetization strategy are tracked in [Product Roadmap](docs/product-roadmap.md).

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
