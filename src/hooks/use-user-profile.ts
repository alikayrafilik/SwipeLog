import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthState } from '@/context/AuthContext';
import { useCloudState } from '@/context/CloudStateContext';
import { saveCloudProfile } from '@/services/cloud-state';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED, LOCAL_USER_ID } from '@/constants/features';

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  favoriteMovieIds: string[];
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;
}

const PROFILE_STORAGE_KEY = '@swipelog_user_profile_v1';

export const defaultUserProfile: UserProfile = {
  name: '',
  username: '',
  bio: '',
  avatarUrl: '',
  coverUrl: '',
  favoriteMovieIds: [],
  onboardingCompleted: false,
  onboardingCompletedAt: undefined,
};

interface UserProfileContextValue {
  profile: UserProfile;
  isLoaded: boolean;
  saveProfile: (nextProfile: UserProfile) => Promise<void>;
  resetProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuthState();
  const { state: cloudState, isLoaded: isCloudStateLoaded, isCloudSyncReady } = useCloudState();
  const [profile, setProfile] = useState<UserProfile>(defaultUserProfile);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId || !isCloudStateLoaded) return;

    let cancelled = false;
    const userStorageKey = `${PROFILE_STORAGE_KEY}:${userId}`;

    Promise.all([
      AsyncStorage.getItem(userStorageKey),
      AsyncStorage.getItem(PROFILE_STORAGE_KEY),
    ])
      .then(([userStored, legacyStored]) => {
        const storedProfile = cloudState?.profile ?? (userStored ? JSON.parse(userStored) : null);
        const legacyProfile = !AUTH_ENABLED && legacyStored ? JSON.parse(legacyStored) : null;
        const migratedProfile = storedProfile ?? legacyProfile;
        const nextProfile = { ...defaultUserProfile, ...(migratedProfile as Partial<UserProfile> | null) };
        if (!cancelled) setProfile(nextProfile);
        void AsyncStorage.setItem(userStorageKey, JSON.stringify(nextProfile));
        if (CLOUD_SYNC_ENABLED && isCloudSyncReady && !cloudState?.profile) {
          void saveCloudProfile(userId, nextProfile).catch((error) => {
            console.error('[UserProfile] Failed to create cloud profile:', error);
          });
        }
      })
      .catch((error) => {
        console.error('[UserProfile] Failed to load profile:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cloudState?.profile, isCloudStateLoaded, isCloudSyncReady, session?.user.id]);

  const saveProfile = useCallback(async (nextProfile: UserProfile) => {
    const normalized = {
      ...nextProfile,
      name: nextProfile.name.trim(),
      username: nextProfile.username.trim().replace(/^@/, ''),
      bio: nextProfile.bio.trim(),
      avatarUrl: nextProfile.avatarUrl.trim(),
      coverUrl: nextProfile.coverUrl.trim(),
      favoriteMovieIds: [...new Set(nextProfile.favoriteMovieIds ?? [])].slice(0, 4),
      onboardingCompleted: Boolean(nextProfile.onboardingCompleted),
      onboardingCompletedAt: nextProfile.onboardingCompletedAt,
    };
    setProfile(normalized);
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, JSON.stringify(normalized)),
      ...(CLOUD_SYNC_ENABLED && isCloudSyncReady ? [saveCloudProfile(userId, normalized)] : []),
    ]);
  }, [isCloudSyncReady, session?.user.id]);

  const resetProfile = useCallback(async () => {
    setProfile(defaultUserProfile);
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, JSON.stringify(defaultUserProfile)),
      ...(CLOUD_SYNC_ENABLED && isCloudSyncReady ? [saveCloudProfile(userId, defaultUserProfile)] : []),
    ]);
  }, [isCloudSyncReady, session?.user.id]);

  const value = useMemo(
    () => ({ profile, isLoaded, saveProfile, resetProfile }),
    [isLoaded, profile, resetProfile, saveProfile]
  );

  const Provider = UserProfileContext.Provider;
  return React.createElement(Provider, { value }, children);
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error('useUserProfile must be used within UserProfileProvider');
  return context;
}
