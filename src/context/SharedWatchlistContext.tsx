import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthState } from '@/context/AuthContext';
import { AUTH_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { MovieItem } from '@/services/tmdb';
import type { FriendSummary } from '@/services/social';
import {
  SharedWatchlist,
  SharedWatchlistDetail,
  SharedWatchlistItemStatus,
  SharedWatchlistVote,
  sharedWatchlistService,
} from '@/services/shared-watchlists';

interface SharedWatchlistContextValue {
  lists: SharedWatchlist[];
  isLoaded: boolean;
  error: string | null;
  createList: (name: string) => Promise<SharedWatchlistDetail>;
  createListWithFriend: (friend: FriendSummary, name?: string) => Promise<SharedWatchlistDetail>;
  joinList: (inviteCode: string) => Promise<SharedWatchlistDetail>;
  getListDetail: (listId: string) => Promise<SharedWatchlistDetail | null>;
  addMovieToSharedList: (listId: string, movie: MovieItem) => Promise<void>;
  voteForMovie: (listId: string, movieId: string, vote: SharedWatchlistVote) => Promise<void>;
  removeMovieFromSharedList: (listId: string, movieId: string) => Promise<void>;
  renameList: (listId: string, name: string) => Promise<void>;
  updateMovieStatus: (
    listId: string,
    movieId: string,
    status: SharedWatchlistItemStatus
  ) => Promise<void>;
  archiveList: (listId: string) => Promise<void>;
  refreshLists: () => Promise<void>;
  markSeenBy: (listId: string, movieId: string, watchedAt?: string) => Promise<void>;
  removeSeenBy: (listId: string, movieId: string) => Promise<void>;
}

const SharedWatchlistContext = createContext<SharedWatchlistContextValue | null>(null);

const isPermissionError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'permission-denied';

const getErrorMessage = (error: unknown) => {
  if (isPermissionError(error)) {
    return 'Shared watchlist access is not ready for this account. Make sure Firestore rules are deployed and this user still has a member record for each shared list.';
  }
  if (error instanceof Error) return error.message;
  return 'Shared watchlists could not be updated.';
};

export function SharedWatchlistProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuthState();
  const { profile, isLoaded: isProfileLoaded } = useUserProfile();
  const [lists, setLists] = useState<SharedWatchlist[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
  const displayName = profile.name || profile.username || session?.user.email || 'Movie friend';

  const refreshLists = useCallback(async () => {
    if (!userId || !isProfileLoaded) return;
    try {
      setError(null);
      const nextLists = await sharedWatchlistService.listForUser(userId);
      setLists(nextLists);
    } catch (nextError) {
      const message = getErrorMessage(nextError);
      console.error('[SharedWatchlists] Failed to load lists:', nextError);
      setError(message);
    } finally {
      setIsLoaded(true);
    }
  }, [isProfileLoaded, userId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refreshLists();
    }, 0);
    return () => clearTimeout(timeout);
  }, [refreshLists]);

  const createList = useCallback(
    async (name: string) => {
      if (!userId) throw new Error('Sign in before creating a shared watchlist.');
      const list = await sharedWatchlistService.create(userId, displayName, name);
      await refreshLists();
      return list;
    },
    [displayName, refreshLists, userId]
  );

  const createListWithFriend = useCallback(
    async (friend: FriendSummary, name?: string) => {
      if (!userId) throw new Error('Sign in before creating a shared watchlist.');
      const list = await sharedWatchlistService.createWithFriend(
        userId,
        displayName,
        friend,
        name || `${friend.displayName || friend.username || 'Friend'} Movies`
      );
      await refreshLists();
      return list;
    },
    [displayName, refreshLists, userId]
  );

  const joinList = useCallback(
    async (inviteCode: string) => {
      if (!userId) throw new Error('Sign in before joining a shared watchlist.');
      const list = await sharedWatchlistService.joinByInviteCode(userId, displayName, inviteCode);
      await refreshLists();
      return list;
    },
    [displayName, refreshLists, userId]
  );

  const getListDetail = useCallback(async (listId: string) => {
    return sharedWatchlistService.getDetail(listId);
  }, []);

  const addMovieToSharedList = useCallback(
    async (listId: string, movie: MovieItem) => {
      if (!userId) throw new Error('Sign in before adding movies to a shared watchlist.');
      await sharedWatchlistService.addMovie(listId, userId, displayName, movie);
      await refreshLists();
    },
    [displayName, refreshLists, userId]
  );

  const voteForMovie = useCallback(
    async (listId: string, movieId: string, vote: SharedWatchlistVote) => {
      if (!userId) throw new Error('Sign in before voting in a shared watchlist.');
      await sharedWatchlistService.vote(listId, movieId, userId, vote);
      await refreshLists();
    },
    [refreshLists, userId]
  );

  const removeMovieFromSharedList = useCallback(
    async (listId: string, movieId: string) => {
      if (!userId) throw new Error('Sign in before removing movies from a shared watchlist.');
      await sharedWatchlistService.removeMovie(listId, movieId, userId);
      await refreshLists();
    },
    [refreshLists, userId]
  );

  const renameList = useCallback(
    async (listId: string, name: string) => {
      if (!userId) throw new Error('Sign in before renaming a shared watchlist.');
      await sharedWatchlistService.renameList(listId, userId, name);
      await refreshLists();
    },
    [refreshLists, userId]
  );

  const updateMovieStatus = useCallback(
    async (listId: string, movieId: string, status: SharedWatchlistItemStatus) => {
      if (!userId) throw new Error('Sign in before updating a shared watchlist movie.');
      await sharedWatchlistService.updateItemStatus(listId, movieId, status, userId);
      await refreshLists();
    },
    [refreshLists, userId]
  );

  const archiveList = useCallback(
    async (listId: string) => {
      if (!userId) throw new Error('Sign in before archiving a shared watchlist.');
      await sharedWatchlistService.archiveList(listId, userId);
      await refreshLists();
    },
    [refreshLists, userId]
  );

  const markSeenBy = useCallback(
    async (listId: string, movieId: string, watchedAt?: string) => {
      if (!userId) throw new Error('Sign in before marking movie as seen.');
      await sharedWatchlistService.markSeenBy(
        listId,
        movieId,
        userId,
        displayName,
        profile.avatarUrl || '',
        watchedAt
      );
      await refreshLists();
    },
    [displayName, profile.avatarUrl, refreshLists, userId]
  );

  const removeSeenBy = useCallback(
    async (listId: string, movieId: string) => {
      if (!userId) throw new Error('Sign in before removing seen status.');
      await sharedWatchlistService.removeSeenBy(listId, movieId, userId);
      await refreshLists();
    },
    [refreshLists, userId]
  );

  const value = useMemo<SharedWatchlistContextValue>(
    () => ({
      lists,
      isLoaded,
      error,
      createList,
      createListWithFriend,
      joinList,
      getListDetail,
      addMovieToSharedList,
      voteForMovie,
      removeMovieFromSharedList,
      renameList,
      updateMovieStatus,
      archiveList,
      refreshLists,
      markSeenBy,
      removeSeenBy,
    }),
    [
      addMovieToSharedList,
      archiveList,
      createList,
      createListWithFriend,
      error,
      getListDetail,
      isLoaded,
      joinList,
      lists,
      markSeenBy,
      removeMovieFromSharedList,
      removeSeenBy,
      renameList,
      refreshLists,
      updateMovieStatus,
      voteForMovie,
    ]
  );

  return <SharedWatchlistContext.Provider value={value}>{children}</SharedWatchlistContext.Provider>;
}

export function useSharedWatchlists() {
  const context = useContext(SharedWatchlistContext);
  if (!context) throw new Error('useSharedWatchlists must be used within SharedWatchlistProvider');
  return context;
}
