import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import type { AuthResponse, AuthTokenResponsePassword, Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { AUTH_ENABLED } from '@/constants/features';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_REDIRECT_URL = 'swipelog://auth';

const createSessionFromUrl = async (url: string) => {
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  const params = new URLSearchParams(fragment || query);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(AUTH_ENABLED);

  useEffect(() => {
    if (!AUTH_ENABLED) return;

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    Linking.getInitialURL().then((url) => {
      if (url) void createSessionFromUrl(url);
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void createSessionFromUrl(url);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password) =>
        supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        }),
      signOut: () => supabase.auth.signOut(),
      deleteAccount: async () => {
        const { error } = await supabase.rpc('delete_user');
        if (!error) {
          await supabase.auth.signOut();
        }
        return { error };
      },
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
