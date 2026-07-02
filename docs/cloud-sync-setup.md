# Cloud Sync Setup

SwipeLog stores movie data, tier lists, and profile data locally first. When auth and cloud sync are enabled, the app also backs that state up to Firebase Firestore so a user can sign out, reinstall the app, or sign in on another device without losing data. Shared watchlists are Firebase-backed group records and require authenticated Firestore access for real multi-user use.

## Required Environment

Set these values in `.env` for local development, and in EAS environment variables for preview and production builds:

```env
EXPO_PUBLIC_ENABLE_AUTH=true
EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

Cloud sync is intentionally disabled unless `EXPO_PUBLIC_ENABLE_AUTH=true`. Keep `.env` out of Git and use `.env.example` for placeholders only.

For local multi-user QA against Firebase emulators, keep the normal Firebase config values and add:

```env
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=localhost
EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT=9099
EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT=8080
```

Use `10.0.2.2` for `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` when an Android emulator needs to reach emulators running on the host machine.

## Firebase Project Setup

1. Create or open the Firebase project used by SwipeLog.
2. Enable Email/Password authentication in Firebase Auth.
3. Create a Firestore database.
4. Add a web app in Firebase project settings and copy its config values into the environment variables above.
5. Configure Firestore security rules so signed-in users can only read and write their own document in the `user_app_state` collection.
6. If shared watchlists are enabled, add rules for `shared_watchlists` and `user_shared_watchlists`. See [Shared Watchlists](shared-watchlists.md).

The repository includes `firebase.json` and `firestore.rules` so the Firebase CLI can run the Auth and Firestore emulators or deploy rules from the project root.

Example Firestore rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /user_app_state/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## What Syncs

Each Firestore document is stored at `user_app_state/{firebaseAuth.currentUser.uid}`.

- `movie_store`: logs, diary entries, ratings, favorites, watchlist, lists, discovery history
- `profile`: display name, username, bio, profile image URI, banner URI, featured movie ids
- `tier_lists`: tier list definitions, ranked movie ids, unranked movie ids, tier labels, and tier colors
- `updated_at`: ISO timestamp for the latest cloud write

Shared watchlists use separate Firestore collections so multiple users can collaborate on the same list:

- `shared_watchlists/{listId}`: list metadata
- `shared_watchlists/{listId}/members/{userId}`: list membership
- `shared_watchlists/{listId}/items/{movieId}`: movie candidates, votes, and status
- `shared_watchlist_invites/{inviteCode}`: minimal invite lookup for join-by-code
- `user_shared_watchlists/{userId}/lists/{listId}`: per-user list index

## Expected Behavior

If cloud sync is configured:

- Sign out and sign back in on the same device: data returns
- Delete and reinstall the app, then sign in: data returns
- Sign in on another device: data returns

If cloud sync is not configured:

- Same-device local data can remain until the app is deleted
- Reinstalling the app removes local data
- Other devices will not receive the user's data

## Verification Checklist

1. Create a test account.
2. Verify the email address, then sign in.
3. Log at least one watched movie.
4. Edit the profile name or bio.
5. Create or edit a tier list.
6. Confirm a document appears in Firestore at `user_app_state/{uid}` with `movie_store`, `profile`, `tier_lists`, or `updated_at` fields.
7. Sign out and sign back in.
8. Confirm movie data, profile data, and tier lists return.
9. Test on a second device or simulator with the same account.
10. Create a shared watchlist, join it from a second account, add a movie, and confirm votes sync.

## Troubleshooting

If the app reports that cloud sync is disabled, check:

- `EXPO_PUBLIC_ENABLE_AUTH=true`
- `EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true`
- Firebase environment variables are set for the current environment

If auth works but data does not sync, check:

- The signed-in Firebase user exists and has a verified email
- Firestore is enabled in the intended Firebase project
- Firestore rules allow only `request.auth.uid == userId`
- The latest repository `firestore.rules` has been deployed with `firebase deploy --only firestore:rules`
- The `user_app_state/{uid}` document can be read and written by the signed-in user
- Shared watchlist members exist under `shared_watchlists/{listId}/members/{uid}`
- The per-user membership index exists under `user_shared_watchlists/{uid}/lists/{listId}`
- If shared list loading reports `Missing or insufficient permissions`, compare every `user_shared_watchlists/{uid}/lists/{listId}` entry with `shared_watchlists/{listId}/members/{uid}`. Remove stale user index entries or recreate the missing member document through the invite flow.
- `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` is set only for local emulator sessions
- The emulator host is reachable from the target runtime (`localhost` for web/iOS simulator, `10.0.2.2` for Android emulator)

## Legacy Supabase Assets

The repository still contains legacy Supabase migrations and a Supabase `tmdb-proxy` function from the previous backend path. The current app runtime uses Firebase Auth and Firestore for cloud sync. Keep the Supabase assets only if they are still needed for migration history or a separate TMDB proxy deployment; otherwise they can be removed in a dedicated cleanup change.
