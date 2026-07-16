import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as ExpoLinking from 'expo-linking';
import { AUTH_ENABLED } from '@/constants/features';
import { setMonitoringUser } from '@/services/monitoring';
import { trackEvent } from '@/services/analytics';
import { firebaseAuth } from '@/services/firebase';
import {
  clearLocalAccountData,
  deleteCloudAccountData,
} from '@/services/account-deletion';
import {
  type ActionCodeSettings,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
  verifyPasswordResetCode,
  sendEmailVerification,
} from 'firebase/auth';

const authContinueUrl =
  process.env.EXPO_PUBLIC_AUTH_CONTINUE_URL ||
  'https://swipelog-b563d.firebaseapp.com/auth';

export interface Session {
  user: {
    id: string;
    email: string;
  };
}

interface AuthResponse {
  data: { session: Session | null };
  error: Error | null;
}

interface AuthStateContextValue {
  session: Session | null;
  loading: boolean;
  authLinkError: string | null;
  authLinkMessage: string | null;
  pendingPasswordReset: { code: string; email: string } | null;
}

interface AuthActionsContextValue {
  clearAuthLinkError: () => void;
  clearAuthLinkMessage: () => void;
  clearPendingPasswordReset: () => void;
  confirmPasswordResetCode: (code: string, password: string) => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  deleteAccount: (password: string) => Promise<{ error: Error | null }>;
}

type AuthContextValue = AuthStateContextValue & AuthActionsContextValue;

const AuthStateContext = createContext<AuthStateContextValue | null>(null);
const AuthActionsContext = createContext<AuthActionsContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(AUTH_ENABLED);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [authLinkMessage, setAuthLinkMessage] = useState<string | null>(null);
  const [pendingPasswordReset, setPendingPasswordReset] = useState<{ code: string; email: string } | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED) return;

    let mounted = true;

    // Firebase Auth session persistence
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (mounted) {
        if (user && user.emailVerified) {
          setSession({
            user: {
              id: user.uid,
              email: user.email || '',
            },
          });
        } else {
          setSession(null);
        }
        setLoading(false);
      }
    });

    const getActionLinkParams = (url: string) => {
      const params = ExpoLinking.parse(url).queryParams ?? {};
      const nestedLink = params.link ?? params.continueUrl;
      if (typeof nestedLink === 'string') {
        return ExpoLinking.parse(nestedLink).queryParams ?? params;
      }
      return params;
    };

    const handleAuthLink = async (url: string) => {
      try {
        const params = getActionLinkParams(url);
        const mode = typeof params.mode === 'string' ? params.mode : null;
        const code = typeof params.oobCode === 'string' ? params.oobCode : null;
        if (!mode || !code) return;

        if (mode === 'verifyEmail') {
          await applyActionCode(firebaseAuth, code);
          setAuthLinkError(null);
          setAuthLinkMessage('Email verified. You can now sign in.');
          return;
        }

        if (mode === 'resetPassword') {
          const resetEmail = await verifyPasswordResetCode(firebaseAuth, code);
          setAuthLinkError(null);
          setAuthLinkMessage(null);
          setPendingPasswordReset({ code, email: resetEmail });
        }
      } catch (error) {
        if (mounted) {
          setAuthLinkError(error instanceof Error ? error.message : 'The link could not be opened.');
        }
      }
    };

    ExpoLinking.getInitialURL().then((url) => {
      if (url) void handleAuthLink(url);
    });
    const linkingSubscription = ExpoLinking.addEventListener('url', ({ url }) => {
      void handleAuthLink(url);
    });

    return () => {
      mounted = false;
      unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  useEffect(() => {
    setMonitoringUser(session?.user.id ?? null);
  }, [session?.user.id]);

  const clearAuthLinkError = useCallback(() => setAuthLinkError(null), []);
  const clearAuthLinkMessage = useCallback(() => setAuthLinkMessage(null), []);
  const clearPendingPasswordReset = useCallback(() => setPendingPasswordReset(null), []);

  const authActionSettings = useMemo(
    (): ActionCodeSettings => ({
      url: authContinueUrl,
      handleCodeInApp: true,
      android: {
        packageName: 'com.waage.SwipeLog',
        installApp: true,
      },
      iOS: {
        bundleId: 'com.waage.swipelog',
      },
    }),
    []
  );

  const resetPasswordForEmail = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email, authActionSettings);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [authActionSettings]);

  const confirmPasswordResetCode = useCallback(async (code: string, password: string) => {
    try {
      await confirmPasswordReset(firebaseAuth, code, password);
      setPendingPasswordReset(null);
      setAuthLinkMessage('Password updated. You can now sign in.');
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user, authActionSettings);
        await firebaseSignOut(firebaseAuth);
        void trackEvent('login', { method: 'email', result: 'failed' });
        return { error: new Error('Your email is not verified yet. We sent a new verification link to your email.') };
      }
      void trackEvent('login', { method: 'email', result: 'success' });
      return { error: null };
    } catch (error) {
      void trackEvent('login', { method: 'email', result: 'failed' });
      return { error: error as Error };
    }
  }, [authActionSettings]);

  const signUp = useCallback(async (email: string, password: string) => {
    let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      createdUser = userCredential.user;
      await sendEmailVerification(userCredential.user, authActionSettings);
      await firebaseSignOut(firebaseAuth);
      void trackEvent('sign_up', { method: 'email', result: 'success' });
      
      return {
        data: { session: null },
        error: null,
      };
    } catch (error) {
      void trackEvent('sign_up', { method: 'email', result: 'failed' });
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch {
          await firebaseSignOut(firebaseAuth);
        }
      }
      return { data: { session: null }, error: error as Error };
    }
  }, [authActionSettings]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(firebaseAuth);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    try {
      if (firebaseAuth.currentUser) {
        await firebaseUpdatePassword(firebaseAuth.currentUser, password);
        return { error: null };
      }
      return { error: new Error('No user is signed in.') };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    void trackEvent('account_deletion_started');
    try {
      const user = firebaseAuth.currentUser;
      if (!user || !user.email) {
        void trackEvent('account_deletion_completed', { result: 'failed' });
        return { error: new Error('No user is signed in.') };
      }

      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await deleteCloudAccountData(user.uid);
      await clearLocalAccountData(user.uid);
      await deleteUser(user);
      void trackEvent('account_deletion_completed', { result: 'success' });
      return { error: null };
    } catch (error) {
      void trackEvent('account_deletion_completed', { result: 'failed' });
      return { error: error as Error };
    }
  }, []);

  const stateValue = useMemo<AuthStateContextValue>(
    () => ({
      session,
      loading,
      authLinkError,
      authLinkMessage,
      pendingPasswordReset,
    }),
    [authLinkError, authLinkMessage, loading, pendingPasswordReset, session]
  );

  const actionsValue = useMemo<AuthActionsContextValue>(
    () => ({
      clearAuthLinkError,
      clearAuthLinkMessage,
      clearPendingPasswordReset,
      confirmPasswordResetCode,
      deleteAccount,
      resetPasswordForEmail,
      signIn,
      signOut,
      signUp,
      updatePassword,
    }),
    [
      clearAuthLinkError,
      clearAuthLinkMessage,
      clearPendingPasswordReset,
      confirmPasswordResetCode,
      deleteAccount,
      resetPasswordForEmail,
      signIn,
      signOut,
      signUp,
      updatePassword,
    ]
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
