import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { loadCloudState, saveCloudProfile } from '@/services/cloud-state';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED, LOCAL_USER_ID } from '@/constants/features';

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  favoriteMovieIds: string[];
}

const PROFILE_STORAGE_KEY = '@swipelog_user_profile_v1';

export const defaultUserProfile: UserProfile = {
  name: '',
  username: '',
  bio: '',
  avatarUrl: '',
  coverUrl: '',
  favoriteMovieIds: [],
};

export function useUserProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(defaultUserProfile);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;

    let cancelled = false;
    const userStorageKey = `${PROFILE_STORAGE_KEY}:${userId}`;

    Promise.all([
      loadCloudState(userId)
        .then((state) => ({ state, loaded: true as const }))
        .catch((error) => {
          console.error('[UserProfile] Failed to load cloud profile:', error);
          return { state: null, loaded: false as const };
        }),
      AsyncStorage.getItem(userStorageKey),
      AsyncStorage.getItem(PROFILE_STORAGE_KEY),
    ])
      .then(([cloudResult, userStored, legacyStored]) => {
        const storedProfile = cloudResult.state?.profile ?? (userStored ? JSON.parse(userStored) : null);
        const migratedProfile = storedProfile ?? (legacyStored ? JSON.parse(legacyStored) : null);
        const nextProfile = { ...defaultUserProfile, ...(migratedProfile as Partial<UserProfile> | null) };
        if (!cancelled) setProfile(nextProfile);
        void AsyncStorage.setItem(userStorageKey, JSON.stringify(nextProfile));
        if (CLOUD_SYNC_ENABLED && cloudResult.loaded && !cloudResult.state?.profile) {
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
  }, [session?.user.id]);

  const saveProfile = async (nextProfile: UserProfile) => {
    const normalized = {
      ...nextProfile,
      name: nextProfile.name.trim(),
      username: nextProfile.username.trim().replace(/^@/, ''),
      bio: nextProfile.bio.trim(),
      avatarUrl: nextProfile.avatarUrl.trim(),
      coverUrl: nextProfile.coverUrl.trim(),
      favoriteMovieIds: [...new Set(nextProfile.favoriteMovieIds ?? [])].slice(0, 4),
    };
    setProfile(normalized);
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, JSON.stringify(normalized)),
      ...(CLOUD_SYNC_ENABLED ? [saveCloudProfile(userId, normalized)] : []),
    ]);
  };

  const resetProfile = async () => {
    setProfile(defaultUserProfile);
    const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, JSON.stringify(defaultUserProfile)),
      ...(CLOUD_SYNC_ENABLED ? [saveCloudProfile(userId, defaultUserProfile)] : []),
    ]);
  };

  return { profile, isLoaded, saveProfile, resetProfile };
}
