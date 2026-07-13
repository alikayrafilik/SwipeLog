import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuthState } from '@/context/AuthContext';
import { CloudStateProvider } from '@/context/CloudStateContext';
import { MovieProvider, useMovieState } from '@/context/MovieContext';
import { SharedWatchlistProvider } from '@/context/SharedWatchlistContext';
import { TierListProvider } from '@/context/TierListContext';
import { AUTH_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { UserProfileProvider, useUserProfile } from '@/hooks/use-user-profile';
import { LanguageProvider } from '@/i18n';
import {
  getGenreCountBucket,
  setAnalyticsUser,
  setAnalyticsUserProperties,
  trackEvent,
  trackScreenView,
} from '@/services/analytics';
import {
  configureSmartNotificationHandler,
  subscribeToSmartNotificationResponses,
  syncSmartNotifications,
} from '@/services/smart-notifications';
import { wrapWithMonitoring } from '@/services/monitoring';
import '../global.css';

const screenNameForPath = (pathname: string) => {
  if (pathname === '/') return 'Browse';
  if (pathname === '/onboarding') return 'Onboarding';
  if (pathname === '/auth') return 'Auth';
  if (pathname === '/discover') return 'Discover';
  if (pathname === '/library') return 'Library';
  if (pathname === '/profile') return 'Profile';
  if (pathname.startsWith('/movie/')) return 'Movie Detail';
  if (pathname === '/friends' || pathname === '/friends/add') return 'Friends';
  if (pathname === '/shared-watchlists' || pathname.startsWith('/shared-watchlist/')) {
    return 'Shared Watchlist';
  }
  return null;
};

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
    void setAnalyticsUser(session?.user.id ?? null);
  }, [session?.user.id]);

  React.useEffect(() => {
    void setAnalyticsUserProperties({
      onboarding_completed: profile.onboardingCompleted ? 'true' : 'false',
      favorite_genre_count: getGenreCountBucket(profile.favoriteGenreIds.length),
      has_logged_movie: movies.some((movie) => movie.isWatched) ? 'true' : 'false',
      has_watchlist_item: movies.some((movie) => movie.isWatchlist) ? 'true' : 'false',
      locale: profile.language,
    });
  }, [movies, profile.favoriteGenreIds.length, profile.language, profile.onboardingCompleted]);

  React.useEffect(() => {
    void trackEvent('app_opened');
  }, []);

  React.useEffect(() => {
    const screenName = screenNameForPath(pathname);
    if (!screenName) return;
    void trackScreenView(screenName);
  }, [pathname]);

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
          animation: 'fade_from_bottom',
          animationDuration: 220,
          gestureEnabled: true,
          gestureDirection: 'vertical',
          orientation: 'portrait',
          contentStyle: { backgroundColor: '#002B3A' },
        }}
      >
        {/* Auth flow switches should remain fade to avoid sliding when opening the app */}
        <Stack.Screen name="auth" options={{ animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: 200 }} />
        
        {/* Consistent content transitions */}
        <Stack.Screen name="movie/[id]" />
        <Stack.Screen name="statistics" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="friends/add" />
        <Stack.Screen name="u/[username]" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="shared-watchlists" />
        <Stack.Screen name="shared-watchlist/[id]" />
        <Stack.Screen name="tier-lists" />
        <Stack.Screen name="tier-list/[id]" />
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
        <LanguageProvider>
          <SharedWatchlistProvider>
            <AuthenticatedApp />
          </SharedWatchlistProvider>
        </LanguageProvider>
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
