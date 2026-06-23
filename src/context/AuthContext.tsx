import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import type { AuthResponse, AuthTokenResponsePassword, Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { AUTH_ENABLED } from '@/constants/features';
import { setMonitoringUser } from '@/services/monitoring';

interface AuthStateContextValue {
  session: Session | null;
  loading: boolean;
}

interface AuthActionsContextValue {
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

type AuthContextValue = AuthStateContextValue & AuthActionsContextValue;

const AuthStateContext = createContext<AuthStateContextValue | null>(null);
const AuthActionsContext = createContext<AuthActionsContextValue | null>(null);
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

  useEffect(() => {
    setMonitoringUser(session?.user.id ?? null);
  }, [session?.user.id]);

  const signIn = useCallback(
    (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
    []
  );

  const signUp = useCallback(
    (email: string, password: string) =>
      supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      }),
    []
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_user');
    if (!error) {
      await supabase.auth.signOut();
    }
    return { error };
  }, []);

  const stateValue = useMemo<AuthStateContextValue>(
    () => ({
      session,
      loading,
    }),
    [loading, session]
  );

  const actionsValue = useMemo<AuthActionsContextValue>(
    () => ({
      deleteAccount,
      signIn,
      signOut,
      signUp,
    }),
    [deleteAccount, signIn, signOut, signUp]
  );

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) throw new Error('useAuthState must be used within AuthProvider');
  return context;
};

export const useAuthActions = () => {
  const context = useContext(AuthActionsContext);
  if (!context) throw new Error('useAuthActions must be used within AuthProvider');
  return context;
};

export const useAuth = (): AuthContextValue => {
  const state = useAuthState();
  const actions = useAuthActions();
  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [actions, state]
  );
};
