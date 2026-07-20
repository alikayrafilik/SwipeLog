import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  parseActionCodeURL,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  reload,
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
    emailVerified: boolean;
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
  resendVerificationEmail: () => Promise<{ error: Error | null }>;
  refreshEmailVerification: () => Promise<{ error: Error | null }>;
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
  const authLinksInFlight = useRef(new Set<string>());
  const processedAuthLinks = useRef(new Set<string>());
  const signingUp = useRef(false);

  useEffect(() => {
    if (!AUTH_ENABLED) return;

    let mounted = true;

    // Firebase Auth session persistence
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (mounted) {
        if (signingUp.current) {
          setSession(null);
          setLoading(false);
          return;
        }
        if (user) {
          setSession({
            user: {
              id: user.uid,
              email: user.email || '',
              emailVerified: user.emailVerified,
            },
          });
        } else {
          setSession(null);
        }
        setLoading(false);
      }
    });

    const getNestedActionLink = (url: string) => {
      const params = ExpoLinking.parse(url).queryParams ?? {};
      const nestedLink = params.link ?? params.continueUrl;
      return typeof nestedLink === 'string' ? nestedLink : url;
    };

    const getFriendlyActionLinkError = (error: unknown, mode: string | null) => {
      const code =
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
          ? error.code
          : null;

      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        return mode === 'resetPassword'
          ? 'This password reset link is invalid or has expired. Request a new link and use the latest email.'
          : 'This verification link is invalid or has expired. Request a new email and use the latest link.';
      }
      if (code === 'auth/user-disabled' || code === 'auth/user-not-found') {
        return 'This account is no longer available. Contact support if you need help.';
      }
      return 'The link could not be opened. Please request a new email and try again.';
    };

    const handleAuthLink = async (url: string) => {
      if (authLinksInFlight.current.has(url) || processedAuthLinks.current.has(url)) return;
      authLinksInFlight.current.add(url);
      let mode: string | null = null;
      try {
        const nestedActionLink = getNestedActionLink(url);
        const parsedAction = parseActionCodeURL(nestedActionLink) ?? parseActionCodeURL(url);
        const fallbackParams = ExpoLinking.parse(nestedActionLink).queryParams ?? {};
        mode = parsedAction?.operation === 'PASSWORD_RESET'
          ? 'resetPassword'
          : parsedAction?.operation === 'VERIFY_EMAIL'
            ? 'verifyEmail'
            : typeof fallbackParams.mode === 'string'
              ? fallbackParams.mode
              : null;
        const code = parsedAction?.code ?? (
          typeof fallbackParams.oobCode === 'string' ? fallbackParams.oobCode : null
        );
        if (!mode || !code) return;

        if (mode === 'verifyEmail') {
          await applyActionCode(firebaseAuth, code);
          setAuthLinkError(null);
          setAuthLinkMessage('Email verified. You can now sign in.');
          processedAuthLinks.current.add(url);
          return;
        }

        if (mode === 'resetPassword') {
          const resetEmail = await verifyPasswordResetCode(firebaseAuth, code);
          setAuthLinkError(null);
          setAuthLinkMessage(null);
          setPendingPasswordReset({ code, email: resetEmail });
          processedAuthLinks.current.add(url);
        }
      } catch (error) {
        if (mounted) {
          setPendingPasswordReset(null);
          setAuthLinkError(getFriendlyActionLinkError(error, mode));
        }
      } finally {
        authLinksInFlight.current.delete(url);
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

  const passwordResetActionSettings = useMemo(
    (): ActionCodeSettings => ({
      url: authContinueUrl,
      handleCodeInApp: false,
    }),
    []
  );

  const resetPasswordForEmail = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email, passwordResetActionSettings);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [passwordResetActionSettings]);

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
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      void trackEvent('login', { method: 'email', result: 'success' });
      return { error: null };
    } catch (error) {
      void trackEvent('login', { method: 'email', result: 'failed' });
      return { error: error as Error };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;
    signingUp.current = true;

    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      createdUser = userCredential.user;
      try {
        await sendEmailVerification(userCredential.user, authActionSettings);
      } catch (error) {
        console.warn('[Auth] Verification email could not be sent:', error);
      }
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (error) {
        console.warn('[Auth] Could not end post-signup session:', error);
      }
      // Keep the navigator on the sign-in screen while Firebase finishes
      // publishing the sign-out state asynchronously.
      setSession(null);
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
    } finally {
      signingUp.current = false;
    }
  }, [authActionSettings]);

  const resendVerificationEmail = useCallback(async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return { error: new Error('No user is signed in.') };
      await sendEmailVerification(user, authActionSettings);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [authActionSettings]);

  const refreshEmailVerification = useCallback(async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return { error: new Error('No user is signed in.') };
      await reload(user);
      setSession({ user: { id: user.uid, email: user.email || '', emailVerified: user.emailVerified } });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

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
      resendVerificationEmail,
      refreshEmailVerification,
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
      resendVerificationEmail,
      refreshEmailVerification,
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
