/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally mutable. */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';
import { useMovieActions, useMovieState } from '@/context/MovieContext';
import { useUserProfile } from '@/hooks/use-user-profile';
import { tmdbService } from '@/services/tmdb';
import {
  buildTasteProfile,
  PersonalizedCandidate,
  rankDiscoveryCandidates,
} from '@/services/discovery-ranking';
import { getCountBucket, trackEvent } from '@/services/analytics';
import FeedbackToast from '@/components/FeedbackToast';
import HalfStarRating from '@/components/HalfStarRating';
import WatchedDatePicker from '@/components/WatchedDatePicker';
import {
  getTodayWatchDateInput,
  toWatchDateTime,
  validateWatchDate,
} from '@/utils/watch-date';
import { getBottomSheetPadding, getTabScreenBottomInset } from '@/constants/layout';

const SWIPE_THRESHOLD = 105;
const WATCHED_SWIPE_THRESHOLD = 120;
const DISCOVER_HORIZONTAL_PADDING = 32;
const DISCOVER_HEADER_RESERVE = 78;
const DISCOVER_GENRE_RESERVE = 45;
const DISCOVER_ACTION_RESERVE = 72;
const DISCOVER_VERTICAL_GAP = 18;

const getYear = (date?: string) => date?.match(/\d{4}/)?.[0] ?? '';

type DiscoveryCandidate = PersonalizedCandidate;
type TriageBucket = 'interested' | 'passed' | 'watched';

interface TriageSessionItem {
  movie: DiscoveryCandidate;
  bucket: TriageBucket;
  createdAt: string;
}

interface WatchedDraft {
  movieId: string;
  rating: number;
  note: string;
  watchedAt: string;
  isFavorite: boolean;
}

const createDefaultWatchedDraft = (movieId: string): WatchedDraft => ({
  movieId,
  rating: 0,
  note: '',
  watchedAt: getTodayWatchDateInput(),
  isFavorite: false,
});

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

export interface DiscoveryCardRef {
  triggerSwipe: (direction: 'left' | 'right') => void;
  openWatchedLog: () => void;
}

interface DiscoveryCardProps {
  movie: DiscoveryCandidate;
  isTop: boolean;
  isNext: boolean;
  cardWidth: number;
  cardHeight: number;
  swipeProgressX: SharedValue<number>;
  swipeProgressY: SharedValue<number>;
  onSwipeComplete: (direction: 'left' | 'right' | 'down') => void;
  onOpenMovie: (movie: DiscoveryCandidate) => void;
}

const DiscoveryCard = forwardRef<DiscoveryCardRef, DiscoveryCardProps>(
  ({ movie, isTop, isNext, cardWidth, cardHeight, swipeProgressX, swipeProgressY, onSwipeComplete, onOpenMovie }, ref) => {
    const { width } = useWindowDimensions();
    const isCompactCard = cardHeight < 430;
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      triggerSwipe: (direction: 'left' | 'right') => {
        if (!isTop) return;
        translateX.value = withTiming(direction === 'right' ? width * 1.3 : -width * 1.3, { duration: 180 }, () => {
          runOnJS(onSwipeComplete)(direction);
        });
        swipeProgressX.value = withTiming(direction === 'right' ? width * 1.3 : -width * 1.3, { duration: 180 });
      },
      openWatchedLog: () => {
        if (!isTop) return;
        translateY.value = withTiming(width * 1.1, { duration: 180 }, () => {
          runOnJS(onSwipeComplete)('down');
        });
        swipeProgressY.value = withTiming(WATCHED_SWIPE_THRESHOLD, { duration: 180 });
      },
    }));

    const panGesture = Gesture.Pan()
      .enabled(isTop)
      .minDistance(12)
      .onUpdate((event) => {
        const isVertical = Math.abs(event.translationY) > Math.abs(event.translationX);
        translateX.value = isVertical ? event.translationX * 0.12 : event.translationX;
        translateY.value = isVertical ? Math.max(0, event.translationY) : event.translationY * 0.12;
        swipeProgressX.value = translateX.value;
        swipeProgressY.value = translateY.value;
      })
      .onEnd((event) => {
        const isDownwardSwipe =
          event.translationY > WATCHED_SWIPE_THRESHOLD &&
          Math.abs(event.translationY) > Math.abs(event.translationX);

        if (isDownwardSwipe) {
          runOnJS(onSwipeComplete)('down');
        } else if (Math.abs(translateX.value) > SWIPE_THRESHOLD || Math.abs(event.velocityX) > 850) {
          const direction = translateX.value >= 0 ? 'right' : 'left';
          translateX.value = withTiming(direction === 'right' ? width * 1.3 : -width * 1.3, { duration: 180 }, () => {
            runOnJS(onSwipeComplete)(direction);
          });
          swipeProgressX.value = withTiming(direction === 'right' ? width * 1.3 : -width * 1.3, { duration: 180 });
        } else {
          translateX.value = withSpring(0, { damping: 18, stiffness: 170 });
          translateY.value = withSpring(0, { damping: 18, stiffness: 170 });
          swipeProgressX.value = withSpring(0, { damping: 18, stiffness: 170 });
          swipeProgressY.value = withSpring(0, { damping: 18, stiffness: 170 });
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
        Math.max(Math.abs(swipeProgressX.value) / SWIPE_THRESHOLD, swipeProgressY.value / WATCHED_SWIPE_THRESHOLD)
      );
      return {
        opacity: interpolate(progress, [0, 1], [0.72, 1], Extrapolation.CLAMP),
        transform: [
          { scale: interpolate(progress, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
          { translateY: interpolate(progress, [0, 1], [12, 0], Extrapolation.CLAMP) },
        ],
      };
    });

    const likeStyle = useAnimatedStyle(() => ({
      opacity: interpolate(isTop ? translateX.value : 0, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));

    const skipStyle = useAnimatedStyle(() => ({
      opacity: interpolate(isTop ? translateX.value : 0, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP),
    }));

    const watchedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(
        isTop ? translateY.value : 0,
        [30, WATCHED_SWIPE_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP
      ),
    }));

    const feedbackFrameStyle = useAnimatedStyle(() => {
      const leftIntensity = interpolate(isTop ? translateX.value : 0, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP);
      const rightIntensity = interpolate(isTop ? translateX.value : 0, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
      const downIntensity = interpolate(isTop ? translateY.value : 0, [0, WATCHED_SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
      const red = Math.round(255 * leftIntensity + 249 * rightIntensity + 0 * downIntensity);
      const green = Math.round(80 * leftIntensity + 200 * rightIntensity + 43 * downIntensity);
      const blue = Math.round(80 * leftIntensity + 14 * rightIntensity + 58 * downIntensity);
      const alpha = Math.max(leftIntensity, rightIntensity, downIntensity);
      const borderAlpha = (0.92 * alpha).toFixed(3);
      const backgroundAlpha = (0.1 * alpha).toFixed(3);
      const shadowAlpha = (0.28 * alpha).toFixed(3);
      const shadowRadius = (22 * alpha).toFixed(1);

      return {
        opacity: alpha,
        borderColor: `rgba(${red}, ${green}, ${blue}, ${borderAlpha})`,
        backgroundColor: `rgba(${red}, ${green}, ${blue}, ${backgroundAlpha})`,
        boxShadow: `0 0 ${shadowRadius}px rgba(${red}, ${green}, ${blue}, ${shadowAlpha})`,
      };
    });

    const cardMeta = getYear(movie.date);

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 bg-brand-navyLight"
          style={[
            { borderCurve: 'continuous', boxShadow: '0 18px 40px rgba(0,0,0,0.35)', zIndex: isTop ? 2 : 1 },
            isTop ? activeCardStyle : nextCardStyle,
          ]}
        >
          {isTop ? (
            <Animated.View
              pointerEvents="none"
              className="absolute inset-0 rounded-[28px] border-[3px]"
              style={[{ zIndex: 4 }, feedbackFrameStyle]}
            />
          ) : null}
          <Pressable className="flex-1" onPress={() => onOpenMovie(movie)} disabled={!isTop}>
            <View className="flex-1 overflow-hidden bg-brand-navyLight">
              {movie.image ? (
                <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
              ) : (
                <View className="flex-1 items-center justify-center bg-brand-navyLight">
                  <Ionicons name="film-outline" size={64} color="#A0AEC0" />
                </View>
              )}
            </View>
            <View
              className="justify-center bg-[#002B3A] px-5"
              style={{ minHeight: isCompactCard ? 76 : 92, paddingVertical: isCompactCard ? 10 : 12 }}
            >
              <View className="gap-1.5">
                <View>
                  <Text
                    selectable
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    className="font-black text-white"
                    style={{ fontSize: isCompactCard ? 18 : 22, lineHeight: isCompactCard ? 24 : 28 }}
                  >
                    {movie.title}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between gap-3">
                  {cardMeta ? (
                    <Text selectable numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-semibold text-white/85">
                      {cardMeta}
                    </Text>
                  ) : (
                    <View className="flex-1" />
                  )}
                  {movie.rating ? (
                    <View className="flex-row shrink-0 items-center gap-1.5">
                      <Text className="text-[13px] font-black text-white">
                        {movie.rating.toFixed(1)}
                      </Text>
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-yellow">
                        <Text className="text-[7px] font-black text-brand-navy">IMDb</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Pressable>

          {isTop && (
            <>
              <Animated.View className="absolute right-5 top-6 rotate-[10deg] rounded-lg border-4 border-red-400 px-3 py-1.5" style={skipStyle}>
                <Text className="text-xl font-black uppercase text-red-300">Pass</Text>
              </Animated.View>
              <Animated.View className="absolute left-5 top-6 rotate-[-10deg] rounded-lg border-4 border-brand-yellow px-3 py-1.5" style={likeStyle}>
                <Text className="text-lg font-black uppercase text-brand-yellow">Interested</Text>
              </Animated.View>
              <Animated.View
                className="absolute left-1/2 top-6 -translate-x-1/2 items-center rounded-xl border-4 border-brand-yellow bg-black/35 px-4 py-2"
                style={watchedStyle}
              >
                <Ionicons name="eye" size={24} color="#F9C80E" />
                <Text className="mt-1 text-xs font-black uppercase text-brand-yellow">
                  Watched
                </Text>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </GestureDetector>
    );
  }
);
DiscoveryCard.displayName = 'DiscoveryCard';

interface TriageSessionRowProps {
  movie: DiscoveryCandidate;
  bucket: TriageBucket;
  status: string;
  onPress: () => void;
  onAddToWatchlist?: () => void;
  onRemove?: () => void;
  onMoveToInterested?: () => void;
  onDismiss?: () => void;
}

const TriageSessionRow = ({
  movie,
  bucket,
  status,
  onPress,
  onAddToWatchlist,
  onRemove,
  onMoveToInterested,
  onDismiss,
}: TriageSessionRowProps) => {
  return (
    <Pressable
      className="min-h-[80px] flex-row items-center gap-3 border-b border-white/8 bg-[#073746] px-3 py-2.5"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={bucket === 'watched' ? `Edit ${movie.title}` : movie.title}
    >
      {movie.image ? (
        <Image
          source={{ uri: movie.image }}
          style={{ height: 62, width: 42, borderRadius: 7, backgroundColor: '#002B3A' }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View className="h-[62px] w-[42px] items-center justify-center rounded-md bg-[#002B3A]">
          <Ionicons name="film-outline" size={16} color="#8EA1A8" />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13px] font-black text-white">
          {movie.title}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[10px] font-semibold text-white/60">
          {getYear(movie.date) || movie.reason}
        </Text>
        <Text
          numberOfLines={1}
          className={`mt-1 text-[9px] font-semibold ${
            bucket === 'passed' ? 'text-red-200/80' : bucket === 'watched' ? 'text-brand-yellow' : 'text-brand-grayText'
          }`}
        >
          {status}
        </Text>
      </View>
      {bucket === 'watched' ? (
        <View className="rounded-lg border border-brand-yellow/70 px-3 py-1.5">
          <Text className="text-[9px] font-black uppercase text-brand-yellow">Edit</Text>
        </View>
      ) : bucket === 'interested' ? (
        <View className="flex-row items-center gap-2">
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-500/10"
            onPress={(event) => {
              event.stopPropagation();
              onRemove?.();
            }}
            accessibilityLabel={`Remove ${movie.title}`}
          >
            <Ionicons name="trash-outline" size={17} color="#FCA5A5" />
          </Pressable>
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow"
            onPress={(event) => {
              event.stopPropagation();
              onAddToWatchlist?.();
            }}
            accessibilityLabel={`Add ${movie.title} to Watchlist`}
          >
            <Ionicons name="bookmark" size={16} color="#051E2A" />
          </Pressable>
        </View>
      ) : bucket === 'passed' ? (
        <View className="flex-row items-center gap-2">
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-lg border border-green-300/25 bg-green-500/10"
            onPress={(event) => {
              event.stopPropagation();
              onMoveToInterested?.();
            }}
            accessibilityLabel={`Move ${movie.title} to Interested`}
          >
            <Ionicons name="arrow-up-outline" size={17} color="#86EFAC" />
          </Pressable>
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-500/10"
            onPress={(event) => {
              event.stopPropagation();
              onDismiss?.();
            }}
            accessibilityLabel={`Dismiss ${movie.title}`}
          >
            <Ionicons name="ban-outline" size={17} color="#FCA5A5" />
          </Pressable>
        </View>
      ) : (
        <Ionicons name="chevron-forward-outline" size={17} color="#8EA1A8" />
      )}
    </Pressable>
  );
};

export default function DiscoverScreen() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabScreenBottomInset = getTabScreenBottomInset(insets.bottom);
  const { profile } = useUserProfile();
  const { discoverySignals, movies } = useMovieState();
  const {
    addWatchEntry,
    addMovieToList,
    filterDiscoveryCandidates,
    recordDiscoveryEvent,
  } = useMovieActions();
  const [deck, setDeck] = useState<DiscoveryCandidate[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [triageSession, setTriageSession] = useState<TriageSessionItem[]>([]);
  const [watchedDrafts, setWatchedDrafts] = useState<Record<string, WatchedDraft>>({});
  const [showSessionReview, setShowSessionReview] = useState(false);
  const [sessionReviewTab, setSessionReviewTab] = useState<TriageBucket>('interested');
  const [editingSessionItem, setEditingSessionItem] = useState<TriageSessionItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  
  const didInitialLoad = useRef(false);
  const didAutoOpenReview = useRef(false);
  const topCardRef = useRef<DiscoveryCardRef>(null);
  
  const loadingMoreLock = useSharedValue(false);
  const swipeProgressX = useSharedValue(0);
  const swipeProgressY = useSharedValue(0);

  const activeMovie = deck[0];
  
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
    () => buildTasteProfile(movies, discoverySignals, profile.favoriteGenreIds),
    [discoverySignals, movies, profile.favoriteGenreIds]
  );
  const hasTasteGenres = tasteProfile.topGenres.length > 0;
  const cardWidth = Math.min(width - DISCOVER_HORIZONTAL_PADDING, 390);
  const reservedVerticalSpace =
    insets.top +
    tabScreenBottomInset +
    DISCOVER_HEADER_RESERVE +
    (hasTasteGenres ? DISCOVER_GENRE_RESERVE : 0) +
    DISCOVER_ACTION_RESERVE +
    DISCOVER_VERTICAL_GAP;
  const availableCardHeight = height - reservedVerticalSpace;
  const cardHeight = Math.max(300, Math.min(560, cardWidth * 1.52, availableCardHeight));
  const isCompactDiscoverLayout = cardHeight < 430;
  const sessionCounts = useMemo(
    () => ({
      interested: triageSession.filter((item) => item.bucket === 'interested').length,
      watched: triageSession.filter((item) => item.bucket === 'watched').length,
      passed: triageSession.filter((item) => item.bucket === 'passed').length,
      watchedDrafts: Object.keys(watchedDrafts).length,
      total: triageSession.length,
    }),
    [triageSession, watchedDrafts]
  );
  const sessionItemsForActiveTab = useMemo(
    () => triageSession.filter((item) => item.bucket === sessionReviewTab),
    [sessionReviewTab, triageSession]
  );
  const editingWatchedDraft = editingSessionItem?.bucket === 'watched'
    ? watchedDrafts[editingSessionItem.movie.id] ?? createDefaultWatchedDraft(editingSessionItem.movie.id)
    : null;
  const editingWatchedDateValidation = editingWatchedDraft ? validateWatchDate(editingWatchedDraft.watchedAt) : null;

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
    void trackEvent('discover_session_started', {
      has_taste_profile: movies.some((movie) => movie.isWatched) || discoverySignals.length > 0,
    });
    void loadPage(1, true);
  }, [discoverySignals.length, loadPage, movies]);

  useEffect(() => {
    if (!activeMovie) return;
    const timeout = setTimeout(() => {
      void trackEvent('discover_card_viewed', {
        source: 'discover',
        surface: 'card_stack',
        reason_source: activeMovie.source,
        position_bucket: '1',
        algorithm_version: 'taste_v1',
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [activeMovie]);

  // Sync swipe progress exactly when a new card becomes active.
  useEffect(() => {
    swipeProgressX.value = 0;
    swipeProgressY.value = 0;
  }, [activeMovie?.id, swipeProgressX, swipeProgressY]);

  useEffect(() => {
    if (sessionCounts.total === 0) {
      didAutoOpenReview.current = false;
      return;
    }

    if (deck.length > 0) {
      didAutoOpenReview.current = false;
      return;
    }

    if (!loading && deck.length === 0 && !didAutoOpenReview.current) {
      didAutoOpenReview.current = true;
      requestAnimationFrame(() => setShowSessionReview(true));
    }
  }, [deck.length, loading, sessionCounts.total]);

  useEffect(() => {
    if (sessionCounts.total === 0) return;
    const activeCount = sessionCounts[sessionReviewTab];
    if (activeCount > 0) return;

    const nextTab =
      sessionCounts.interested > 0
        ? 'interested'
        : sessionCounts.watched > 0
          ? 'watched'
          : sessionCounts.passed > 0
            ? 'passed'
            : null;
    if (nextTab) {
      requestAnimationFrame(() => setSessionReviewTab(nextTab));
    }
  }, [sessionCounts, sessionReviewTab]);

  const addToTriageSession = useCallback((movie: DiscoveryCandidate, bucket: TriageBucket) => {
    const item: TriageSessionItem = {
      movie,
      bucket,
      createdAt: new Date().toISOString(),
    };

    setTriageSession((current) => [
      ...current.filter((existing) => existing.movie.id !== movie.id),
      item,
    ]);
    if (bucket === 'watched') {
      setWatchedDrafts((current) => ({
        ...current,
        [movie.id]: current[movie.id] ?? createDefaultWatchedDraft(movie.id),
      }));
    }
  }, []);

  const removeTopCardAndMaybeLoadMore = useCallback(() => {
    setDeck((current) => current.slice(1));
    requestAnimationFrame(() => {
      if (deck.length <= 10 && !loadingMoreLock.value) {
        void loadPage(page + 1);
      }
    });
  }, [deck.length, loadPage, loadingMoreLock, page]);

  const onSwipeComplete = useCallback(
    (direction: 'left' | 'right' | 'down') => {
      if (!activeMovie) return;
      const bucket = direction === 'right' ? 'interested' : direction === 'left' ? 'passed' : 'watched';
      addToTriageSession(activeMovie, bucket);
      removeTopCardAndMaybeLoadMore();
    },
    [activeMovie, addToTriageSession, removeTopCardAndMaybeLoadMore]
  );

  const removeFromTriageSession = useCallback((movieId: string) => {
    setEditingSessionItem((current) => (current?.movie.id === movieId ? null : current));
    setTriageSession((current) => current.filter((item) => item.movie.id !== movieId));
    setWatchedDrafts((drafts) => {
      if (!drafts[movieId]) return drafts;
      const next = { ...drafts };
      delete next[movieId];
      return next;
    });
  }, []);

  const moveTriageItem = useCallback((movie: DiscoveryCandidate, bucket: TriageBucket) => {
    const movedItem: TriageSessionItem = { movie, bucket, createdAt: new Date().toISOString() };
    setTriageSession((current) =>
      current.map((item) =>
        item.movie.id === movie.id
          ? movedItem
          : item
      )
    );
    setEditingSessionItem((current) => (current?.movie.id === movie.id ? movedItem : current));
    if (bucket === 'watched') {
      setWatchedDrafts((current) => ({
        ...current,
        [movie.id]: current[movie.id] ?? createDefaultWatchedDraft(movie.id),
      }));
    } else {
      setWatchedDrafts((current) => {
        if (!current[movie.id]) return current;
        const next = { ...current };
        delete next[movie.id];
        return next;
      });
    }
    setFeedbackMessage(
      bucket === 'interested'
        ? 'Moved to Interested'
        : bucket === 'watched'
          ? 'Moved to Watched'
          : 'Moved to Passed'
    );
  }, []);

  const addInterestedMovieToWatchlist = useCallback(
    (movie: DiscoveryCandidate) => {
      addMovieToList(movie, 'Watchlist', 'discover');
      recordDiscoveryEvent(movie, 'interested');
      removeFromTriageSession(movie.id);
      setEditingSessionItem(null);
      setFeedbackMessage('Added to Watchlist');
    },
    [addMovieToList, recordDiscoveryEvent, removeFromTriageSession]
  );

  const addAllInterestedToWatchlist = useCallback(() => {
    const interestedItems = triageSession.filter((item) => item.bucket === 'interested');
    interestedItems.forEach((item) => {
      addMovieToList(item.movie, 'Watchlist', 'discover_review');
      recordDiscoveryEvent(item.movie, 'interested');
    });
    setTriageSession((current) => current.filter((item) => item.bucket !== 'interested'));
    if (interestedItems.length > 0) {
      setFeedbackMessage(`${interestedItems.length} added to Watchlist`);
    }
  }, [addMovieToList, recordDiscoveryEvent, triageSession]);

  const dismissAllPassed = useCallback(() => {
    const passedItems = triageSession.filter((item) => item.bucket === 'passed');
    passedItems.forEach((item) => recordDiscoveryEvent(item.movie, 'passed'));
    setTriageSession((current) => current.filter((item) => item.bucket !== 'passed'));
    if (passedItems.length > 0) {
      setFeedbackMessage(`${passedItems.length} dismissed`);
    }
  }, [recordDiscoveryEvent, triageSession]);

  const dismissPassedMovie = useCallback(
    (movie: DiscoveryCandidate) => {
      recordDiscoveryEvent(movie, 'passed');
      removeFromTriageSession(movie.id);
      setFeedbackMessage('Dismissed');
    },
    [recordDiscoveryEvent, removeFromTriageSession]
  );

  const updateWatchedDraft = useCallback((movieId: string, updates: Partial<WatchedDraft>) => {
    setWatchedDrafts((current) => ({
      ...current,
      [movieId]: {
        ...(current[movieId] ?? createDefaultWatchedDraft(movieId)),
        ...updates,
      },
    }));
  }, []);

  const saveWatchedMovieToDiary = useCallback(
    (movie: DiscoveryCandidate) => {
      const draft = watchedDrafts[movie.id] ?? createDefaultWatchedDraft(movie.id);
      const validation = validateWatchDate(draft.watchedAt);
      if (validation.error) {
        setFeedbackMessage(validation.error);
        return;
      }

      addWatchEntry(movie, draft.rating, draft.note, toWatchDateTime(validation.dateKey), 'discover');
      recordDiscoveryEvent(movie, 'watched');
      if (draft.isFavorite) {
        addMovieToList(movie, 'Favorites', 'discover');
      }
      removeFromTriageSession(movie.id);
      setEditingSessionItem(null);
      setFeedbackMessage('Saved to Diary');
    },
    [addMovieToList, addWatchEntry, recordDiscoveryEvent, removeFromTriageSession, watchedDrafts]
  );

  const completeSessionReview = useCallback(() => {
    const passedItems = triageSession.filter((item) => item.bucket === 'passed');
    passedItems.forEach((item) => recordDiscoveryEvent(item.movie, 'passed'));
    setTriageSession((current) => current.filter((item) => item.bucket !== 'passed'));
    setShowSessionReview(false);
    setEditingSessionItem(null);
    setFeedbackMessage(
      passedItems.length > 0
        ? `${passedItems.length} passed choices saved`
        : 'Session review closed'
    );
    void trackEvent('discover_session_completed', {
      card_count_bucket: getCountBucket(triageSession.length),
      positive_action_bucket: getCountBucket(
        triageSession.filter((item) => item.bucket === 'interested' || item.bucket === 'watched').length
      ),
    });
  }, [recordDiscoveryEvent, triageSession]);

  const openMovie = (movie: DiscoveryCandidate) => {
    setEditingSessionItem(null);
    setShowSessionReview(false);
    recordDiscoveryEvent(movie, 'opened');
    void trackEvent('discover_movie_opened', {
      source: 'discover',
      surface: 'session_review',
      reason_source: movie.source,
      algorithm_version: 'taste_v1',
    });
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: movie.id,
        title: movie.title,
        year: getYear(movie.date),
        image: movie.image,
        overview: movie.overview ?? '',
        rating: `${movie.rating ?? 0}`,
        source: 'discover',
        reasonSource: movie.source,
      },
    } as never);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-[#002B3A]" edges={['top', 'left', 'right']}>
        <View
          className="flex-1 px-4"
          style={{
            paddingBottom: tabScreenBottomInset,
          }}
        >
          <View className="flex-row items-center justify-between pb-3 pt-2">
            <View>
              <Text selectable className="text-[26px] font-black text-white">Discover</Text>
              <Text selectable className="text-[11px] font-semibold text-white/50">
                Sort films now, decide later
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                className="flex-row items-center gap-1.5 rounded-full border border-brand-yellow/20 bg-brand-yellow/10 px-3 py-2"
                onPress={() => setShowSessionReview(true)}
                accessibilityLabel="Review discovery session"
              >
                <Ionicons name="albums-outline" size={13} color="#F9C80E" />
                <Text selectable className="text-[9px] font-black uppercase text-brand-yellow">Review session</Text>
              </Pressable>
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
            ) : deck.length > 0 ? (
              <View style={{ height: cardHeight, width: cardWidth }}>
                {deck.slice(0, 2).reverse().map((movie, index, array) => {
                  const isTop = index === array.length - 1;
                  const isNext = array.length === 2 && index === 0;

                  return (
                    <DiscoveryCard
                      key={movie.id}
                      ref={isTop ? topCardRef : undefined}
                      movie={movie}
                      isTop={isTop}
                      isNext={isNext}
                      cardWidth={cardWidth}
                      cardHeight={cardHeight}
                      swipeProgressX={swipeProgressX}
                      swipeProgressY={swipeProgressY}
                      onSwipeComplete={onSwipeComplete}
                      onOpenMovie={openMovie}
                    />
                  );
                })}
              </View>
            ) : (
              <View className="items-center gap-4 px-8">
                <Ionicons name="sparkles-outline" size={58} color="#F9C80E" />
                <Text selectable className="text-center text-xl font-black text-white">
                  {loadError ? 'Could not load movies' : sessionCounts.total > 0 ? 'Ready to review' : 'You reached the end'}
                </Text>
                <Text selectable className="text-center text-xs font-medium leading-5 text-white/55">
                  {loadError
                    ? 'Check your connection and try loading the deck again.'
                    : sessionCounts.total > 0
                      ? `You sorted ${sessionCounts.total} ${sessionCounts.total === 1 ? 'film' : 'films'}. Review your session before loading more.`
                    : 'Load more movies or review the films you already sorted.'}
                </Text>
                <View className="flex-row gap-3">
                  {sessionCounts.total > 0 ? (
                    <Pressable
                      className="rounded-xl bg-brand-yellow px-4 py-3"
                      onPress={() => setShowSessionReview(true)}
                      accessibilityLabel="Review discovery session"
                    >
                      <Text className="text-xs font-black text-brand-navy">Review Session</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    className="rounded-xl border border-white/15 bg-white/8 px-4 py-3"
                    onPress={() => loadPage(loadError ? 1 : page + 1, loadError)}
                  >
                    <Text className="text-xs font-black text-white">
                      {loadError ? 'Try Again' : 'Load More'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {activeMovie ? (
            <>
              <View
                className="w-full flex-row items-start justify-center"
                style={{ gap: isCompactDiscoverLayout ? 16 : 20, marginTop: isCompactDiscoverLayout ? 8 : 16 }}
              >
                <Pressable
                  accessibilityLabel="Skip movie"
                  className="items-center"
                  onPress={() => topCardRef.current?.triggerSwipe('left')}
                >
                  <View
                    className="items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10"
                    style={{ height: isCompactDiscoverLayout ? 52 : 56, width: isCompactDiscoverLayout ? 52 : 56 }}
                  >
                    <Ionicons name="close" size={isCompactDiscoverLayout ? 25 : 27} color="#FCA5A5" />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel="Log movie as watched"
                  className="items-center"
                  onPress={() => topCardRef.current?.openWatchedLog()}
                >
                  <View
                    className="items-center justify-center rounded-2xl border border-white/10 bg-white/7"
                    style={{ height: isCompactDiscoverLayout ? 52 : 56, width: isCompactDiscoverLayout ? 52 : 56 }}
                  >
                    <Ionicons name="eye-outline" size={isCompactDiscoverLayout ? 22 : 24} color="#FFFFFF" />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel="Save movie to watchlist"
                  className="items-center"
                  onPress={() => topCardRef.current?.triggerSwipe('right')}
                >
                  <View
                    className="items-center justify-center rounded-2xl bg-brand-yellow"
                    style={{ height: isCompactDiscoverLayout ? 52 : 56, width: isCompactDiscoverLayout ? 52 : 56 }}
                  >
                    <Ionicons name="sparkles" size={isCompactDiscoverLayout ? 21 : 23} color="#051E2A" />
                  </View>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <Modal
          animationType="fade"
          onRequestClose={() => setShowSessionReview(false)}
          statusBarTranslucent
          transparent
          visible={showSessionReview}
        >
          <View className="flex-1 justify-center bg-[#002B3A]/90 px-4 py-8">
            <Pressable className="absolute inset-0" onPress={() => setShowSessionReview(false)} />
            <View
              className="max-h-[88%] w-full self-center overflow-hidden rounded-[20px] border border-white/10 bg-[#073746] px-4 pt-3"
              style={{ borderCurve: 'continuous', height: '82%', maxWidth: 420, boxShadow: '0 18px 44px rgba(0,0,0,0.32)' }}
            >
              <View className="mb-4 flex-row items-start justify-between">
                <View className="w-9" />
                <View className="min-w-0 flex-1 items-center">
                  <Text className="text-center text-[17px] font-black text-white">Review Session</Text>
                  <Text className="mt-1 text-center text-[9px] font-semibold text-white/55">
                    Review the picks you sorted today.
                  </Text>
                </View>
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                  onPress={() => setShowSessionReview(false)}
                  accessibilityLabel="Close review session"
                >
                  <Ionicons name="close" size={19} color="#FFFFFF" />
                </Pressable>
              </View>

              <View className="mb-4 flex-row rounded-xl bg-[#002B3A]/70 p-1">
                {[
                  { id: 'interested', label: 'Interested', count: sessionCounts.interested },
                  { id: 'watched', label: 'Watched', count: sessionCounts.watched },
                  { id: 'passed', label: 'Passed', count: sessionCounts.passed },
                ].map((tab) => {
                  const isActive = sessionReviewTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      className={`min-w-0 flex-1 items-center rounded-lg px-2 py-2.5 ${
                        isActive ? 'bg-brand-yellow' : 'bg-transparent'
                      }`}
                      onPress={() => setSessionReviewTab(tab.id as TriageBucket)}
                      accessibilityLabel={`Show ${tab.label} films`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`text-[9px] font-black uppercase ${
                          isActive ? 'text-brand-navy' : 'text-white/65'
                        }`}
                      >
                        {tab.label}
                      </Text>
                      <Text className={`mt-0.5 text-[10px] font-black ${isActive ? 'text-brand-navy' : 'text-white/70'}`}>
                        {tab.count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {sessionReviewTab === 'interested' && sessionCounts.interested > 0 ? (
                <View className="mb-3 flex-row items-center justify-between rounded-xl border border-white/10 bg-[#0A4152] px-3 py-2.5">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[11px] font-black text-white">Ready for Watchlist</Text>
                    <Text className="mt-0.5 text-[9px] font-semibold text-brand-grayText">
                      Add picks one by one, or send all to Watchlist.
                    </Text>
                  </View>
                  <Pressable
                    className="rounded-xl bg-brand-yellow px-3 py-2"
                    onPress={addAllInterestedToWatchlist}
                    accessibilityLabel="Add all interested films to watchlist"
                  >
                    <Text className="text-[9px] font-black uppercase text-brand-navy">Add selected</Text>
                  </Pressable>
                </View>
              ) : null}

              {sessionReviewTab === 'passed' && sessionCounts.passed > 0 ? (
                <View className="mb-3 flex-row items-center justify-between rounded-xl border border-white/10 bg-[#0A4152] px-3 py-2.5">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[11px] font-black text-white">Passed picks</Text>
                    <Text className="mt-0.5 text-[9px] font-semibold text-brand-grayText">
                      Recover anything interesting, or dismiss the rest.
                    </Text>
                  </View>
                  <Pressable
                    className="rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2"
                    onPress={dismissAllPassed}
                    accessibilityLabel="Dismiss all passed films"
                  >
                    <Text className="text-[9px] font-black uppercase text-red-200">Dismiss selected</Text>
                  </Pressable>
                </View>
              ) : null}

              {sessionReviewTab === 'watched' ? (
                <View className="mb-3 flex-row items-center justify-between rounded-xl border border-white/10 bg-[#0A4152] px-3 py-2.5">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[11px] font-black text-white">Watched picks</Text>
                    <Text className="mt-0.5 text-[9px] font-semibold text-brand-grayText">
                      Add ratings, favorites, and reviews before saving.
                    </Text>
                  </View>
                  <View className="rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-2">
                    <Text className="text-[9px] font-black uppercase text-brand-yellow">Edit rows</Text>
                  </View>
                </View>
              ) : null}

              <ScrollView className="min-h-[300px] flex-1" showsVerticalScrollIndicator={false}>
                {sessionItemsForActiveTab.length > 0 ? (
                  <View className="overflow-hidden rounded-xl border border-white/10 bg-[#062F3D]">
                    {sessionItemsForActiveTab.map(({ movie, bucket }) => {
                      const watchedDraft = watchedDrafts[movie.id] ?? createDefaultWatchedDraft(movie.id);
                      const status =
                        bucket === 'interested'
                          ? 'Ready for Watchlist'
                          : bucket === 'passed'
                            ? 'Passed'
                            : [
                                watchedDraft.rating > 0 ? `★ ${watchedDraft.rating.toFixed(1)}` : 'Needs rating',
                                watchedDraft.note.trim() ? 'Review added' : null,
                                watchedDraft.isFavorite ? 'Favorite' : null,
                              ]
                                .filter(Boolean)
                                .join(' / ');

                      return (
                        <TriageSessionRow
                          key={movie.id}
                          movie={movie}
                          bucket={bucket}
                          status={status}
                          onPress={() => {
                            if (bucket === 'watched') {
                              setEditingSessionItem({ movie, bucket, createdAt: new Date().toISOString() });
                            } else {
                              openMovie(movie);
                            }
                          }}
                          onAddToWatchlist={() => addInterestedMovieToWatchlist(movie)}
                          onRemove={() => removeFromTriageSession(movie.id)}
                          onMoveToInterested={() => moveTriageItem(movie, 'interested')}
                          onDismiss={() => dismissPassedMovie(movie)}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <View className="items-center justify-center rounded-2xl border border-dashed border-white/12 bg-[#062F3D] px-5 py-10">
                    <Ionicons name="albums-outline" size={28} color="#A0AEC0" />
                    <Text className="mt-3 text-[13px] font-black text-white">No films here yet</Text>
                    <Text className="mt-1 text-center text-[10px] font-semibold leading-4 text-brand-grayText">
                      Keep sorting films in Discover and they will appear here.
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View className="pb-4 pt-4">
                <Pressable
                  className="h-12 items-center justify-center rounded-xl bg-brand-yellow"
                  onPress={completeSessionReview}
                  accessibilityLabel="Complete review session"
                >
                  <Text className="text-[12px] font-black text-brand-navy">Complete Session</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={editingSessionItem !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setEditingSessionItem(null)}
        >
          <KeyboardAvoidingView
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end bg-black/45"
            keyboardVerticalOffset={16}
          >
            <Pressable className="flex-1" onPress={() => setEditingSessionItem(null)} />
            {editingSessionItem ? (
              <View
                className="max-h-[88%] rounded-t-[28px] border border-white/12 bg-[#002B3A] px-4 pt-3"
                style={{ paddingBottom: getBottomSheetPadding(insets.bottom) }}
              >
                <ScrollView
                  automaticallyAdjustKeyboardInsets
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                <View className="mb-4 items-center">
                  <View className="h-1 w-10 rounded-full bg-white/20" />
                </View>

                <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-[#073746] p-3">
                  {editingSessionItem.movie.image ? (
                    <Image
                      source={{ uri: editingSessionItem.movie.image }}
                      style={{ height: 92, width: 62, borderRadius: 12, backgroundColor: '#002B3A' }}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View className="h-[92px] w-[62px] items-center justify-center rounded-xl bg-[#002B3A]">
                      <Ionicons name="film-outline" size={20} color="#8EA1A8" />
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={2} className="text-[17px] font-black leading-5 text-white">
                      {editingSessionItem.movie.title}
                    </Text>
                    <Text className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                      {getYear(editingSessionItem.movie.date) || editingSessionItem.movie.reason}
                    </Text>
                  </View>
                </View>

                {editingSessionItem.bucket === 'interested' ? (
                  <View className="gap-2">
                    <Pressable
                      className="h-12 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4"
                      onPress={() => addInterestedMovieToWatchlist(editingSessionItem.movie)}
                      accessibilityLabel="Add to Watchlist"
                    >
                      <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
                      <Text className="text-[13px] font-bold text-white">Add to Watchlist</Text>
                    </Pressable>
                    <Pressable
                      className="h-12 flex-row items-center gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4"
                      onPress={() => removeFromTriageSession(editingSessionItem.movie.id)}
                      accessibilityLabel="Remove from session"
                    >
                      <Ionicons name="trash-outline" size={18} color="#F87171" />
                      <Text className="text-[13px] font-bold text-red-300">Remove</Text>
                    </Pressable>
                  </View>
                ) : null}

                {editingSessionItem.bucket === 'watched' && editingWatchedDraft ? (
                  <View className="gap-3">
                    <View className="rounded-2xl border border-white/10 bg-[#073746] p-4">
                      <Text className="mb-2 text-[10px] font-black uppercase text-brand-grayText">Rating</Text>
                      <HalfStarRating
                        rating={editingWatchedDraft.rating}
                        size={28}
                        onChange={(rating) => updateWatchedDraft(editingSessionItem.movie.id, { rating })}
                      />
                    </View>
                    <Pressable
                      className="h-12 flex-row items-center justify-between rounded-2xl border border-white/10 bg-[#073746] px-4"
                      onPress={() =>
                        updateWatchedDraft(editingSessionItem.movie.id, { isFavorite: !editingWatchedDraft.isFavorite })
                      }
                      accessibilityLabel="Toggle favorite"
                    >
                      <Text className="text-[13px] font-bold text-white">Favorite</Text>
                      <Ionicons
                        name={editingWatchedDraft.isFavorite ? 'heart' : 'heart-outline'}
                        size={22}
                        color={editingWatchedDraft.isFavorite ? '#F9C80E' : '#A0AEC0'}
                      />
                    </Pressable>
                    <View className="rounded-2xl border border-white/10 bg-[#073746] px-4 py-3">
                      <WatchedDatePicker
                        error={editingWatchedDateValidation?.error}
                        onChange={(watchedAt) => updateWatchedDraft(editingSessionItem.movie.id, { watchedAt })}
                        value={editingWatchedDraft.watchedAt}
                      />
                    </View>
                    <View className="rounded-2xl border border-white/10 bg-[#073746] px-4 py-3">
                      <Text className="mb-2 text-[10px] font-black uppercase text-brand-grayText">Review</Text>
                      <TextInput
                        value={editingWatchedDraft.note}
                        onChangeText={(note) => updateWatchedDraft(editingSessionItem.movie.id, { note })}
                        placeholder="Write a short thought..."
                        placeholderTextColor="#8EA1A8"
                        multiline
                        className="min-h-[96px] text-[13px] font-medium leading-5 text-white"
                        textAlignVertical="top"
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        className="h-12 flex-1 items-center justify-center rounded-2xl border border-white/12 bg-[#073746]"
                        onPress={() => removeFromTriageSession(editingSessionItem.movie.id)}
                        accessibilityLabel="Remove watched film"
                      >
                        <Text className="text-[10px] font-black uppercase text-red-300">Remove</Text>
                      </Pressable>
                      <Pressable
                        className="h-12 flex-1 items-center justify-center rounded-2xl bg-[#FFB300]"
                        onPress={() => saveWatchedMovieToDiary(editingSessionItem.movie)}
                        accessibilityLabel="Save watched film"
                      >
                        <Text className="text-[10px] font-black uppercase text-brand-navy">Save</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {editingSessionItem.bucket === 'passed' ? (
                  <View className="gap-2">
                    <Pressable
                      className="h-12 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4"
                      onPress={() => moveTriageItem(editingSessionItem.movie, 'interested')}
                      accessibilityLabel="Move to Interested"
                    >
                      <Ionicons name="arrow-up-outline" size={18} color="#22C55E" />
                      <Text className="text-[13px] font-bold text-white">Move to Interested</Text>
                    </Pressable>
                    <Pressable
                      className="h-12 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4"
                      onPress={() => moveTriageItem(editingSessionItem.movie, 'watched')}
                      accessibilityLabel="Move to Watched"
                    >
                      <Ionicons name="arrow-forward-outline" size={18} color="#38BDF8" />
                      <Text className="text-[13px] font-bold text-white">Move to Watched</Text>
                    </Pressable>
                    <Pressable
                      className="h-12 flex-row items-center gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4"
                      onPress={() => removeFromTriageSession(editingSessionItem.movie.id)}
                      accessibilityLabel="Dismiss film"
                    >
                      <Ionicons name="ban-outline" size={18} color="#F87171" />
                      <Text className="text-[13px] font-bold text-red-300">Dismiss</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View className="mt-3 gap-2 border-t border-white/10 pt-3">
                  <Pressable
                    className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#073746]"
                    onPress={() => openMovie(editingSessionItem.movie)}
                    accessibilityLabel="Open movie details"
                  >
                    <Ionicons name="information-circle-outline" size={16} color="#A0AEC0" />
                    <Text className="text-[10px] font-black uppercase text-white/65">Open Details</Text>
                  </Pressable>
                  <Pressable
                    className="h-11 items-center justify-center rounded-xl border border-white/10 bg-[#073746]"
                    onPress={() => setEditingSessionItem(null)}
                    accessibilityLabel="Cancel edit"
                  >
                    <Text className="text-[10px] font-black uppercase text-white/65">Cancel</Text>
                  </Pressable>
                </View>
                </ScrollView>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </Modal>

        <FeedbackToast message={feedbackMessage} onDismiss={() => setFeedbackMessage(null)} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
