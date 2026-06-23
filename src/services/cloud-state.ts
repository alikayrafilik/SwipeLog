import { supabase } from '@/services/supabase';
import { CLOUD_SYNC_ENABLED } from '@/constants/features';

export interface CloudState {
  movie_store: unknown | null;
  profile: unknown | null;
  tier_lists: unknown | null;
}

const isMissingCloudStateTableError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'PGRST205';

const isAnonPermissionError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42501' &&
  'hint' in error &&
  typeof (error as { hint?: unknown }).hint === 'string' &&
  (error as { hint: string }).hint.includes('TO anon');

const isMissingTierListsColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ((error as { code?: string }).code === 'PGRST204' ||
    (error as { code?: string }).code === '42703') &&
  'message' in error &&
  typeof (error as { message?: unknown }).message === 'string' &&
  (error as { message: string }).message.includes('tier_lists');

const hasMatchingSession = async (userId: string) => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id === userId;
};

export const loadCloudState = async (userId: string): Promise<CloudState | null> => {
  if (!CLOUD_SYNC_ENABLED) return null;
  if (!(await hasMatchingSession(userId))) return null;

  const { data, error } = await supabase
    .from('user_app_state')
    .select('movie_store, profile, tier_lists')
    .eq('user_id', userId)
    .maybeSingle();

  if (isMissingTierListsColumnError(error)) {
    const fallback = await supabase
      .from('user_app_state')
      .select('movie_store, profile')
      .eq('user_id', userId)
      .maybeSingle();

    if (isMissingCloudStateTableError(fallback.error)) return null;
    if (isAnonPermissionError(fallback.error)) return null;
    if (fallback.error) throw fallback.error;
    return fallback.data ? { ...fallback.data, tier_lists: null } : null;
  }

  if (isMissingCloudStateTableError(error)) return null;
  if (isAnonPermissionError(error)) return null;
  if (error) throw error;
  return data;
};

export const saveCloudMovieStore = async (userId: string, movieStore: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;
  if (!(await hasMatchingSession(userId))) return;

  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      movie_store: movieStore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (isMissingCloudStateTableError(error)) return;
  if (isMissingTierListsColumnError(error)) return;
  if (isAnonPermissionError(error)) return;
  if (error) throw error;
};

export const saveCloudProfile = async (userId: string, profile: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;
  if (!(await hasMatchingSession(userId))) return;

  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      profile,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (isMissingCloudStateTableError(error)) return;
  if (isMissingTierListsColumnError(error)) return;
  if (isAnonPermissionError(error)) return;
  if (error) throw error;
};

export const saveCloudTierLists = async (userId: string, tierLists: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;
  if (!(await hasMatchingSession(userId))) return;

  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      tier_lists: tierLists,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (isMissingCloudStateTableError(error)) return;
  if (isMissingTierListsColumnError(error)) return;
  if (isAnonPermissionError(error)) return;
  if (error) throw error;
};
