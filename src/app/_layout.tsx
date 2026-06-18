import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MovieProvider, useMovies } from '@/context/MovieContext';
import { TierListProvider } from '@/context/TierListContext';
import OnboardingTips from '@/components/OnboardingTips';
import { AUTH_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import {
  configureSmartNotificationHandler,
  subscribeToSmartNotificationResponses,
  syncSmartNotifications,
} from '@/services/smart-notifications';
import '../global.css';

function RootNavigator() {
  const { loading, session } = useAuth();
  const { isInitialized, movies } = useMovies();
  const router = useRouter();
  const segments = useSegments();
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
    if (loading) return;
    const isAuthScreen = (segments[0] as string | undefined) === 'auth';

    if (!AUTH_ENABLED && isAuthScreen) router.replace('/(tabs)');
    else if (AUTH_ENABLED && !session && !isAuthScreen) router.replace('/auth' as never);
    else if (session && isAuthScreen) router.replace('/(tabs)');
  }, [loading, router, segments, session]);

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

  if (loading) {
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
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="movie/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen
          name="trailer-feed"
          options={{ animation: 'fade', gestureEnabled: false, orientation: 'landscape' }}
        />
        <Stack.Screen name="statistics" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reviews" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tier-lists" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tier-list/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <OnboardingTips enabled={isInitialized && (!AUTH_ENABLED || Boolean(session))} />
    </>
  );
}

function AuthenticatedApp() {
  const { session } = useAuth();

  return (
    <MovieProvider key={AUTH_ENABLED ? (session?.user.id ?? 'signed-out') : LOCAL_USER_ID}>
      <TierListProvider>
        <RootNavigator />
      </TierListProvider>
    </MovieProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
