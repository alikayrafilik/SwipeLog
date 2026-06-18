import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED } from '@/constants/features';

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const isSupabaseRequired = AUTH_ENABLED || CLOUD_SYNC_ENABLED;

if (isSupabaseRequired && (!supabaseUrl || !supabasePublishableKey)) {
  throw new Error('Supabase environment variables are missing.');
}

export const supabase = createClient(
  supabaseUrl ?? 'https://disabled.supabase.co',
  supabasePublishableKey ?? 'disabled-publishable-key',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
