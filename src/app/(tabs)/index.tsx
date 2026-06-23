import ActionModal from '@/components/ActionModal';
import SearchBar from '@/components/SearchBar';
import SuggestionsPanel from '@/components/SuggestionsPanel';
import SwipeableMovieCard from '@/components/SwipeableMovieCard';
import { useMovieActions, useMovieState } from '@/context/MovieContext';
import { useDebounce } from '@/hooks/useDebounce';
import { MovieItem, tmdbService, TrendingWindow } from '@/services/tmdb';
import {
  buildTasteProfile,
  PersonalizedCandidate,
  rankDiscoveryCandidates,
} from '@/services/discovery-ranking';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import SectionHeader from '@/components/SectionHeader';
import MovieSkeleton from '@/components/MovieSkeleton';

type FilterMode = 'all' | 'date' | 'rating';
type SearchState = 'empty' | 'suggestion' | 'results';
type CarouselVariant = 'dated' | 'ranked' | 'watchlist';

interface HomeMovieItem extends MovieItem {
  communityRating?: number;
  isWatched?: boolean;
  isWatchlist?: boolean;
  watchlistAddedAt?: string;
  reason?: string;
}

const getYearNumber = (date?: string) => {
  if (!date) return 0;
  const year = date.match(/\d{4}/)?.[0];
  return year ? Number.parseInt(year, 10) : 0;
};

const getYear = (date?: string) => {
  if (!date) return '';
  return date.match(/\d{4}/)?.[0] ?? date;
};

const formatWatchedDate = (watchedAt: string) => {
  const date = new Date(watchedAt);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function HomeScreen() {
  const { diaryEntries, discoverySignals, movies } = useMovieState();
  const { refreshMovieMetadata } = useMovieActions();
  
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('empty');
  const [isFocused, setIsFocused] = useState(false);
  
  const [results, setResults] = useState<MovieItem[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMovie, setActiveMovie] = useState<MovieItem | null>(null);

  // Home carousels data
  const [topRated, setTopRated] = useState<MovieItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MovieItem[]>([]);
  const [upcoming, setUpcoming] = useState<MovieItem[]>([]);
  const [trendingWindow, setTrendingWindow] = useState<TrendingWindow>('week');
  const [trending, setTrending] = useState<MovieItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [recommendationCandidates, setRecommendationCandidates] = useState<
    Omit<PersonalizedCandidate, 'personalScore'>[]
  >([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [loadingHome, setLoadingHome] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const syncedCommunityRatings = useRef('');
  const loadedTrendingWindowRef = useRef<TrendingWindow | null>(null);
  const recommendationSourcesRef = useRef<{ id: string; title: string }[]>([]);
  const topGenreIdsRef = useRef<number[]>([]);

  const debouncedQuery = useDebounce(query, 350);
  const inputRef = useRef<TextInput>(null);
  const tasteProfile = useMemo(
    () => buildTasteProfile(movies, discoverySignals),
    [discoverySignals, movies]
  );
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
  const recommendationSourceSignature = useMemo(
    () => recommendationSources.map((movie) => movie.id).join(','),
    [recommendationSources]
  );
  const topGenreIds = useMemo(
    () => tasteProfile.topGenres.map((genre) => genre.id),
    [tasteProfile.topGenres]
  );
  const topGenreSignature = useMemo(() => topGenreIds.join(','), [topGenreIds]);
  const hasRecommendationInputs = topGenreIds.length > 0 || recommendationSources.length > 0;

  useEffect(() => {
    recommendationSourcesRef.current = recommendationSources;
    topGenreIdsRef.current = topGenreIds;
  }, [recommendationSources, topGenreIds]);

  const loadHomeCollections = useCallback(
    async (windowToLoad: TrendingWindow) => {
      const [topRatedList, nowPlayingList, upcomingList, trendingList] = await Promise.all([
        tmdbService.getTopRatedMovies(),
        tmdbService.getNowPlayingMovies(),
        tmdbService.getUpcomingMovies(),
        tmdbService.getTrendingMovies(windowToLoad),
      ]);

      setTopRated(topRatedList.slice(0, 10));
      setNowPlaying(nowPlayingList.slice(0, 10));
      setUpcoming(upcomingList.slice(0, 10));
      setTrending(trendingList.slice(0, 12));
      loadedTrendingWindowRef.current = windowToLoad;
    },
    []
  );

  const fetchRecommendationCandidates = useCallback(async () => {
    if (!tasteProfile.hasHistory || !hasRecommendationInputs) {
      return [];
    }

    const nextTopGenreIds = topGenreIdsRef.current;
    const nextRecommendationSources = recommendationSourcesRef.current;
    const [tasteMovies, recommendationGroups] = await Promise.all([
      tmdbService.discoverMoviesByGenres(nextTopGenreIds),
      Promise.all(
        nextRecommendationSources.map(async (source) => {
          const items = await tmdbService.getMovieRecommendations(source.id);
          return items.map<Omit<PersonalizedCandidate, 'personalScore'>>((movie) => ({
            ...movie,
            reason: `Because you liked ${source.title}`,
            source: 'recommended',
          }));
        })
      ),
    ]);
    const candidates: Omit<PersonalizedCandidate, 'personalScore'>[] = [
      ...recommendationGroups.flat(),
      ...tasteMovies.map((movie) => ({
        ...movie,
        reason: 'Selected from your taste profile',
        source: 'taste' as const,
      })),
    ];
    return Array.from(new Map(candidates.map((movie) => [movie.id, movie])).values());
  }, [hasRecommendationInputs, tasteProfile.hasHistory]);

  // Fetch home movie collections from TMDB on mount
  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      setLoadingHome(true);
      try {
        await loadHomeCollections('week');
      } catch (err) {
        console.error('[BrowseHome] Failed to load home screen movies:', err);
      } finally {
        if (isMounted) setLoadingHome(false);
      }
    };

    fetchHomeData();
    return () => {
      isMounted = false;
    };
  }, [loadHomeCollections]);

  useEffect(() => {
    let isMounted = true;

    const fetchTrending = async () => {
      if (loadedTrendingWindowRef.current === trendingWindow) return;
      setLoadingTrending(true);
      try {
        const trendingMovies = await tmdbService.getTrendingMovies(trendingWindow);
        if (isMounted) {
          setTrending(trendingMovies.slice(0, 12));
          loadedTrendingWindowRef.current = trendingWindow;
        }
      } finally {
        if (isMounted) setLoadingTrending(false);
      }
    };

    void fetchTrending();
    return () => {
      isMounted = false;
    };
  }, [trendingWindow]);

  // 2. Fetch suggestions as the user types
  useEffect(() => {
    let isMounted = true;
    const trimmedQuery = debouncedQuery.trim();

    if (trimmedQuery.length === 0) {
      return;
    }

    if (searchState !== 'suggestion') {
      return;
    }

    const loadSuggestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const searchResults = await tmdbService.searchMovies(trimmedQuery);
        if (isMounted) {
          setResults(searchResults);
        }
      } catch {
        if (isMounted) {
          setError('Search failed. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSuggestions();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, searchState]);

  // Derive recently logged movies dynamically
  const recentlyLogged = useMemo(() => {
    const seenMovieIds = new Set<string>();
    const latestEntries = diaryEntries.filter((entry) => {
      if (seenMovieIds.has(entry.movieId)) return false;
      seenMovieIds.add(entry.movieId);
      return true;
    });

    return latestEntries
      .slice(0, 8)
      .map((entry) => ({
        ...entry.movie,
        logId: entry.id,
        rating: entry.rating,
        watchedAt: entry.watchedAt,
        note: entry.note,
      }));
  }, [diaryEntries]);

  const recentlyAddedToWatchlist = useMemo<HomeMovieItem[]>(() => {
    return movies
      .filter((movie) => movie.isWatchlist)
      .sort((a, b) => (b.watchlistAddedAt ?? '').localeCompare(a.watchlistAddedAt ?? ''))
      .slice(0, 10)
      .map((movie) => ({
        id: movie.id,
        title: movie.title,
        image: movie.image,
        date: movie.date,
        rating: movie.rating,
        communityRating: movie.communityRating,
        overview: movie.overview,
        isWatched: movie.isWatched,
        isWatchlist: movie.isWatchlist,
        watchlistAddedAt: movie.watchlistAddedAt,
      }));
  }, [movies]);

  useEffect(() => {
    const missingCommunityRatingIds = recentlyAddedToWatchlist
      .filter((movie) => !movie.communityRating)
      .map((movie) => movie.id)
      .sort();
    const signature = missingCommunityRatingIds.join(',');
    if (!signature || signature === syncedCommunityRatings.current) return;
    syncedCommunityRatings.current = signature;
    void refreshMovieMetadata(missingCommunityRatingIds);
  }, [recentlyAddedToWatchlist, refreshMovieMetadata]);

  const savedMovieById = useMemo(
    () => new Map(movies.map((movie) => [movie.id, movie])),
    [movies]
  );

  const getHomeMovieState = (movieId: string) => {
    const savedMovie = savedMovieById.get(movieId);
    return {
      isWatched: savedMovie?.isWatched ?? false,
      isWatchlist: savedMovie?.isWatchlist ?? false,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const refreshRecommendations = async () => {
      setLoadingRecommendations(true);
      try {
        const nextCandidates = await fetchRecommendationCandidates();
        if (isMounted) setRecommendationCandidates(nextCandidates);
      } catch (error) {
        console.error('[BrowseHome] Failed to load recommendations:', error);
      } finally {
        if (isMounted) setLoadingRecommendations(false);
      }
    };

    void refreshRecommendations();
    return () => {
      isMounted = false;
    };
  }, [fetchRecommendationCandidates, recommendationSourceSignature, topGenreSignature]);

  const recommendations = useMemo(
    () =>
      rankDiscoveryCandidates(recommendationCandidates, tasteProfile)
        .filter((movie) => {
          const state = savedMovieById.get(movie.id);
          return !state?.isWatched && !state?.isWatchlist;
        })
        .slice(0, 12),
    [recommendationCandidates, savedMovieById, tasteProfile]
  );

  const tonightPick = useMemo(
    () =>
      [...recentlyAddedToWatchlist]
        .filter((movie) => !movie.isWatched)
        .sort(
          (a, b) =>
            (b.communityRating ?? b.rating ?? 0) - (a.communityRating ?? a.rating ?? 0)
        )[0],
    [recentlyAddedToWatchlist]
  );

  const sortedResults = useMemo(() => {
    const nextResults = [...results];

    if (filter === 'rating') {
      return nextResults.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    if (filter === 'date') {
      return nextResults.sort((a, b) => getYearNumber(b.date) - getYearNumber(a.date));
    }

    return nextResults;
  }, [filter, results]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    setError(null);

    if (text.trim().length === 0) {
      setSearchState('empty');
      setResults([]);
      setActiveMovie(null);
      return;
    }

    setSearchState('suggestion');
  };

  const handleSubmit = async () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return;
    }

    Keyboard.dismiss();
    setSearchState('results');
    setIsFocused(false);
    setLoading(true);
    setError(null);

    try {
      const searchResults = await tmdbService.searchMovies(trimmedQuery);
      setResults(searchResults);
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setActiveMovie(null);
    setSearchState('empty');
    setIsFocused(false);
    Keyboard.dismiss();
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setError(null);
    try {
      const [, nextCandidates] = await Promise.all([
        loadHomeCollections(trendingWindow),
        fetchRecommendationCandidates(),
      ]);
      setRecommendationCandidates(nextCandidates);
    } catch (refreshError) {
      console.error('[BrowseHome] Failed to refresh home screen:', refreshError);
      setError('Refresh failed. Pull down to try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectSuggestion = (movie: MovieItem) => {
    Keyboard.dismiss();
    setIsFocused(false);
    navigateToMovie(movie);
  };

  const handleCloseModal = () => {
    setActiveMovie(null);
  };

  const handleFilterPress = () => {
    setFilter((current) => {
      if (current === 'all') return 'rating';
      if (current === 'rating') return 'date';
      return 'all';
    });
  };

  const navigateToMovie = (movie: MovieItem) => {
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: movie.id,
        title: movie.title,
        year: getYear(movie.date),
        image: movie.image,
        overview: movie.overview ?? '',
        rating: `${movie.rating ?? 0}`,
      },
    } as never);
  };

  const renderMovie: ListRenderItem<MovieItem> = useCallback(
    ({ item }) => (
      <SwipeableMovieCard
        activeMovieId={activeMovie?.id ?? null}
        movie={item}
        onPressMovie={navigateToMovie}
        onSwipeActive={setActiveMovie}
      />
    ),
    [activeMovie?.id]
  );

  const showHomeView = query.trim().length === 0 && !isFocused;
  const showEmptyFocusView = isFocused && query.trim().length === 0;

  const renderRecentlyLogged = () => (
    <View className="mb-9">
      <SectionHeader title="Recently logged by you" subtitle="Your latest diary activity" />

      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 14, paddingRight: 8 }}
        showsHorizontalScrollIndicator={false}
      >
        {recentlyLogged.map((item) => (
          <Pressable
            key={item.logId}
            className="w-[250px] flex-row gap-3 rounded-2xl border border-white/10 bg-[#073746] p-3"
            onPress={() => navigateToMovie(item)}
          >
            <View
              className="h-[132px] w-[88px] overflow-hidden rounded-xl bg-slate-800"
              style={{ borderCurve: 'continuous' }}
            >
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1 py-1">
              <View className="mb-2 self-start rounded-full bg-brand-yellow/15 px-2 py-1">
                <Text className="text-[9px] font-black uppercase tracking-wider text-brand-yellow">
                  Watched {formatWatchedDate(item.watchedAt)}
                </Text>
              </View>

              <Text numberOfLines={2} className="text-[15px] font-black leading-5 text-white">
                {item.title}
              </Text>

              <View className="mt-2 flex-row items-center gap-1.5">
                <Ionicons name="star" size={14} color="#F9C80E" />
                <Text className="text-[12px] font-black text-white">
                  {(item.rating ?? 0).toFixed(1)}
                </Text>
              </View>

              {item.note ? (
                <Text numberOfLines={2} className="mt-2 text-[10px] font-medium leading-4 text-white/55">
                  &ldquo;{item.note}&rdquo;
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderTrending = () => (
    <View className="mb-9">
      <View className="mb-4 flex-row items-center gap-3">
        <Text className="text-[21px] font-black tracking-tight text-white">Trending</Text>
        <View className="flex-row overflow-hidden rounded-full border border-brand-yellow/35 bg-[#073746]">
          {([
            { label: 'Today', value: 'day' },
            { label: 'This Week', value: 'week' },
          ] as const).map((option) => {
            const isActive = trendingWindow === option.value;
            return (
              <Pressable
                key={option.value}
                className={`px-4 py-1.5 ${isActive ? 'bg-brand-yellow' : 'bg-transparent'}`}
                onPress={() => setTrendingWindow(option.value)}
              >
                <Text
                  className={`text-[11px] font-black ${
                    isActive ? 'text-brand-navy' : 'text-white/70'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {loadingTrending ? <ActivityIndicator size="small" color="#F9C80E" /> : null}
      </View>

      <FlatList
        data={trending}
        horizontal
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingRight: 8 }}
        ItemSeparatorComponent={() => <View className="w-3.5" />}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        nestedScrollEnabled
        removeClippedSubviews
        showsHorizontalScrollIndicator={false}
        windowSize={3}
        renderItem={({ item, index }) => {
          const movieState = getHomeMovieState(item.id);

          return (
            <Pressable onPress={() => navigateToMovie(item)} style={{ width: 132 }}>
              <View className="relative pb-7">
                <View className="absolute inset-x-0 bottom-0 h-24 flex-row items-end justify-between overflow-hidden rounded-b-2xl px-1">
                  {Array.from({ length: 14 }).map((_, barIndex) => (
                    <View
                      key={barIndex}
                      className="w-1 rounded-t-full bg-cyan-300/55"
                      style={{ height: 16 + ((barIndex * 13 + index * 17) % 58) }}
                    />
                  ))}
                </View>

                <View
                  className="h-[198px] w-[132px] overflow-hidden rounded-2xl border border-white/10 bg-brand-navyLight"
                  style={{ borderCurve: 'continuous' }}
                >
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={{ height: 198, width: 132 }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={180}
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-slate-800">
                      <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                    </View>
                  )}

                  <View className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1">
                    <Text className="text-[10px] font-black text-brand-yellow">#{index + 1}</Text>
                  </View>

                  {movieState.isWatched || movieState.isWatchlist ? (
                    <View className="absolute right-2 top-2 gap-1">
                      {movieState.isWatched ? (
                        <View className="h-7 w-7 items-center justify-center rounded-full bg-black/75">
                          <Ionicons name="eye" size={15} color="#F9C80E" />
                        </View>
                      ) : null}
                      {movieState.isWatchlist ? (
                        <View className="h-7 w-7 items-center justify-center rounded-full bg-black/75">
                          <Ionicons name="bookmark" size={14} color="#F9C80E" />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              <Text numberOfLines={1} className="mt-1 text-[13px] font-bold text-white">
                {item.title}
              </Text>
              <Text className="mt-1 text-[10px] font-semibold text-white/50">
                {item.date || `#${index + 1} ${trendingWindow === 'day' ? 'today' : 'this week'}`}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );

  const renderRecommendations = () => {
    return (
      <View className="mb-9">
        <View className="flex-row items-start justify-between gap-3">
          <SectionHeader
            eyebrow="Personalized"
            title="Made for you"
            subtitle="Ranked from your ratings, favorites, and discovery choices"
          />
          {loadingRecommendations ? <ActivityIndicator size="small" color="#F9C80E" /> : null}
        </View>

        <FlatList
          data={recommendations}
          horizontal
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingRight: 8 }}
          ItemSeparatorComponent={() => <View className="w-4" />}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          nestedScrollEnabled
          removeClippedSubviews
          showsHorizontalScrollIndicator={false}
          windowSize={3}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigateToMovie(item)} style={{ width: 142 }}>
              <View
                className="h-[213px] w-[142px] overflow-hidden rounded-2xl border border-brand-yellow/20 bg-brand-navyLight"
                style={{ borderCurve: 'continuous' }}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{ height: 213, width: 142 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={180}
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-slate-800">
                    <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                  </View>
                )}
                <View className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/75">
                  <Ionicons name="sparkles" size={16} color="#F9C80E" />
                </View>
              </View>

              <Text numberOfLines={1} className="mt-2 px-0.5 text-[14px] font-bold text-white">
                {item.title}
              </Text>
              <View className="mt-1 flex-row items-center gap-1 px-0.5">
                <Ionicons name="star" size={13} color="#F9C80E" />
                <Text className="text-[11px] font-black text-white">
                  {(item.rating ?? 0).toFixed(1)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    );
  };

  const renderTonightPick = () => {
    if (!tonightPick) return null;

    return (
      <View className="mb-9">
        <SectionHeader title="Tonight's pick" subtitle="A strong choice from your watchlist" />
        <Pressable
          className="flex-row gap-4 overflow-hidden rounded-3xl border border-brand-yellow/25 bg-[#073746] p-3"
          onPress={() => navigateToMovie(tonightPick)}
        >
          <View className="h-[150px] w-[100px] overflow-hidden rounded-2xl bg-brand-navyLight">
            {tonightPick.image ? (
              <Image source={{ uri: tonightPick.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="film-outline" size={26} color="#A0AEC0" />
              </View>
            )}
          </View>
          <View className="min-w-0 flex-1 justify-center py-2">
            <View className="self-start rounded-full bg-brand-yellow/15 px-2.5 py-1">
              <Text className="text-[9px] font-black uppercase tracking-wider text-brand-yellow">
                From your watchlist
              </Text>
            </View>
            <Text numberOfLines={2} className="mt-3 text-[19px] font-black leading-6 text-white">
              {tonightPick.title}
            </Text>
            <View className="mt-2 flex-row items-center gap-1.5">
              <Ionicons name="star" size={14} color="#F9C80E" />
              <Text className="text-[11px] font-black text-white">
                {(tonightPick.communityRating ?? tonightPick.rating ?? 0).toFixed(1)}
              </Text>
            </View>
            <Text numberOfLines={2} className="mt-2 text-[10px] font-semibold leading-4 text-white/55">
              Your highest-rated unwatched save, ready when you are.
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderMovieCarousel = (title: string, data: HomeMovieItem[], variant: CarouselVariant) => (
    <View className="mb-9">
      <SectionHeader title={title} />
      <FlatList
        data={data}
        horizontal
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingRight: 8 }}
        ItemSeparatorComponent={() => <View className="w-4" />}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        nestedScrollEnabled
        removeClippedSubviews
        showsHorizontalScrollIndicator={false}
        windowSize={3}
        renderItem={({ item, index }) => {
          const movieState = getHomeMovieState(item.id);
          const isWatched = item.isWatched ?? movieState.isWatched;
          const isWatchlist = item.isWatchlist ?? movieState.isWatchlist;

          return (
            <Pressable
              onPress={() => navigateToMovie(item)}
              style={{ width: 142 }}
            >
              <View
                className={`overflow-hidden rounded-2xl border bg-brand-navyLight ${
                  variant === 'ranked' && index < 3 ? 'border-brand-yellow/40' : 'border-white/8'
                }`}
                style={{ height: 213, width: 142, borderCurve: 'continuous' }}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{ height: 213, width: 142 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={180}
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center p-2 bg-slate-800">
                    <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                  </View>
                )}

                {variant === 'ranked' ? (
                  <View className="absolute left-2 top-2 h-7 min-w-7 items-center justify-center rounded-full bg-black/70 px-2">
                    <Text className="text-[11px] font-black text-brand-yellow">#{index + 1}</Text>
                  </View>
                ) : null}

                {isWatched || isWatchlist ? (
                  <View className="absolute right-2 top-2 flex-row gap-1">
                    {isWatched ? (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-black/75">
                        <Ionicons name="eye" size={17} color="#F9C80E" />
                      </View>
                    ) : null}
                    {isWatchlist ? (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-black/75">
                        <Ionicons name="bookmark" size={16} color="#F9C80E" />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <Text numberOfLines={1} className="mt-2 px-0.5 text-[14px] font-bold text-white">
                {item.title}
              </Text>

              {variant === 'ranked' ? (
                <View className="mt-1 flex-row items-center gap-1 px-0.5">
                  <Ionicons name="star" size={14} color="#F9C80E" />
                  <Text className="text-[12px] font-black text-white">
                    {(item.rating ?? 0).toFixed(1)}
                  </Text>
                </View>
              ) : variant === 'watchlist' ? (
                <Text className="mt-1 px-0.5 text-[11px] font-semibold text-brand-yellow">
                  {item.watchlistAddedAt
                    ? `Added ${formatWatchedDate(item.watchlistAddedAt)}`
                    : 'In your watchlist'}
                </Text>
              ) : (
                <Text className="mt-1 px-0.5 text-[11px] font-semibold text-white/55">
                  {item.date || 'Release date TBA'}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: '#002B3A' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          {/* Top Search Bar Row */}
          <View className="z-10 px-4 pb-3 pt-3" style={{ backgroundColor: '#002B3A' }}>
            <SearchBar
              inputRef={inputRef}
              value={query}
              onChangeText={handleChangeText}
              onSubmit={handleSubmit}
              onClear={handleClear}
              onFocus={() => {
                setIsFocused(true);
                if (query.trim().length > 0) {
                  setSearchState('suggestion');
                }
              }}
              onBlur={() => {
                // Keep focused state active if there is text so suggestions stay open
                if (query.trim().length === 0) {
                  setIsFocused(false);
                }
              }}
            />

            {/* Suggestions Overlay */}
            {searchState === 'suggestion' && query.trim().length > 0 ? (
              <SuggestionsPanel
                loading={loading}
                movies={results}
                onSelectMovie={handleSelectSuggestion}
              />
            ) : null}

            {/* Filter Toggle */}
            {searchState === 'results' ? (
              <View className="mt-5 flex-row items-center">
                <Pressable
                  className="h-8 flex-row items-center justify-center rounded-md border border-white px-3"
                  onPress={handleFilterPress}
                >
                  <Text selectable className="text-base font-medium text-white">
                    Filter
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Error Banner */}
          {error ? (
            <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/12 px-3 py-2">
              <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
              <Text selectable className="min-w-0 flex-1 text-xs font-semibold text-red-100">
                {error}
              </Text>
            </View>
          ) : null}

          {/* A. BROWSE HOME VIEW (Default state) */}
          {showHomeView && (
            <ScrollView
              className="flex-1 px-4 pt-3"
              contentContainerStyle={{ paddingBottom: 100 }}
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
              style={{ backgroundColor: '#002B3A' }}
            >
              {loadingHome && topRated.length === 0 ? (
                <View className="gap-8 py-3">
                  {[0, 1, 2].map((section) => (
                    <View key={section}>
                      <View className="mb-4 h-6 w-40 rounded-lg bg-white/5" />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {Array.from({ length: 4 }).map((_, index) => (
                          <MovieSkeleton key={index} />
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              ) : (
                <View>
                  {/* 1. Tonight's pick */}
                  {renderTonightPick()}

                  {/* 3. Personalized recommendations */}
                  {tasteProfile.hasHistory && recommendations.length > 0 && renderRecommendations()}

                  {/* 4. Recently logged by you */}
                  {recentlyLogged.length > 0 && renderRecentlyLogged()}

                  {/* 5. Recently added to watchlist */}
                  {recentlyAddedToWatchlist.length > 0 &&
                    renderMovieCarousel(
                      'Recently added to Watchlist',
                      recentlyAddedToWatchlist,
                      'watchlist'
                    )}

                  {/* 6. Trending */}
                  {trending.length > 0 && renderTrending()}

                  {/* 7. Now Playing */}
                  {nowPlaying.length > 0 &&
                    renderMovieCarousel('Now Playing', nowPlaying, 'dated')}

                  {/* 8. Upcoming movies */}
                  {upcoming.length > 0 &&
                    renderMovieCarousel('Upcoming movies', upcoming, 'dated')}

                  {/* 9. Ranked Movies */}
                  {topRated.length > 0 &&
                    renderMovieCarousel('Ranked Movies', topRated, 'ranked')}
                </View>
              )}
            </ScrollView>
          )}

          {/* B. SEARCH FOCUSED (EMPTY) VIEW */}
          {showEmptyFocusView && (
            <View className="flex-1 items-center justify-center px-8 pb-20">
              <View className="h-24 w-24 items-center justify-center">
                <Ionicons name="document-outline" size={68} color="#FFFFFF" />
                <View className="absolute bottom-3 right-2 rounded-full" style={{ backgroundColor: '#002B3A' }}>
                  <Ionicons name="search-outline" size={44} color="#FFFFFF" />
                </View>
              </View>
              <Text selectable className="mt-5 text-center text-lg font-extrabold text-white">
                What are you looking for?
              </Text>
              <Text selectable className="mt-2 text-center text-xs font-medium text-white/56">
                Search powered by TMDB
              </Text>
            </View>
          )}

          {/* C. ACTIVE SEARCH RESULTS VIEW */}
          {searchState === 'results' && !showHomeView && !showEmptyFocusView ? (
            <View className="flex-1 px-3" style={{ backgroundColor: '#002B3A' }}>
              {loading && sortedResults.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                  <ActivityIndicator size="large" color="#FFB300" />
                </View>
              ) : sortedResults.length > 0 ? (
                <FlatList
                  data={sortedResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMovie}
                  contentInsetAdjustmentBehavior="automatic"
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
                />
              ) : (
                <View className="flex-1 items-center justify-center px-8 pb-20">
                  <Ionicons name="film-outline" size={52} color="#FFFFFF80" />
                  <Text selectable className="mt-4 text-center text-sm font-semibold text-white/62">
                    {`No movies found for "${query}".`}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Action Gesture Modal */}
          <ActionModal
            key={activeMovie?.id ?? 'empty-action-modal'}
            visible={activeMovie !== null}
            movie={activeMovie}
            onClose={handleCloseModal}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
