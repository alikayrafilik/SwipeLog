import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MovieItem, tmdbService } from '@/services/tmdb';
import type { LetterboxdImportMovie } from '@/services/letterboxd-import';
import { useAuth } from '@/context/AuthContext';
import { loadCloudState, saveCloudMovieStore } from '@/services/cloud-state';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import type { DiscoverySignal } from '@/services/discovery-ranking';
import { toWatchDateTime, validateIsoWatchDate } from '@/utils/watch-date';

export interface MovieRecord {
  id: string;
  title: string;
  image: string;
  date?: string;
  overview?: string;
  genreIds?: number[];
  runtimeMinutes?: number;
  communityRating?: number;
}

export interface WatchEntry {
  id: string;
  movieId: string;
  rating: number;
  watchedAt: string;
  note?: string;
}

export interface UserMovieState {
  movieId: string;
  rating: number;
  isLiked: boolean;
  isWatchlist: boolean;
  watchlistAddedAt?: string;
  listIds: string[];
}

export interface CustomMovieList {
  id: string;
  name: string;
  createdAt: string;
}

export type DiscoveryAction = 'liked' | 'skipped' | 'opened' | 'watched';

export interface DiscoveryEvent {
  id: string;
  movieId: string;
  action: DiscoveryAction;
  createdAt: string;
}

interface MovieStoreV4 {
  version: 4;
  catalog: Record<string, MovieRecord>;
  userStates: Record<string, UserMovieState>;
  watchHistory: WatchEntry[];
  lists: CustomMovieList[];
  discoveryEvents: DiscoveryEvent[];
  lastModified: string;
}

interface LegacyStoreV3 {
  version: 3;
  catalog: Record<string, MovieRecord>;
  userStates: Record<string, UserMovieState>;
  watchHistory: WatchEntry[];
  lists: CustomMovieList[];
}

// Compatibility view used by the current screens while the store is normalized.
export interface LoggedMovie extends MovieRecord {
  rating: number;
  isLiked: boolean;
  isWatched: boolean;
  isWatchlist: boolean;
  watchlistAddedAt?: string;
  watchedDate?: string;
  lists: string[];
}

export interface DiaryEntry extends WatchEntry {
  movie: MovieRecord;
}

interface MovieStateSnapshot {
  rating: number;
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
}

interface MovieContextType {
  movies: LoggedMovie[];
  watchHistory: WatchEntry[];
  diaryEntries: DiaryEntry[];
  discoveryEvents: DiscoveryEvent[];
  discoverySignals: DiscoverySignal[];
  discoveryHiddenMovieIds: string[];
  customLists: string[];
  isInitialized: boolean;
  logMovie: (
    movie: MovieItem,
    rating: number,
    isWatched: boolean,
    isWatchlist: boolean,
    isLiked?: boolean
  ) => void;
  addWatchEntry: (movie: MovieItem, rating: number, note?: string, watchedAt?: string) => void;
  updateWatchEntry: (entryId: string, updates: Pick<WatchEntry, 'rating' | 'watchedAt' | 'note'>) => void;
  deleteWatchEntry: (entryId: string) => void;
  recordDiscoveryEvent: (movie: MovieItem, action: DiscoveryAction) => void;
  getDiscoveryState: (movieId: string) => DiscoveryAction | null;
  shouldShowInDiscovery: (movieId: string) => boolean;
  filterDiscoveryCandidates: (movies: MovieItem[]) => MovieItem[];
  clearDiscoveryHistory: () => void;
  clearAllMovieData: () => Promise<void>;
  refreshMovieMetadata: (movieIds?: string[]) => Promise<void>;
  toggleLike: (movieId: string) => void;
  removeMovie: (movieId: string) => void;
  getMovieState: (movieId: string) => MovieStateSnapshot | null;
  createList: (name: string) => void;
  deleteList: (name: string) => void;
  saveMovie: (movie: MovieItem) => void;
  addMovieToList: (movie: MovieItem, listName: string) => void;
  toggleMovieInList: (movieId: string, listName: string) => void;
  importMovies: (items: LetterboxdImportMovie[]) => void;
}

interface LegacyMovie extends MovieRecord {
  rating?: number;
  isLiked?: boolean;
  isWatched?: boolean;
  isWatchlist?: boolean;
  watchedDate?: string;
  lists?: string[];
}

const MovieContext = createContext<MovieContextType | undefined>(undefined);

const V4_STORAGE_KEY = '@swipelog_store_v4';
const V3_STORAGE_KEY = '@swipelog_store_v3';
const LEGACY_MOVIES_KEY = '@swipelog_movie_logs_v2';
const LEGACY_LISTS_KEY = '@swipelog_custom_lists';
const SYSTEM_LISTS = new Set(['Favorites', 'Watchlist']);
const defaultCustomLists = ['Favorites', 'With my bff', 'Might rewatch'];

const emptyStore = (lastModified = new Date(0).toISOString()): MovieStoreV4 => ({
  version: 4,
  catalog: {},
  userStates: {},
  watchHistory: [],
  discoveryEvents: [],
  lists: defaultCustomLists.map((name, index) => ({
    id: `default-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    createdAt: new Date(0).toISOString(),
  })),
  lastModified,
});

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getCreatedTimeFromId = (id: string) => {
  const timestamp = id.match(/^[a-z-]+-(\d+)-/)?.[1];
  return timestamp ? Number(timestamp) : 0;
};

const compareWatchEntriesDesc = (a: WatchEntry, b: WatchEntry) => {
  const watchedAtOrder = b.watchedAt.localeCompare(a.watchedAt);
  if (watchedAtOrder !== 0) return watchedAtOrder;
  return getCreatedTimeFromId(b.id) - getCreatedTimeFromId(a.id);
};

const toIsoDate = (value?: string) => {
  if (!value) return new Date().toISOString();
  const validation = validateIsoWatchDate(value.slice(0, 10));
  if (validation.error) return new Date().toISOString();
  return new Date(toWatchDateTime(validation.dateKey)).toISOString();
};

const toDisplayDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const toMovieRecord = (movie: MovieItem, previous?: MovieRecord): MovieRecord => ({
  id: movie.id,
  title: movie.title,
  image: movie.image,
  date: movie.date,
  overview: movie.overview,
  genreIds: movie.genreIds ?? previous?.genreIds,
  runtimeMinutes: movie.runtimeMinutes ?? previous?.runtimeMinutes,
  communityRating: movie.rating ?? previous?.communityRating,
});

const migrateLegacyStore = (legacyMovies: LegacyMovie[], legacyLists: string[]): MovieStoreV4 => {
  const store = emptyStore();
  const listNames = Array.from(new Set([...defaultCustomLists, ...legacyLists]));
  store.lists = listNames.map((name, index) => ({
    id: `migrated-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    createdAt: new Date(0).toISOString(),
  }));

  legacyMovies.forEach((movie) => {
    store.catalog[movie.id] = {
      id: movie.id,
      title: movie.title,
      image: movie.image,
      date: movie.date,
      overview: movie.overview,
      genreIds: movie.genreIds,
      runtimeMinutes: movie.runtimeMinutes,
    };

    const customListIds = (movie.lists ?? [])
      .filter((name) => !SYSTEM_LISTS.has(name))
      .map((name) => store.lists.find((list) => list.name === name)?.id)
      .filter((id): id is string => Boolean(id));

    store.userStates[movie.id] = {
      movieId: movie.id,
      rating: movie.rating ?? 0,
      isLiked: movie.isLiked ?? movie.lists?.includes('Favorites') ?? false,
      isWatchlist: movie.isWatchlist ?? movie.lists?.includes('Watchlist') ?? false,
      watchlistAddedAt:
        movie.isWatchlist || movie.lists?.includes('Watchlist')
          ? new Date(0).toISOString()
          : undefined,
      listIds: customListIds,
    };

    if (movie.isWatched) {
      store.watchHistory.push({
        id: createId('watch'),
        movieId: movie.id,
        rating: movie.rating ?? 0,
        watchedAt: toIsoDate(movie.watchedDate),
      });
    }
  });

  store.lastModified = new Date().toISOString();
  return store;
};

const migrateV3Store = (store: LegacyStoreV3): MovieStoreV4 => ({
  ...store,
  version: 4,
  discoveryEvents: [],
  lastModified: new Date().toISOString(),
});

export const MovieProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [store, setStore] = useState<MovieStoreV4>(emptyStore);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCloudSyncReady, setIsCloudSyncReady] = useState(false);

  useEffect(() => {
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;

    let cancelled = false;
    const userStorageKey = `${V4_STORAGE_KEY}:${userId}`;

    const loadStoredData = async () => {
      try {
        const [cloudResult, userStoredV4] = await Promise.all([
          loadCloudState(userId)
            .then((state) => ({ state, loaded: true as const }))
            .catch((error) => {
              console.error('[MovieStore] Failed to load cloud data:', error);
              return { state: null, loaded: false as const };
            }),
          AsyncStorage.getItem(userStorageKey),
        ]);

        const cloudStore = cloudResult.state?.movie_store as MovieStoreV4 | null;
        const localStore = userStoredV4 ? (JSON.parse(userStoredV4) as MovieStoreV4) : null;
        const isCloudValid = cloudStore?.version === 4;
        const isLocalValid = localStore?.version === 4;

        let storeToUse: MovieStoreV4 | null = null;
        let shouldSaveToCloud = false;
        let shouldSaveToLocal = false;

        if (isCloudValid && isLocalValid) {
          const cloudTime = new Date(cloudStore.lastModified ?? 0).getTime();
          const localTime = new Date(localStore.lastModified ?? 0).getTime();

          if (localTime > cloudTime) {
            storeToUse = localStore;
            shouldSaveToCloud = true;
          } else {
            storeToUse = cloudStore;
            shouldSaveToLocal = localTime < cloudTime;
          }
        } else if (isCloudValid) {
          storeToUse = cloudStore;
          shouldSaveToLocal = true;
        } else if (isLocalValid) {
          storeToUse = localStore;
          shouldSaveToCloud = true;
        }

        if (storeToUse) {
          const normalized = { ...storeToUse, discoveryEvents: storeToUse.discoveryEvents ?? [] };
          if (!cancelled) setStore(normalized);
          if (shouldSaveToLocal) {
            await AsyncStorage.setItem(userStorageKey, JSON.stringify(normalized));
          }
          if (CLOUD_SYNC_ENABLED && cloudResult.loaded && shouldSaveToCloud) {
            void saveCloudMovieStore(userId, normalized).catch((error) => {
              console.error('[MovieStore] Failed to create cloud backup:', error);
            });
          }
        } else {
          const [globalV4, storedV3, storedMovies, storedLists] = await Promise.all([
            AsyncStorage.getItem(V4_STORAGE_KEY),
            AsyncStorage.getItem(V3_STORAGE_KEY),
            AsyncStorage.getItem(LEGACY_MOVIES_KEY),
            AsyncStorage.getItem(LEGACY_LISTS_KEY),
          ]);
          const migrated = globalV4
            ? (JSON.parse(globalV4) as MovieStoreV4)
            : storedV3
              ? migrateV3Store(JSON.parse(storedV3))
              : migrateLegacyStore(
                  storedMovies ? JSON.parse(storedMovies) : [],
                  storedLists ? JSON.parse(storedLists) : []
                );
          if (!cancelled) setStore(migrated);
          await AsyncStorage.setItem(userStorageKey, JSON.stringify(migrated));
          if (CLOUD_SYNC_ENABLED && cloudResult.loaded) void saveCloudMovieStore(userId, migrated).catch((error) => {
            console.error('[MovieStore] Failed to create cloud backup:', error);
          });
        }
        if (!cancelled) setIsCloudSyncReady(CLOUD_SYNC_ENABLED && cloudResult.loaded);
      } catch (error) {
        console.error('[MovieStore] Failed to load or migrate data:', error);
        if (!cancelled) setStore(emptyStore());
      } finally {
        if (!cancelled) setIsInitialized(true);
      }
    };

    loadStoredData();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!isInitialized || !userId) return;

    const userStorageKey = `${V4_STORAGE_KEY}:${userId}`;
    const localTimeout = setTimeout(() => {
      AsyncStorage.setItem(userStorageKey, JSON.stringify(store)).catch((error) => {
        console.error('[MovieStore] Failed to write local store:', error);
      });
    }, 200);

    if (!isCloudSyncReady) return () => clearTimeout(localTimeout);

    const cloudTimeout = setTimeout(() => {
      saveCloudMovieStore(userId, store).catch((error) => {
        console.error('[MovieStore] Failed to sync cloud data:', error);
      });
    }, 800);

    return () => {
      clearTimeout(localTimeout);
      clearTimeout(cloudTimeout);
    };
  }, [isCloudSyncReady, isInitialized, session?.user.id, store]);

  const updateStore = React.useCallback((updater: (prev: MovieStoreV4) => MovieStoreV4) => {
    setStore((prev) => {
      const next = updater(prev);
      return { ...next, lastModified: new Date().toISOString() };
    });
  }, []);

  const customLists = useMemo(() => store.lists.map((list) => list.name), [store.lists]);
  const listNameById = useMemo(
    () => new Map(store.lists.map((list) => [list.id, list.name])),
    [store.lists]
  );
  const latestWatchByMovieId = useMemo(() => {
    const latestByMovieId = new Map<string, WatchEntry>();
    store.watchHistory.forEach((entry) => {
      const latest = latestByMovieId.get(entry.movieId);
      if (!latest || compareWatchEntriesDesc(entry, latest) < 0) {
        latestByMovieId.set(entry.movieId, entry);
      }
    });
    return latestByMovieId;
  }, [store.watchHistory]);
  const watchedMovieIds = useMemo(
    () => new Set(store.watchHistory.map((entry) => entry.movieId)),
    [store.watchHistory]
  );
  const diaryEntries = useMemo<DiaryEntry[]>(
    () =>
      store.watchHistory
        .map((entry) => ({ ...entry, movie: store.catalog[entry.movieId] }))
        .filter((entry): entry is DiaryEntry => Boolean(entry.movie))
        .sort(compareWatchEntriesDesc),
    [store.catalog, store.watchHistory]
  );

  const movies = useMemo<LoggedMovie[]>(() => {
    return Object.values(store.catalog)
      .map((movie) => {
        const state = store.userStates[movie.id];
        const latestWatch = latestWatchByMovieId.get(movie.id);
        const customListNames = (state?.listIds ?? [])
          .map((id) => listNameById.get(id))
          .filter((name): name is string => Boolean(name));

        return {
          ...movie,
          rating: state?.rating ?? latestWatch?.rating ?? 0,
          isLiked: state?.isLiked ?? false,
          isWatched: watchedMovieIds.has(movie.id),
          isWatchlist: state?.isWatchlist ?? false,
          watchlistAddedAt: state?.watchlistAddedAt,
          watchedDate: toDisplayDate(latestWatch?.watchedAt),
          lists: [
            ...customListNames,
            ...(state?.isLiked ? ['Favorites'] : []),
            ...(state?.isWatchlist ? ['Watchlist'] : []),
          ],
        };
      })
      .filter((movie) => movie.isWatched || movie.isWatchlist || movie.isLiked || movie.lists.length > 0);
  }, [latestWatchByMovieId, listNameById, store.catalog, store.userStates, watchedMovieIds]);

  const discoveryHiddenMovieIdSet = useMemo(() => {
    const hidden = new Set<string>();
    store.discoveryEvents.forEach((event) => {
      if (event.action === 'liked' || event.action === 'skipped' || event.action === 'watched') {
        hidden.add(event.movieId);
      }
    });
    store.watchHistory.forEach((entry) => hidden.add(entry.movieId));
    Object.values(store.userStates).forEach((state) => {
      if (state.isWatchlist) hidden.add(state.movieId);
    });
    return hidden;
  }, [store.discoveryEvents, store.userStates, store.watchHistory]);
  const discoveryHiddenMovieIds = useMemo(
    () => Array.from(discoveryHiddenMovieIdSet),
    [discoveryHiddenMovieIdSet]
  );

  const discoverySignals = useMemo<DiscoverySignal[]>(
    () =>
      store.discoveryEvents
        .map((event) => {
          const movie = store.catalog[event.movieId];
          return movie ? { action: event.action, movie } : null;
        })
        .filter((signal): signal is DiscoverySignal => Boolean(signal)),
    [store.catalog, store.discoveryEvents]
  );

  const logMovie = (
    movie: MovieItem,
    rating: number,
    isWatched: boolean,
    isWatchlist: boolean,
    isLiked?: boolean
  ) => {
    updateStore((previous) => {
      const existingState = previous.userStates[movie.id];
      const watchlistAddedAt = isWatchlist
        ? existingState?.isWatchlist
          ? existingState.watchlistAddedAt
          : new Date().toISOString()
        : undefined;
      const previousWatches = previous.watchHistory.filter((entry) => entry.movieId === movie.id);
      let watchHistory = previous.watchHistory;

      if (isWatched && previousWatches.length === 0) {
        watchHistory = [
          ...watchHistory,
          { id: createId('watch'), movieId: movie.id, rating, watchedAt: new Date().toISOString() },
        ];
      } else if (isWatched && previousWatches.length > 0) {
        const latestId = [...previousWatches].sort(compareWatchEntriesDesc)[0].id;
        watchHistory = watchHistory.map((entry) =>
          entry.id === latestId ? { ...entry, rating } : entry
        );
      } else if (!isWatched && previousWatches.length > 0) {
        watchHistory = watchHistory.filter((entry) => entry.movieId !== movie.id);
      }

      return {
        ...previous,
        catalog: {
          ...previous.catalog,
          [movie.id]: toMovieRecord(movie, previous.catalog[movie.id]),
        },
        userStates: {
          ...previous.userStates,
          [movie.id]: {
            movieId: movie.id,
            rating,
            isLiked: isLiked ?? existingState?.isLiked ?? false,
            isWatchlist,
            watchlistAddedAt,
            listIds: existingState?.listIds ?? [],
          },
        },
        watchHistory,
      };
    });
  };

  const addWatchEntry = (movie: MovieItem, rating: number, note?: string, watchedAt?: string) => {
    updateStore((previous) => {
      const existingState = previous.userStates[movie.id];
      const entry: WatchEntry = {
        id: createId('watch'),
        movieId: movie.id,
        rating,
        watchedAt: toIsoDate(watchedAt),
        note: note?.trim() || undefined,
      };

      return {
        ...previous,
        catalog: {
          ...previous.catalog,
          [movie.id]: toMovieRecord(movie, previous.catalog[movie.id]),
        },
        userStates: {
          ...previous.userStates,
          [movie.id]: {
            movieId: movie.id,
            rating,
            isLiked: existingState?.isLiked ?? false,
            isWatchlist: false,
            watchlistAddedAt: undefined,
            listIds: existingState?.listIds ?? [],
          },
        },
        watchHistory: [...previous.watchHistory, entry],
      };
    });
  };

  const updateWatchEntry = (
    entryId: string,
    updates: Pick<WatchEntry, 'rating' | 'watchedAt' | 'note'>
  ) => {
    updateStore((previous) => {
      const target = previous.watchHistory.find((entry) => entry.id === entryId);
      if (!target) return previous;
      return {
        ...previous,
        userStates: {
          ...previous.userStates,
          [target.movieId]: {
            ...previous.userStates[target.movieId],
            movieId: target.movieId,
            rating: updates.rating,
            isLiked: previous.userStates[target.movieId]?.isLiked ?? false,
            isWatchlist: previous.userStates[target.movieId]?.isWatchlist ?? false,
            listIds: previous.userStates[target.movieId]?.listIds ?? [],
          },
        },
        watchHistory: previous.watchHistory.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                rating: updates.rating,
                watchedAt: toIsoDate(updates.watchedAt),
                note: updates.note?.trim() || undefined,
              }
            : entry
        ),
      };
    });
  };

  const deleteWatchEntry = (entryId: string) => {
    updateStore((previous) => {
      const target = previous.watchHistory.find((entry) => entry.id === entryId);
      if (!target) return previous;
      const watchHistory = previous.watchHistory.filter((entry) => entry.id !== entryId);
      const remainingForMovie = watchHistory
        .filter((entry) => entry.movieId === target.movieId)
        .sort(compareWatchEntriesDesc);
      const currentState = previous.userStates[target.movieId];

      return {
        ...previous,
        userStates: currentState
          ? {
              ...previous.userStates,
              [target.movieId]: {
                ...currentState,
                rating: remainingForMovie[0]?.rating ?? 0,
              },
            }
          : previous.userStates,
        watchHistory,
      };
    });
  };

  const recordDiscoveryEvent = (movie: MovieItem, action: DiscoveryAction) => {
    updateStore((previous) => {
      const existingState = previous.userStates[movie.id];
      const event: DiscoveryEvent = {
        id: createId('discovery'),
        movieId: movie.id,
        action,
        createdAt: new Date().toISOString(),
      };

      return {
        ...previous,
        catalog: {
          ...previous.catalog,
          [movie.id]: toMovieRecord(movie, previous.catalog[movie.id]),
        },
        userStates:
          action === 'liked'
            ? {
                ...previous.userStates,
                [movie.id]: {
                  movieId: movie.id,
                  rating: existingState?.rating ?? 0,
                  isLiked: existingState?.isLiked ?? false,
                  isWatchlist: true,
                  watchlistAddedAt: existingState?.isWatchlist
                    ? existingState.watchlistAddedAt
                    : new Date().toISOString(),
                  listIds: existingState?.listIds ?? [],
                },
              }
            : previous.userStates,
        discoveryEvents: [...previous.discoveryEvents, event],
      };
    });
  };

  const getDiscoveryState = (movieId: string): DiscoveryAction | null => {
    const latest = [...store.discoveryEvents]
      .reverse()
      .find((event) => event.movieId === movieId);
    return latest?.action ?? null;
  };

  const shouldShowInDiscovery = (movieId: string) =>
    !discoveryHiddenMovieIdSet.has(movieId);

  const filterDiscoveryCandidates = (candidates: MovieItem[]) =>
    candidates.filter((movie) => shouldShowInDiscovery(movie.id));

  const clearDiscoveryHistory = () => {
    updateStore((previous) => ({ ...previous, discoveryEvents: [] }));
  };

  const clearAllMovieData = async () => {
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    const clearedStore = emptyStore(new Date().toISOString());

    setStore(clearedStore);

    await AsyncStorage.multiRemove([V4_STORAGE_KEY, V3_STORAGE_KEY, LEGACY_MOVIES_KEY, LEGACY_LISTS_KEY]);
    if (userId) {
      await AsyncStorage.setItem(`${V4_STORAGE_KEY}:${userId}`, JSON.stringify(clearedStore));
      if (CLOUD_SYNC_ENABLED && isCloudSyncReady) {
        await saveCloudMovieStore(userId, clearedStore);
      }
    }
  };

  const refreshMovieMetadata = async (movieIds?: string[]) => {
    const ids = movieIds ?? Object.keys(store.catalog);
    const uniqueIds = [...new Set(ids)].filter((id) => store.catalog[id]);
    if (uniqueIds.length === 0) return;

    const details: { id: string; details: any }[] = [];
    for (let index = 0; index < uniqueIds.length; index += 20) {
      const batch = uniqueIds.slice(index, index + 20);
      details.push(
        ...(await Promise.all(
          batch.map(async (id) => ({ id, details: await tmdbService.getMovieDetails(id) }))
        ))
      );
    }

    updateStore((previous) => {
      const catalog = { ...previous.catalog };
      let changed = false;
      details.forEach(({ id, details: movieDetails }) => {
        const movie = catalog[id];
        if (!movie || !movieDetails) return;
        const nextMovie = {
          ...movie,
          runtimeMinutes:
            typeof movieDetails.runtime === 'number' && movieDetails.runtime > 0
              ? movieDetails.runtime
              : movie.runtimeMinutes,
          genreIds: Array.isArray(movieDetails.genres)
            ? movieDetails.genres.map((genre: { id: number }) => genre.id)
            : movie.genreIds,
          communityRating:
            typeof movieDetails.vote_average === 'number' && movieDetails.vote_average > 0
              ? Math.round((movieDetails.vote_average / 2) * 10) / 10
              : movie.communityRating,
        };
        if (
          nextMovie.runtimeMinutes !== movie.runtimeMinutes ||
          nextMovie.communityRating !== movie.communityRating ||
          JSON.stringify(nextMovie.genreIds) !== JSON.stringify(movie.genreIds)
        ) {
          catalog[id] = nextMovie;
          changed = true;
        }
      });
      return changed ? { ...previous, catalog } : previous;
    });
  };

  const createList = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateStore((previous) => {
      if (previous.lists.some((list) => list.name.toLowerCase() === trimmed.toLowerCase())) return previous;
      return {
        ...previous,
        lists: [...previous.lists, { id: createId('list'), name: trimmed, createdAt: new Date().toISOString() }],
      };
    });
  };

  const deleteList = (name: string) => {
    updateStore((previous) => {
      const list = previous.lists.find((item) => item.name === name);
      if (!list) return previous;
      return {
        ...previous,
        lists: previous.lists.filter((item) => item.id !== list.id),
        userStates: Object.fromEntries(
          Object.entries(previous.userStates).map(([movieId, state]) => [
            movieId,
            {
              ...state,
              isLiked: name === 'Favorites' ? false : state.isLiked,
              isWatchlist: name === 'Watchlist' ? false : state.isWatchlist,
              watchlistAddedAt: name === 'Watchlist' ? undefined : state.watchlistAddedAt,
              listIds: state.listIds.filter((id) => id !== list.id),
            },
          ])
        ),
      };
    });
  };

  const saveMovie = (movie: MovieItem) => {
    updateStore((previous) => ({
      ...previous,
      catalog: {
        ...previous.catalog,
        [movie.id]: toMovieRecord(movie, previous.catalog[movie.id]),
      },
      userStates: {
        ...previous.userStates,
        [movie.id]: previous.userStates[movie.id] ?? {
          movieId: movie.id,
          rating: 0,
          isLiked: false,
          isWatchlist: false,
          listIds: [],
        },
      },
    }));
  };

  const addMovieToList = (movie: MovieItem, listName: string) => {
    updateStore((previous) => {
      const existing = previous.userStates[movie.id];
      const list = previous.lists.find((item) => item.name === listName);
      const nextListIds =
        list && !SYSTEM_LISTS.has(listName)
          ? [...new Set([...(existing?.listIds ?? []), list.id])]
          : existing?.listIds ?? [];

      return {
        ...previous,
        catalog: {
          ...previous.catalog,
          [movie.id]: toMovieRecord(movie, previous.catalog[movie.id]),
        },
        userStates: {
          ...previous.userStates,
          [movie.id]: {
            movieId: movie.id,
            rating: existing?.rating ?? 0,
            isLiked: listName === 'Favorites' ? true : existing?.isLiked ?? false,
            isWatchlist: listName === 'Watchlist' ? true : existing?.isWatchlist ?? false,
            watchlistAddedAt:
              listName === 'Watchlist'
                ? existing?.watchlistAddedAt ?? new Date().toISOString()
                : existing?.watchlistAddedAt,
            listIds: nextListIds,
          },
        },
      };
    });
  };

  const toggleMovieInList = (movieId: string, listName: string) => {
    updateStore((previous) => {
      const existing = previous.userStates[movieId];
      if (!existing) return previous;
      const list = previous.lists.find((item) => item.name === listName);
      const hasList = list ? existing.listIds.includes(list.id) : false;
      const nextIsWatchlist = listName === 'Watchlist' ? !existing.isWatchlist : existing.isWatchlist;

      return {
        ...previous,
        userStates: {
          ...previous.userStates,
          [movieId]: {
            ...existing,
            isLiked: listName === 'Favorites' ? !existing.isLiked : existing.isLiked,
            isWatchlist: nextIsWatchlist,
            watchlistAddedAt:
              listName === 'Watchlist'
                ? nextIsWatchlist
                  ? new Date().toISOString()
                  : undefined
                : existing.watchlistAddedAt,
            listIds:
              !list || SYSTEM_LISTS.has(listName)
                ? existing.listIds
                : hasList
                  ? existing.listIds.filter((id) => id !== list.id)
                  : [...existing.listIds, list.id],
          },
        },
      };
    });
  };

  const toggleLike = (movieId: string) => toggleMovieInList(movieId, 'Favorites');

  const removeMovie = (movieId: string) => {
    updateStore((previous) => {
      const userStates = { ...previous.userStates };
      const catalog = { ...previous.catalog };
      delete userStates[movieId];
      delete catalog[movieId];
      return {
        ...previous,
        catalog,
        userStates,
        watchHistory: previous.watchHistory.filter((entry) => entry.movieId !== movieId),
      };
    });
  };

  const getMovieState = (movieId: string): MovieStateSnapshot | null => {
    const state = store.userStates[movieId];
    const isWatched = watchedMovieIds.has(movieId);
    if (!state && !isWatched) return null;
    return {
      rating: state?.rating ?? 0,
      isWatched,
      isWatchlist: state?.isWatchlist ?? false,
      isLiked: state?.isLiked ?? false,
    };
  };

  const importMovies = (items: LetterboxdImportMovie[]) => {
    updateStore((previous) => {
      const next = {
        ...previous,
        catalog: { ...previous.catalog },
        userStates: { ...previous.userStates },
        watchHistory: [...previous.watchHistory],
      };

      items.forEach(({ movie, rating, watchEntries, isWatched, isWatchlist, isLiked }) => {
        const existingState = next.userStates[movie.id];
        next.catalog[movie.id] = toMovieRecord(movie, next.catalog[movie.id]);
        next.userStates[movie.id] = {
          movieId: movie.id,
          rating: rating > 0 ? rating : existingState?.rating ?? 0,
          isLiked: isLiked || existingState?.isLiked || false,
          isWatchlist: isWatchlist || existingState?.isWatchlist || false,
          watchlistAddedAt:
            isWatchlist && !existingState?.isWatchlist
              ? new Date().toISOString()
              : existingState?.watchlistAddedAt,
          listIds: existingState?.listIds ?? [],
        };

        if (isWatched) {
          watchEntries.forEach((importedEntry) => {
            const watchedAt = toIsoDate(importedEntry.watchedAt);
            const dateKey = watchedAt.slice(0, 10);
            const existingIndex = next.watchHistory.findIndex(
              (entry) => entry.movieId === movie.id && entry.watchedAt.slice(0, 10) === dateKey
            );
            if (existingIndex >= 0) {
              const existingEntry = next.watchHistory[existingIndex];
              next.watchHistory[existingIndex] = {
                ...existingEntry,
                rating: importedEntry.rating > 0 ? importedEntry.rating : existingEntry.rating || rating,
                note: importedEntry.note?.trim() || existingEntry.note,
              };
            } else {
              next.watchHistory.push({
                id: createId('watch'),
                movieId: movie.id,
                rating: importedEntry.rating || rating,
                watchedAt,
                note: importedEntry.note?.trim() || undefined,
              });
            }
          });
        }
      });

      return next;
    });
  };

  return (
    <MovieContext.Provider
      value={{
        movies,
        watchHistory: store.watchHistory,
        diaryEntries,
        discoveryEvents: store.discoveryEvents,
        discoverySignals,
        discoveryHiddenMovieIds,
        customLists,
        isInitialized,
        logMovie,
        addWatchEntry,
        updateWatchEntry,
        deleteWatchEntry,
        recordDiscoveryEvent,
        getDiscoveryState,
        shouldShowInDiscovery,
        filterDiscoveryCandidates,
        clearDiscoveryHistory,
        clearAllMovieData,
        refreshMovieMetadata,
        toggleLike,
        removeMovie,
        getMovieState,
        createList,
        deleteList,
        saveMovie,
        addMovieToList,
        toggleMovieInList,
        importMovies,
      }}
    >
      {children}
    </MovieContext.Provider>
  );
};

export const useMovies = () => {
  const context = useContext(MovieContext);
  if (!context) throw new Error('useMovies must be used within a MovieProvider');
  return context;
};
