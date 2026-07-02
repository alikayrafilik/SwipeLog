#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const rules = read('firestore.rules');
const service = read('src/services/shared-watchlists.ts');
const cloudState = read('src/services/cloud-state.ts');
const docs = read('docs/shared-watchlists.md');
const qaEvidence = read('docs/shared-watchlists-qa-evidence.md');
const firebaseConfig = JSON.parse(read('firebase.json'));
const packageJson = JSON.parse(read('package.json'));

const checks = [
  {
    name: 'firebase config deploys the checked firestore rules file',
    ok:
      firebaseConfig.firestore?.rules === 'firestore.rules' &&
      firebaseConfig.emulators?.auth?.port === 9099 &&
      firebaseConfig.emulators?.firestore?.port === 8080,
  },
  {
    name: 'app can target Firebase Auth and Firestore emulators for runtime QA',
    ok:
      read('src/services/firebase.ts').includes('connectAuthEmulator') &&
      read('src/services/firebase.ts').includes('connectFirestoreEmulator') &&
      read('src/services/firebase.ts').includes('EXPO_PUBLIC_USE_FIREBASE_EMULATOR') &&
      docs.includes('EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true') &&
      docs.includes('firebase emulators:start --only auth,firestore'),
  },
  {
    name: 'repeatable emulator QA covers shared watchlist allow and deny flows',
    ok:
      packageJson.scripts?.['qa:shared-watchlists:emulator']?.includes('qa-shared-watchlists-emulator.js') &&
      read('scripts/qa-shared-watchlists-emulator.js').includes('Expected permission-denied') &&
      read('scripts/qa-shared-watchlists-emulator.js').includes('archived lists reject new members') &&
      read('scripts/qa-shared-watchlists-emulator.js').includes('archived lists cannot be reactivated') &&
      qaEvidence.includes('qa-shared-watchlists-emulator.js'),
  },
  {
    name: 'QA evidence tracks Expo web export coverage for shared routes',
    ok:
      qaEvidence.includes('npx expo export --platform web --output-dir .expo-web-export-qa') &&
      qaEvidence.includes('/shared-watchlists') &&
      qaEvidence.includes('/shared-watchlist/[id]'),
  },
  {
    name: 'stale shared watchlist indexes do not break the whole list load',
    ok:
      service.includes('removeStaleMembershipIndex') &&
      service.includes("deleteDoc(doc(firestore, 'user_shared_watchlists', userId, 'lists', listId))") &&
      service.includes('isPermissionError(error)') &&
      service.includes('if (!isPermissionError(error)) throw error;') &&
      read('scripts/qa-shared-watchlists-emulator.js').includes('stale membership indexes cannot read private lists'),
  },
  {
    name: 'permission errors are actionable in-app and documented for live Firebase',
    ok:
      read('src/context/SharedWatchlistContext.tsx').includes('Shared watchlist access is not ready for this account') &&
      read('docs/cloud-sync-setup.md').includes('firebase deploy --only firestore:rules') &&
      read('docs/cloud-sync-setup.md').includes('Missing or insufficient permissions') &&
      read('docs/release-observability-checklist.md').includes('Firestore rules are deployed before preview QA'),
  },
  {
    name: 'manual Android APK QA setup is documented',
    ok:
      qaEvidence.includes('Android APK Test Setup') &&
      qaEvidence.includes('npx firebase-tools deploy --only firestore:rules') &&
      qaEvidence.includes('npx eas build --profile preview --platform android') &&
      qaEvidence.includes('User A and User B are different Firebase Auth accounts'),
  },
  {
    name: 'runtime QA evidence template covers the full shared watchlist flow',
    ok:
      qaEvidence.includes('User A creates a shared watchlist') &&
      qaEvidence.includes('User B joins with the invite code') &&
      qaEvidence.includes('User B cannot mark the movie chosen or watched together') &&
      qaEvidence.includes('Archived list is read-only in the app') &&
      qaEvidence.includes('Old invite code no longer works after archive'),
  },
  {
    name: 'shared watchlist reads require membership',
    ok: rules.includes('allow read: if isSharedWatchlistMember(listId);'),
  },
  {
    name: 'join-by-code uses minimal invite lookup',
    ok:
      rules.includes('match /shared_watchlist_invites/{inviteCode}') &&
      service.includes("doc(firestore, 'shared_watchlist_invites', normalizedCode)") &&
      docs.includes('minimal invite lookup'),
  },
  {
    name: 'user list index requires existing membership and source metadata match',
    ok:
      rules.includes("exists(/databases/$(database)/documents/shared_watchlists/$(listId)/members/$(userId))") &&
      rules.includes('request.resource.data.name == get(/databases/$(database)/documents/shared_watchlists/$(listId)).data.name') &&
      rules.includes('request.resource.data.inviteCode == get(/databases/$(database)/documents/shared_watchlists/$(listId)).data.inviteCode') &&
      rules.includes('request.resource.data.ownerId == get(/databases/$(database)/documents/shared_watchlists/$(listId)).data.ownerId') &&
      rules.includes('request.resource.data.status == get(/databases/$(database)/documents/shared_watchlists/$(listId)).data.status'),
  },
  {
    name: 'votes are per-user subcollection documents',
    ok:
      rules.includes('match /votes/{userId}') &&
      service.includes("'items', movieId, 'votes', userId") &&
      docs.includes('items/{movieId}/votes/{userId}'),
  },
  {
    name: 'archived lists block joins, item writes, status updates, and votes',
    ok:
      rules.includes('function isActiveSharedWatchlist(listId)') &&
      rules.match(/allow create: if signedIn\(\)[\s\S]*?isActiveSharedWatchlist\(listId\)/) &&
      rules.match(/allow create: if isSharedWatchlistMember\(listId\)[\s\S]*?isActiveSharedWatchlist\(listId\)/) &&
      rules.match(/allow update: if isSharedWatchlistOwner\(listId\)[\s\S]*?isActiveSharedWatchlist\(listId\)/) &&
      rules.match(/allow create, update: if isSharedWatchlistMember\(listId\)[\s\S]*?isActiveSharedWatchlist\(listId\)/),
  },
  {
    name: 'service and UI treat archived lists as read-only',
    ok:
      service.includes('const assertActiveList') &&
      service.includes("throw new Error('This shared watchlist is archived.')") &&
      read('src/app/shared-watchlist/[id].tsx').includes("const isArchived = list?.status === 'archived'") &&
      read('src/app/shared-watchlist/[id].tsx').includes('This shared list is read-only') &&
      read('src/app/shared-watchlist/[id].tsx').includes('{!isArchived ? ('),
  },
  {
    name: 'local and cloud join both reject archived invites',
    ok:
      service.includes('const list = Object.values(store.lists).find((item) => item.inviteCode === normalizedCode);') &&
      service.includes('assertActiveList(list);') &&
      service.includes("if (!invite || invite.status !== 'active')"),
  },
  {
    name: 'archive action closes the invite lookup',
    ok:
      service.includes('async archiveList(listId: string, userId: string)') &&
      service.includes('Only the owner can archive this list.') &&
      service.includes("doc(firestore, 'shared_watchlist_invites', list.inviteCode)") &&
      service.includes("status: 'archived'"),
  },
  {
    name: 'chosen and watched status updates are owner-only',
    ok:
      rules.includes('allow update: if isSharedWatchlistOwner(listId)') &&
      service.includes("Only the owner can choose or close a movie.") &&
      read('src/app/shared-watchlist/[id].tsx').includes('{isOwner ? (') &&
      docs.includes('Only owners can update item status'),
  },
  {
    name: 'movie removal is limited to owners or the member who added it',
    ok:
      rules.includes('resource.data.addedBy == request.auth.uid') &&
      rules.includes('items/$(movieId)).data.addedBy == request.auth.uid') &&
      service.includes('Only the owner or the person who added this movie can remove it.') &&
      service.includes("collection(firestore, 'shared_watchlists', listId, 'items', movieId, 'votes')") &&
      service.includes('await Promise.all(votesSnapshot.docs.map((voteDoc) => deleteDoc(voteDoc.ref)))') &&
      read('src/app/shared-watchlist/[id].tsx').includes('canRemoveMovie') &&
      docs.includes('Owners and the member who added a movie can remove it'),
  },
  {
    name: 'archive lifecycle is irreversible and member timestamp touches require active lists',
    ok:
      rules.includes("(resource.data.status == 'archived' && request.resource.data.status == 'archived')") &&
      rules.includes('isActiveSharedWatchlist(listId)\n          && request.resource.data.diff(resource.data).changedKeys().hasOnly([\'updatedAt\'])'),
  },
  {
    name: 'vote writes are self-scoped and constrained',
    ok:
      rules.includes("request.resource.data.keys().hasOnly(['userId', 'vote', 'updatedAt'])") &&
      rules.includes('isSelf(userId)') &&
      rules.includes("request.resource.data.vote in ['yes', 'maybe', 'no']"),
  },
  {
    name: 'member updates cannot change role, join time, invite code, or user id',
    ok:
      rules.includes("request.resource.data.diff(resource.data).changedKeys().hasOnly(['displayName'])") &&
      rules.includes('request.resource.data.userId == resource.data.userId') &&
      rules.includes('request.resource.data.role == resource.data.role') &&
      rules.includes('request.resource.data.inviteCode == resource.data.inviteCode') &&
      rules.includes('request.resource.data.joinedAt == resource.data.joinedAt'),
  },
  {
    name: 'member creates always require the source invite code',
    ok:
      rules.includes('request.resource.data.inviteCode == get(/databases/$(database)/documents/shared_watchlists/$(listId)).data.inviteCode') &&
      rules.match(/allow create: if signedIn\(\)[\s\S]*?request.resource.data.inviteCode == get/),
  },
  {
    name: 'item creates are owner-authored candidate payloads without vote maps',
    ok:
      rules.includes("request.resource.data.keys().hasOnly(['id', 'movieId', 'title', 'image', 'date', 'overview', 'addedBy', 'addedByName', 'addedAt', 'status'])") &&
      rules.includes('request.resource.data.addedBy == request.auth.uid') &&
      rules.includes("request.resource.data.status == 'candidate'") &&
      service.includes('removeUndefinedFields({') &&
      !service.includes('setDoc(itemRef, item)'),
  },
  {
    name: 'invite codes are checked for collisions',
    ok:
      service.includes('createUniqueInviteCode') &&
      service.includes("doc(firestore, 'shared_watchlist_invites', code)") &&
      service.includes('inviteDoc.exists()'),
  },
  {
    name: 'seenBy subcollection is defined in firestore rules with read restricted to members',
    ok:
      rules.includes('match /seenBy/{userId}') &&
      rules.includes('allow read: if isSharedWatchlistMember(listId);'),
  },
  {
    name: 'seenBy writes require isSelf and source user_log',
    ok:
      rules.includes('allow create, update: if isSharedWatchlistMember(listId)') &&
      rules.includes('&& isSelf(userId)') &&
      rules.includes("request.resource.data.source == 'user_log'"),
  },
  {
    name: 'service queries seenBy subcollection and supports marking/removing seen status',
    ok:
      service.includes("'items', itemDoc.id, 'seenBy'") &&
      service.includes('markSeenBy(') &&
      service.includes('removeSeenBy('),
  },
  {
    name: 'detail screen syncs seenBy with local watch history and displays watched users',
    ok:
      read('src/app/shared-watchlist/[id].tsx').includes('useMovieState') &&
      read('src/app/shared-watchlist/[id].tsx').includes('syncSeenBy') &&
      read('src/app/shared-watchlist/[id].tsx').includes('watchedText'),
  },
  {
    name: 'public_watched_movies rules allow signedIn reads and self writes',
    ok:
      rules.includes('match /public_watched_movies/{userId}') &&
      rules.includes('allow read: if signedIn();') &&
      rules.includes('allow create, update: if isSelf(userId)') &&
      rules.includes("request.resource.data.userId == request.auth.uid"),
  },
  {
    name: 'cloudState writes watched movie IDs to public_watched_movies',
    ok:
      cloudState.includes("doc(firestore, 'public_watched_movies', userId)") &&
      cloudState.includes('watchedMovieIds'),
  },
  {
    name: 'sharedWatchlistService getDetail fetches and merges public_watched_movies for list members',
    ok:
      service.includes("doc(firestore, 'public_watched_movies', member.userId)") &&
      service.includes('watchedMoviesMap'),
  },
];

const failures = checks.filter((check) => !check.ok);

if (failures.length > 0) {
  console.error('Shared watchlist security checks failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure.name}`);
  });
  process.exit(1);
}

console.log(`Shared watchlist security checks passed (${checks.length}/${checks.length}).`);
