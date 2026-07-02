# Shared Watchlists QA Evidence

Use this file to record runtime evidence before treating shared watchlists as release-ready.

## Build And Environment

- Build profile:
- Platform:
- Build URL:
- Firebase project:
- Firestore rules deployed from commit:
- Tester A account:
- Tester B account:
- Test date: 2026-06-29

## Android APK Test Setup

Run these before installing the preview APK on a physical Android device:

```bash
npm run check
npm run qa:shared-watchlists:emulator
npx firebase-tools deploy --only firestore:rules
npx eas build --profile preview --platform android
```

Install the APK from the EAS build link on the phone. If an older SwipeLog APK is already installed and the install fails, uninstall the existing app and install the new APK again.

Before starting the User A/User B flow, confirm:

- The APK came from the current shared watchlist branch or local working tree.
- The Firebase project is the expected preview/staging project.
- Firestore rules were deployed after the latest `firestore.rules` change.
- User A and User B are different Firebase Auth accounts.
- Cloud sync and auth are enabled in the APK environment.

## Required Evidence

1. Static checks pass.
   - Command: `npm run check`
   - Result: Pass. Lint, `tsc --noEmit`, and `check:shared-watchlists` completed successfully. Shared watchlist security checks passed (20/20).

2. Firestore rules are deployed or loaded in the emulator.
   - Command: `npx firebase-tools@14.17.0 emulators:exec --only auth,firestore "node ./scripts/qa-shared-watchlists-emulator.js"`
   - Result: Pass. Auth and Firestore emulators started with the repository `firestore.rules`; the QA script exited successfully.

3. Automated Auth + Firestore emulator QA passes.
   - Command: `npx firebase-tools@14.17.0 emulators:exec --only auth,firestore "node ./scripts/qa-shared-watchlists-emulator.js"`
   - Result: Pass. Output included `Shared watchlist emulator QA passed.`

4. Expo web export includes the shared watchlist routes.
   - Command: `npx expo export --platform web --output-dir .expo-web-export-qa`
   - Result: Pass. Static routes included `/shared-watchlists` and `/shared-watchlist/[id]`.

5. User A creates a shared watchlist.
   - List name:
   - Invite code:
   - Evidence:

6. User B joins with the invite code.
   - Evidence:

7. User B cannot join after User A archives the list.
   - Evidence:

8. User A adds a movie.
   - Movie:
   - Evidence:

9. User B votes on the movie.
   - Vote:
   - Evidence:

10. User B cannot mark the movie chosen or watched together.
   - Evidence:

11. User A marks the movie chosen.
   - Evidence:

12. User A marks the movie watched together.
    - Evidence:

13. User B removes a movie they added.
    - Evidence:

14. User B cannot remove a movie User A added.
    - Evidence:

15. User A archives the list after confirmation.
    - Evidence:

16. Archived list is read-only in the app.
    - Evidence:

17. Old invite code no longer works after archive.
    - Evidence:

## Firestore Spot Checks

- `shared_watchlists/{listId}` has expected `ownerId`, `inviteCode`, and `status`.
- `shared_watchlists/{listId}/members/{uid}` exists for each member and includes matching `inviteCode`.
- `shared_watchlists/{listId}/items/{movieId}/votes/{uid}` exists for each vote.
- `shared_watchlist_invites/{inviteCode}` has `status: archived` after archive.
- `user_shared_watchlists/{uid}/lists/{listId}` exists only for actual members.

## Final Decision

- Result: `ship` / `hold` / `retest`
- Notes:
