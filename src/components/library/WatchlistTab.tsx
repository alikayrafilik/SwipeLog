import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  TextInput,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LoggedMovie, useMovieActions, useMovieState } from '@/context/MovieContext';
import ActionModal from '@/components/ActionModal';
import EmptyState from '@/components/EmptyState';
import FeedbackToast from '@/components/FeedbackToast';
import { GENRE_NAMES } from '@/constants/movies';
import { MovieItem } from '@/services/tmdb';
import {
  listContentStyle,
  virtualizedListProps,
  getYear,
  FilterSection,
  FilterChip,
} from './shared';

type WatchlistSortMode = 'recent' | 'rating' | 'runtime' | 'title';
type RuntimeFilter = 'all' | 'short' | 'medium' | 'long';

export default function WatchlistTab() {
  const { movies } = useMovieState();
  const { refreshMovieMetadata, toggleMovieInList } = useMovieActions();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [watchlistSort, setWatchlistSort] = useState<WatchlistSortMode>('recent');
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>('all');
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [tonightPickId, setTonightPickId] = useState<string | null>(null);
  const [movieAction, setMovieAction] = useState<LoggedMovie | null>(null);
  const [watchlistActionMovie, setWatchlistActionMovie] = useState<MovieItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const syncedWatchlistMetadata = useRef('');

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshMovieMetadata(movies.map((movie) => movie.id));
    } finally {
      setIsRefreshing(false);
    }
  };

  const getWatchlistScore = (movie: LoggedMovie) => movie.communityRating ?? movie.rating ?? 0;
  const getWatchlistScoreLabel = (movie: LoggedMovie) => {
    if (movie.rating > 0) return `Your ${movie.rating.toFixed(1)}`;
    if (movie.communityRating) return `TMDB ${movie.communityRating.toFixed(1)}`;
    return 'No score';
  };

  const watchlistMovies = useMemo(
    () => movies.filter((m) => m.isWatchlist),
    [movies]
  );

  const watchlistGenres = useMemo(() => {
    const counts = new Map<number, number>();
    watchlistMovies.forEach((movie) =>
      movie.genreIds?.forEach((genreId) => counts.set(genreId, (counts.get(genreId) ?? 0) + 1))
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ id, count, name: GENRE_NAMES[id] ?? 'Other' }));
  }, [watchlistMovies]);

  const filteredWatchlistMovies = useMemo(() => {
    const query = watchlistSearch.trim().toLowerCase();
    const filtered = watchlistMovies.filter((movie) => {
      if (query && !movie.title.toLowerCase().includes(query)) return false;
      if (genreFilter && !movie.genreIds?.includes(genreFilter)) return false;
      const runtime = movie.runtimeMinutes;
      if (runtimeFilter === 'short' && (!runtime || runtime >= 100)) return false;
      if (runtimeFilter === 'medium' && (!runtime || runtime < 100 || runtime > 140)) return false;
      if (runtimeFilter === 'long' && (!runtime || runtime <= 140)) return false;
      return true;
    });

    if (watchlistSort === 'rating') return [...filtered].sort((a, b) => getWatchlistScore(b) - getWatchlistScore(a));
    if (watchlistSort === 'runtime') {
      return [...filtered].sort((a, b) => (a.runtimeMinutes ?? Number.MAX_SAFE_INTEGER) - (b.runtimeMinutes ?? Number.MAX_SAFE_INTEGER));
    }
    if (watchlistSort === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return [...filtered].sort((a, b) => (b.watchlistAddedAt ?? '').localeCompare(a.watchlistAddedAt ?? ''));
  }, [genreFilter, runtimeFilter, watchlistMovies, watchlistSearch, watchlistSort]);

  const tonightPick = useMemo(() => {
    const selected = watchlistMovies.find((movie) => movie.id === tonightPickId);
    return selected ?? [...watchlistMovies].sort((a, b) => b.rating - a.rating)[0] ?? null;
  }, [tonightPickId, watchlistMovies]);

  useEffect(() => {
    const missingIds = watchlistMovies
      .filter((movie) => !movie.runtimeMinutes || !movie.genreIds?.length || !movie.communityRating)
      .map((movie) => movie.id)
      .sort();
    const signature = missingIds.join(',');
    if (!signature || signature === syncedWatchlistMetadata.current) return;
    syncedWatchlistMetadata.current = signature;
    void refreshMovieMetadata(missingIds);
  }, [refreshMovieMetadata, watchlistMovies]);

  const shuffleTonightPick = () => {
    if (watchlistMovies.length === 0) return;
    const currentIndex = watchlistMovies.findIndex((movie) => movie.id === tonightPick?.id);
    const nextIndex = watchlistMovies.length === 1 ? 0 : (currentIndex + 1 + Math.floor(Math.random() * (watchlistMovies.length - 1))) % watchlistMovies.length;
    setTonightPickId(watchlistMovies[nextIndex].id);
  };

  const navigateToMovie = (movie: {
    id: string;
    title: string;
    image: string;
    date?: string;
    overview?: string;
    rating?: number;
  }) => {
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

  const libraryRefreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      colors={['#F9C80E']}
      progressBackgroundColor="#073445"
      tintColor="#F9C80E"
    />
  );

  return (
    <View className="flex-1">
      <FlatList
        key="watchlist-list"
        data={filteredWatchlistMovies}
        keyExtractor={(movie) => movie.id}
        contentContainerStyle={listContentStyle}
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={libraryRefreshControl}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View>
            {tonightPick ? (
              <View className="mb-5 overflow-hidden rounded-3xl border border-brand-yellow/25 bg-[#073746] p-3">
                <View className="mb-3 flex-row items-center justify-between">
                  <View>
                    <Text className="text-[9px] font-black uppercase tracking-[2px] text-brand-yellow">Tonight&apos;s pick</Text>
                    <Text className="mt-1 text-[11px] font-semibold text-brand-grayText">One less decision, one more movie.</Text>
                  </View>
                  <Pressable
                    className="h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow/15"
                    onPress={shuffleTonightPick}
                    accessibilityLabel="Choose another watchlist movie"
                  >
                    <Ionicons name="shuffle" size={18} color="#F9C80E" />
                  </Pressable>
                </View>
                <Pressable className="flex-row gap-3" onPress={() => navigateToMovie(tonightPick)}>
                  <View className="h-[132px] w-[88px] overflow-hidden rounded-xl bg-brand-navy">
                    {tonightPick.image ? (
                      <Image source={{ uri: tonightPick.image }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                      </View>
                    )}
                  </View>
                  <View className="min-w-0 flex-1 justify-center">
                    <Text numberOfLines={2} className="text-[18px] font-black leading-6 text-white">{tonightPick.title}</Text>
                    <View className="mt-2 flex-row items-center gap-3">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="star" size={13} color="#F9C80E" />
                        <Text className="text-[10px] font-black text-white">
                          {(tonightPick.communityRating ?? tonightPick.rating).toFixed(1)}
                        </Text>
                      </View>
                      {tonightPick.runtimeMinutes ? (
                        <Text className="text-[10px] font-bold text-brand-grayText">{tonightPick.runtimeMinutes} min</Text>
                      ) : null}
                    </View>
                    <Pressable
                      className="mt-3 self-start flex-row items-center gap-1.5 rounded-lg bg-brand-yellow px-3 py-2"
                      onPress={(event) => {
                        event.stopPropagation();
                        setWatchlistActionMovie(tonightPick);
                      }}
                    >
                      <Ionicons name="eye-outline" size={15} color="#073445" />
                      <Text className="text-[10px] font-black text-brand-navy">Log as watched</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            ) : null}

            <View className="mb-3 flex-row items-center gap-2">
              <View className="h-10 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
                <Ionicons name="search-outline" size={16} color="#A0AEC0" />
                <TextInput
                  value={watchlistSearch}
                  onChangeText={setWatchlistSearch}
                  placeholder="Search watchlist"
                  placeholderTextColor="#A0AEC0"
                  className="min-w-0 flex-1 text-[11px] font-semibold text-white"
                />
              </View>
              <Pressable
                className="h-10 flex-row items-center gap-1 rounded-xl border border-brand-yellow/25 bg-brand-yellow/10 px-3"
                onPress={() => setShowFilterModal(true)}
              >
                <Ionicons name="options-outline" size={15} color="#F9C80E" />
                <Text className="text-[8px] font-black uppercase text-brand-yellow">Filter</Text>
              </Pressable>
            </View>

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[15px] font-black text-white">Your watchlist</Text>
              <Text className="text-[9px] font-black uppercase text-brand-grayText">
                {filteredWatchlistMovies.length} / {watchlistMovies.length} films
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          watchlistMovies.length > 0 ? (
            <View className="items-center py-16">
              <Ionicons name="options-outline" size={42} color="#A0AEC0" />
              <Text className="mt-3 text-center text-xs font-semibold text-brand-grayText">No films match these filters.</Text>
            </View>
          ) : (
            <View className="py-8">
              <EmptyState
                icon="bookmark-outline"
                title="Save something for later"
                description="Add films to your watchlist and use filters to choose what to watch."
                actionLabel="Find films"
                onAction={() => router.push('/(tabs)' as never)}
              />
            </View>
          )
        }
        renderItem={({ item: movie }) => (
          <Pressable
            className="flex-row items-center gap-3 rounded-2xl border border-white/8 bg-brand-navyLight p-2.5"
            onPress={() => navigateToMovie(movie)}
            onLongPress={() => setMovieAction(movie)}
            delayLongPress={300}
          >
            <View className="h-[84px] w-14 overflow-hidden rounded-lg bg-brand-navy">
              {movie.image ? (
                <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Ionicons name="film-outline" size={20} color="#A0AEC0" />
                </View>
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[13px] font-black text-white">{movie.title}</Text>
              <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="star" size={11} color="#F9C80E" />
                  <Text className="text-[9px] font-bold text-brand-yellow">{getWatchlistScoreLabel(movie)}</Text>
                </View>
                {movie.runtimeMinutes ? <Text className="text-[9px] font-bold text-brand-grayText">{movie.runtimeMinutes} min</Text> : null}
                {getYear(movie.date) ? <Text className="text-[9px] font-bold text-brand-grayText">{getYear(movie.date)}</Text> : null}
              </View>
              <Text numberOfLines={1} className="mt-2 text-[8px] font-semibold text-white/40">
                {movie.genreIds?.slice(0, 2).map((id) => GENRE_NAMES[id]).filter(Boolean).join(' - ') || 'Movie'}
              </Text>
            </View>
            <View className="gap-2">
              <Pressable
                className="h-8 w-8 items-center justify-center rounded-lg bg-brand-yellow/15"
                onPress={(event) => {
                  event.stopPropagation();
                  setWatchlistActionMovie(movie);
                }}
                accessibilityLabel={`Log ${movie.title} as watched`}
              >
                <Ionicons name="eye-outline" size={16} color="#F9C80E" />
              </Pressable>
              <Pressable
                className="h-8 w-8 items-center justify-center rounded-lg bg-white/5"
                onPress={(event) => {
                  event.stopPropagation();
                  setMovieAction(movie);
                }}
                accessibilityLabel={`More actions for ${movie.title}`}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color="#A0AEC0" />
              </Pressable>
            </View>
          </Pressable>
        )}
        {...virtualizedListProps}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
        statusBarTranslucent
        transparent
        visible={showFilterModal}
      >
        <View className="flex-1 justify-end bg-black/65">
          <Pressable className="absolute inset-0" onPress={() => setShowFilterModal(false)} />
          <View
            className="max-h-[78%] rounded-t-[24px] border-t border-white/10 bg-[#0D162D] px-4 pb-8 pt-4"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[17px] font-black text-white">Filter Watchlist</Text>
                <Text className="mt-0.5 text-[10px] font-semibold text-brand-grayText">
                  Narrow the library without losing your place.
                </Text>
              </View>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white/8" onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={19} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <FilterSection title="Sort by">
                {([
                  { id: 'recent', label: 'Recently added' },
                  { id: 'rating', label: 'Score' },
                  { id: 'runtime', label: 'Runtime' },
                  { id: 'title', label: 'Title' },
                ] as { id: WatchlistSortMode; label: string }[]).map((option) => (
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={watchlistSort === option.id}
                    onPress={() => setWatchlistSort(option.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Runtime">
                {([
                  { id: 'all', label: 'Any length' },
                  { id: 'short', label: 'Under 100m' },
                  { id: 'medium', label: '100-140m' },
                  { id: 'long', label: 'Over 140m' },
                ] as { id: RuntimeFilter; label: string }[]).map((option) => (
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={runtimeFilter === option.id}
                    onPress={() => setRuntimeFilter(option.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Genre">
                <FilterChip label="All genres" selected={genreFilter === null} onPress={() => setGenreFilter(null)} />
                {watchlistGenres.map((genre) => (
                  <FilterChip
                    key={genre.id}
                    label={`${genre.name} ${genre.count}`}
                    selected={genreFilter === genre.id}
                    onPress={() => setGenreFilter(genreFilter === genre.id ? null : genre.id)}
                  />
                ))}
              </FilterSection>
            </ScrollView>

            <View className="mt-4 flex-row gap-3">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                onPress={() => {
                  setWatchlistSort('recent');
                  setRuntimeFilter('all');
                  setGenreFilter(null);
                  setWatchlistSearch('');
                }}
              >
                <Text className="text-[11px] font-black text-white">Reset</Text>
              </Pressable>
              <Pressable className="h-11 flex-1 items-center justify-center rounded-xl bg-brand-yellow" onPress={() => setShowFilterModal(false)}>
                <Text className="text-[11px] font-black text-brand-navy">Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setMovieAction(null)}
        statusBarTranslucent
        transparent
        visible={movieAction !== null}
      >
        <View className="flex-1 justify-end bg-black/65">
          <Pressable className="absolute inset-0" onPress={() => setMovieAction(null)} />
          <View
            className="rounded-t-[24px] border-t border-white/10 bg-[#0D162D] px-4 pb-8 pt-4"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="mb-4 flex-row items-center gap-3">
              {movieAction?.image ? (
                <Image source={{ uri: movieAction.image }} className="h-[66px] w-11 rounded-md bg-slate-800" resizeMode="cover" />
              ) : (
                <View className="h-[66px] w-11 items-center justify-center rounded-md bg-slate-800">
                  <Ionicons name="film-outline" size={18} color="#A0AEC0" />
                </View>
              )}
              <View className="min-w-0 flex-1">
                <Text selectable numberOfLines={1} className="text-[16px] font-black text-white">
                  {movieAction?.title}
                </Text>
                <Text selectable className="mt-1 text-[10px] font-semibold text-brand-grayText">
                  Watchlist actions
                </Text>
              </View>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white/8" onPress={() => setMovieAction(null)}>
                <Ionicons name="close" size={19} color="#FFFFFF" />
              </Pressable>
            </View>

            <View className="gap-2">
              <Pressable
                className="h-12 flex-row items-center gap-3 rounded-xl bg-white/5 px-3"
                onPress={() => {
                  if (movieAction) navigateToMovie(movieAction);
                  setMovieAction(null);
                }}
              >
                <Ionicons name="information-circle-outline" size={19} color="#F9C80E" />
                <Text className="text-[12px] font-black text-white">View details</Text>
              </Pressable>
              <Pressable
                className="h-12 flex-row items-center gap-3 rounded-xl bg-brand-yellow px-3"
                onPress={() => {
                  if (movieAction) setWatchlistActionMovie(movieAction);
                  setMovieAction(null);
                }}
              >
                <Ionicons name="eye-outline" size={19} color="#073445" />
                <Text className="text-[12px] font-black text-brand-navy">Log as watched</Text>
              </Pressable>
              <Pressable
                className="h-12 flex-row items-center gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3"
                onPress={() => {
                  if (movieAction) {
                    toggleMovieInList(movieAction.id, 'Watchlist');
                    setFeedbackMessage(`${movieAction.title} removed from Watchlist`);
                  }
                  setMovieAction(null);
                }}
              >
                <Ionicons name="trash-outline" size={19} color="#FCA5A5" />
                <Text className="text-[12px] font-black text-red-200">Remove from Watchlist</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ActionModal
        key={watchlistActionMovie?.id ?? 'watchlist-action'}
        visible={watchlistActionMovie !== null}
        movie={watchlistActionMovie}
        onClose={() => setWatchlistActionMovie(null)}
      />
      <FeedbackToast message={feedbackMessage} onDismiss={() => setFeedbackMessage(null)} />
    </View>
  );
}
