import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthState } from '@/context/AuthContext';
import { useCloudState } from '@/context/CloudStateContext';
import { saveCloudProfile } from '@/services/cloud-state';
import { buildPublicProfile, socialService } from '@/services/social';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/i18n/config';

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  avatarIcon: string;
  avatarColor: string;
  favoriteMovieIds: string[];
  favoriteGenreIds: number[];
  language: SupportedLocale;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;
  updatedAt?: string;
}

const PROFILE_STORAGE_KEY = '@swipelog_user_profile_v1';

export const defaultUserProfile: UserProfile = {
  name: '',
  username: '',
  bio: '',
  avatarUrl: '',
  coverUrl: '',
  avatarIcon: 'film-outline',
  avatarColor: '#F9C80E',
  favoriteMovieIds: [],
  favoriteGenreIds: [],
  language: DEFAULT_LOCALE,
  onboardingCompleted: false,
  onboardingCompletedAt: undefined,
  updatedAt: undefined,
};

interface UserProfileContextValue {
  profile: UserProfile;
  isLoaded: boolean;
  saveProfile: (nextProfile: UserProfile) => Promise<void>;
  resetProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

const getProfileUpdatedTime = (profile: Partial<UserProfile> | null | undefined) => {
  const value = profile?.updatedAt ?? profile?.onboardingCompletedAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const normalizeProfile = (profile: Partial<UserProfile> | null | undefined): UserProfile => ({
  ...defaultUserProfile,
  ...(profile ?? {}),
  language: normalizeLocale(profile?.language),
  favoriteGenreIds: [...new Set(profile?.favoriteGenreIds ?? [])]
    .filter(Number.isFinite)
    .slice(0, 5),
});

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
        const cloudProfile = cloudState?.profile as Partial<UserProfile> | null | undefined;
        const localProfile = userStored ? (JSON.parse(userStored) as Partial<UserProfile>) : null;
        const legacyProfile = !AUTH_ENABLED && legacyStored ? JSON.parse(legacyStored) : null;
        const cloudTime = getProfileUpdatedTime(cloudProfile);
        const localTime = getProfileUpdatedTime(localProfile);
        const migratedProfile =
          cloudProfile && localProfile
            ? localTime > cloudTime
              ? localProfile
              : cloudProfile
            : cloudProfile ?? localProfile ?? legacyProfile;
        const nextProfile = normalizeProfile(migratedProfile as Partial<UserProfile> | null);
        if (!cancelled) setProfile(nextProfile);
        void AsyncStorage.setItem(userStorageKey, JSON.stringify(nextProfile));
        if (CLOUD_SYNC_ENABLED && isCloudSyncReady && (!cloudProfile || localTime > cloudTime)) {
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
    const updatedAt = new Date().toISOString();
    const normalized = {
      ...nextProfile,
      name: nextProfile.name.trim(),
      username: nextProfile.username.trim().replace(/^@/, ''),
      bio: nextProfile.bio.trim(),
      avatarUrl: nextProfile.avatarUrl.trim(),
      coverUrl: nextProfile.coverUrl.trim(),
      avatarIcon: nextProfile.avatarIcon.trim() || defaultUserProfile.avatarIcon,
      avatarColor: nextProfile.avatarColor.trim() || defaultUserProfile.avatarColor,
      favoriteMovieIds: [...new Set(nextProfile.favoriteMovieIds ?? [])].slice(0, 4),
      favoriteGenreIds: [...new Set(nextProfile.favoriteGenreIds ?? [])]
        .filter(Number.isFinite)
        .slice(0, 5),
      language: normalizeLocale(nextProfile.language),
      onboardingCompleted: Boolean(nextProfile.onboardingCompleted),
      onboardingCompletedAt: nextProfile.onboardingCompletedAt,
      updatedAt,
    };
    setProfile(normalized);
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, JSON.stringify(normalized)),
      ...(CLOUD_SYNC_ENABLED && isCloudSyncReady ? [saveCloudProfile(userId, normalized)] : []),
      ...(CLOUD_SYNC_ENABLED && isCloudSyncReady ? [socialService.publishPublicProfile(buildPublicProfile(userId, normalized))] : []),
    ]);
  }, [isCloudSyncReady, session?.user.id]);

  const resetProfile = useCallback(async () => {
    const clearedProfile = { ...defaultUserProfile, updatedAt: new Date().toISOString() };
    setProfile(clearedProfile);
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, JSON.stringify(clearedProfile)),
      ...(CLOUD_SYNC_ENABLED && isCloudSyncReady ? [saveCloudProfile(userId, clearedProfile)] : []),
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
