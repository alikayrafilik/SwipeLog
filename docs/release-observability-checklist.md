# Release Observability Checklist

Use this checklist before every Play Store or App Store submission.

## Release Blockers

Confirm these before creating preview or production builds:

- `EXPO_PUBLIC_TMDB_PROXY_URL` is set in the matching EAS environment. Preview and production builds must not use `EXPO_PUBLIC_TMDB_API_KEY`.
- Firebase Auth and Firestore environment variables are set for the matching EAS environment.
- Firestore rules allow users to read and write only `user_app_state/{uid}`.
- Firestore rules cover shared watchlists: only members can read list data, members can add items and vote, and only owners can archive lists.
- Firestore rules are deployed before preview QA: `firebase deploy --only firestore:rules`.
- Shared watchlist loading does not fail the whole screen when a user's stale membership index points at a list they can no longer read.
- iOS `bundleIdentifier` and Android `package` match the intended store records.
- Sentry is configured for the release, or the team has explicitly accepted a no-Sentry build.
- `npm run check` passes, including `check:shared-watchlists`.
- Shared watchlist runtime evidence is recorded in `docs/shared-watchlists-qa-evidence.md`.

## Crash Analytics

1. Create a Sentry React Native project and copy its public DSN.
2. Add these values to the EAS preview and production environments:

```bash
EXPO_PUBLIC_SENTRY_DSN=<public dsn>
EXPO_PUBLIC_SENTRY_ENVIRONMENT=preview
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.2
SENTRY_AUTH_TOKEN=<sensitive org auth token>
```

Use `production` for `EXPO_PUBLIC_SENTRY_ENVIRONMENT` on the production profile.
Keep `SENTRY_AUTH_TOKEN` sensitive; never commit it.

3. Build an installable preview binary:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

4. Install the preview build on a real Android and iPhone.
5. Verify that Sentry receives:
   - app launch/session events
   - a non-fatal test error from a temporary local test build
   - route/user context without email or IP address
   - sourcemapped stack traces from EAS builds

Remove any temporary crash trigger before submitting.

## Real Device Performance Smoke Test

Run this on at least one mid-range Android device and one iPhone.
Do not use Expo Go for this pass; use a preview or production-like build.

Target thresholds:

- Cold launch to interactive: under 3 seconds on mid-range devices.
- Browse first contentful home render: under 2 seconds after auth/profile load.
- Search suggestion response after typing: under 750 ms after debounce.
- Discover swipe interaction: no visible dropped-frame bursts.
- Library tabs with 200+ movies: scroll stays smooth and images load progressively.
- Memory: no steady growth after 10 minutes of Browse, Discover, Library, Profile navigation.
- Crash-free manual pass: 30 minutes with no fatal crash or native ANR.

Test flow:

1. Fresh install, first launch, onboarding, auth.
2. Browse home: pull-to-refresh, switch Trending Today/This Week, open five movie details.
3. Search: type, submit, open result, log/watchlist from action modal.
4. Discover: 30 swipes, log one watched movie, reset deck.
5. Library: Logs, Diary, Lists with the Watchlist card, Tier Lists.
6. Profile: edit favorite four, export data, Letterboxd import dry run with cancel.
7. Shared Lists: create a group list, join from a second account, add a movie to To Watch, then mark it Watched.
8. Background and foreground the app three times.
9. Kill and relaunch the app.

Evidence to keep with the release:

- Sentry release link.
- Android device model, OS, build URL, and notes.
- iPhone model, iOS version, TestFlight/internal build URL, and notes.
- Screenshots or screen recordings for any jank or crash.
- Final decision: ship, hold, or retest.
