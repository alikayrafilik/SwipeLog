# Shared Watchlists

Shared watchlists let signed-in users create a group movie list, invite others with a short code, add movies to a shared To Watch queue, and mark movies as Watched together.

## Data Model

Firestore collections:

```txt
shared_watchlists/{listId}
  name
  inviteCode
  ownerId
  createdAt
  updatedAt
  status

shared_watchlists/{listId}/members/{userId}
  userId
  displayName
  role
  joinedAt
  inviteCode

shared_watchlists/{listId}/items/{movieId}
  movieId
  title
  image
  date
  overview
  addedBy
  addedByName
  addedAt
  status

shared_watchlists/{listId}/items/{movieId}/votes/{userId}
  userId
  vote
  updatedAt

user_shared_watchlists/{userId}/lists/{listId}
  listId
  name
  inviteCode
  ownerId
  updatedAt
  status

shared_watchlist_invites/{inviteCode}
  code
  listId
  name
  ownerId
  status
  updatedAt
```

`user_shared_watchlists` is a lightweight membership index so the app can load a user's group lists without a collection group query.
`shared_watchlist_invites` is a minimal invite lookup so signed-in users can join by code without making private list documents publicly queryable.

## Security Requirements

Before release, Firebase rules must enforce:

- Users must be authenticated to read or write shared watchlist data.
- A user can read a shared watchlist only if `shared_watchlists/{listId}/members/{uid}` exists.
- A user can create a list only with themselves as `ownerId`.
- A user can join a list only by writing their own member document with the matching invite code.
- All member documents, including the owner membership, must carry the source list invite code.
- Signed-in users can read invite lookup documents, but the lookup contains only minimal list metadata.
- A member can add items to a list.
- A member can update their own vote only.
- Only owners can update item status to `candidate`, `chosen`, or `watched`; owners can delete items.
- Owners and the member who added a movie can remove it from an active shared watchlist.
- Removing a movie deletes vote documents before deleting the parent item so Firestore rules can still verify item ownership.
- Only the owner can archive or delete a list.
- Archived lists cannot accept new members, item writes, status updates, or votes.
- Archiving a list also archives its invite lookup so old invite codes stop working.
- Archive is treated as a one-way lifecycle transition in Firestore rules.
- The app service enforces owner-only archive in local demo mode and before cloud writes.
- Local demo mode and cloud mode both reject joins for archived shared watchlists.
- The app asks the owner for confirmation before archiving and provides a native share action for invite codes.
- Archived list detail screens are read-only in the app and local demo mode enforces the same mutation guard.
- Only members can write their own `user_shared_watchlists/{uid}` index for lists where their membership document exists.
- User list index metadata must match the source `shared_watchlists/{listId}` document.
- The app tolerates stale user list index entries: if a listed shared watchlist is no longer readable because the member document is gone, that stale user index is removed and the rest of the list load continues.

The repo includes a deployable starting point at [`../firestore.rules`](../firestore.rules). Review it against the production Firebase project before release.
[`../firebase.json`](../firebase.json) points Firebase CLI at that rules file and configures the Auth emulator on port 9099 and Firestore emulator on port 8080.

## QA Checklist

Static checks:

```bash
npm run check:shared-watchlists
```

This verifies the repository still enforces the critical shared-watchlist rules: private list reads require membership, invite-code joins use the minimal invite index, votes are per-user documents, list indexes require membership, and item payloads cannot smuggle vote maps.

Firebase rules deploy and emulator commands:

```bash
firebase emulators:start --only auth,firestore
firebase deploy --only firestore:rules
```

Set `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` and the emulator host/ports from [Cloud Sync Setup](cloud-sync-setup.md) before running the app against local emulators.

Automated Auth + Firestore emulator QA:

```bash
npx firebase-tools@14.17.0 emulators:exec --only auth,firestore "node ./scripts/qa-shared-watchlists-emulator.js"
```

The script creates temporary emulator users and verifies the important allow/deny rules: owner create, member join, private reads, voting, owner-only chosen/watched status, owner-or-addedBy removal, archive, blocked joins after archive, blocked votes after archive, and blocked reactivation.

Run this on a preview build with Firebase Auth and Cloud Sync enabled:

Record runtime proof in [Shared Watchlists QA Evidence](shared-watchlists-qa-evidence.md).

1. User A creates a shared watchlist.
2. User A copies the invite code.
3. User B joins with that invite code.
4. User A adds a movie from search.
5. User B votes `In`, User A votes `Maybe`.
6. The detail screen shows vote counts and score order correctly.
7. User A marks the top movie as `chosen`.
8. User B refreshes and sees the chosen state.
9. User A marks it `watched together`.
10. A non-member cannot load the list document directly.
11. A signed-out user cannot create, join, vote, or add items.

For local development with auth/cloud sync disabled, the same UI uses AsyncStorage as a single-device demo mode.
