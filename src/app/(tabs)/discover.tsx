/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally mutable. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useMovies } from '@/context/MovieContext';
import { tmdbService } from '@/services/tmdb';
import {
  buildTasteProfile,
  PersonalizedCandidate,
  rankDiscoveryCandidates,
} from '@/services/discovery-ranking';
import FeedbackToast from '@/components/FeedbackToast';
import HalfStarRating from '@/components/HalfStarRating';
import {
  getTodayWatchDateInput,
  toWatchDateTime,
  validateWatchDate,
  WATCH_DATE_HELP_TEXT,
} from '@/utils/watch-date';

const SWIPE_THRESHOLD = 105;
const WATCHED_SWIPE_THRESHOLD = 120;

const getYear = (date?: string) => date?.match(/\d{4}/)?.[0] ?? '';

type DiscoveryCandidate = PersonalizedCandidate;

const interleaveMovies = <T,>(groups: T[][]): T[] => {
  const result: T[] = [];
  const longestGroup = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < longestGroup; index += 1) {
    groups.forEach((group) => {
      if (group[index]) result.push(group[index]);
    });
  }

  return result;
};

export default function DiscoverScreen() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    addWatchEntry,
    clearDiscoveryHistory,
    discoverySignals,
    filterDiscoveryCandidates,
    movies,
    recordDiscoveryEvent,
  } = useMovies();
  const [deck, setDeck] = useState<DiscoveryCandidate[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loggingMovie, setLoggingMovie] = useState<DiscoveryCandidate | null>(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftNote, setDraftNote] = useState('');
  const [draftWatchedAt, setDraftWatchedAt] = useState(getTodayWatchDateInput);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const didInitialLoad = useRef(false);
  const loadingMoreLock = useSharedValue(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const activeMovie = deck[0];
  const nextMovie = deck[1];
  const watchedDateValidation = useMemo(() => validateWatchDate(draftWatchedAt), [draftWatchedAt]);
  const cardWidth = Math.min(width - 32, 390);
  const cardHeight = Math.max(360, Math.min(530, height - 330));
  const recommendationSources = useMemo(
    () =>
      [...movies]
        .filter((movie) => movie.isLiked || movie.rating >= 4)
        .sort((a, b) => {
          if (a.isLiked !== b.isLiked) return a.isLiked ? -1 : 1;
          return b.rating - a.rating;
        })
        .slice(0, 3),
    [movies]
  );
  const tasteProfile = useMemo(
    () => buildTasteProfile(movies, discoverySignals),
    [discoverySignals, movies]
  );

  const loadPage = useCallback(
    async (pageToLoad: number, replace = false) => {
      if (replace) setLoading(true);
      else {
        if (loadingMoreLock.value) return;
        loadingMoreLock.value = true;
      }

      try {
        setLoadError(false);
        const popularPromise = tmdbService.discoverMovies(pageToLoad);
        const trendingPromise = tmdbService.getTrendingMovies('week');
        const tastePromise = tmdbService.discoverMoviesByGenres(
          tasteProfile.topGenres.map((genre) => genre.id),
          pageToLoad
        );
        const recommendationPromises = recommendationSources.map(async (sourceMovie) => {
          const recommendations = await tmdbService.getMovieRecommendations(sourceMovie.id);
          return recommendations.map<Omit<DiscoveryCandidate, 'personalScore'>>((movie) => ({
            ...movie,
            reason: `Because you liked ${sourceMovie.title}`,
            source: 'recommended',
          }));
        });

        const [popularMovies, trendingMovies, tasteMovies, recommendationGroups] = await Promise.all([
          popularPromise,
          trendingPromise,
          tastePromise,
          Promise.all(recommendationPromises),
        ]);

        const recommended = interleaveMovies(recommendationGroups);
        const taste = tasteMovies.map<Omit<DiscoveryCandidate, 'personalScore'>>((movie) => ({
          ...movie,
          reason: 'Chosen from your taste profile',
          source: 'taste',
        }));
        const trending = trendingMovies.map<Omit<DiscoveryCandidate, 'personalScore'>>((movie) => ({
          ...movie,
          reason: 'Trending this week',
          source: 'trending',
        }));
        const popular = popularMovies.map<Omit<DiscoveryCandidate, 'personalScore'>>((movie) => ({
          ...movie,
          reason: 'Popular discovery pick',
          source: 'popular',
        }));
        const candidates = [...recommended, ...taste, ...trending, ...popular];
        const unique = Array.from(new Map(candidates.map((movie) => [movie.id, movie])).values());
        const ranked = rankDiscoveryCandidates(unique, tasteProfile);
        const filtered = filterDiscoveryCandidates(ranked) as DiscoveryCandidate[];

        setDeck((current) => {
          const combined = replace ? filtered : [...current, ...filtered];
          return Array.from(new Map(combined.map((movie) => [movie.id, movie])).values());
        });
        setPage(pageToLoad);
        setLoadError(filtered.length === 0);
      } catch (error) {
        console.error('[Discover] Failed to load movies:', error);
        setLoadError(true);
      } finally {
        setLoading(false);
        loadingMoreLock.value = false;
      }
    },
    [filterDiscoveryCandidates, loadingMoreLock, recommendationSources, tasteProfile]
  );

  useEffect(() => {
    if (didInitialLoad.current) {
      return;
    }

    didInitialLoad.current = true;
    void loadPage(1, true);
  }, [loadPage]);

  const finishSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (!activeMovie) return;
      translateX.value = 0;
      translateY.value = 0;
      setDeck((current) => current.slice(1));

      requestAnimationFrame(() => {
        recordDiscoveryEvent(activeMovie, direction === 'right' ? 'liked' : 'skipped');
        if (deck.length <= 10 && !loadingMoreLock.value) {
          void loadPage(page + 1);
        }
      });
    },
    [activeMovie, deck.length, loadPage, loadingMoreLock, page, recordDiscoveryEvent, translateX, translateY]
  );

  const triggerSwipe = (direction: 'left' | 'right') => {
    if (!activeMovie) return;
    translateX.value = withTiming(direction === 'right' ? width * 1.3 : -width * 1.3, { duration: 180 }, () => {
      runOnJS(finishSwipe)(direction);
    });
  };

  const openWatchedLog = () => {
    if (!activeMovie) return;
    setLoggingMovie(activeMovie);
    setDraftRating(0);
    setDraftNote('');
    setDraftWatchedAt(getTodayWatchDateInput());
    translateX.value = withSpring(0, { damping: 18, stiffness: 170 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 170 });
  };

  const confirmWatchedLog = () => {
    if (!loggingMovie || watchedDateValidation.error) return;
    addWatchEntry(loggingMovie, draftRating, draftNote, toWatchDateTime(watchedDateValidation.dateKey));
    recordDiscoveryEvent(loggingMovie, 'watched');
    setFeedbackMessage(`${loggingMovie.title} logged to Diary`);
    setDeck((current) => current.filter((movie) => movie.id !== loggingMovie.id));
    setLoggingMovie(null);
    if (deck.length <= 10 && !loadingMoreLock.value) {
      void loadPage(page + 1);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    translateX.value = 0;
    translateY.value = 0;
    try {
      await loadPage(1, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openMovie = () => {
    if (!activeMovie) return;
    recordDiscoveryEvent(activeMovie, 'opened');
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: activeMovie.id,
        title: activeMovie.title,
        year: getYear(activeMovie.date),
        image: activeMovie.image,
        overview: activeMovie.overview ?? '',
        rating: `${activeMovie.rating ?? 0}`,
      },
    } as never);
  };

  const panGesture = Gesture.Pan()
    .minDistance(12)
    .onUpdate((event) => {
      const isVertical = Math.abs(event.translationY) > Math.abs(event.translationX);
      translateX.value = isVertical ? event.translationX * 0.12 : event.translationX;
      translateY.value = isVertical ? Math.max(0, event.translationY) : event.translationY * 0.12;
    })
    .onEnd((event) => {
      const isDownwardSwipe =
        event.translationY > WATCHED_SWIPE_THRESHOLD &&
        Math.abs(event.translationY) > Math.abs(event.translationX);

      if (isDownwardSwipe) {
        runOnJS(openWatchedLog)();
      } else if (Math.abs(translateX.value) > SWIPE_THRESHOLD || Math.abs(event.velocityX) > 850) {
        const direction = translateX.value >= 0 ? 'right' : 'left';
        translateX.value = withTiming(direction === 'right' ? width * 1.3 : -width * 1.3, { duration: 180 }, () => {
          runOnJS(finishSwipe)(direction);
        });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 170 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 170 });
      }
    });

  const activeCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      Math.max(Math.abs(translateX.value) / SWIPE_THRESHOLD, translateY.value / WATCHED_SWIPE_THRESHOLD)
    );
    return {
      opacity: interpolate(progress, [0, 1], [0.72, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(progress, [0, 1], [0.96, 1], Extrapolation.CLAMP) },
        { translateY: interpolate(progress, [0, 1], [10, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP),
  }));

  const watchedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [30, WATCHED_SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const cardMeta = useMemo(() => {
    if (!activeMovie) return '';
    return getYear(activeMovie.date);
  }, [activeMovie]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-[#002B3A]" edges={['top', 'left', 'right']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingBottom: 92 + insets.bottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#F9C80E']}
              progressBackgroundColor="#073445"
              tintColor="#F9C80E"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between pb-3 pt-2">
            <View>
              <Text selectable className="text-[26px] font-black text-white">Discover</Text>
              <Text selectable className="text-[11px] font-semibold text-white/50">
                Find your next movie
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <Ionicons name="layers-outline" size={13} color="#F9C80E" />
              <Text selectable className="text-[10px] font-black text-white">{deck.length}</Text>
            </View>
          </View>

          {tasteProfile.topGenres.length > 0 ? (
            <View className="mb-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {tasteProfile.topGenres.slice(0, 3).map((genre) => (
                  <View key={genre.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    <Text selectable className="text-[9px] font-black text-white/70">{genre.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View className="flex-1 items-center justify-start">
            {loading ? (
              <ActivityIndicator size="large" color="#F9C80E" />
            ) : activeMovie ? (
              <View style={{ height: cardHeight, width: cardWidth }}>
                {nextMovie ? (
                  <Animated.View
                    className="absolute inset-x-2 bottom-0 top-3 overflow-hidden rounded-[28px] border border-white/8 bg-brand-navyLight"
                    style={[{ borderCurve: 'continuous' }, nextCardStyle]}
                  >
                    {nextMovie.image ? <Image source={{ uri: nextMovie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" /> : null}
                  </Animated.View>
                ) : null}

                <GestureDetector gesture={panGesture}>
                  <Animated.View
                    key={activeMovie.id}
                    className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 bg-brand-navyLight"
                    style={[{ borderCurve: 'continuous', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }, activeCardStyle]}
                  >
                    <Pressable className="flex-1" onPress={openMovie}>
                      {activeMovie.image ? (
                        <Image source={{ uri: activeMovie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
                      ) : (
                        <View className="flex-1 items-center justify-center bg-brand-navyLight">
                          <Ionicons name="film-outline" size={64} color="#A0AEC0" />
                        </View>
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(5,8,20,0.72)', 'rgba(5,8,20,0.98)']}
                        locations={[0, 0.35, 1]}
                        className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-24"
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="min-w-0 flex-1">
                            <Text selectable numberOfLines={1} className="text-[9px] font-black uppercase tracking-wider text-brand-yellow">
                              {activeMovie.reason}
                            </Text>
                            <Text selectable numberOfLines={2} className="mt-1 text-[25px] font-black leading-8 text-white">
                              {activeMovie.title}
                            </Text>
                          </View>
                          {activeMovie.rating ? (
                            <View className="h-14 w-14 items-center justify-center rounded-2xl border border-brand-yellow/30 bg-brand-yellow/15">
                              <Ionicons name="star" size={16} color="#F9C80E" />
                              <Text className="mt-0.5 text-[13px] font-black text-white">
                                {activeMovie.rating.toFixed(1)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {cardMeta ? (
                          <Text selectable className="mt-2 text-[10px] font-extrabold uppercase tracking-wider text-white/55">
                            {cardMeta}
                          </Text>
                        ) : null}
                        <Text selectable numberOfLines={2} className="mt-2 text-[11px] font-medium leading-5 text-white/70">
                          {activeMovie.overview || 'No overview is available for this movie yet.'}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    <Animated.View className="absolute left-5 top-6 rotate-[-10deg] rounded-lg border-4 border-red-400 px-3 py-1.5" style={skipStyle}>
                      <Text className="text-xl font-black uppercase text-red-300">Skip</Text>
                    </Animated.View>
                    <Animated.View className="absolute right-5 top-6 rotate-[10deg] rounded-lg border-4 border-brand-yellow px-3 py-1.5" style={likeStyle}>
                      <Text className="text-xl font-black uppercase text-brand-yellow">Save</Text>
                    </Animated.View>
                    <Animated.View
                      className="absolute left-1/2 top-6 -translate-x-1/2 items-center rounded-xl border-4 border-brand-yellow bg-black/35 px-4 py-2"
                      style={watchedStyle}
                    >
                      <Ionicons name="eye" size={24} color="#F9C80E" />
                      <Text className="mt-1 text-xs font-black uppercase text-brand-yellow">
                        Already watched
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              </View>
            ) : (
              <View className="items-center gap-4 px-8">
                <Ionicons name="sparkles-outline" size={58} color="#F9C80E" />
                <Text selectable className="text-center text-xl font-black text-white">
                  {loadError ? 'Could not load movies' : 'You reached the end'}
                </Text>
                <Text selectable className="text-center text-xs font-medium leading-5 text-white/55">
                  {loadError
                    ? 'Check your connection and try loading the deck again.'
                    : 'Load more movies or reset skipped discovery choices.'}
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    className="rounded-xl border border-white/15 bg-white/8 px-4 py-3"
                    onPress={() => loadPage(loadError ? 1 : page + 1, loadError)}
                  >
                    <Text className="text-xs font-black text-white">
                      {loadError ? 'Try Again' : 'Load More'}
                    </Text>
                  </Pressable>
                  <Pressable
                    className="rounded-xl bg-brand-yellow px-4 py-3"
                    onPress={() => {
                      clearDiscoveryHistory();
                      loadPage(1, true);
                    }}
                  >
                    <Text className="text-xs font-black text-brand-navy">Reset Deck</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {activeMovie ? (
            <>
          <View className="mt-4 w-full flex-row items-start justify-center gap-5">
            <Pressable
              accessibilityLabel="Skip movie"
              className="items-center gap-1.5"
              onPress={() => triggerSwipe('left')}
            >
              <View className="h-14 w-14 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10">
                <Ionicons name="close" size={27} color="#FCA5A5" />
              </View>
              <Text className="text-[9px] font-black uppercase tracking-wider text-red-300/80">Skip</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Log movie as watched"
              className="items-center gap-1.5"
              onPress={openWatchedLog}
            >
              <View className="h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/7">
                <Ionicons name="eye-outline" size={24} color="#FFFFFF" />
              </View>
              <Text className="text-[9px] font-black uppercase tracking-wider text-white/55">Watched</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Save movie to watchlist"
              className="items-center gap-1.5"
              onPress={() => triggerSwipe('right')}
            >
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow">
                <Ionicons name="bookmark" size={23} color="#051E2A" />
              </View>
              <Text className="text-[9px] font-black uppercase tracking-wider text-brand-yellow">Save</Text>
            </Pressable>
          </View>
          <Text className="mt-3 text-center text-[9px] font-semibold text-white/35">
            Swipe left to skip, right to save, or down to log
          </Text>
            </>
          ) : null}
        </ScrollView>

        <Modal
          animationType="fade"
          onRequestClose={() => setLoggingMovie(null)}
          statusBarTranslucent
          transparent
          visible={loggingMovie !== null}
        >
          <View className="flex-1 items-center justify-center bg-black/70 px-6">
            <Pressable className="absolute inset-0" onPress={() => setLoggingMovie(null)} />
            <ScrollView
              className="w-full max-w-[360px]"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="w-full gap-4 rounded-2xl border border-white/10 bg-[#073746] p-4">
                <View className="flex-row items-center justify-between">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-brand-yellow">
                      Already watched
                    </Text>
                    <Text numberOfLines={1} className="mt-1 text-[17px] font-black text-white">
                      {loggingMovie?.title}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close watched log"
                    className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                    onPress={() => setLoggingMovie(null)}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-white/45">
                      Your rating
                    </Text>
                    <View className="flex-row items-center gap-1 rounded-full bg-brand-yellow/15 px-2.5 py-1">
                      <Ionicons name="star" size={11} color="#F9C80E" />
                      <Text className="text-[10px] font-black text-brand-yellow">
                        {draftRating > 0 ? draftRating.toFixed(1) : 'Not rated'}
                      </Text>
                    </View>
                  </View>
                  <HalfStarRating
                    rating={draftRating}
                    onChange={(value) => setDraftRating(draftRating === value ? 0 : value)}
                    size={29}
                  />
                </View>

                <TextInput
                  value={draftWatchedAt}
                  onChangeText={setDraftWatchedAt}
                  placeholder="DD-MM-YYYY"
                  placeholderTextColor="#8EA1A8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  className={`h-11 rounded-xl border px-3 text-[13px] font-bold text-white ${
                    watchedDateValidation.error ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-white/5'
                  }`}
                />
                <Text selectable className={`text-[9px] font-bold ${watchedDateValidation.error ? 'text-red-200' : 'text-white/45'}`}>
                  {watchedDateValidation.error ?? WATCH_DATE_HELP_TEXT}
                </Text>
                <TextInput
                  value={draftNote}
                  onChangeText={setDraftNote}
                  placeholder="Add a short note..."
                  placeholderTextColor="#8EA1A8"
                  multiline
                  maxLength={280}
                  className="min-h-[84px] rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] font-medium text-white"
                  style={{ textAlignVertical: 'top' }}
                />

                <Pressable
                  accessibilityLabel="Save watched log"
                  className={`h-12 flex-row items-center justify-center gap-2 rounded-xl ${
                    watchedDateValidation.error ? 'bg-brand-yellow/40' : 'bg-brand-yellow'
                  }`}
                  disabled={Boolean(watchedDateValidation.error)}
                  onPress={confirmWatchedLog}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#073445" />
                  <Text className="text-[12px] font-black text-brand-navy">Save to diary</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Modal>
        <FeedbackToast message={feedbackMessage} onDismiss={() => setFeedbackMessage(null)} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
