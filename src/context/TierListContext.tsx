import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AUTH_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { useAuth } from '@/context/AuthContext';

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

interface TierListContextValue {
  tierLists: MovieTierList[];
  isInitialized: boolean;
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

const STORAGE_KEY = '@swipelog_tier_lists_v1';
const TierListContext = createContext<TierListContextValue | undefined>(undefined);

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

export const TierListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [tierLists, setTierLists] = useState<MovieTierList[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
  const userStorageKey = userId ? `${STORAGE_KEY}:${userId}` : null;

  useEffect(() => {
    if (!userStorageKey) return;
    let cancelled = false;
    AsyncStorage.getItem(userStorageKey)
      .then((stored) => {
        if (!cancelled) setTierLists(stored ? (JSON.parse(stored) as MovieTierList[]) : []);
      })
      .catch((error) => console.error('[TierLists] Failed to load:', error))
      .finally(() => {
        if (!cancelled) setIsInitialized(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userStorageKey]);

  useEffect(() => {
    if (!isInitialized || !userStorageKey) return;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(userStorageKey, JSON.stringify(tierLists)).catch((error) => {
        console.error('[TierLists] Failed to save:', error);
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [isInitialized, tierLists, userStorageKey]);

  const createTierList = (title: string, sourceLabel: string, movieIds: string[]) => {
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
  };

  const updateList = (tierListId: string, update: (list: MovieTierList) => MovieTierList) => {
    setTierLists((current) =>
      current.map((list) =>
        list.id === tierListId
          ? { ...update(list), updatedAt: new Date().toISOString() }
          : list
      )
    );
  };

  const moveMovieToTier = (tierListId: string, movieId: string, tierId: string | null) => {
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
  };

  const value: TierListContextValue = {
    tierLists,
    isInitialized,
    createTierList,
    deleteTierList: (tierListId) =>
      setTierLists((current) => current.filter((list) => list.id !== tierListId)),
    renameTierList: (tierListId, title) =>
      updateList(tierListId, (list) => ({ ...list, title: title.trim() || list.title })),
    renameTier: (tierListId, tierId, label) =>
      updateList(tierListId, (list) => ({
        ...list,
        tiers: list.tiers.map((tier) =>
          tier.id === tierId ? { ...tier, label: label.trim() || tier.label } : tier
          ),
        })),
    addTier: (tierListId) =>
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
    deleteTier: (tierListId, tierId) =>
      updateList(tierListId, (list) => {
        const removedTier = list.tiers.find((tier) => tier.id === tierId);
        if (!removedTier || list.tiers.length <= 1) return list;
        return {
          ...list,
          unrankedMovieIds: uniqueIds([...list.unrankedMovieIds, ...removedTier.movieIds]),
          tiers: list.tiers.filter((tier) => tier.id !== tierId),
        };
      }),
    updateTierColor: (tierListId, tierId, color) =>
      updateList(tierListId, (list) => ({
        ...list,
        tiers: list.tiers.map((tier) => (tier.id === tierId ? { ...tier, color } : tier)),
      })),
    moveTier: (tierListId, tierId, direction) =>
      updateList(tierListId, (list) => {
        const index = list.tiers.findIndex((tier) => tier.id === tierId);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= list.tiers.length) return list;
        const tiers = [...list.tiers];
        [tiers[index], tiers[targetIndex]] = [tiers[targetIndex], tiers[index]];
        return { ...list, tiers };
      }),
    addMovies: (tierListId, movieIds) =>
      updateList(tierListId, (list) => {
        const additions = uniqueIds(movieIds).filter((movieId) => !list.sourceMovieIds.includes(movieId));
        return {
          ...list,
          sourceMovieIds: [...list.sourceMovieIds, ...additions],
          unrankedMovieIds: [...list.unrankedMovieIds, ...additions],
        };
      }),
    removeMovie: (tierListId, movieId) =>
      updateList(tierListId, (list) => ({
        ...list,
        sourceMovieIds: list.sourceMovieIds.filter((id) => id !== movieId),
        unrankedMovieIds: list.unrankedMovieIds.filter((id) => id !== movieId),
        tiers: list.tiers.map((tier) => ({
          ...tier,
          movieIds: tier.movieIds.filter((id) => id !== movieId),
        })),
      })),
    restoreTierList: (tierList) =>
      setTierLists((current) =>
        current.map((item) =>
          item.id === tierList.id ? { ...tierList, updatedAt: new Date().toISOString() } : item
        )
      ),
    shuffleUnranked: (tierListId) =>
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
    moveMovieToTier,
    moveMovieWithinTier: (tierListId, movieId, direction) =>
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
    skipUnrankedMovie: (tierListId, movieId) =>
      updateList(tierListId, (list) => ({
        ...list,
        unrankedMovieIds: [
          ...list.unrankedMovieIds.filter((id) => id !== movieId),
          movieId,
        ],
      })),
    resetTierList: (tierListId) =>
      updateList(tierListId, (list) => ({
        ...list,
        unrankedMovieIds: list.sourceMovieIds,
        tiers: list.tiers.map((tier) => ({ ...tier, movieIds: [] })),
      })),
  };

  return <TierListContext.Provider value={value}>{children}</TierListContext.Provider>;
};

export const useTierLists = () => {
  const context = useContext(TierListContext);
  if (!context) throw new Error('useTierLists must be used within TierListProvider');
  return context;
};
