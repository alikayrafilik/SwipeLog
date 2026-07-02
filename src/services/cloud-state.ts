import { firebaseAuth, firestore } from '@/services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CLOUD_SYNC_ENABLED } from '@/constants/features';

export interface CloudState {
  movie_store: unknown | null;
  profile: unknown | null;
  tier_lists: unknown | null;
}

export interface CloudSyncCheckResult {
  ok: boolean;
  message: string;
  checkedAt: string;
}

const hasMatchingSession = (userId: string) => {
  return firebaseAuth.currentUser?.uid === userId;
};

const getCloudStateErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return 'Unknown cloud sync error.';
};

const removeUndefinedFields = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : removeUndefinedFields(item)));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, removeUndefinedFields(item)] as const)
        .filter(([, item]) => item !== undefined)
    );
  }
  return value;
};

export const loadCloudState = async (userId: string): Promise<CloudState | null> => {
  if (!CLOUD_SYNC_ENABLED) return null;
  if (!hasMatchingSession(userId)) return null;

  try {
    const docRef = doc(firestore, 'user_app_state', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        movie_store: data.movie_store ?? null,
        profile: data.profile ?? null,
        tier_lists: data.tier_lists ?? null,
      };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

export const saveCloudMovieStore = async (userId: string, movieStore: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;
  if (!hasMatchingSession(userId)) return;

  try {
    const docRef = doc(firestore, 'user_app_state', userId);
    const sanitizedMovieStore = removeUndefinedFields(movieStore);

    const storeObj =
      movieStore && typeof movieStore === 'object'
        ? (movieStore as { watchHistory?: { movieId: string }[] })
        : null;
    const watchedMovieIds = storeObj?.watchHistory
      ? Array.from(new Set(storeObj.watchHistory.map((w) => w.movieId)))
      : [];

    const watchedDocRef = doc(firestore, 'public_watched_movies', userId);

    await Promise.all([
      setDoc(
        docRef,
        {
          movie_store: sanitizedMovieStore,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      ),
      setDoc(watchedDocRef, {
        userId,
        watchedMovieIds,
        updatedAt: new Date().toISOString(),
      }),
    ]);
  } catch (error) {
    throw error;
  }
};

export const saveCloudProfile = async (userId: string, profile: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;
  if (!hasMatchingSession(userId)) return;

  try {
    const docRef = doc(firestore, 'user_app_state', userId);
    const sanitizedProfile = removeUndefinedFields(profile);
    await setDoc(
      docRef,
      {
        profile: sanitizedProfile,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    throw error;
  }
};

export const saveCloudTierLists = async (userId: string, tierLists: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;
  if (!hasMatchingSession(userId)) return;

  try {
    const docRef = doc(firestore, 'user_app_state', userId);
    const sanitizedTierLists = removeUndefinedFields(tierLists);
    await setDoc(
      docRef,
      {
        tier_lists: sanitizedTierLists,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    throw error;
  }
};

export const verifyCloudSync = async (userId: string): Promise<CloudSyncCheckResult> => {
  const checkedAt = new Date().toISOString();

  if (!CLOUD_SYNC_ENABLED) {
    return {
      ok: false,
      checkedAt,
      message: 'Cloud sync is disabled. Set EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true.',
    };
  }

  if (!hasMatchingSession(userId)) {
    return {
      ok: false,
      checkedAt,
      message: 'No matching signed-in Firebase session was found.',
    };
  }

  try {
    const docRef = doc(firestore, 'user_app_state', userId);
    
    // Test write
    await setDoc(
      docRef,
      {
        updated_at: checkedAt,
      },
      { merge: true }
    );

    // Test read
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return {
        ok: false,
        checkedAt,
        message: 'Cloud sync read returned no matching user row.',
      };
    }

    return {
      ok: true,
      checkedAt,
      message: 'Cloud sync can read and write your account state.',
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      message: getCloudStateErrorMessage(error),
    };
  }
};
