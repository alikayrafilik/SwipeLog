import { supabase } from '@/services/supabase';
import { CLOUD_SYNC_ENABLED } from '@/constants/features';

export interface CloudState {
  movie_store: unknown | null;
  profile: unknown | null;
}

const isMissingCloudStateTableError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'PGRST205';

export const loadCloudState = async (userId: string): Promise<CloudState | null> => {
  if (!CLOUD_SYNC_ENABLED) return null;

  const { data, error } = await supabase
    .from('user_app_state')
    .select('movie_store, profile')
    .eq('user_id', userId)
    .maybeSingle();

  if (isMissingCloudStateTableError(error)) return null;
  if (error) throw error;
  return data;
};

export const saveCloudMovieStore = async (userId: string, movieStore: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;

  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      movie_store: movieStore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (isMissingCloudStateTableError(error)) return;
  if (error) throw error;
};

export const saveCloudProfile = async (userId: string, profile: unknown) => {
  if (!CLOUD_SYNC_ENABLED) return;

  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      profile,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (isMissingCloudStateTableError(error)) return;
  if (error) throw error;
};
