import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { CLOUD_SYNC_ENABLED } from '@/constants/features';
import { firebaseAuth, firestore } from '@/services/firebase';
import type { FriendSummary } from '@/services/social';
import type { MovieItem } from '@/services/tmdb';

export type SharedWatchlistRole = 'owner' | 'member';
export type SharedWatchlistStatus = 'active' | 'archived';
export type SharedWatchlistItemStatus = 'candidate' | 'chosen' | 'watched';
export type SharedWatchlistVote = 'yes' | 'maybe' | 'no';

export interface SharedWatchlistMember {
  userId: string;
  displayName: string;
  role: SharedWatchlistRole;
  joinedAt: string;
  inviteCode?: string;
}

export interface SharedWatchlist {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  status: SharedWatchlistStatus;
  members: SharedWatchlistMember[];
  itemCount?: number;
  previewItems?: SharedWatchlistItem[];
}

export interface SharedWatchlistSeenBy {
  userId: string;
  displayName: string;
  avatarUrl: string;
  watchedAt?: string;
  updatedAt: string;
  source: 'user_log';
}

export interface SharedWatchlistItem {
  id: string;
  movieId: string;
  title: string;
  image: string;
  date?: string;
  overview?: string;
  addedBy: string;
  addedByName: string;
  addedAt: string;
  status: SharedWatchlistItemStatus;
  votes: Record<string, SharedWatchlistVote>;
  seenBy?: SharedWatchlistSeenBy[];
}

interface SharedWatchlistInvite {
  code: string;
  listId: string;
  name: string;
  status: SharedWatchlistStatus;
  ownerId: string;
  updatedAt: string;
}

export interface SharedWatchlistDetail extends SharedWatchlist {
  items: SharedWatchlistItem[];
}

interface LocalSharedWatchlistStore {
  lists: Record<string, SharedWatchlistDetail>;
}

const LOCAL_SHARED_WATCHLISTS_KEY = '@swipelog_shared_watchlists_v1';
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const isCloudAvailable = () => CLOUD_SYNC_ENABLED && Boolean(firebaseAuth.currentUser);

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createInviteCode = () =>
  Array.from({ length: 7 }, () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]).join('');

const nowIso = () => new Date().toISOString();

const sanitizeDisplayName = (displayName: string, fallback: string) =>
  displayName.trim() || fallback;

const removeUndefinedFields = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;

const createUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createInviteCode();
    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      if (!Object.values(store.lists).some((list) => list.inviteCode === code)) return code;
    } else {
      const inviteDoc = await getDoc(doc(firestore, 'shared_watchlist_invites', code));
      if (!inviteDoc.exists()) return code;
    }
  }
  throw new Error('Could not generate a unique invite code. Please try again.');
};

const toSharedWatchlist = (
  id: string,
  data: Record<string, unknown>,
  members: SharedWatchlistMember[] = []
): SharedWatchlist => ({
  id,
  name: typeof data.name === 'string' ? data.name : 'Shared Watchlist',
  inviteCode: typeof data.inviteCode === 'string' ? data.inviteCode : '',
  ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
  createdAt: typeof data.createdAt === 'string' ? data.createdAt : nowIso(),
  updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
  status: data.status === 'archived' ? 'archived' : 'active',
  members,
});

const toSharedWatchlistItem = (id: string, data: Record<string, unknown>): SharedWatchlistItem => ({
  id,
  movieId: typeof data.movieId === 'string' ? data.movieId : id,
  title: typeof data.title === 'string' ? data.title : 'Untitled',
  image: typeof data.image === 'string' ? data.image : '',
  date: typeof data.date === 'string' ? data.date : undefined,
  overview: typeof data.overview === 'string' ? data.overview : undefined,
  addedBy: typeof data.addedBy === 'string' ? data.addedBy : '',
  addedByName: typeof data.addedByName === 'string' ? data.addedByName : 'Someone',
  addedAt: typeof data.addedAt === 'string' ? data.addedAt : nowIso(),
  status:
    data.status === 'chosen' || data.status === 'watched'
      ? data.status
      : 'candidate',
  votes:
    typeof data.votes === 'object' && data.votes !== null
      ? (data.votes as Record<string, SharedWatchlistVote>)
      : {},
  seenBy: Array.isArray(data.seenBy) ? (data.seenBy as SharedWatchlistSeenBy[]) : [],
});

const toVoteRecord = (userId: string, data: Record<string, unknown>) => {
  const vote = data.vote;
  if (vote !== 'yes' && vote !== 'maybe' && vote !== 'no') return null;
  return [userId, vote] as const;
};

const readLocalStore = async (): Promise<LocalSharedWatchlistStore> => {
  const raw = await AsyncStorage.getItem(LOCAL_SHARED_WATCHLISTS_KEY);
  if (!raw) return { lists: {} };
  try {
    return JSON.parse(raw) as LocalSharedWatchlistStore;
  } catch {
    return { lists: {} };
  }
};

const writeLocalStore = (store: LocalSharedWatchlistStore) =>
  AsyncStorage.setItem(LOCAL_SHARED_WATCHLISTS_KEY, JSON.stringify(store));

const localListSummariesForUser = async (userId: string) => {
  const store = await readLocalStore();
  return Object.values(store.lists)
    .filter((list) => list.status === 'active' && list.members.some((member) => member.userId === userId))
    .map(({ items, ...summary }) => ({
      ...summary,
      itemCount: items.length,
      previewItems: items.slice(0, 3),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

const addMembershipIndex = async (userId: string, list: SharedWatchlist) => {
  await setDoc(
    doc(firestore, 'user_shared_watchlists', userId, 'lists', list.id),
    {
      listId: list.id,
      name: list.name,
      inviteCode: list.inviteCode,
      ownerId: list.ownerId,
      updatedAt: list.updatedAt,
      status: list.status,
    },
    { merge: true }
  );
};

const toSharedWatchlistInvite = (
  code: string,
  data: Record<string, unknown>
): SharedWatchlistInvite | null => {
  const listId = typeof data.listId === 'string' ? data.listId : '';
  if (!listId) return null;
  return {
    code,
    listId,
    name: typeof data.name === 'string' ? data.name : 'Shared Watchlist',
    status: data.status === 'archived' ? 'archived' : 'active',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
  };
};

const assertActiveList = (list: Pick<SharedWatchlist, 'status'>) => {
  if (list.status !== 'active') {
    throw new Error('This shared watchlist is archived.');
  }
};

const isPermissionError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'permission-denied';

const removeStaleMembershipIndex = async (userId: string, listId: string) => {
  try {
    await deleteDoc(doc(firestore, 'user_shared_watchlists', userId, 'lists', listId));
  } catch (error) {
    console.warn('[SharedWatchlists] Could not remove stale membership index:', error);
  }
};

export const sharedWatchlistService = {
  async listForUser(userId: string): Promise<SharedWatchlist[]> {
    if (!isCloudAvailable()) return localListSummariesForUser(userId);

    const snapshot = await getDocs(collection(firestore, 'user_shared_watchlists', userId, 'lists'));
    const lists = await Promise.all(
      snapshot.docs.map(async (membershipDoc) => {
        const listId = membershipDoc.id;
        try {
          const detail = await this.getDetail(listId);
          if (!detail) {
            await removeStaleMembershipIndex(userId, listId);
            return null;
          }
          return detail;
        } catch (error) {
          if (!isPermissionError(error)) throw error;
          await removeStaleMembershipIndex(userId, listId);
          return null;
        }
      })
    );

    return lists
      .filter((list): list is SharedWatchlistDetail => list !== null && list.status === 'active')
      .map(({ items, ...summary }) => ({
        ...summary,
        itemCount: items.length,
        previewItems: items.slice(0, 3),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getDetail(listId: string): Promise<SharedWatchlistDetail | null> {
    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      return store.lists[listId] ?? null;
    }

    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) return null;

    const [membersSnapshot, itemsSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'shared_watchlists', listId, 'members')),
      getDocs(collection(firestore, 'shared_watchlists', listId, 'items')),
    ]);
    const members = membersSnapshot.docs.map((memberDoc) => ({
      userId: memberDoc.id,
      ...(memberDoc.data() as Omit<SharedWatchlistMember, 'userId'>),
    }));

    // Fetch watched movies for all members
    const memberWatchedDocs = await Promise.all(
      members.map(async (member) => {
        try {
          const docSnap = await getDoc(doc(firestore, 'public_watched_movies', member.userId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            return {
              userId: member.userId,
              watchedMovieIds: Array.isArray(data.watchedMovieIds) ? (data.watchedMovieIds as string[]) : [],
            };
          }
        } catch (error) {
          console.warn(`[SharedWatchlists] Could not load watched movies for user ${member.userId}:`, error);
        }
        return { userId: member.userId, watchedMovieIds: [] };
      })
    );

    const watchedMoviesMap = new Map<string, string[]>();
    memberWatchedDocs.forEach(({ userId: memberId, watchedMovieIds }) => {
      watchedMovieIds.forEach((movieId) => {
        const list = watchedMoviesMap.get(movieId) ?? [];
        if (!list.includes(memberId)) {
          list.push(memberId);
        }
        watchedMoviesMap.set(movieId, list);
      });
    });

    const items = await Promise.all(
      itemsSnapshot.docs.map(async (itemDoc) => {
        const item = toSharedWatchlistItem(itemDoc.id, itemDoc.data());
        const [votesSnapshot, seenBySnapshot] = await Promise.all([
          getDocs(collection(firestore, 'shared_watchlists', listId, 'items', itemDoc.id, 'votes')),
          getDocs(collection(firestore, 'shared_watchlists', listId, 'items', itemDoc.id, 'seenBy')),
        ]);
        const votes = Object.fromEntries(
          votesSnapshot.docs
            .map((voteDoc) => toVoteRecord(voteDoc.id, voteDoc.data()))
            .filter((entry): entry is readonly [string, SharedWatchlistVote] => entry !== null)
        );
        const seenByUserIds = new Set(seenBySnapshot.docs.map((d) => d.id));
        const seenBy: SharedWatchlistSeenBy[] = seenBySnapshot.docs.map((seenDoc) => {
          const data = seenDoc.data();
          return {
            userId: seenDoc.id,
            displayName: typeof data.displayName === 'string' ? data.displayName : 'Someone',
            avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
            watchedAt: typeof data.watchedAt === 'string' ? data.watchedAt : undefined,
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
            source: 'user_log' as const,
          };
        });

        // Add members who watched this movie in the cloud but don't have a seenBy subcollection doc yet
        const cloudWatchedUserIds = watchedMoviesMap.get(itemDoc.id) ?? [];
        cloudWatchedUserIds.forEach((memberId) => {
          if (!seenByUserIds.has(memberId)) {
            const memberInfo = members.find((m) => m.userId === memberId);
            if (memberInfo) {
              seenBy.push({
                userId: memberId,
                displayName: memberInfo.displayName,
                avatarUrl: '',
                source: 'user_log' as const,
                updatedAt: nowIso(),
              });
            }
          }
        });

        return { ...item, votes, seenBy };
      })
    );
    const sortedItems = items
      .sort((a, b) => {
        if (a.status !== b.status) {
          const order: Record<SharedWatchlistItemStatus, number> = { chosen: 0, candidate: 1, watched: 2 };
          return order[a.status] - order[b.status];
        }
        return b.addedAt.localeCompare(a.addedAt);
      });

    return {
      ...toSharedWatchlist(listDoc.id, listDoc.data(), members),
      items: sortedItems,
    };
  },

  async create(userId: string, displayName: string, name: string): Promise<SharedWatchlistDetail> {
    const createdAt = nowIso();
    const memberName = sanitizeDisplayName(displayName, 'You');
    const list: SharedWatchlistDetail = {
      id: createId('shared'),
      name: name.trim() || 'Movie Night',
      inviteCode: await createUniqueInviteCode(),
      ownerId: userId,
      createdAt,
      updatedAt: createdAt,
      status: 'active',
      members: [{ userId, displayName: memberName, role: 'owner', joinedAt: createdAt }],
      items: [],
    };

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      await writeLocalStore({ lists: { ...store.lists, [list.id]: list } });
      return list;
    }

    await setDoc(doc(firestore, 'shared_watchlists', list.id), {
      name: list.name,
      inviteCode: list.inviteCode,
      ownerId: list.ownerId,
      createdAt,
      updatedAt: createdAt,
      status: list.status,
    });
    await setDoc(doc(firestore, 'shared_watchlists', list.id, 'members', userId), {
      ...list.members[0],
      inviteCode: list.inviteCode,
    });
    await setDoc(doc(firestore, 'shared_watchlist_invites', list.inviteCode), {
      code: list.inviteCode,
      listId: list.id,
      name: list.name,
      ownerId: list.ownerId,
      status: list.status,
      updatedAt: createdAt,
    });
    await addMembershipIndex(userId, list);

    return list;
  },

  async createWithFriend(
    userId: string,
    displayName: string,
    friend: FriendSummary,
    name: string
  ): Promise<SharedWatchlistDetail> {
    const createdAt = nowIso();
    const ownerName = sanitizeDisplayName(displayName, 'You');
    const friendName = sanitizeDisplayName(friend.displayName, friend.username || 'Friend');
    const list: SharedWatchlistDetail = {
      id: createId('shared'),
      name: name.trim() || `${friendName} Movies`,
      inviteCode: await createUniqueInviteCode(),
      ownerId: userId,
      createdAt,
      updatedAt: createdAt,
      status: 'active',
      members: [
        { userId, displayName: ownerName, role: 'owner', joinedAt: createdAt },
        { userId: friend.userId, displayName: friendName, role: 'member', joinedAt: createdAt, inviteCode: '' },
      ],
      items: [],
    };
    list.members[1] = { ...list.members[1], inviteCode: list.inviteCode };

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      await writeLocalStore({ lists: { ...store.lists, [list.id]: list } });
      return list;
    }

    await setDoc(doc(firestore, 'shared_watchlists', list.id), {
      name: list.name,
      inviteCode: list.inviteCode,
      ownerId: list.ownerId,
      createdAt,
      updatedAt: createdAt,
      status: list.status,
    });
    await Promise.all([
      setDoc(doc(firestore, 'shared_watchlists', list.id, 'members', userId), {
        ...list.members[0],
        inviteCode: list.inviteCode,
      }),
      setDoc(doc(firestore, 'shared_watchlists', list.id, 'members', friend.userId), list.members[1]),
      setDoc(doc(firestore, 'shared_watchlist_invites', list.inviteCode), {
        code: list.inviteCode,
        listId: list.id,
        name: list.name,
        ownerId: list.ownerId,
        status: list.status,
        updatedAt: createdAt,
      }),
    ]);
    await Promise.all([
      addMembershipIndex(userId, list),
      addMembershipIndex(friend.userId, list),
    ]);

    return list;
  },

  async joinByInviteCode(userId: string, displayName: string, inviteCode: string): Promise<SharedWatchlistDetail> {
    const normalizedCode = inviteCode.trim().toUpperCase();
    const joinedAt = nowIso();
    const member: SharedWatchlistMember = {
      userId,
      displayName: sanitizeDisplayName(displayName, 'Guest'),
      role: 'member',
      joinedAt,
      inviteCode: normalizedCode,
    };

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = Object.values(store.lists).find((item) => item.inviteCode === normalizedCode);
      if (!list) throw new Error('No shared watchlist matches that invite code.');
      assertActiveList(list);
      const members = list.members.some((item) => item.userId === userId)
        ? list.members
        : [...list.members, member];
      const nextList = { ...list, members, updatedAt: joinedAt };
      await writeLocalStore({ lists: { ...store.lists, [nextList.id]: nextList } });
      return nextList;
    }

    const inviteDoc = await getDoc(doc(firestore, 'shared_watchlist_invites', normalizedCode));
    const invite = inviteDoc.exists()
      ? toSharedWatchlistInvite(inviteDoc.id, inviteDoc.data())
      : null;
    if (!invite || invite.status !== 'active') {
      throw new Error('No shared watchlist matches that invite code.');
    }

    await setDoc(doc(firestore, 'shared_watchlists', invite.listId, 'members', userId), member, { merge: true });
    await addMembershipIndex(userId, {
      id: invite.listId,
      name: invite.name,
      inviteCode: invite.code,
      ownerId: invite.ownerId,
      createdAt: invite.updatedAt,
      updatedAt: invite.updatedAt,
      status: invite.status,
      members: [],
    });

    const detail = await this.getDetail(invite.listId);
    if (!detail) throw new Error('The shared watchlist could not be loaded.');
    return detail;
  },

  async addMovie(listId: string, userId: string, displayName: string, movie: MovieItem): Promise<void> {
    const addedAt = nowIso();
    const item: SharedWatchlistItem = {
      id: movie.id,
      movieId: movie.id,
      title: movie.title,
      image: movie.image,
      date: movie.date,
      overview: movie.overview,
      addedBy: userId,
      addedByName: sanitizeDisplayName(displayName, 'Someone'),
      addedAt,
      status: 'candidate',
      votes: {},
    };

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      assertActiveList(list);
      const existing = list.items.find((nextItem) => nextItem.movieId === movie.id);
      const items = existing ? list.items : [item, ...list.items];
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, items, updatedAt: addedAt } },
      });
      return;
    }

    const itemRef = doc(firestore, 'shared_watchlists', listId, 'items', item.id);
    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    assertActiveList(toSharedWatchlist(listDoc.id, listDoc.data()));
    const existingItem = await getDoc(itemRef);
    if (existingItem.exists()) return;

    await Promise.all([
      setDoc(itemRef, removeUndefinedFields({
        id: item.id,
        movieId: item.movieId,
        title: item.title,
        image: item.image,
        date: item.date,
        overview: item.overview,
        addedBy: item.addedBy,
        addedByName: item.addedByName,
        addedAt: item.addedAt,
        status: item.status,
      })),
      setDoc(doc(firestore, 'shared_watchlists', listId), { updatedAt: addedAt }, { merge: true }),
    ]);
  },

  async vote(listId: string, movieId: string, userId: string, vote: SharedWatchlistVote): Promise<void> {
    const updatedAt = nowIso();

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      assertActiveList(list);
      const items = list.items.map((item) =>
        item.movieId === movieId ? { ...item, votes: { ...item.votes, [userId]: vote } } : item
      );
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, items, updatedAt } },
      });
      return;
    }

    const itemRef = doc(firestore, 'shared_watchlists', listId, 'items', movieId);
    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    assertActiveList(toSharedWatchlist(listDoc.id, listDoc.data()));
    const itemDoc = await getDoc(itemRef);
    if (!itemDoc.exists()) throw new Error('Shared watchlist movie not found.');
    await Promise.all([
      setDoc(
        doc(firestore, 'shared_watchlists', listId, 'items', movieId, 'votes', userId),
        { userId, vote, updatedAt },
        { merge: true }
      ),
      setDoc(doc(firestore, 'shared_watchlists', listId), { updatedAt }, { merge: true }),
    ]);
  },

  async updateItemStatus(
    listId: string,
    movieId: string,
    status: SharedWatchlistItemStatus,
    userId: string
  ): Promise<void> {
    const updatedAt = nowIso();

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      assertActiveList(list);
      if (list.ownerId !== userId) throw new Error('Only the owner can choose or close a movie.');
      const items = list.items.map((item) =>
        item.movieId === movieId ? { ...item, status } : item
      );
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, items, updatedAt } },
      });
      return;
    }

    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    assertActiveList(toSharedWatchlist(listDoc.id, listDoc.data()));

    await Promise.all([
      setDoc(doc(firestore, 'shared_watchlists', listId, 'items', movieId), { status }, { merge: true }),
      setDoc(doc(firestore, 'shared_watchlists', listId), { updatedAt }, { merge: true }),
    ]);
  },

  async removeMovie(listId: string, movieId: string, userId: string): Promise<void> {
    const updatedAt = nowIso();

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      assertActiveList(list);
      const item = list.items.find((nextItem) => nextItem.movieId === movieId);
      if (!item) return;
      if (list.ownerId !== userId && item.addedBy !== userId) {
        throw new Error('Only the owner or the person who added this movie can remove it.');
      }
      await writeLocalStore({
        lists: {
          ...store.lists,
          [listId]: {
            ...list,
            items: list.items.filter((nextItem) => nextItem.movieId !== movieId),
            updatedAt,
          },
        },
      });
      return;
    }

    const [listDoc, itemDoc] = await Promise.all([
      getDoc(doc(firestore, 'shared_watchlists', listId)),
      getDoc(doc(firestore, 'shared_watchlists', listId, 'items', movieId)),
    ]);
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    if (!itemDoc.exists()) return;
    const list = toSharedWatchlist(listDoc.id, listDoc.data());
    const item = toSharedWatchlistItem(itemDoc.id, itemDoc.data());
    assertActiveList(list);
    if (list.ownerId !== userId && item.addedBy !== userId) {
      throw new Error('Only the owner or the person who added this movie can remove it.');
    }

    const votesSnapshot = await getDocs(
      collection(firestore, 'shared_watchlists', listId, 'items', movieId, 'votes')
    );

    await Promise.all(votesSnapshot.docs.map((voteDoc) => deleteDoc(voteDoc.ref)));
    await Promise.all([
      deleteDoc(doc(firestore, 'shared_watchlists', listId, 'items', movieId)),
      setDoc(doc(firestore, 'shared_watchlists', listId), { updatedAt }, { merge: true }),
    ]);
  },

  async renameList(listId: string, userId: string, name: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Shared list name cannot be empty.');
    const updatedAt = nowIso();

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      assertActiveList(list);
      if (list.ownerId !== userId) throw new Error('Only the owner can rename this list.');
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, name: trimmedName, updatedAt } },
      });
      return;
    }

    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    const list = toSharedWatchlist(listDoc.id, listDoc.data());
    assertActiveList(list);
    if (list.ownerId !== userId) throw new Error('Only the owner can rename this list.');

    await Promise.all([
      setDoc(doc(firestore, 'shared_watchlists', listId), { name: trimmedName, updatedAt }, { merge: true }),
      list.inviteCode
        ? setDoc(
            doc(firestore, 'shared_watchlist_invites', list.inviteCode),
            { name: trimmedName, updatedAt },
            { merge: true }
          )
        : Promise.resolve(),
      addMembershipIndex(userId, { ...list, name: trimmedName, updatedAt }),
    ]);
  },

  async archiveList(listId: string, userId: string): Promise<void> {
    const updatedAt = nowIso();

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      if (list.ownerId !== userId) throw new Error('Only the owner can archive this list.');
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, status: 'archived', updatedAt } },
      });
      return;
    }

    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    const list = toSharedWatchlist(listDoc.id, listDoc.data());
    if (list.ownerId !== userId) throw new Error('Only the owner can archive this list.');

    await setDoc(
      doc(firestore, 'shared_watchlists', listId),
      { status: 'archived', updatedAt },
      { merge: true }
    );
    if (list.inviteCode) {
      await setDoc(
        doc(firestore, 'shared_watchlist_invites', list.inviteCode),
        { status: 'archived', updatedAt },
        { merge: true }
      );
    }
  },

  async markSeenBy(
    listId: string,
    movieId: string,
    userId: string,
    displayName: string,
    avatarUrl: string,
    watchedAt?: string
  ): Promise<void> {
    const updatedAt = nowIso();
    const payload = removeUndefinedFields({
      userId,
      displayName,
      avatarUrl,
      watchedAt,
      updatedAt,
      source: 'user_log' as const,
    });

    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) throw new Error('Shared watchlist not found.');
      assertActiveList(list);
      
      const items = list.items.map((item) => {
        if (item.movieId !== movieId) return item;
        const currentSeenBy = item.seenBy ?? [];
        const exists = currentSeenBy.some((seen) => seen.userId === userId);
        const newSeen = {
          userId,
          displayName,
          avatarUrl,
          watchedAt,
          updatedAt,
          source: 'user_log' as const,
        };
        const seenBy = exists
          ? currentSeenBy.map((seen) => (seen.userId === userId ? newSeen : seen))
          : [...currentSeenBy, newSeen];
        return { ...item, seenBy };
      });
      
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, items, updatedAt } },
      });
      return;
    }

    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) throw new Error('Shared watchlist not found.');
    assertActiveList(toSharedWatchlist(listDoc.id, listDoc.data()));

    const itemRef = doc(firestore, 'shared_watchlists', listId, 'items', movieId);
    const itemDoc = await getDoc(itemRef);
    if (!itemDoc.exists()) throw new Error('Shared watchlist movie not found.');

    await Promise.all([
      setDoc(
        doc(firestore, 'shared_watchlists', listId, 'items', movieId, 'seenBy', userId),
        payload,
        { merge: true }
      ),
      setDoc(doc(firestore, 'shared_watchlists', listId), { updatedAt }, { merge: true }),
    ]);
  },

  async removeSeenBy(listId: string, movieId: string, userId: string): Promise<void> {
    const updatedAt = nowIso();
    if (!isCloudAvailable()) {
      const store = await readLocalStore();
      const list = store.lists[listId];
      if (!list) return;
      assertActiveList(list);
      const items = list.items.map((item) => {
        if (item.movieId !== movieId) return item;
        return {
          ...item,
          seenBy: (item.seenBy ?? []).filter((seen) => seen.userId !== userId),
        };
      });
      await writeLocalStore({
        lists: { ...store.lists, [listId]: { ...list, items, updatedAt } },
      });
      return;
    }

    const listDoc = await getDoc(doc(firestore, 'shared_watchlists', listId));
    if (!listDoc.exists()) return;
    assertActiveList(toSharedWatchlist(listDoc.id, listDoc.data()));

    await Promise.all([
      deleteDoc(doc(firestore, 'shared_watchlists', listId, 'items', movieId, 'seenBy', userId)),
      setDoc(doc(firestore, 'shared_watchlists', listId), { updatedAt }, { merge: true }),
    ]);
  },
};
