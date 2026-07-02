import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { CLOUD_SYNC_ENABLED } from '@/constants/features';
import { firebaseAuth, firestore } from '@/services/firebase';
import { isRemoteProfileImageUri } from '@/services/profile-images';
import type { DiaryEntry, LoggedMovie } from '@/context/MovieContext';
import type { UserProfile } from '@/hooks/use-user-profile';

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';
export type FriendshipState = 'self' | 'none' | 'sent' | 'incoming' | 'friends';

export interface PublicProfileMovie {
  id: string;
  title: string;
  image: string;
  date?: string;
  rating?: number;
  overview?: string;
}

export interface PublicProfileStats {
  watched: number;
  watchlist: number;
  averageRating: number | null;
}

export interface PublicProfile {
  userId: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  favoriteMovies: PublicProfileMovie[];
  favoriteFilms: PublicProfileMovie[];
  recentDiaryEntries: PublicProfileMovie[];
  recentReviews: PublicProfileMovie[];
  stats: PublicProfileStats;
  updatedAt: string;
  usernameKey: string;
  searchText: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromUsername: string;
  fromAvatarUrl: string;
  toUserId: string;
  toDisplayName: string;
  toUsername: string;
  toAvatarUrl: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FriendSummary {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
}

export interface RelationshipSummary {
  state: FriendshipState;
  request: FriendRequest | null;
}

const APP_PROFILE_URL = 'https://swipelog.app/u';

const isCloudAvailable = () => CLOUD_SYNC_ENABLED && Boolean(firebaseAuth.currentUser);

const nowIso = () => new Date().toISOString();

export const normalizeUsername = (username: string) =>
  username.trim().replace(/^@/, '').toLowerCase();

export const createProfileShareUrl = (username: string) =>
  `${APP_PROFILE_URL}/${encodeURIComponent(normalizeUsername(username))}`;

const toPublicMovie = (movie: LoggedMovie): PublicProfileMovie => ({
  id: movie.id,
  title: movie.title,
  image: movie.image,
  date: movie.date,
  rating: movie.rating,
  overview: movie.overview,
});

const toPublicDiaryMovie = (entry: DiaryEntry): PublicProfileMovie => ({
  id: entry.movie.id,
  title: entry.movie.title,
  image: entry.movie.image,
  date: entry.movie.date,
  rating: entry.rating,
  overview: entry.movie.overview,
});

const toPublicImageUri = (uri: string) => (isRemoteProfileImageUri(uri) ? uri : '');

export const buildPublicProfile = (
  userId: string,
  profile: UserProfile,
  movies: LoggedMovie[] = [],
  diaryEntries: DiaryEntry[] = []
): PublicProfile => {
  const usernameKey = normalizeUsername(profile.username);
  const favoriteMovies = profile.favoriteMovieIds
    .map((movieId) => movies.find((movie) => movie.id === movieId))
    .filter((movie): movie is LoggedMovie => Boolean(movie))
    .slice(0, 4)
    .map(toPublicMovie);
  const watchedMovies = movies.filter((movie) => movie.isWatched);
  const ratedMovies = movies.filter((movie) => movie.rating > 0);
  const favoriteFilms = movies
    .filter((movie) => movie.isLiked)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8)
    .map(toPublicMovie);
  const recentDiaryEntries = diaryEntries.slice(0, 8).map(toPublicDiaryMovie);
  const recentReviews = diaryEntries
    .filter((entry) => Boolean(entry.note?.trim()))
    .slice(0, 5)
    .map((entry) => ({
      ...toPublicDiaryMovie(entry),
      overview: entry.note?.trim(),
    }));
  const averageRating =
    ratedMovies.length > 0
      ? ratedMovies.reduce((sum, movie) => sum + movie.rating, 0) / ratedMovies.length
      : null;
  const displayName = profile.name || profile.username || 'Movie friend';

  return {
    userId,
    displayName,
    username: usernameKey,
    bio: profile.bio,
    avatarUrl: toPublicImageUri(profile.avatarUrl),
    coverUrl: toPublicImageUri(profile.coverUrl),
    favoriteMovies,
    favoriteFilms,
    recentDiaryEntries,
    recentReviews,
    stats: {
      watched: watchedMovies.length,
      watchlist: movies.filter((movie) => movie.isWatchlist).length,
      averageRating,
    },
    updatedAt: nowIso(),
    usernameKey,
    searchText: `${displayName} ${usernameKey}`.toLowerCase(),
  };
};

const toPublicProfile = (id: string, data: Record<string, unknown>): PublicProfile => ({
  userId: typeof data.userId === 'string' ? data.userId : id,
  displayName: typeof data.displayName === 'string' ? data.displayName : 'Movie friend',
  username: typeof data.username === 'string' ? data.username : '',
  bio: typeof data.bio === 'string' ? data.bio : '',
  avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
  coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : '',
  favoriteMovies: Array.isArray(data.favoriteMovies) ? (data.favoriteMovies as PublicProfileMovie[]) : [],
  favoriteFilms: Array.isArray(data.favoriteFilms) ? (data.favoriteFilms as PublicProfileMovie[]) : [],
  recentDiaryEntries: Array.isArray(data.recentDiaryEntries) ? (data.recentDiaryEntries as PublicProfileMovie[]) : [],
  recentReviews: Array.isArray(data.recentReviews) ? (data.recentReviews as PublicProfileMovie[]) : [],
  stats:
    typeof data.stats === 'object' && data.stats !== null
      ? (data.stats as PublicProfileStats)
      : { watched: 0, watchlist: 0, averageRating: null },
  updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
  usernameKey: typeof data.usernameKey === 'string' ? data.usernameKey : '',
  searchText: typeof data.searchText === 'string' ? data.searchText : '',
});

const toFriendRequest = (id: string, data: Record<string, unknown>): FriendRequest => ({
  id,
  fromUserId: typeof data.fromUserId === 'string' ? data.fromUserId : '',
  fromDisplayName: typeof data.fromDisplayName === 'string' ? data.fromDisplayName : 'Movie friend',
  fromUsername: typeof data.fromUsername === 'string' ? data.fromUsername : '',
  fromAvatarUrl: typeof data.fromAvatarUrl === 'string' ? data.fromAvatarUrl : '',
  toUserId: typeof data.toUserId === 'string' ? data.toUserId : '',
  toDisplayName: typeof data.toDisplayName === 'string' ? data.toDisplayName : 'Movie friend',
  toUsername: typeof data.toUsername === 'string' ? data.toUsername : '',
  toAvatarUrl: typeof data.toAvatarUrl === 'string' ? data.toAvatarUrl : '',
  status: data.status === 'accepted' || data.status === 'declined' ? data.status : 'pending',
  createdAt: typeof data.createdAt === 'string' ? data.createdAt : nowIso(),
  updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
});

const requestIdFor = (a: string, b: string) => [a, b].sort().join('_');

const isPermissionDenied = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'permission-denied';

export const socialService = {
  async publishPublicProfile(profile: PublicProfile): Promise<void> {
    if (!isCloudAvailable() || !profile.usernameKey) return;
    try {
      await setDoc(doc(firestore, 'public_profiles', profile.userId), profile, { merge: true });
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      console.warn('[Social] Public profile publish was blocked by Firestore rules. Deploy the latest rules to enable profile updates.');
    }
  },

  async getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
    if (!isCloudAvailable()) return null;
    const usernameKey = normalizeUsername(username);
    const snapshot = await getDocs(query(collection(firestore, 'public_profiles'), where('usernameKey', '==', usernameKey)));
    const first = snapshot.docs[0];
    return first ? toPublicProfile(first.id, first.data()) : null;
  },

  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    if (!isCloudAvailable()) return null;
    const snap = await getDoc(doc(firestore, 'public_profiles', userId));
    return snap.exists() ? toPublicProfile(snap.id, snap.data()) : null;
  },

  async searchPublicProfiles(term: string, currentUserId: string): Promise<PublicProfile[]> {
    if (!isCloudAvailable()) return [];
    const queryText = term.trim().replace(/^@/, '').toLowerCase();
    if (!queryText) return [];
    const snapshot = await getDocs(collection(firestore, 'public_profiles'));
    return snapshot.docs
      .map((profileDoc) => toPublicProfile(profileDoc.id, profileDoc.data()))
      .filter((profile) => profile.userId !== currentUserId)
      .filter((profile) =>
        profile.usernameKey.includes(queryText) ||
        profile.displayName.toLowerCase().includes(queryText) ||
        profile.searchText.includes(queryText)
      )
      .slice(0, 20);
  },

  async getRelationship(currentUserId: string, targetUserId: string): Promise<RelationshipSummary> {
    if (!isCloudAvailable()) return { state: 'none', request: null };
    if (currentUserId === targetUserId) return { state: 'self', request: null };

    const friendSnap = await getDoc(doc(firestore, 'user_friends', currentUserId, 'friends', targetUserId));
    if (friendSnap.exists()) return { state: 'friends', request: null };

    let requestSnap;
    try {
      requestSnap = await getDoc(doc(firestore, 'friend_requests', requestIdFor(currentUserId, targetUserId)));
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      return { state: 'none', request: null };
    }
    if (!requestSnap.exists()) return { state: 'none', request: null };
    const request = toFriendRequest(requestSnap.id, requestSnap.data());
    if (request.status !== 'pending') return { state: 'none', request };
    return {
      state: request.fromUserId === currentUserId ? 'sent' : 'incoming',
      request,
    };
  },

  async sendFriendRequest(from: PublicProfile, to: PublicProfile): Promise<void> {
    if (!isCloudAvailable()) throw new Error('Sign in before adding friends.');
    if (from.userId === to.userId) throw new Error('You cannot add yourself.');
    let relationship: RelationshipSummary = { state: 'none', request: null };
    try {
      relationship = await this.getRelationship(from.userId, to.userId);
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
    }
    if (relationship.state === 'friends' || relationship.state === 'sent') return;
    if (relationship.state === 'incoming' && relationship.request) {
      await this.acceptFriendRequest(relationship.request);
      return;
    }
    const createdAt = nowIso();
    const request: FriendRequest = {
      id: requestIdFor(from.userId, to.userId),
      fromUserId: from.userId,
      fromDisplayName: from.displayName,
      fromUsername: from.username,
      fromAvatarUrl: from.avatarUrl,
      toUserId: to.userId,
      toDisplayName: to.displayName,
      toUsername: to.username,
      toAvatarUrl: to.avatarUrl,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    };
    await setDoc(doc(firestore, 'friend_requests', request.id), request);
  },

  async acceptFriendRequest(request: FriendRequest): Promise<void> {
    if (!isCloudAvailable()) throw new Error('Sign in before accepting friends.');
    const updatedAt = nowIso();
    await Promise.all([
      setDoc(doc(firestore, 'friend_requests', request.id), { status: 'accepted', updatedAt }, { merge: true }),
      setDoc(doc(firestore, 'user_friends', request.fromUserId, 'friends', request.toUserId), {
        userId: request.toUserId,
        displayName: request.toDisplayName,
        username: request.toUsername,
        avatarUrl: request.toAvatarUrl,
        createdAt: updatedAt,
      }),
      setDoc(doc(firestore, 'user_friends', request.toUserId, 'friends', request.fromUserId), {
        userId: request.fromUserId,
        displayName: request.fromDisplayName,
        username: request.fromUsername,
        avatarUrl: request.fromAvatarUrl,
        createdAt: updatedAt,
      }),
    ]);
  },

  async declineFriendRequest(request: FriendRequest): Promise<void> {
    if (!isCloudAvailable()) return;
    await setDoc(doc(firestore, 'friend_requests', request.id), { status: 'declined', updatedAt: nowIso() }, { merge: true });
  },

  async listFriendRequests(userId: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
    if (!isCloudAvailable()) return { incoming: [], outgoing: [] };
    const [incomingSnapshot, outgoingSnapshot] = await Promise.all([
      getDocs(query(collection(firestore, 'friend_requests'), where('toUserId', '==', userId), where('status', '==', 'pending'))),
      getDocs(query(collection(firestore, 'friend_requests'), where('fromUserId', '==', userId), where('status', '==', 'pending'))),
    ]);
    return {
      incoming: incomingSnapshot.docs.map((item) => toFriendRequest(item.id, item.data())),
      outgoing: outgoingSnapshot.docs.map((item) => toFriendRequest(item.id, item.data())),
    };
  },

  async listFriends(userId: string): Promise<FriendSummary[]> {
    if (!isCloudAvailable()) return [];
    const snapshot = await getDocs(collection(firestore, 'user_friends', userId, 'friends'));
    return snapshot.docs
      .map((item) => {
        const data = item.data();
        return {
          userId: item.id,
          displayName: typeof data.displayName === 'string' ? data.displayName : 'Movie friend',
          username: typeof data.username === 'string' ? data.username : '',
          avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : nowIso(),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
};
