import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Switch,
  Pressable,
  type PressableProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import HorizontalList, { HorizontalMovieItem } from '@/components/HorizontalList';
import { useMovieActions, useMovieState } from '@/context/MovieContext';
import type { LoggedMovie } from '@/context/MovieContext';
import { useAuthActions, useAuthState } from '@/context/AuthContext';
import { defaultUserProfile, UserProfile, useUserProfile } from '@/hooks/use-user-profile';
import { shareDataExport } from '@/services/data-export';
import { readLetterboxdFiles } from '@/services/letterboxd-files';
import { importLetterboxdCsvFiles, type LetterboxdImportResult } from '@/services/letterboxd-import';
import { persistProfileImage, ProfileImageKind } from '@/services/profile-images';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED } from '@/constants/features';
import { verifyCloudSync, type CloudSyncCheckResult } from '@/services/cloud-state';
import HalfStarRating from '@/components/HalfStarRating';
import { getTabScreenBottomInset } from '@/constants/layout';
import {
  defaultSmartNotificationPreferences,
  getScheduledSmartNotificationCount,
  isSmartNotificationsSupported,
  loadSmartNotificationPreferences,
  requestSmartNotificationPermission,
  saveSmartNotificationPreferences,
  sendSmartNotificationTest,
  SmartNotificationPreferences,
  syncSmartNotifications,
} from '@/services/smart-notifications';

const GENRE_NAMES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

const PROFILE_BIO_MAX_LENGTH = 120;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScalePressableProps extends PressableProps {
  children: React.ReactNode;
  className?: string;
  pressedScale?: number;
  pressedTranslateY?: number;
  shadowFeedback?: boolean;
}

function ScalePressable({
  children,
  className,
  pressedScale = 0.97,
  pressedTranslateY = 0,
  shadowFeedback = false,
  onPressIn,
  onPressOut,
  ...props
}: ScalePressableProps) {
  const pressProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    elevation: shadowFeedback ? 4 + pressProgress.value * 3 : undefined,
    shadowOpacity: shadowFeedback ? 0.1 + pressProgress.value * 0.08 : undefined,
    transform: [
      { scale: 1 - (1 - pressedScale) * pressProgress.value },
      { translateY: pressedTranslateY * pressProgress.value },
    ],
  }));

  return (
    <AnimatedPressable
      {...props}
      className={className}
      onPressIn={(event) => {
        pressProgress.value = withTiming(1, { duration: 110 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressProgress.value = withTiming(0, { duration: 130 });
        onPressOut?.(event);
      }}
      style={[animatedStyle, props.style]}
    >
      {children}
    </AnimatedPressable>
  );
}

interface LetterboxdImportSummary extends LetterboxdImportResult {
  sourceFiles: number;
}

const formatLetterboxdImportLines = (summary: LetterboxdImportSummary) => [
  `${summary.matched} movies matched${summary.skipped ? `, ${summary.skipped} not matched` : ''}.`,
  `${summary.diaryLogs} diary logs`,
  `${summary.watchlist} watchlist movies`,
  `${summary.favorites} favorites`,
  `${summary.sourceFiles} Letterboxd files read`,
];

const confirmLetterboxdImport = (summary: LetterboxdImportSummary) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      'Ready to import',
      formatLetterboxdImportLines(summary).join('\n'),
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Import', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });

export default function ProfileScreen() {
  const { session } = useAuthState();
  const { deleteAccount, signOut } = useAuthActions();
  const { customLists, diaryEntries, discoveryEvents, movies, watchHistory } = useMovieState();
  const { clearAllMovieData, importMovies, refreshMovieMetadata } = useMovieActions();
  const { profile, resetProfile, saveProfile } = useUserProfile();
  const [showSettings, setShowSettings] = useState(false);
  const [draftProfile, setDraftProfile] = useState<UserProfile>(profile);
  const [isImporting, setIsImporting] = useState(false);
  const [lastLetterboxdImport, setLastLetterboxdImport] = useState<LetterboxdImportSummary | null>(null);
  const [isPickingImage, setIsPickingImage] = useState<ProfileImageKind | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cloudSyncCheck, setCloudSyncCheck] = useState<CloudSyncCheckResult | null>(null);
  const [isCheckingCloudSync, setIsCheckingCloudSync] = useState(false);
  const [notificationPreferences, setNotificationPreferences] =
    useState<SmartNotificationPreferences>(defaultSmartNotificationPreferences);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [scheduledNotificationCount, setScheduledNotificationCount] = useState(0);
  const didSyncRuntimes = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void Promise.all([
      loadSmartNotificationPreferences(),
      getScheduledSmartNotificationCount(),
    ]).then(([preferences, count]) => {
      setNotificationPreferences(preferences);
      setScheduledNotificationCount(count);
    });
  }, []);

  const movieById = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);

  // Filter and sort movies dynamically
  const watchedMovies = useMemo<LoggedMovie[]>(() => {
    const seenMovieIds = new Set<string>();
    return diaryEntries
      .filter((entry) => {
        if (seenMovieIds.has(entry.movieId)) return false;
        seenMovieIds.add(entry.movieId);
        return true;
      })
      .map((entry) => {
        const savedMovie = movieById.get(entry.movieId);
        if (savedMovie) {
          return {
            ...savedMovie,
            rating: entry.rating || savedMovie.rating,
            isWatched: true,
            watchedDate: entry.watchedAt,
          };
        }
        return {
          ...entry.movie,
          rating: entry.rating,
          isLiked: false,
          isWatched: true,
          isWatchlist: false,
          watchedDate: entry.watchedAt,
          lists: [],
        };
      });
  }, [diaryEntries, movieById]);
  const favoriteMovies = useMemo(() => movies.filter((m) => m.isLiked), [movies]);
  const featuredMovies = useMemo(
    () =>
      profile.favoriteMovieIds
        .map((id) => movieById.get(id))
        .filter((movie): movie is NonNullable<typeof movie> => Boolean(movie)),
    [movieById, profile.favoriteMovieIds]
  );
  const featuredDraftMovies = useMemo(
    () =>
      draftProfile.favoriteMovieIds
        .map((id) => movieById.get(id))
        .filter((movie): movie is NonNullable<typeof movie> => Boolean(movie)),
    [draftProfile.favoriteMovieIds, movieById]
  );
  const featuredCandidates = useMemo(() => {
    const candidates = [...featuredDraftMovies, ...favoriteMovies, ...watchedMovies];
    return candidates.filter(
      (movie, index) => candidates.findIndex((candidate) => candidate.id === movie.id) === index
    );
  }, [favoriteMovies, featuredDraftMovies, watchedMovies]);
  const watchlistCount = useMemo(() => movies.filter((m) => m.isWatchlist).length, [movies]);

  // Compute stats
  const watchedCount = watchedMovies.length;
  const totalMinutes = useMemo(
    () =>
      watchHistory.reduce((total, entry) => {
        const runtime = movieById.get(entry.movieId)?.runtimeMinutes;
        return total + (runtime ?? 0);
      }, 0),
    [movieById, watchHistory]
  );
  const runtimeCoverage = useMemo(
    () =>
      watchHistory.filter((entry) => movieById.get(entry.movieId)?.runtimeMinutes)
        .length,
    [movieById, watchHistory]
  );
  const ratedEntries = useMemo(() => watchHistory.filter((entry) => entry.rating > 0), [watchHistory]);
  const averageRating = ratedEntries.length
    ? ratedEntries.reduce((total, entry) => total + entry.rating, 0) / ratedEntries.length
    : 0;

  const timeSpentStr = useMemo(() => {
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    if (days >= 30) {
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      return `${months}m ${remainingDays}d ${hours}h`;
    }
    return `${days}d ${hours}h ${minutes}m`;
  }, [totalMinutes]);

  // Map movies for HorizontalList components
  const favoritesData = useMemo(() => {
    return [...favoriteMovies]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8)
      .map((m) => ({
      id: m.id,
      title: m.title,
      image: m.image,
      date: m.date,
      rating: m.rating,
      overview: m.overview,
      }));
  }, [favoriteMovies]);

  const diaryEntryWatchNumbers = useMemo(() => {
    const watchNumbers = new Map<string, number>();
    const countsByMovieId = new Map<string, number>();
    [...diaryEntries].reverse().forEach((entry) => {
      const nextCount = (countsByMovieId.get(entry.movieId) ?? 0) + 1;
      countsByMovieId.set(entry.movieId, nextCount);
      watchNumbers.set(entry.id, nextCount);
    });
    return watchNumbers;
  }, [diaryEntries]);

  const recentlyWatchedData = useMemo(() => {
    return diaryEntries.slice(0, 8).map((entry) => {
      const m = movieById.get(entry.movieId) ?? entry.movie;
      const watchNumber = diaryEntryWatchNumbers.get(entry.id) ?? 1;
      return {
        id: m.id,
        badgeLabel: watchNumber > 1 ? `Rewatch #${watchNumber}` : undefined,
        listKey: entry.id,
        title: m.title,
        image: m.image,
        date: m.date,
        rating: entry.rating || movieById.get(entry.movieId)?.rating || 0,
        overview: m.overview,
      };
    });
  }, [diaryEntries, diaryEntryWatchNumbers, movieById]);

  const topGenres = useMemo(() => {
    const counts = new Map<number, number>();
    watchedMovies.forEach((movie) => {
      movie.genreIds?.forEach((genreId) => counts.set(genreId, (counts.get(genreId) ?? 0) + 1));
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => ({ id, count, name: GENRE_NAMES[id] ?? 'Other' }));
  }, [watchedMovies]);

  const ratingDistribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: ratedEntries.filter((entry) => Math.round(entry.rating) === rating).length,
      })),
    [ratedEntries]
  );
  const maxRatingCount = Math.max(1, ...ratingDistribution.map((item) => item.count));
  const lastReviewedEntry = useMemo(
    () => diaryEntries.find((entry) => Boolean(entry.note?.trim())) ?? null,
    [diaryEntries]
  );

  const handleLetterboxdImport = async () => {
    try {
      const result = await File.pickFileAsync({
        multipleFiles: true,
        mimeTypes: ['*/*'],
      });
      if (result.canceled) return;

      setIsImporting(true);
      const readableFiles = await readLetterboxdFiles(result.result);
      if (readableFiles.length === 0) {
        Alert.alert(
          'No Letterboxd data found',
          'Choose the ZIP file downloaded from Letterboxd, or CSV files from the extracted export folder.'
        );
        return;
      }

      const imported = await importLetterboxdCsvFiles(readableFiles);
      const summary = { ...imported, sourceFiles: readableFiles.length };
      if (imported.matched === 0) {
        Alert.alert(
          'No movies matched',
          [
            'SwipeLog found Letterboxd CSV data, but could not match those movies with TMDB.',
            'Try importing the original Letterboxd ZIP export, or try again later if TMDB is unavailable.',
          ].join('\n\n')
        );
        return;
      }

      const shouldImport = await confirmLetterboxdImport(summary);
      if (!shouldImport) return;

      importMovies(imported.items);
      setLastLetterboxdImport(summary);
      Alert.alert(
        'Letterboxd import complete',
        [
          `${imported.matched} movies matched${imported.skipped ? `, ${imported.skipped} could not be matched` : ''}.`,
          `${imported.diaryLogs} diary logs, ${imported.watchlist} watchlist, ${imported.favorites} favorites`,
        ].join('\n')
      );
    } catch (error) {
      console.error('[LetterboxdImport] Failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown import error';
      Alert.alert(
        'Import failed',
        [
          'SwipeLog could not read this Letterboxd export.',
          'Try downloading a fresh export from Letterboxd and selecting the ZIP file.',
          message,
        ].join('\n\n')
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleProfileRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshMovieMetadata(watchedMovies.map((movie) => movie.id));
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateNotificationPreferences = async (
    nextPreferences: SmartNotificationPreferences,
    requestPermission = false
  ) => {
    if (isUpdatingNotifications) return;
    if (!isSmartNotificationsSupported) {
      Alert.alert(
        'Development build required',
        'Android Expo Go cannot load expo-notifications. Smart notifications work in your development build and APK.'
      );
      return;
    }
    setIsUpdatingNotifications(true);
    try {
      if (requestPermission && nextPreferences.enabled) {
        const granted = await requestSmartNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications are disabled',
            'Allow notifications in your device settings to receive watchlist release reminders.'
          );
          return;
        }
      }
      await saveSmartNotificationPreferences(nextPreferences);
      setNotificationPreferences(nextPreferences);
      const count = await syncSmartNotifications(movies, nextPreferences);
      setScheduledNotificationCount(count);
    } catch (error) {
      console.error('[SmartNotifications] Failed to update preferences:', error);
      Alert.alert('Could not update reminders', 'Please try again in a moment.');
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      if (!isSmartNotificationsSupported) {
        Alert.alert(
          'Development build required',
          'Test notifications are available in your development build and APK, not Android Expo Go.'
        );
        return;
      }
      const granted = await requestSmartNotificationPermission();
      if (!granted) {
        Alert.alert('Notifications are disabled', 'Allow notifications to send a test reminder.');
        return;
      }
      await sendSmartNotificationTest(movies);
    } catch (error) {
      console.error('[SmartNotifications] Failed to send test:', error);
      Alert.alert('Test failed', 'The test notification could not be sent.');
    }
  };

  useEffect(() => {
    if (didSyncRuntimes.current || watchedMovies.length === 0) return;
    didSyncRuntimes.current = true;
    const missingRuntimeIds = watchedMovies
      .filter((movie) => !movie.runtimeMinutes)
      .map((movie) => movie.id);
    if (missingRuntimeIds.length > 0) {
      void refreshMovieMetadata(missingRuntimeIds);
    }
  }, [refreshMovieMetadata, watchedMovies]);

  const openLibraryTab = (tab: 'Logs' | 'Diary' | 'Watchlist') => {
    router.push({ pathname: '/(tabs)/library', params: { tab } } as never);
  };

  const openStatistics = () => {
    router.push('/statistics' as never);
  };

  const openMovie = (movie: HorizontalMovieItem) => {
    const image = typeof movie.image === 'string' ? movie.image : '';
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: movie.id,
        title: movie.title,
        year: movie.date?.match(/\d{4}/)?.[0] ?? '',
        image,
        overview: movie.overview ?? '',
        rating: `${movie.rating ?? 0}`,
      },
    } as never);
  };

  const handlePickProfileImage = async (kind: ProfileImageKind) => {
    try {
      setIsPickingImage(kind);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: kind === 'avatar' ? [1, 1] : [16, 7],
        quality: 0.85,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const uri = await persistProfileImage(asset.uri, kind, asset.fileName);
      setDraftProfile((current) => ({
        ...current,
        [kind === 'avatar' ? 'avatarUrl' : 'coverUrl']: uri,
      }));
    } catch (error) {
      console.error('[ProfileImage] Failed:', error);
      Alert.alert('Image selection failed', 'The selected image could not be saved. Please try another image.');
    } finally {
      setIsPickingImage(null);
    }
  };

  const toggleFeaturedMovie = (movieId: string) => {
    setDraftProfile((current) => {
      const isSelected = current.favoriteMovieIds.includes(movieId);
      if (isSelected) {
        return {
          ...current,
          favoriteMovieIds: current.favoriteMovieIds.filter((id) => id !== movieId),
        };
      }
      if (current.favoriteMovieIds.length >= 4) {
        Alert.alert('Four films selected', 'Remove one of your featured films before adding another.');
        return current;
      }
      return { ...current, favoriteMovieIds: [...current.favoriteMovieIds, movieId] };
    });
  };

  const moveFeaturedMovie = (movieId: string, direction: -1 | 1) => {
    setDraftProfile((current) => {
      const index = current.favoriteMovieIds.indexOf(movieId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.favoriteMovieIds.length) return current;
      const favoriteMovieIds = [...current.favoriteMovieIds];
      [favoriteMovieIds[index], favoriteMovieIds[targetIndex]] = [
        favoriteMovieIds[targetIndex],
        favoriteMovieIds[index],
      ];
      return { ...current, favoriteMovieIds };
    });
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      await shareDataExport({
        exportedAt: new Date().toISOString(),
        profile,
        movies,
        watchHistory,
        customLists,
        discoveryEvents,
      });
    } catch (error) {
      console.error('[DataExport] Failed:', error);
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Your data could not be exported.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCheckCloudSync = async () => {
    if (!session?.user.id || isCheckingCloudSync) return;

    try {
      setIsCheckingCloudSync(true);
      const result = await verifyCloudSync(session.user.id);
      setCloudSyncCheck(result);
      if (!result.ok) {
        Alert.alert('Cloud sync check failed', result.message);
      }
    } catch (error) {
      const result = {
        ok: false,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Cloud sync check failed.',
      };
      setCloudSyncCheck(result);
      Alert.alert('Cloud sync check failed', result.message);
    } finally {
      setIsCheckingCloudSync(false);
    }
  };

  const confirmResetProfile = () => {
    Alert.alert(
      'Reset profile?',
      'Your name, username, bio, profile picture, and banner will return to their defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset profile',
          style: 'destructive',
          onPress: async () => {
            await resetProfile();
            setDraftProfile(defaultUserProfile);
          },
        },
      ]
    );
  };

  const confirmClearMovieData = () => {
    Alert.alert(
      'Delete all movie data?',
      'This permanently removes your logs, diary, ratings, favorites, watchlist, lists, and discovery history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllMovieData();
              Alert.alert('Movie data deleted', 'Your profile details and images were kept.');
            } catch (error) {
              console.error('[MovieStore] Failed to clear movie data:', error);
              Alert.alert('Delete failed', 'Movie data could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await signOut();
          if (error) Alert.alert('Sign out failed', error.message);
        },
      },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account, movie logs, ratings, and profile. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteAccount();
            if (error) {
              console.error('[Profile] Delete account failed:', error);
              Alert.alert('Delete failed', 'An error occurred while deleting your account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openProfileSettings = () => {
    const availableIds = new Set(movies.map((movie) => movie.id));
    setDraftProfile({
      ...profile,
      favoriteMovieIds: profile.favoriteMovieIds.filter((id) => availableIds.has(id)),
    });
    setShowSettings(true);
  };

  if (showSettings) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050814', paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 py-4">
          <TouchableOpacity
            onPress={() => {
              setDraftProfile(profile);
              setShowSettings(false);
            }}
            className="w-9 h-9 rounded-full bg-brand-navyLight items-center justify-center border border-white/10"
            activeOpacity={0.7}
            accessibilityLabel="Go back to profile"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-black">Edit Profile</Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                setIsSavingProfile(true);
                await saveProfile(draftProfile);
                setShowSettings(false);
              } finally {
                setIsSavingProfile(false);
              }
            }}
            className="rounded-lg bg-brand-yellow px-3 py-2"
            disabled={isSavingProfile}
            accessibilityLabel="Save profile"
          >
            {isSavingProfile ? (
              <ActivityIndicator size="small" color="#073445" />
            ) : (
              <Text className="text-xs font-black text-brand-navy">Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(140, insets.bottom + 120),
            gap: 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleProfileRefresh}
              colors={['#F9C80E']}
              progressBackgroundColor="#073445"
              tintColor="#F9C80E"
            />
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="overflow-hidden rounded-2xl border border-slate-800/80 bg-brand-navyLight">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handlePickProfileImage('cover')}
              disabled={isPickingImage !== null}
              accessibilityLabel="Choose profile banner from gallery"
              className="relative h-36 bg-slate-800"
            >
              {draftProfile.coverUrl || profile.coverUrl ? (
                <Image
                  source={{ uri: draftProfile.coverUrl || profile.coverUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-full w-full items-center justify-center bg-brand-navy">
                  <Ionicons name="image-outline" size={30} color="#64748B" />
                </View>
              )}
              <View className="absolute inset-0 items-center justify-center bg-black/25">
                <View className="flex-row items-center gap-2 rounded-full bg-brand-navy/85 px-4 py-2">
                  {isPickingImage === 'cover' ? (
                    <ActivityIndicator size="small" color="#F9C80E" />
                  ) : (
                    <Ionicons name="images-outline" size={17} color="#F9C80E" />
                  )}
                  <Text className="text-[11px] font-black text-white">Change banner</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="items-center px-4 pb-5">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePickProfileImage('avatar')}
                disabled={isPickingImage !== null}
                accessibilityLabel="Choose profile picture from gallery"
                className="-mt-12 h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-brand-navyLight bg-slate-700"
              >
                {draftProfile.avatarUrl || profile.avatarUrl ? (
                  <Image
                    source={{ uri: draftProfile.avatarUrl || profile.avatarUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={38} color="#A0AEC0" />
                )}
                <View className="absolute inset-0 items-center justify-center bg-black/30">
                  {isPickingImage === 'avatar' ? (
                    <ActivityIndicator size="small" color="#F9C80E" />
                  ) : (
                    <Ionicons name="camera-outline" size={23} color="white" />
                  )}
                </View>
              </TouchableOpacity>
              <Text selectable className="mt-3 text-lg font-extrabold text-white">
                {draftProfile.name || 'Your name'}
              </Text>
              <Text selectable className="text-[11px] font-semibold text-brand-grayText">
                Tap the images to choose from your gallery
              </Text>
            </View>
          </View>

          <View className="gap-4 rounded-2xl border border-slate-800/80 bg-brand-navyLight p-4">
            {([
              { key: 'name', label: 'Name', placeholder: 'Your name' },
              { key: 'username', label: 'Username', placeholder: 'username' },
            ] satisfies { key: 'name' | 'username'; label: string; placeholder: string }[]).map((field) => (
              <View key={field.key} className="gap-2">
                <Text selectable className="text-[10px] font-extrabold uppercase text-brand-grayText">
                  {field.label}
                </Text>
                <TextInput
                  value={draftProfile[field.key]}
                  onChangeText={(value) =>
                    setDraftProfile((current) => ({ ...current, [field.key]: value }))
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor="#64748B"
                  autoCapitalize={field.key === 'username' ? 'none' : 'sentences'}
                  autoCorrect={field.key !== 'username'}
                  className="h-11 rounded-xl border border-white/10 bg-brand-navy px-3 text-[13px] font-semibold text-white"
                />
              </View>
            ))}

            <View className="gap-2">
              <Text selectable className="text-[10px] font-extrabold uppercase text-brand-grayText">
                Bio
              </Text>
              <TextInput
                value={draftProfile.bio}
                onChangeText={(bio) => setDraftProfile((current) => ({ ...current, bio }))}
                placeholder="Tell people about your movie taste..."
                placeholderTextColor="#64748B"
                multiline
                maxLength={PROFILE_BIO_MAX_LENGTH}
                className="min-h-[92px] rounded-xl border border-white/10 bg-brand-navy px-3 py-3 text-[13px] font-semibold text-white"
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-right text-[9px] font-semibold text-brand-grayText">
                {draftProfile.bio.length}/{PROFILE_BIO_MAX_LENGTH}
              </Text>
            </View>
          </View>

          <View className="gap-3 rounded-2xl border border-slate-800/80 bg-brand-navyLight p-4">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-brand-grayText">
              Profile images
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-white/10 bg-brand-navy"
                activeOpacity={0.75}
                onPress={() =>
                  setDraftProfile((current) => ({ ...current, avatarUrl: defaultUserProfile.avatarUrl }))
                }
                accessibilityLabel="Remove custom profile picture"
              >
                <Ionicons name="person-circle-outline" size={18} color="#F9C80E" />
                <Text className="text-[10px] font-black text-white">Reset picture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-white/10 bg-brand-navy"
                activeOpacity={0.75}
                onPress={() =>
                  setDraftProfile((current) => ({ ...current, coverUrl: defaultUserProfile.coverUrl }))
                }
                accessibilityLabel="Remove custom profile banner"
              >
                <Ionicons name="image-outline" size={18} color="#F9C80E" />
                <Text className="text-[10px] font-black text-white">Reset banner</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-4 rounded-2xl border border-slate-800/80 bg-brand-navyLight p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[12px] font-black text-white">Favorite four</Text>
                <Text className="mt-0.5 text-[9px] font-semibold text-brand-grayText">
                  Choose and arrange the films shown on your profile.
                </Text>
              </View>
              <Text className="text-[11px] font-black text-brand-yellow">
                {draftProfile.favoriteMovieIds.length}/4
              </Text>
            </View>

            {featuredDraftMovies.length > 0 ? (
              <View className="gap-2">
                {featuredDraftMovies.map((movie, index) => (
                  <View
                    key={movie.id}
                    className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-brand-navy p-2"
                  >
                    <Image
                      source={{ uri: movie.image }}
                      className="h-14 w-10 rounded-md bg-slate-800"
                      resizeMode="cover"
                    />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={2} className="text-[11px] font-black leading-4 text-white">
                        {index + 1}. {movie.title}
                      </Text>
                      <Text className="mt-0.5 text-[9px] font-semibold text-brand-grayText">
                        {movie.date?.match(/\d{4}/)?.[0] ?? 'Unknown year'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      hitSlop={8}
                      disabled={index === 0}
                      onPress={() => moveFeaturedMovie(movie.id, -1)}
                      accessibilityLabel={`Move ${movie.title} left`}
                    >
                      <Ionicons name="arrow-up" size={17} color={index === 0 ? '#475569' : '#A0AEC0'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      disabled={index === featuredDraftMovies.length - 1}
                      onPress={() => moveFeaturedMovie(movie.id, 1)}
                      accessibilityLabel={`Move ${movie.title} right`}
                    >
                      <Ionicons
                        name="arrow-down"
                        size={17}
                        color={index === featuredDraftMovies.length - 1 ? '#475569' : '#A0AEC0'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => toggleFeaturedMovie(movie.id)}
                      accessibilityLabel={`Remove ${movie.title} from favorite four`}
                    >
                      <Ionicons name="close-circle" size={19} color="#FCA5A5" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[10px] font-semibold text-brand-grayText">
                Select up to four films below.
              </Text>
            )}

            {featuredCandidates.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {featuredCandidates.map((movie) => {
                  const isSelected = draftProfile.favoriteMovieIds.includes(movie.id);
                  return (
                    <TouchableOpacity
                      key={movie.id}
                      activeOpacity={0.75}
                      onPress={() => toggleFeaturedMovie(movie.id)}
                      accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} ${movie.title}`}
                      className="w-[68px]"
                    >
                      <View
                        className={`aspect-[2/3] overflow-hidden rounded-lg border-2 bg-slate-800 ${
                          isSelected ? 'border-brand-yellow' : 'border-transparent'
                        }`}
                      >
                        {movie.image ? (
                          <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
                        ) : (
                          <View className="h-full w-full items-center justify-center">
                            <Ionicons name="film-outline" size={20} color="#A0AEC0" />
                          </View>
                        )}
                        {isSelected ? (
                          <View className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-brand-yellow">
                            <Ionicons name="checkmark" size={14} color="#073445" />
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} className="mt-1 text-[9px] font-bold leading-3 text-white">
                        {movie.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text className="text-[9px] font-semibold leading-4 text-brand-grayText">
                Log or favorite films first, then return here to choose your favorite four.
              </Text>
            )}
          </View>

          <View className="gap-3 rounded-2xl border border-slate-800/80 bg-brand-navyLight p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/15">
                <Ionicons name="notifications-outline" size={21} color="#F9C80E" />
              </View>
              <View className="min-w-0 flex-1">
                <Text selectable className="text-[14px] font-black text-white">
                  Smart notifications
                </Text>
                <Text selectable className="mt-0.5 text-[10px] font-semibold leading-4 text-brand-grayText">
                  Get reminders when films in your watchlist reach their release date.
                </Text>
              </View>
              {isUpdatingNotifications ? (
                <ActivityIndicator size="small" color="#F9C80E" />
              ) : (
                <Switch
                  disabled={!isSmartNotificationsSupported}
                  value={notificationPreferences.enabled}
                  onValueChange={(enabled) =>
                    void updateNotificationPreferences(
                      { ...notificationPreferences, enabled },
                      enabled
                    )
                  }
                  trackColor={{ false: '#334155', true: '#F9C80E' }}
                  thumbColor={notificationPreferences.enabled ? '#073445' : '#CBD5E1'}
                />
              )}
            </View>

            {!isSmartNotificationsSupported ? (
              <View className="flex-row items-center gap-2 rounded-xl border border-brand-yellow/20 bg-brand-yellow/10 px-3 py-2.5">
                <Ionicons name="information-circle-outline" size={16} color="#F9C80E" />
                <Text className="flex-1 text-[9px] font-bold leading-4 text-brand-grayText">
                  Android Expo Go does not support this module. It will be available in your development build and APK.
                </Text>
              </View>
            ) : null}

            <View className="h-px bg-white/10" />

            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-[11px] font-black text-white">Remind me one day before</Text>
                <Text className="mt-0.5 text-[9px] font-semibold leading-4 text-brand-grayText">
                  Receive an extra reminder at 6:00 PM the day before release.
                </Text>
              </View>
              <Switch
                disabled={!notificationPreferences.enabled || isUpdatingNotifications}
                value={notificationPreferences.enabled && notificationPreferences.dayBeforeRelease}
                onValueChange={(dayBeforeRelease) =>
                  void updateNotificationPreferences({
                    ...notificationPreferences,
                    dayBeforeRelease,
                  })
                }
                trackColor={{ false: '#334155', true: '#F9C80E' }}
                thumbColor={
                  notificationPreferences.enabled && notificationPreferences.dayBeforeRelease
                    ? '#073445'
                    : '#CBD5E1'
                }
              />
            </View>

            {notificationPreferences.enabled ? (
              <View className="gap-3 rounded-xl bg-brand-navy px-3 py-2.5">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={15} color="#F9C80E" />
                  <Text className="flex-1 text-[9px] font-bold text-brand-grayText">
                    {scheduledNotificationCount > 0
                      ? `${scheduledNotificationCount} release reminders are currently scheduled.`
                      : 'Future-dated watchlist films will be scheduled automatically.'}
                  </Text>
                </View>
                <TouchableOpacity
                  className="h-9 flex-row items-center justify-center gap-2 rounded-lg border border-brand-yellow/25 bg-brand-yellow/10"
                  onPress={() => void handleTestNotification()}
                  accessibilityLabel="Send a test notification"
                >
                  <Ionicons name="notifications" size={14} color="#F9C80E" />
                  <Text className="text-[9px] font-black text-brand-yellow">Send test notification</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View className="gap-3 rounded-2xl border border-slate-800/80 bg-brand-navyLight p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/15">
                <Ionicons name="cloud-upload-outline" size={21} color="#F9C80E" />
              </View>
              <View className="min-w-0 flex-1">
                <Text selectable className="text-[14px] font-black text-white">
                  Import from Letterboxd
                </Text>
                <Text selectable className="mt-0.5 text-[10px] font-semibold leading-4 text-brand-grayText">
                  Preview your Letterboxd export before adding watched films, diary logs, watchlist, and favorites.
                </Text>
              </View>
            </View>
            <View className="gap-2 rounded-xl border border-white/10 bg-brand-navy px-3 py-3">
              {['ZIP exports work best', 'Existing diary entries are merged by movie and date', 'Nothing is added until you confirm the preview'].map((item) => (
                <View key={item} className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle-outline" size={14} color="#F9C80E" />
                  <Text selectable className="min-w-0 flex-1 text-[9px] font-bold leading-4 text-brand-grayText">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            {lastLetterboxdImport ? (
              <View className="rounded-xl border border-brand-yellow/20 bg-brand-yellow/10 px-3 py-3">
                <Text selectable className="text-[10px] font-black uppercase tracking-wider text-brand-yellow">
                  Last import
                </Text>
                <Text selectable className="mt-1 text-[10px] font-bold leading-4 text-white">
                  {formatLetterboxdImportLines(lastLetterboxdImport).join('  |  ')}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              accessibilityLabel="Import Letterboxd export"
              activeOpacity={0.75}
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
              disabled={isImporting}
              onPress={handleLetterboxdImport}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color="#073445" />
              ) : (
                <Ionicons name="document-text-outline" size={18} color="#073445" />
              )}
              <Text className="text-[12px] font-black text-brand-navy">
                {isImporting ? 'Analyzing export...' : 'Choose Letterboxd export'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="gap-3 rounded-2xl border border-slate-800/80 bg-brand-navyLight p-4">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-brand-grayText">
              Data & privacy
            </Text>
            {AUTH_ENABLED ? (
              <View className="gap-3 rounded-xl border border-white/10 bg-brand-navy p-3">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/15">
                    {isCheckingCloudSync ? (
                      <ActivityIndicator size="small" color="#F9C80E" />
                    ) : (
                      <Ionicons
                        name={cloudSyncCheck?.ok ? 'cloud-done-outline' : 'cloud-outline'}
                        size={20}
                        color="#F9C80E"
                      />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-black text-white">Cloud sync</Text>
                    <Text className="mt-0.5 text-[9px] font-semibold leading-4 text-brand-grayText">
                      {CLOUD_SYNC_ENABLED
                        ? 'Your logs, watchlist, lists, and profile sync with your account.'
                        : 'Cloud sync is disabled for this build.'}
                    </Text>
                  </View>
                  <View
                    className={`rounded-full px-2.5 py-1 ${
                      CLOUD_SYNC_ENABLED ? 'bg-brand-yellow/15' : 'bg-white/10'
                    }`}
                  >
                    <Text
                      className={`text-[8px] font-black uppercase ${
                        CLOUD_SYNC_ENABLED ? 'text-brand-yellow' : 'text-brand-grayText'
                      }`}
                    >
                      {CLOUD_SYNC_ENABLED ? 'On' : 'Off'}
                    </Text>
                  </View>
                </View>

                {cloudSyncCheck ? (
                  <View
                    className={`rounded-xl border px-3 py-2.5 ${
                      cloudSyncCheck.ok
                        ? 'border-emerald-400/20 bg-emerald-500/10'
                        : 'border-red-400/25 bg-red-500/10'
                    }`}
                  >
                    <Text
                      selectable
                      className={`text-[9px] font-bold leading-4 ${
                        cloudSyncCheck.ok ? 'text-emerald-100' : 'text-red-100'
                      }`}
                    >
                      {cloudSyncCheck.message}
                    </Text>
                    <Text className="mt-1 text-[8px] font-semibold text-brand-grayText">
                      Checked {new Date(cloudSyncCheck.checkedAt).toLocaleString()}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  className={`h-10 flex-row items-center justify-center gap-2 rounded-xl ${
                    session?.user.id && !isCheckingCloudSync
                      ? 'border border-brand-yellow/25 bg-brand-yellow/10'
                      : 'bg-white/5'
                  }`}
                  activeOpacity={0.75}
                  disabled={!session?.user.id || isCheckingCloudSync}
                  onPress={handleCheckCloudSync}
                  accessibilityLabel="Check cloud sync"
                >
                  <Ionicons name="pulse-outline" size={15} color="#F9C80E" />
                  <Text className="text-[9px] font-black uppercase text-brand-yellow">
                    {isCheckingCloudSync ? 'Checking...' : 'Check cloud sync'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity
              className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-brand-navy p-3"
              activeOpacity={0.75}
              onPress={handleExportData}
              disabled={isExporting}
              accessibilityLabel="Export SwipeLog data"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/15">
                {isExporting ? (
                  <ActivityIndicator size="small" color="#F9C80E" />
                ) : (
                  <Ionicons name="share-outline" size={20} color="#F9C80E" />
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] font-black text-white">Export your data</Text>
                <Text className="mt-0.5 text-[9px] font-semibold leading-4 text-brand-grayText">
                  Share a JSON backup of your profile, logs, ratings, lists, and watchlist.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#A0AEC0" />
            </TouchableOpacity>
          </View>

          <View className="gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-red-300">
              Reset options
            </Text>
            {AUTH_ENABLED ? (
              <TouchableOpacity
                className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-brand-navy p-3"
                activeOpacity={0.75}
                onPress={confirmSignOut}
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={19} color="#F9C80E" />
                <View className="min-w-0 flex-1">
                  <Text className="text-[12px] font-black text-white">Sign out</Text>
                  <Text numberOfLines={2} className="text-[9px] font-semibold leading-3 text-brand-grayText">
                    {session?.user.email ?? 'Current account'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-brand-navy p-3"
              activeOpacity={0.75}
              onPress={confirmResetProfile}
              accessibilityLabel="Reset profile to defaults"
            >
              <Ionicons name="refresh-outline" size={19} color="#F9C80E" />
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] font-black text-white">Reset profile</Text>
                <Text className="text-[9px] font-semibold text-brand-grayText">
                  Keep movie data, reset your profile details.
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center gap-3 rounded-xl border border-red-400/25 bg-red-500/10 p-3"
              activeOpacity={0.75}
              onPress={confirmClearMovieData}
              accessibilityLabel="Delete all movie data"
            >
              <Ionicons name="trash-outline" size={19} color="#FCA5A5" />
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] font-black text-red-100">Delete all movie data</Text>
                <Text className="text-[9px] font-semibold text-red-200/65">
                  Permanently remove logs, ratings, lists, and watchlist.
                </Text>
              </View>
            </TouchableOpacity>
            {AUTH_ENABLED ? (
              <TouchableOpacity
                className="mt-2 flex-row items-center gap-3 rounded-xl border border-red-500/40 bg-red-600/20 p-3"
                activeOpacity={0.75}
                onPress={confirmDeleteAccount}
                accessibilityLabel="Delete account"
              >
                <Ionicons name="warning-outline" size={19} color="#F87171" />
                <View className="min-w-0 flex-1">
                  <Text className="text-[12px] font-black text-red-100">Delete account</Text>
                  <Text className="text-[9px] font-semibold text-red-200/65">
                    Permanently delete your account and all data.
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['bottom', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: getTabScreenBottomInset(insets.bottom) }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleProfileRefresh}
            colors={['#F9C80E']}
            progressBackgroundColor="#073445"
            tintColor="#F9C80E"
          />
        }
      >
        {/* Profile Header Wrapper */}
        <View className="relative">
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} className="h-44 w-full" resizeMode="cover" />
          ) : (
            <View className="h-44 w-full items-center justify-center bg-brand-navyLight">
              <Ionicons name="image-outline" size={34} color="#334155" />
            </View>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(5,13,32,0)', 'rgba(15,25,54,0.62)']}
            className="absolute bottom-0 left-0 right-0 h-16"
          />

          {/* Back Button Overlay - Shifted dynamically to avoid top notches */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 w-9 h-9 rounded-full bg-brand-navy/60 items-center justify-center border border-white/10"
            style={{ top: insets.top > 0 ? insets.top + 8 : 16 }}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>

          {/* Settings Button Overlay - Shifted dynamically to avoid top notches */}
          <TouchableOpacity
            onPress={openProfileSettings}
            className="absolute right-4 w-9 h-9 rounded-full bg-brand-navy/60 items-center justify-center border border-white/10"
            style={{ top: insets.top > 0 ? insets.top + 8 : 16 }}
            activeOpacity={0.7}
            accessibilityLabel="Open profile settings"
          >
            <Ionicons name="settings-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* Profile details band */}
        <View className="relative border-b border-slate-800/30 bg-brand-navyLight px-4 pb-3 pt-4">
          <ScalePressable
            onPress={openProfileSettings}
            pressedScale={0.96}
            className="absolute left-4 -top-14 z-20 h-32 w-32 overflow-hidden rounded-full border-4 border-brand-navyLight bg-slate-700"
            accessibilityLabel="Edit profile picture"
          >
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-slate-700">
                <Ionicons name="person" size={48} color="#A0AEC0" />
              </View>
            )}
          </ScalePressable>

          <View className="min-h-[84px] pl-[138px]">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-xl font-bold tracking-wide text-white">
                  {profile.name || 'Set up your profile'}
                </Text>
                <Text numberOfLines={1} className="mt-0.5 text-xs font-semibold text-brand-grayText">
                  {profile.username ? `@${profile.username}` : 'Add a username'}
                </Text>
              </View>
              <ScalePressable
                onPress={openProfileSettings}
                pressedScale={0.96}
                className="mt-0.5 rounded-md bg-brand-yellow px-3 py-1.5"
                accessibilityLabel="Edit profile"
              >
                <Text className="text-[10px] font-black text-brand-navy">Edit</Text>
              </ScalePressable>
            </View>

            <TouchableOpacity
              activeOpacity={profile.bio ? 1 : 0.75}
              onPress={profile.bio ? undefined : openProfileSettings}
              accessibilityLabel={profile.bio ? 'Profile bio' : 'Add a profile bio'}
            >
              <Text
                selectable={Boolean(profile.bio)}
                numberOfLines={2}
                className={`mt-2 text-[11px] font-medium leading-4 ${
                  profile.bio ? 'text-brand-grayText' : 'text-brand-grayText/70'
                }`}
              >
                {profile.bio || 'Add a bio to tell people what kind of films define your taste.'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-2 px-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[17px] font-bold tracking-wide text-white">Favorite four</Text>
            <TouchableOpacity
              onPress={openProfileSettings}
              accessibilityLabel="Edit favorite four"
            >
              <Text className="text-[10px] font-black text-brand-yellow">Edit</Text>
            </TouchableOpacity>
          </View>
          {featuredMovies.length > 0 ? (
            <View className="flex-row gap-2">
              {featuredMovies.map((movie) => (
                <ScalePressable
                  key={movie.id}
                  className="min-w-0 flex-1"
                  pressedScale={0.985}
                  pressedTranslateY={-3}
                  onPress={() => openMovie(movie)}
                  accessibilityLabel={`Open ${movie.title}`}
                >
                  <View className="aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-slate-800">
                    {movie.image ? (
                      <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons name="film-outline" size={22} color="#A0AEC0" />
                      </View>
                    )}
                  </View>
                </ScalePressable>
              ))}
              {Array.from({ length: Math.max(0, 4 - featuredMovies.length) }).map((_, index) => (
                <ScalePressable
                  key={`empty-${index}`}
                  className="min-w-0 flex-1"
                  pressedScale={0.985}
                  pressedTranslateY={-3}
                  onPress={openProfileSettings}
                  accessibilityLabel="Add a favorite film"
                >
                  <View className="aspect-[2/3] items-center justify-center rounded-lg border border-dashed border-white/15 bg-brand-navyLight">
                    <Ionicons name="add" size={23} color="#A0AEC0" />
                  </View>
                </ScalePressable>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.75}
              className="items-center justify-center rounded-xl border border-dashed border-white/15 bg-brand-navyLight px-4 py-7"
              onPress={openProfileSettings}
              accessibilityLabel="Choose favorite four films"
            >
              <Ionicons name="heart-outline" size={24} color="#F9C80E" />
              <Text className="mt-2 text-[11px] font-black text-white">Choose your favorite four</Text>
              <Text className="mt-1 text-center text-[9px] font-semibold text-brand-grayText">
                Feature the films that best represent your taste.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-4 gap-3 px-4">
          {[
            [
              { icon: 'film-outline', label: 'Watched', value: watchedCount, subtitle: 'Movies' },
              { icon: 'book-outline', label: 'Diary', value: watchHistory.length, subtitle: 'Entries' },
            ],
            [
              { icon: 'bookmark-outline', label: 'Watchlist', value: watchlistCount, subtitle: 'Movies' },
              {
                icon: 'star-outline',
                label: 'Average',
                value: averageRating ? averageRating.toFixed(1) : '-',
                subtitle: 'Out of 5',
              },
            ],
          ].map((row, rowIndex) => (
            <View key={`stats-row-${rowIndex}`} className="flex-row gap-3">
              {row.map((stat) => (
                <ScalePressable
                  key={stat.label}
                  className="h-[104px] flex-1 rounded-2xl border border-slate-800/80 bg-brand-navyLight px-3.5 py-3"
                  pressedScale={0.98}
                  shadowFeedback
                  onPress={openStatistics}
                  accessibilityLabel={`Open ${stat.label}`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowRadius: 16,
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name={stat.icon as keyof typeof Ionicons.glyphMap} size={13} color="#A0AEC0" />
                    <Text className="text-[9px] font-black uppercase tracking-wider text-brand-grayText">
                      {stat.label}
                    </Text>
                  </View>
                  <View className="flex-1 justify-center">
                    <View className="flex-row items-baseline justify-center gap-1">
                      {stat.label === 'Average' ? (
                        <Ionicons name="star" size={16} color="#F9C80E" />
                      ) : null}
                      <Text className="text-center text-[26px] font-black text-white">{stat.value}</Text>
                    </View>
                  </View>
                  <Text className="text-center text-[9px] font-bold uppercase tracking-wider text-brand-grayText">
                    {stat.subtitle}
                  </Text>
                </ScalePressable>
              ))}
            </View>
          ))}
        </View>

        <View className="mt-6 px-4">
          <Text className="mb-3 text-[17px] font-bold tracking-wide text-white">Your activity</Text>
          <TouchableOpacity
            className="rounded-xl border border-slate-800/80 bg-brand-navyLight p-4"
            activeOpacity={0.8}
            onPress={openStatistics}
            accessibilityLabel="Open diary activity"
          >
            <View className="mb-4 flex-row items-end justify-between">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-brand-grayText">
                  Estimated time watched
                </Text>
                <Text className="mt-1 text-xl font-black text-white">{timeSpentStr}</Text>
              </View>
              <Text className="text-[9px] font-semibold text-brand-grayText">
                {runtimeCoverage}/{watchHistory.length} entries with runtime
              </Text>
            </View>

            <Text className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-grayText">
              Rating distribution
            </Text>
            <View className="gap-2">
              {ratingDistribution.map((item) => (
                <View key={item.rating} className="flex-row items-center gap-2">
                  <Text className="w-5 text-[10px] font-black text-brand-yellow">{item.rating}</Text>
                  <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <View
                      className="h-full rounded-full bg-brand-yellow"
                      style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
                    />
                  </View>
                  <Text className="w-5 text-right text-[9px] font-bold text-brand-grayText">
                    {item.count}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </View>

        {topGenres.length > 0 ? (
          <View className="mt-6 px-4">
            <Text className="mb-3 text-[17px] font-bold tracking-wide text-white">Favorite genres</Text>
            <View className="flex-row flex-wrap gap-2">
              {topGenres.map((genre, index) => (
                <View
                  key={genre.id}
                  className="flex-row items-center gap-2 rounded-full border border-brand-yellow/20 bg-brand-yellow/10 px-3 py-2"
                >
                  <Text className="text-[10px] font-black text-brand-yellow">#{index + 1}</Text>
                  <Text className="text-[11px] font-bold text-white">{genre.name}</Text>
                  <Text className="text-[9px] font-bold text-brand-grayText">{genre.count}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="px-4 mt-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[17px] font-bold tracking-wide text-white">Favorite films</Text>
            <TouchableOpacity onPress={() => openLibraryTab('Logs')} accessibilityLabel="Open favorite films">
              <Text className="text-[10px] font-black text-brand-yellow">View logs</Text>
            </TouchableOpacity>
          </View>
          {favoritesData.length > 0 ? (
            <HorizontalList data={favoritesData} onPressMovie={openMovie} />
          ) : (
            <Text className="text-brand-grayText text-xs italic py-2">No favorites marked yet.</Text>
          )}
        </View>

        {/* Recently Watched Movies Section */}
        <View className="px-4 mt-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[17px] font-bold tracking-wide text-white">Recent diary entries</Text>
            <TouchableOpacity onPress={() => openLibraryTab('Diary')} accessibilityLabel="Open diary">
              <Text className="text-[10px] font-black text-brand-yellow">View diary</Text>
            </TouchableOpacity>
          </View>
          {recentlyWatchedData.length > 0 ? (
            <HorizontalList data={recentlyWatchedData} onPressMovie={openMovie} />
          ) : (
            <Text className="text-brand-grayText text-xs italic py-2">No diary entries yet.</Text>
          )}
        </View>

        {/* Recent Reviews Card */}
        <View className="px-4 mt-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-white text-[17px] font-bold tracking-wide">
              Recent Reviews
            </Text>
            {lastReviewedEntry ? (
              <TouchableOpacity
                onPress={() => router.push('/reviews' as never)}
                accessibilityLabel="See all reviews"
              >
                <Text className="text-[10px] font-black text-brand-yellow">See all</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {lastReviewedEntry ? (
            <TouchableOpacity
              className="bg-brand-navyLight border border-slate-800/80 rounded-xl p-4 flex-row"
              activeOpacity={0.8}
              onPress={() => openMovie({ ...lastReviewedEntry.movie, rating: lastReviewedEntry.rating })}
              accessibilityLabel={`Open ${lastReviewedEntry.movie.title}`}
            >
              {/* Poster Image (Left) */}
              <View className="w-20 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 border border-slate-800/60">
                {lastReviewedEntry.movie.image ? (
                  <Image
                    source={{ uri: lastReviewedEntry.movie.image }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                  </View>
                )}
              </View>

              {/* Review info (Right) */}
              <View className="flex-1 pl-4">
                {/* Header: review by user & Stars */}
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-brand-grayText">
                    review by{' '}
                    <Text className="text-brand-yellow font-bold">
                      {profile.username ? `@${profile.username}` : 'you'}
                    </Text>
                  </Text>
                  <HalfStarRating rating={lastReviewedEntry.rating} size={10} />
                </View>

                {/* Movie Title */}
                <Text className="text-white text-[13px] font-bold mt-1 tracking-wide">
                  {lastReviewedEntry.movie.title}
                </Text>

                {/* Review Text */}
                <Text className="text-brand-grayText text-xs mt-1.5 leading-relaxed" numberOfLines={4}>
                  {lastReviewedEntry.note}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="bg-brand-navyLight border border-slate-800/80 rounded-xl p-4 items-center justify-center">
              <Ionicons name="star-outline" size={24} color="#A0AEC0" className="opacity-60 mb-2" />
              <Text className="text-brand-grayText text-xs italic text-center">
                No reviews yet. Add a note when logging a movie to see it here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
