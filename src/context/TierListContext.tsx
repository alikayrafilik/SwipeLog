import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { useAuthState } from '@/context/AuthContext';
import { useCloudState } from '@/context/CloudStateContext';
import { saveCloudTierLists } from '@/services/cloud-state';

export interface TierDefinition {
  id: string;
  label: string;
  color: string;
  movieIds: string[];
}

export interface MovieTierList {
  id: string;
  title: string;
  sourceLabel: string;
  sourceMovieIds: string[];
  unrankedMovieIds: string[];
  tiers: TierDefinition[];
  createdAt: string;
  updatedAt: string;
}

interface TierListStateContextValue {
  tierLists: MovieTierList[];
  isInitialized: boolean;
}

interface TierListActionsContextValue {
  createTierList: (title: string, sourceLabel: string, movieIds: string[]) => string;
  deleteTierList: (tierListId: string) => void;
  renameTierList: (tierListId: string, title: string) => void;
  renameTier: (tierListId: string, tierId: string, label: string) => void;
  addTier: (tierListId: string) => void;
  deleteTier: (tierListId: string, tierId: string) => void;
  updateTierColor: (tierListId: string, tierId: string, color: string) => void;
  moveTier: (tierListId: string, tierId: string, direction: -1 | 1) => void;
  addMovies: (tierListId: string, movieIds: string[]) => void;
  removeMovie: (tierListId: string, movieId: string) => void;
  restoreTierList: (tierList: MovieTierList) => void;
  shuffleUnranked: (tierListId: string) => void;
  moveMovieToTier: (tierListId: string, movieId: string, tierId: string | null) => void;
  moveMovieWithinTier: (tierListId: string, movieId: string, direction: -1 | 1) => void;
  skipUnrankedMovie: (tierListId: string, movieId: string) => void;
  resetTierList: (tierListId: string) => void;
}

type TierListContextValue = TierListStateContextValue & TierListActionsContextValue;

const STORAGE_KEY = '@swipelog_tier_lists_v1';
const TierListStateContext = createContext<TierListStateContextValue | undefined>(undefined);
const TierListActionsContext = createContext<TierListActionsContextValue | undefined>(undefined);

const DEFAULT_TIERS: Omit<TierDefinition, 'movieIds'>[] = [
  { id: 's', label: 'S', color: '#F87171' },
  { id: 'a', label: 'A', color: '#FB923C' },
  { id: 'b', label: 'B', color: '#FACC15' },
  { id: 'c', label: 'C', color: '#4ADE80' },
  { id: 'd', label: 'D', color: '#60A5FA' },
  { id: 'f', label: 'F', color: '#A78BFA' },
];
const TIER_COLORS = ['#F87171', '#FB923C', '#FACC15', '#4ADE80', '#60A5FA', '#A78BFA', '#F472B6'];

const createId = () => `tier-list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const uniqueIds = (movieIds: string[]) => [...new Set(movieIds)];
const getLatestTierListTime = (tierLists: MovieTierList[] | null | undefined) => {
  if (!Array.isArray(tierLists)) return 0;
  return tierLists.reduce((latest, list) => {
    const time = new Date(list.updatedAt ?? list.createdAt ?? 0).getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
};

export const TierListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuthState();
  const { state: cloudState, isLoaded: isCloudStateLoaded, isCloudSyncReady } = useCloudState();
  const [tierLists, setTierLists] = useState<MovieTierList[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
  const userStorageKey = userId ? `${STORAGE_KEY}:${userId}` : null;

  useEffect(() => {
    if (!userId || !userStorageKey || !isCloudStateLoaded) return;
    let cancelled = false;

    const loadTierLists = async () => {
      try {
        const stored = await AsyncStorage.getItem(userStorageKey);
        const cloudTierLists = cloudState?.tier_lists;
        const localTierLists = stored ? (JSON.parse(stored) as MovieTierList[]) : null;
        const hasCloudTierLists = Array.isArray(cloudTierLists);
        const cloudListValue = hasCloudTierLists ? (cloudTierLists as MovieTierList[]) : null;
        const localListValue = Array.isArray(localTierLists) ? localTierLists : null;
        const cloudTime = getLatestTierListTime(cloudListValue);
        const localTime = getLatestTierListTime(localListValue);
        const shouldUseLocal = Boolean(localListValue) && (!cloudListValue || localTime > cloudTime);
        const nextTierLists = shouldUseLocal ? localListValue! : cloudListValue ?? localListValue ?? [];

        if (!cancelled) setTierLists(nextTierLists);
        await AsyncStorage.setItem(userStorageKey, JSON.stringify(nextTierLists));

        if (CLOUD_SYNC_ENABLED && isCloudSyncReady && shouldUseLocal) {
          void saveCloudTierLists(userId, nextTierLists).catch((error) => {
            console.error('[TierLists] Failed to create cloud backup:', error);
          });
        }
      } catch (error) {
        console.error('[TierLists] Failed to load:', error);
        if (!cancelled) setTierLists([]);
      } finally {
        if (!cancelled) setIsInitialized(true);
      }
    };

    loadTierLists();
    return () => {
      cancelled = true;
    };
  }, [cloudState?.tier_lists, isCloudStateLoaded, isCloudSyncReady, userId, userStorageKey]);

  useEffect(() => {
    if (!isInitialized || !userStorageKey) return;
    const localTimeout = setTimeout(() => {
      AsyncStorage.setItem(userStorageKey, JSON.stringify(tierLists)).catch((error) => {
        console.error('[TierLists] Failed to save:', error);
      });
    }, 200);

    if (!isCloudSyncReady || !userId) return () => clearTimeout(localTimeout);

    const cloudTimeout = setTimeout(() => {
      saveCloudTierLists(userId, tierLists).catch((error) => {
        console.error('[TierLists] Failed to sync cloud data:', error);
      });
    }, 800);

    return () => {
      clearTimeout(localTimeout);
      clearTimeout(cloudTimeout);
    };
  }, [isCloudSyncReady, isInitialized, tierLists, userId, userStorageKey]);

  const createTierList = useCallback((title: string, sourceLabel: string, movieIds: string[]) => {
    const id = createId();
    const now = new Date().toISOString();
    const sourceMovieIds = uniqueIds(movieIds);
    setTierLists((current) => [
      {
        id,
        title: title.trim() || 'Untitled Tier List',
        sourceLabel,
        sourceMovieIds,
        unrankedMovieIds: sourceMovieIds,
        tiers: DEFAULT_TIERS.map((tier) => ({ ...tier, movieIds: [] })),
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ]);
    return id;
  }, []);

  const updateList = useCallback((tierListId: string, update: (list: MovieTierList) => MovieTierList) => {
    setTierLists((current) =>
      current.map((list) =>
        list.id === tierListId
          ? { ...update(list), updatedAt: new Date().toISOString() }
        : list
      )
    );
  }, []);

  const deleteTierList = useCallback(
    (tierListId: string) => setTierLists((current) => current.filter((list) => list.id !== tierListId)),
    []
  );

  const renameTierList = useCallback(
    (tierListId: string, title: string) =>
      updateList(tierListId, (list) => ({ ...list, title: title.trim() || list.title })),
    [updateList]
  );

  const renameTier = useCallback(
    (tierListId: string, tierId: string, label: string) =>
      updateList(tierListId, (list) => ({
        ...list,
        tiers: list.tiers.map((tier) =>
          tier.id === tierId ? { ...tier, label: label.trim() || tier.label } : tier
        ),
      })),
    [updateList]
  );

  const addTier = useCallback(
    (tierListId: string) =>
      updateList(tierListId, (list) => ({
        ...list,
        tiers: [
          ...list.tiers,
          {
            id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: `Tier ${list.tiers.length + 1}`,
            color: TIER_COLORS[list.tiers.length % TIER_COLORS.length],
            movieIds: [],
          },
        ],
      })),
    [updateList]
  );

  const deleteTier = useCallback(
    (tierListId: string, tierId: string) =>
      updateList(tierListId, (list) => {
        const removedTier = list.tiers.find((tier) => tier.id === tierId);
        if (!removedTier || list.tiers.length <= 1) return list;
        return {
          ...list,
          unrankedMovieIds: uniqueIds([...list.unrankedMovieIds, ...removedTier.movieIds]),
          tiers: list.tiers.filter((tier) => tier.id !== tierId),
        };
      }),
    [updateList]
  );

  const updateTierColor = useCallback(
    (tierListId: string, tierId: string, color: string) =>
      updateList(tierListId, (list) => ({
        ...list,
        tiers: list.tiers.map((tier) => (tier.id === tierId ? { ...tier, color } : tier)),
      })),
    [updateList]
  );

  const moveTier = useCallback(
    (tierListId: string, tierId: string, direction: -1 | 1) =>
      updateList(tierListId, (list) => {
        const index = list.tiers.findIndex((tier) => tier.id === tierId);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= list.tiers.length) return list;
        const tiers = [...list.tiers];
        [tiers[index], tiers[targetIndex]] = [tiers[targetIndex], tiers[index]];
        return { ...list, tiers };
      }),
    [updateList]
  );

  const addMovies = useCallback(
    (tierListId: string, movieIds: string[]) =>
      updateList(tierListId, (list) => {
        const additions = uniqueIds(movieIds).filter((movieId) => !list.sourceMovieIds.includes(movieId));
        return {
          ...list,
          sourceMovieIds: [...list.sourceMovieIds, ...additions],
          unrankedMovieIds: [...list.unrankedMovieIds, ...additions],
        };
      }),
    [updateList]
  );

  const removeMovie = useCallback(
    (tierListId: string, movieId: string) =>
      updateList(tierListId, (list) => ({
        ...list,
        sourceMovieIds: list.sourceMovieIds.filter((id) => id !== movieId),
        unrankedMovieIds: list.unrankedMovieIds.filter((id) => id !== movieId),
        tiers: list.tiers.map((tier) => ({
          ...tier,
          movieIds: tier.movieIds.filter((id) => id !== movieId),
        })),
      })),
    [updateList]
  );

  const restoreTierList = useCallback(
    (tierList: MovieTierList) =>
      setTierLists((current) =>
        current.map((item) =>
          item.id === tierList.id ? { ...tierList, updatedAt: new Date().toISOString() } : item
        )
      ),
    []
  );

  const shuffleUnranked = useCallback(
    (tierListId: string) =>
      updateList(tierListId, (list) => {
        const unrankedMovieIds = [...list.unrankedMovieIds];
        for (let index = unrankedMovieIds.length - 1; index > 0; index -= 1) {
          const target = Math.floor(Math.random() * (index + 1));
          [unrankedMovieIds[index], unrankedMovieIds[target]] = [
            unrankedMovieIds[target],
            unrankedMovieIds[index],
          ];
        }
        return { ...list, unrankedMovieIds };
      }),
    [updateList]
  );

  const moveMovieToTier = useCallback((tierListId: string, movieId: string, tierId: string | null) => {
    updateList(tierListId, (list) => ({
      ...list,
      unrankedMovieIds:
        tierId === null
          ? uniqueIds([...list.unrankedMovieIds, movieId])
          : list.unrankedMovieIds.filter((id) => id !== movieId),
      tiers: list.tiers.map((tier) => ({
        ...tier,
        movieIds:
          tier.id === tierId
            ? uniqueIds([...tier.movieIds.filter((id) => id !== movieId), movieId])
            : tier.movieIds.filter((id) => id !== movieId),
      })),
    }));
  }, [updateList]);

  const moveMovieWithinTier = useCallback(
    (tierListId: string, movieId: string, direction: -1 | 1) =>
      updateList(tierListId, (list) => ({
        ...list,
        tiers: list.tiers.map((tier) => {
          const index = tier.movieIds.indexOf(movieId);
          const targetIndex = index + direction;
          if (index < 0 || targetIndex < 0 || targetIndex >= tier.movieIds.length) return tier;
          const movieIds = [...tier.movieIds];
          [movieIds[index], movieIds[targetIndex]] = [movieIds[targetIndex], movieIds[index]];
          return { ...tier, movieIds };
        }),
      })),
    [updateList]
  );

  const skipUnrankedMovie = useCallback(
    (tierListId: string, movieId: string) =>
      updateList(tierListId, (list) => ({
        ...list,
        unrankedMovieIds: [
          ...list.unrankedMovieIds.filter((id) => id !== movieId),
          movieId,
        ],
      })),
    [updateList]
  );

  const resetTierList = useCallback(
    (tierListId: string) =>
      updateList(tierListId, (list) => ({
        ...list,
        unrankedMovieIds: list.sourceMovieIds,
        tiers: list.tiers.map((tier) => ({ ...tier, movieIds: [] })),
      })),
    [updateList]
  );

  const stateValue = useMemo<TierListStateContextValue>(
    () => ({
      isInitialized,
      tierLists,
    }),
    [isInitialized, tierLists]
  );

  const actionsValue = useMemo<TierListActionsContextValue>(
    () => ({
      addMovies,
      addTier,
      createTierList,
      deleteTier,
      deleteTierList,
      moveMovieToTier,
      moveMovieWithinTier,
      moveTier,
      removeMovie,
      renameTier,
      renameTierList,
      resetTierList,
      restoreTierList,
      shuffleUnranked,
      skipUnrankedMovie,
      updateTierColor,
    }),
    [
      addMovies,
      addTier,
      createTierList,
      deleteTier,
      deleteTierList,
      moveMovieToTier,
      moveMovieWithinTier,
      moveTier,
      removeMovie,
      renameTier,
      renameTierList,
      resetTierList,
      restoreTierList,
      shuffleUnranked,
      skipUnrankedMovie,
      updateTierColor,
    ]
  );

  return (
    <TierListStateContext.Provider value={stateValue}>
      <TierListActionsContext.Provider value={actionsValue}>
        {children}
      </TierListActionsContext.Provider>
    </TierListStateContext.Provider>
  );
};

export const useTierListState = () => {
  const context = useContext(TierListStateContext);
  if (!context) throw new Error('useTierListState must be used within TierListProvider');
  return context;
};

export const useTierListActions = () => {
  const context = useContext(TierListActionsContext);
  if (!context) throw new Error('useTierListActions must be used within TierListProvider');
  return context;
};

export const useTierLists = (): TierListContextValue => {
  const state = useTierListState();
  const actions = useTierListActions();
  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [actions, state]
  );
};
