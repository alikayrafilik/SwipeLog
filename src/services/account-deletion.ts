import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentReference,
} from 'firebase/firestore';
import { resetOnboardingTips } from '@/components/OnboardingTips';
import { CLOUD_SYNC_ENABLED } from '@/constants/features';
import { getActivityReadStorageKey } from '@/services/activity';
import { clearDiscoverSession } from '@/services/discover-session';
import { firestore } from '@/services/firebase';
import { clearPersistedProfileImages } from '@/services/profile-images';
import { resetSmartNotifications } from '@/services/smart-notifications';

const MOVIE_STORAGE_KEY = '@swipelog_store_v4';
const LEGACY_MOVIE_STORAGE_KEYS = [
  '@swipelog_store_v4',
  '@swipelog_store_v3',
  '@swipelog_movie_logs_v2',
  '@swipelog_custom_lists',
];
const PROFILE_STORAGE_KEY = '@swipelog_user_profile_v1';
const TIER_LIST_STORAGE_KEY = '@swipelog_tier_lists_v1';
const SHARED_WATCHLIST_STORAGE_KEY = '@swipelog_shared_watchlists_v1';

const deleteSnapshotDocs = async (
  refs: DocumentReference[]
) => {
  for (const ref of refs) {
    await deleteDoc(ref);
  }
};

const deleteItemChildren = async (
  listId: string,
  movieId: string
) => {
  const itemRef = doc(firestore, 'shared_watchlists', listId, 'items', movieId);
  const [votes, seenBy] = await Promise.all([
    getDocs(collection(itemRef, 'votes')),
    getDocs(collection(itemRef, 'seenBy')),
  ]);
  await deleteSnapshotDocs([
    ...votes.docs.map((entry) => entry.ref),
    ...seenBy.docs.map((entry) => entry.ref),
  ]);
};

const deleteOwnedSharedWatchlist = async (
  userId: string,
  listId: string,
  inviteCode: string
) => {
  const listRef = doc(firestore, 'shared_watchlists', listId);
  const [members, items] = await Promise.all([
    getDocs(collection(listRef, 'members')),
    getDocs(collection(listRef, 'items')),
  ]);

  for (const item of items.docs) {
    await deleteItemChildren(listId, item.id);
    await deleteDoc(item.ref);
  }

  for (const member of members.docs) {
    await deleteDoc(doc(firestore, 'user_shared_watchlists', member.id, 'lists', listId));
  }
  await deleteSnapshotDocs(members.docs.map((member) => member.ref));

  if (inviteCode) {
    await deleteDoc(doc(firestore, 'shared_watchlist_invites', inviteCode));
  }
  await deleteDoc(doc(firestore, 'user_shared_watchlists', userId, 'lists', listId));
  await deleteDoc(listRef);
};

const leaveSharedWatchlist = async (userId: string, listId: string) => {
  const listRef = doc(firestore, 'shared_watchlists', listId);
  const items = await getDocs(collection(listRef, 'items'));

  for (const item of items.docs) {
    const itemData = item.data();
    if (itemData.addedBy === userId) {
      await deleteItemChildren(listId, item.id);
      await deleteDoc(item.ref);
    } else {
      await Promise.all([
        deleteDoc(doc(item.ref, 'votes', userId)),
        deleteDoc(doc(item.ref, 'seenBy', userId)),
      ]);
    }
  }

  await deleteDoc(doc(firestore, 'user_shared_watchlists', userId, 'lists', listId));
  await deleteDoc(doc(listRef, 'members', userId));
};

const deleteSharedWatchlistData = async (userId: string) => {
  const indexes = await getDocs(collection(firestore, 'user_shared_watchlists', userId, 'lists'));

  for (const index of indexes.docs) {
    const listId = index.id;
    const listRef = doc(firestore, 'shared_watchlists', listId);
    const listSnapshot = await getDoc(listRef);
    if (!listSnapshot.exists()) {
      await deleteDoc(index.ref);
      continue;
    }

    const list = listSnapshot.data();
    if (list.ownerId === userId) {
      await deleteOwnedSharedWatchlist(
        userId,
        listId,
        typeof list.inviteCode === 'string' ? list.inviteCode : ''
      );
    } else {
      await leaveSharedWatchlist(userId, listId);
    }
  }
};

const deleteSocialData = async (userId: string) => {
  const friends = await getDocs(collection(firestore, 'user_friends', userId, 'friends'));
  for (const friend of friends.docs) {
    await deleteDoc(doc(firestore, 'user_friends', friend.id, 'friends', userId));
    await deleteDoc(friend.ref);
  }

  const [sentRequests, receivedRequests] = await Promise.all([
    getDocs(query(collection(firestore, 'friend_requests'), where('fromUserId', '==', userId))),
    getDocs(query(collection(firestore, 'friend_requests'), where('toUserId', '==', userId))),
  ]);
  const requestRefs = new Map(
    [...sentRequests.docs, ...receivedRequests.docs].map((request) => [request.ref.path, request.ref])
  );
  await deleteSnapshotDocs([...requestRefs.values()]);
};

export const deleteCloudAccountData = async (userId: string) => {
  if (!CLOUD_SYNC_ENABLED) return;

  await deleteSharedWatchlistData(userId);
  await deleteSocialData(userId);
  await Promise.all([
    deleteDoc(doc(firestore, 'user_app_state', userId)),
    deleteDoc(doc(firestore, 'public_watched_movies', userId)),
    deleteDoc(doc(firestore, 'public_profiles', userId)),
  ]);
};

export const clearLocalAccountData = async (userId: string) => {
  await Promise.all([
    resetOnboardingTips(),
    resetSmartNotifications(),
    clearDiscoverSession(),
    AsyncStorage.multiRemove([
      ...LEGACY_MOVIE_STORAGE_KEYS,
      `${MOVIE_STORAGE_KEY}:${userId}`,
      PROFILE_STORAGE_KEY,
      `${PROFILE_STORAGE_KEY}:${userId}`,
      TIER_LIST_STORAGE_KEY,
      `${TIER_LIST_STORAGE_KEY}:${userId}`,
      SHARED_WATCHLIST_STORAGE_KEY,
      getActivityReadStorageKey(userId),
    ]),
    Promise.resolve(clearPersistedProfileImages()),
  ]);
};
