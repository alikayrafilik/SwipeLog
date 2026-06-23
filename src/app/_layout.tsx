import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuthState } from '@/context/AuthContext';
import { CloudStateProvider } from '@/context/CloudStateContext';
import { MovieProvider, useMovieState } from '@/context/MovieContext';
import { TierListProvider } from '@/context/TierListContext';
import { AUTH_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { UserProfileProvider, useUserProfile } from '@/hooks/use-user-profile';
import {
  configureSmartNotificationHandler,
  subscribeToSmartNotificationResponses,
  syncSmartNotifications,
} from '@/services/smart-notifications';
import { wrapWithMonitoring } from '@/services/monitoring';
import '../global.css';

function RootNavigator() {
  const { loading, session } = useAuthState();
  const { isInitialized, movies } = useMovieState();
  const { profile, isLoaded: isProfileLoaded } = useUserProfile();
  const router = useRouter();
  const pathname = usePathname();
  const moviesRef = React.useRef(movies);
  const watchlistReleaseSignature = React.useMemo(
    () =>
      movies
        .filter((movie) => movie.isWatchlist)
        .map((movie) => `${movie.id}:${movie.date ?? ''}`)
        .sort()
        .join('|'),
    [movies]
  );

  React.useEffect(() => {
    moviesRef.current = movies;
  }, [movies]);

  React.useEffect(() => {
    if (!isInitialized) return;
    void syncSmartNotifications(moviesRef.current).catch((error) => {
      console.error('[SmartNotifications] Failed to sync:', error);
    });
  }, [isInitialized, watchlistReleaseSignature]);

  React.useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    void configureSmartNotificationHandler();
    void subscribeToSmartNotificationResponses((url) => router.push(url as never)).then(
      (cleanup) => {
        unsubscribe = cleanup;
      }
    );
    return () => unsubscribe();
  }, [router]);

  const shouldWaitForProfile = (!AUTH_ENABLED || Boolean(session)) && !isProfileLoaded;
  const shouldShowAuth = AUTH_ENABLED && !session;
  const shouldShowOnboarding =
    !shouldShowAuth && (!AUTH_ENABLED || Boolean(session)) && !profile.onboardingCompleted;
  const isAuthScreen = pathname === '/auth';
  const isOnboardingScreen = pathname === '/onboarding';
  const redirectPath = React.useMemo(() => {
    if (shouldShowAuth && !isAuthScreen) return '/auth';
    if (shouldShowOnboarding && !isOnboardingScreen) return '/onboarding';
    if (!shouldShowAuth && !shouldShowOnboarding && (isAuthScreen || isOnboardingScreen)) return '/';
    return null;
  }, [isAuthScreen, isOnboardingScreen, shouldShowAuth, shouldShowOnboarding]);

  React.useEffect(() => {
    if (loading || shouldWaitForProfile || !redirectPath) return;
    router.replace(redirectPath as never);
  }, [loading, redirectPath, router, shouldWaitForProfile]);

  if (loading || shouldWaitForProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-navy">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#F9C80E" />
      </View>
    );
  }

  if (redirectPath) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-navy">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#F9C80E" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 240,
          gestureEnabled: true,
          orientation: 'portrait',
        }}
      >
        <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="movie/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="statistics" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reviews" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tier-lists" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tier-list/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

function AuthenticatedApp() {
  const { session } = useAuthState();

  return (
    <MovieProvider key={AUTH_ENABLED ? (session?.user.id ?? 'signed-out') : LOCAL_USER_ID}>
      <TierListProvider>
        <RootNavigator />
      </TierListProvider>
    </MovieProvider>
  );
}

function AppProviders() {
  const { session } = useAuthState();
  const providerKey = AUTH_ENABLED ? (session?.user.id ?? 'signed-out') : LOCAL_USER_ID;

  return (
    <CloudStateProvider key={providerKey}>
      <UserProfileProvider key={providerKey}>
        <AuthenticatedApp />
      </UserProfileProvider>
    </CloudStateProvider>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      <AppProviders />
    </AuthProvider>
  );
}

export default wrapWithMonitoring(RootLayout);
