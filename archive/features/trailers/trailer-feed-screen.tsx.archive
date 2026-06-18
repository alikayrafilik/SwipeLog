/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally mutable. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { useMovies } from '@/context/MovieContext';
import {
  buildTasteProfile,
  PersonalizedCandidate,
  rankDiscoveryCandidates,
} from '@/services/discovery-ranking';
import { MovieTrailer, tmdbService, WatchProvider } from '@/services/tmdb';

interface TrailerFeedItem extends PersonalizedCandidate {
  trailer: MovieTrailer;
}

interface FeedLoadResult {
  items: TrailerFeedItem[];
}

const TARGET_TRAILER_COUNT = 12;
const CANDIDATE_LIMIT = 28;
const LOOKUP_BATCH_SIZE = 4;
const SWIPE_THRESHOLD = 70;
const PLAYER_TRANSITION_MS = 180;
const CONTROLS_AUTO_HIDE_MS = 3600;

const loadPlayableTrailers = async (
  candidates: PersonalizedCandidate[]
): Promise<FeedLoadResult> => {
  const items: TrailerFeedItem[] = [];

  for (
    let start = 0;
    start < candidates.length && items.length < TARGET_TRAILER_COUNT;
    start += LOOKUP_BATCH_SIZE
  ) {
    const batch = candidates.slice(start, start + LOOKUP_BATCH_SIZE);
    const trailers = await Promise.all(
      batch.map(async (movie) => ({
        movie,
        trailer: await tmdbService.getMovieTrailer(movie.id),
      }))
    );

    trailers.forEach(({ movie, trailer }) => {
      if (trailer && items.length < TARGET_TRAILER_COUNT) {
        items.push({ ...movie, trailer });
      }
    });
  }

  return { items };
};

const getEmbedUrl = (videoKey: string) => {
  const origin = encodeURIComponent('https://swipelog.app');
  return `https://www.youtube.com/embed/${videoKey}?autoplay=0&mute=0&playsinline=1&controls=1&rel=0&enablejsapi=1&origin=${origin}`;
};

const getPlayerCommand = (command: 'playVideo' | 'pauseVideo') => `
  (function() {
    var payload = JSON.stringify({ event: 'command', func: '${command}', args: [] });
    var send = function() {
      window.postMessage(payload, '*');
      var video = document.querySelector('video');
      if (video) {
        video.preload = 'auto';
        if ('${command}' === 'playVideo') {
          video.muted = false;
          video.volume = 1;
          video.play().catch(function() {});
        } else {
          video.muted = true;
          video.pause();
        }
      }
    };
    send();
    setTimeout(send, 250);
    setTimeout(send, 750);
  })();
  true;
`;

const getYear = (date?: string) => date?.match(/\d{4}/)?.[0] ?? '';
const getProviderImage = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;

function TrailerPlayer({
  active,
  item,
  onFailure,
  onReady,
}: {
  active: boolean;
  item: TrailerFeedItem;
  onFailure: (movieId: string) => void;
  onReady: (movieId: string) => void;
}) {
  const playerRef = useRef<React.ElementRef<typeof WebView>>(null);
  const opacity = useSharedValue(active ? 1 : 0);
  const source = useMemo(
    () => ({
      uri: getEmbedUrl(item.trailer.key),
      headers: { Referer: 'https://swipelog.app/' },
    }),
    [item.trailer.key]
  );
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.985 + opacity.value * 0.015 }],
  }));

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: PLAYER_TRANSITION_MS });
    playerRef.current?.injectJavaScript(getPlayerCommand(active ? 'playVideo' : 'pauseVideo'));
  }, [active, opacity]);

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          inset: 0,
          zIndex: active ? 2 : 1,
        },
        animatedStyle,
      ]}
    >
      <WebView
        ref={playerRef}
        source={source}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        cacheEnabled
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        onError={() => onFailure(item.id)}
        onHttpError={() => onFailure(item.id)}
        onLoadEnd={() => {
          onReady(item.id);
          playerRef.current?.injectJavaScript(
            getPlayerCommand(active ? 'playVideo' : 'pauseVideo')
          );
        }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </Animated.View>
  );
}

export default function TrailerFeedScreen() {
  const { width } = useWindowDimensions();
  const {
    discoverySignals,
    filterDiscoveryCandidates,
    movies,
    recordDiscoveryEvent,
  } = useMovies();
  const [items, setItems] = useState<TrailerFeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [failedTrailerIds, setFailedTrailerIds] = useState<string[]>([]);
  const [readyTrailerIds, setReadyTrailerIds] = useState<string[]>([]);
  const [providersByMovieId, setProvidersByMovieId] = useState<Record<string, WatchProvider[]>>({});
  const [controlsVisible, setControlsVisible] = useState(true);
  const didInitialLoad = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasteProfile = useMemo(
    () => buildTasteProfile(movies, discoverySignals),
    [discoverySignals, movies]
  );
  const activeItem = items[activeIndex];
  const nextItem = items[activeIndex + 1];
  const activeFailed = activeItem ? failedTrailerIds.includes(activeItem.id) : false;
  const activeReady = activeItem ? readyTrailerIds.includes(activeItem.id) : false;
  const nextReady = nextItem ? readyTrailerIds.includes(nextItem.id) : false;
  const activeProviders = activeItem ? providersByMovieId[activeItem.id] ?? [] : [];

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setActiveIndex(0);
    setFailedTrailerIds([]);
    setReadyTrailerIds([]);

    try {
      const [trendingMovies, popularMovies, tasteMovies] = await Promise.all([
        tmdbService.getTrendingMovies('week'),
        tmdbService.discoverMovies(1),
        tmdbService.discoverMoviesByGenres(
          tasteProfile.topGenres.map((genre) => genre.id),
          1
        ),
      ]);
      const candidates = [
        ...tasteMovies.map((movie) => ({
          ...movie,
          reason: 'Chosen from your taste profile',
          source: 'taste' as const,
        })),
        ...trendingMovies.map((movie) => ({
          ...movie,
          reason: 'Trending this week',
          source: 'trending' as const,
        })),
        ...popularMovies.map((movie) => ({
          ...movie,
          reason: 'Popular discovery pick',
          source: 'popular' as const,
        })),
      ];
      const unique = Array.from(new Map(candidates.map((movie) => [movie.id, movie])).values());
      const ranked = rankDiscoveryCandidates(unique, tasteProfile);
      const filtered = filterDiscoveryCandidates(ranked).slice(
        0,
        CANDIDATE_LIMIT
      ) as PersonalizedCandidate[];
      const result = await loadPlayableTrailers(filtered);

      setItems(result.items);
      setLoadError(result.items.length === 0);
    } catch (error) {
      console.error('[TrailerFeed] Failed to load trailers:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [filterDiscoveryCandidates, tasteProfile]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    [activeItem, nextItem].forEach((item) => {
      if (!item || providersByMovieId[item.id]) return;
      setProvidersByMovieId((current) => ({ ...current, [item.id]: [] }));
      void tmdbService.getWatchProviders(item.id).then((providers) => {
        const streamingProviders = (providers?.flatrate ?? [])
          .sort((a, b) => a.display_priority - b.display_priority)
          .slice(0, 4);
        setProvidersByMovieId((current) => ({
          ...current,
          [item.id]: streamingProviders,
        }));
      });
    });
  }, [activeItem, nextItem, providersByMovieId]);

  const clearControlsTimer = useCallback(() => {
    if (!controlsTimer.current) return;
    clearTimeout(controlsTimer.current);
    controlsTimer.current = null;
  }, []);

  useEffect(() => {
    return clearControlsTimer;
  }, [clearControlsTimer]);

  const hideControlsTemporarily = useCallback(() => {
    clearControlsTimer();
    setControlsVisible(false);
    controlsTimer.current = setTimeout(() => {
      setControlsVisible(true);
      controlsTimer.current = null;
    }, CONTROLS_AUTO_HIDE_MS);
  }, [clearControlsTimer]);

  const markTrailerReady = useCallback((movieId: string) => {
    setReadyTrailerIds((current) =>
      current.includes(movieId) ? current : [...current, movieId]
    );
    setFailedTrailerIds((current) => current.filter((id) => id !== movieId));
  }, []);

  const markTrailerFailed = useCallback((movieId: string) => {
    setFailedTrailerIds((current) =>
      current.includes(movieId) ? current : [...current, movieId]
    );
  }, []);

  const moveBy = useCallback(
    (amount: number) => {
      if (items.length === 0) return;
      setControlsVisible(true);
      setActiveIndex((current) => Math.min(items.length - 1, Math.max(0, current + amount)));
    },
    [items.length]
  );

  const handleExplicitChoice = useCallback(
    (action: 'liked' | 'skipped') => {
      if (!activeItem) return;
      clearControlsTimer();
      setControlsVisible(true);
      recordDiscoveryEvent(activeItem, action);
      setItems((current) => current.filter((item) => item.id !== activeItem.id));
      setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 2)));
    },
    [activeItem, clearControlsTimer, items.length, recordDiscoveryEvent]
  );

  const openMovie = useCallback(() => {
    if (!activeItem) return;
    recordDiscoveryEvent(activeItem, 'opened');
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: activeItem.id,
        title: activeItem.title,
        year: getYear(activeItem.date),
        image: activeItem.image,
        overview: activeItem.overview ?? '',
        rating: `${activeItem.rating ?? 0}`,
      },
    } as never);
  }, [activeItem, recordDiscoveryEvent]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-24, 24])
        .failOffsetX([-45, 45])
        .onEnd((event) => {
          if (event.translationY < -SWIPE_THRESHOLD || event.velocityY < -700) {
            runOnJS(moveBy)(1);
          } else if (event.translationY > SWIPE_THRESHOLD || event.velocityY > 700) {
            runOnJS(moveBy)(-1);
          }
        }),
    [moveBy]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#020608' }}>
        <StatusBar hidden />
        <ActivityIndicator color="#F9C80E" size="large" />
        <Text selectable style={{ color: 'white', fontSize: 13, fontWeight: '800' }}>
          Finding playable trailers...
        </Text>
      </View>
    );
  }

  if (loadError || !activeItem) {
    return (
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#020608', padding: 24 }}
      >
        <StatusBar hidden />
        <Ionicons name="videocam-off-outline" size={42} color="#F9C80E" />
        <Text selectable style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>
          No playable trailers found
        </Text>
        <Text selectable style={{ maxWidth: 420, color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontSize: 12, lineHeight: 18 }}>
          YouTube availability varies by movie and region. Try another candidate batch.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => router.back()} style={{ borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 12 }}>
            <Text style={{ color: 'white', fontWeight: '800' }}>Close</Text>
          </Pressable>
          <Pressable onPress={() => void loadFeed()} style={{ borderRadius: 14, backgroundColor: '#F9C80E', paddingHorizontal: 18, paddingVertical: 12 }}>
            <Text style={{ color: '#052532', fontWeight: '900' }}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#020608' }}>
      <StatusBar hidden />
      <GestureDetector gesture={panGesture}>
        <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#020608' }}>
          {activeItem.image ? (
            <Image
              source={{ uri: activeItem.image }}
              contentFit="cover"
              style={{ position: 'absolute', inset: 0, opacity: 0.35 }}
            />
          ) : null}

          {[activeItem, nextItem].filter((item): item is TrailerFeedItem => Boolean(item)).map((item) => (
            <TrailerPlayer
              key={item.id}
              active={item.id === activeItem.id}
              item={item}
              onFailure={markTrailerFailed}
              onReady={markTrailerReady}
            />
          ))}

          {controlsVisible ? (
            <Animated.View
              pointerEvents="box-none"
              style={{ position: 'absolute', inset: 0, zIndex: 20 }}
            >
              <Pressable
                accessibilityLabel="Hide trailer controls"
                onPress={hideControlsTemporarily}
                style={{ position: 'absolute', inset: 0 }}
              />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0.48)', 'transparent', 'rgba(0,0,0,0.76)']}
                locations={[0, 0.45, 1]}
                style={{ position: 'absolute', inset: 0 }}
              />
              <SafeAreaView
                pointerEvents="box-none"
                edges={['top', 'bottom', 'left', 'right']}
                style={{ flex: 1 }}
              >
                <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable
                  accessibilityLabel="Close trailer feed"
                  onPress={() => router.back()}
                  style={{ height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.58)' }}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 12, paddingVertical: 8 }}>
                  <View style={{ height: 7, width: 7, borderRadius: 99, backgroundColor: '#F9C80E' }} />
                  <Text selectable style={{ color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>
                    YOUTUBE PROTOTYPE
                  </Text>
                </View>
                <View style={{ minWidth: 96, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text selectable style={{ color: 'white', textAlign: 'center', fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                    {activeIndex + 1} / {items.length}
                  </Text>
                </View>
              </View>

              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
                <View pointerEvents="none" style={{ maxWidth: Math.max(250, width * 0.58), gap: 5 }}>
                  <Text selectable numberOfLines={1} style={{ color: '#F9C80E', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                    {activeItem.reason.toUpperCase()}
                  </Text>
                  <Text selectable numberOfLines={2} style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>
                    {activeItem.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {activeItem.rating ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="star" size={12} color="#F9C80E" />
                        <Text selectable style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>
                          TMDB {(activeItem.rating * 2).toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                    {getYear(activeItem.date) ? (
                      <Text selectable style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '800' }}>
                        {getYear(activeItem.date)}
                      </Text>
                    ) : null}
                    {activeProviders.length > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        {activeProviders.map((provider) => (
                          <Image
                            key={provider.provider_id}
                            source={{ uri: getProviderImage(provider.logo_path) }}
                            contentFit="cover"
                            accessibilityLabel={provider.provider_name}
                            style={{ height: 20, width: 20, borderRadius: 6, opacity: 0.62 }}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FeedAction icon="close" label="Skip" onPress={() => handleExplicitChoice('skipped')} />
                  <FeedAction icon="information-circle-outline" label="Details" onPress={openMovie} />
                  <FeedAction icon="bookmark" label="Save" primary onPress={() => handleExplicitChoice('liked')} />
                </View>
              </View>
                </View>
              </SafeAreaView>
            </Animated.View>
          ) : null}

          {controlsVisible && !activeReady && !activeFailed ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 30, alignItems: 'center', paddingTop: 12 }}>
              <ActivityIndicator color="#F9C80E" size="small" />
            </View>
          ) : null}

          {controlsVisible && nextItem ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 16,
                top: 58,
                zIndex: 30,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 99,
                backgroundColor: 'rgba(0,0,0,0.58)',
                paddingHorizontal: 10,
                paddingVertical: 7,
              }}
            >
              {nextReady ? (
                <Ionicons name="checkmark-circle" size={13} color="#86EFAC" />
              ) : (
                <ActivityIndicator color="#F9C80E" size="small" />
              )}
              <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>
                {nextReady ? 'NEXT READY' : 'PRELOADING NEXT'}
              </Text>
            </View>
          ) : null}

          {activeFailed ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, zIndex: 40, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center', gap: 10, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 24, paddingVertical: 18 }}>
                <Ionicons name="warning-outline" size={28} color="#F9C80E" />
                <Text selectable style={{ color: 'white', fontSize: 13, fontWeight: '900' }}>
                  YouTube could not play this embed
                </Text>
                <Pressable onPress={() => moveBy(1)} style={{ borderRadius: 12, backgroundColor: '#F9C80E', paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: '#052532', fontSize: 11, fontWeight: '900' }}>Next Trailer</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function FeedAction({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minWidth: 66,
        alignItems: 'center',
        gap: 3,
        borderRadius: 14,
        backgroundColor: primary ? '#F9C80E' : 'rgba(0,0,0,0.62)',
        paddingHorizontal: 12,
        paddingVertical: 9,
      }}
    >
      <Ionicons name={icon} size={19} color={primary ? '#052532' : '#FFFFFF'} />
      <Text style={{ color: primary ? '#052532' : '#FFFFFF', fontSize: 9, fontWeight: '900' }}>
        {label}
      </Text>
    </Pressable>
  );
}
