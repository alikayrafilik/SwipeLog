import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoggedMovie } from '@/context/MovieContext';
import type { FriendRequest, FriendSummary } from '@/services/social';

export type ActivityItemKind = 'friend-request' | 'friendship' | 'release';

export type ActivityItem =
  | {
      id: string;
      kind: 'friend-request';
      createdAt: string;
      title: string;
      body: string;
      isUnread: boolean;
      request: FriendRequest;
    }
  | {
      id: string;
      kind: 'friendship';
      createdAt: string;
      title: string;
      body: string;
      isUnread: boolean;
      friend: FriendSummary;
    }
  | {
      id: string;
      kind: 'release';
      createdAt: string;
      title: string;
      body: string;
      isUnread: boolean;
      movie: LoggedMovie;
      releaseDate: string;
    };

interface BuildActivityItemsInput {
  friends: FriendSummary[];
  incomingRequests: FriendRequest[];
  movies: LoggedMovie[];
  readIds: Set<string>;
}

const STORAGE_KEY_PREFIX = '@swipelog_activity_read_v1';

export const getActivityReadStorageKey = (userId: string) =>
  `${STORAGE_KEY_PREFIX}:${userId}`;

export const loadActivityReadIds = async (userId: string) => {
  const stored = await AsyncStorage.getItem(getActivityReadStorageKey(userId));
  if (!stored) return new Set<string>();
  try {
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
};

export const saveActivityReadIds = async (userId: string, ids: Iterable<string>) => {
  await AsyncStorage.setItem(getActivityReadStorageKey(userId), JSON.stringify([...ids]));
};

export const markActivityItemsRead = async (userId: string, itemIds: string[]) => {
  const readIds = await loadActivityReadIds(userId);
  itemIds.forEach((id) => readIds.add(id));
  await saveActivityReadIds(userId, readIds);
  return readIds;
};

const parseReleaseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatReleaseDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const buildActivityItems = ({
  friends,
  incomingRequests,
  movies,
  readIds,
}: BuildActivityItemsInput): ActivityItem[] => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const requestItems: ActivityItem[] = incomingRequests.map((request) => {
    const id = `friend-request:${request.id}`;
    return {
      id,
      kind: 'friend-request',
      createdAt: request.createdAt,
      title: 'New friend request',
      body: `${request.fromDisplayName} wants to connect with you.`,
      isUnread: !readIds.has(id),
      request,
    };
  });

  const friendshipItems: ActivityItem[] = friends.map((friend) => {
    const id = `friendship:${friend.userId}:${friend.createdAt}`;
    return {
      id,
      kind: 'friendship',
      createdAt: friend.createdAt,
      title: 'You are now friends',
      body: `Open @${friend.username}'s profile or start a shared watchlist.`,
      isUnread: !readIds.has(id),
      friend,
    };
  });

  const releaseItems: Extract<ActivityItem, { kind: 'release' }>[] = movies
    .filter((movie) => movie.isWatchlist)
    .map((movie) => {
      const releaseDate = parseReleaseDate(movie.date);
      if (!releaseDate || releaseDate > now) return null;
      const releaseDateKey = releaseDate.toISOString().slice(0, 10);
      const id = `release:${movie.id}:${releaseDateKey}`;
      return {
        id,
        kind: 'release' as const,
        createdAt: releaseDate.toISOString(),
        title: `${movie.title} is out`,
        body: `A film from your watchlist released on ${formatReleaseDate(releaseDate.toISOString())}.`,
        isUnread: !readIds.has(id),
        movie,
        releaseDate: releaseDate.toISOString(),
      };
    })
    .filter((item): item is Extract<ActivityItem, { kind: 'release' }> => Boolean(item));

  return [...requestItems, ...friendshipItems, ...releaseItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
};
