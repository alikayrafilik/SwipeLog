import React, { useMemo, useState } from 'react';
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
import { useMovies } from '@/context/MovieContext';
import EmptyState from '@/components/EmptyState';
import { GENRE_NAMES } from '@/constants/movies';
import {
  COLUMN_WIDTH,
  POSTER_HEIGHT,
  gridGap,
  listContentStyle,
  virtualizedListProps,
  getYear,
  StarRating,
  FilterSection,
  FilterChip,
} from './shared';

type LogsSortMode = 'recent' | 'rating' | 'year' | 'title';
type RatingFilter = 'all' | 'high' | 'unrated';

export default function LogsTab() {
  const { movies, refreshMovieMetadata, diaryEntries, toggleLike } = useMovies();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsSort, setLogsSort] = useState<LogsSortMode>('recent');
  const [logsRatingFilter, setLogsRatingFilter] = useState<RatingFilter>('all');
  const [logsGenreFilter, setLogsGenreFilter] = useState<number | null>(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshMovieMetadata(movies.map((movie) => movie.id));
    } finally {
      setIsRefreshing(false);
    }
  };

  const movieById = useMemo(
    () => new Map(movies.map((movie) => [movie.id, movie])),
    [movies]
  );

  const watchedMovies = useMemo(() => {
    const seenMovieIds = new Set<string>();
    return diaryEntries
      .filter((entry) => {
        if (seenMovieIds.has(entry.movieId)) return false;
        seenMovieIds.add(entry.movieId);
        return true;
      })
      .map((entry) => {
        const saved = movieById.get(entry.movieId);
        return saved ?? {
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

  const logsGenres = useMemo(() => {
    const counts = new Map<number, number>();
    watchedMovies.forEach((movie) =>
      movie.genreIds?.forEach((genreId) => counts.set(genreId, (counts.get(genreId) ?? 0) + 1))
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ id, count, name: GENRE_NAMES[id] ?? 'Other' }));
  }, [watchedMovies]);

  const filteredWatchedMovies = useMemo(() => {
    const query = logsSearch.trim().toLowerCase();
    const filtered = watchedMovies.filter((movie) => {
      if (query && !movie.title.toLowerCase().includes(query)) return false;
      if (logsGenreFilter && !movie.genreIds?.includes(logsGenreFilter)) return false;
      if (logsRatingFilter === 'high' && movie.rating < 4) return false;
      if (logsRatingFilter === 'unrated' && movie.rating > 0) return false;
      return true;
    });

    if (logsSort === 'rating') return [...filtered].sort((a, b) => b.rating - a.rating);
    if (logsSort === 'year') return [...filtered].sort((a, b) => getYear(b.date).localeCompare(getYear(a.date)));
    if (logsSort === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [logsGenreFilter, logsRatingFilter, logsSearch, logsSort, watchedMovies]);

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
        key="logs-grid"
        data={filteredWatchedMovies}
        keyExtractor={(movie) => movie.id}
        numColumns={4}
        contentContainerStyle={listContentStyle}
        columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
        refreshControl={libraryRefreshControl}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View className="mb-4 gap-3">
            <View className="flex-row items-center gap-2">
              <View className="h-10 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
                <Ionicons name="search-outline" size={16} color="#A0AEC0" />
                <TextInput
                  value={logsSearch}
                  onChangeText={setLogsSearch}
                  placeholder="Search logs"
                  placeholderTextColor="#A0AEC0"
                  className="min-w-0 flex-1 text-[11px] font-semibold text-white"
                />
              </View>
              <Pressable
                className="h-10 flex-row items-center gap-1.5 rounded-xl border border-brand-yellow/25 bg-brand-yellow/10 px-3"
                onPress={() => setShowFilterModal(true)}
              >
                <Ionicons name="options-outline" size={16} color="#F9C80E" />
                <Text className="text-[9px] font-black uppercase text-brand-yellow">Filter</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-black text-white">Watched films</Text>
              <Text className="text-[9px] font-black uppercase text-brand-grayText">
                {filteredWatchedMovies.length} / {watchedMovies.length} films
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="py-8">
            {watchedMovies.length === 0 ? (
              <EmptyState
                icon="film-outline"
                title="Your film history starts here"
                description="Log a film and it will appear in your library."
                actionLabel="Browse films"
                onAction={() => router.push('/(tabs)' as never)}
              />
            ) : (
              <EmptyState
                icon="options-outline"
                title="No logs match"
                description="Try changing your filters or search."
              />
            )}
          </View>
        }
        renderItem={({ item: movie }) => (
          <Pressable
            style={{ width: COLUMN_WIDTH }}
            className="mb-2"
            onPress={() => navigateToMovie(movie)}
          >
            <View
              style={{ width: COLUMN_WIDTH, height: POSTER_HEIGHT }}
              className="overflow-hidden rounded-lg bg-brand-navyLight border border-slate-800/60"
            >
              {movie.image ? (
                <Image source={{ uri: movie.image }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="w-full h-full items-center justify-center p-2 bg-slate-800">
                  <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                </View>
              )}
            </View>
            <View className="flex-row items-center justify-between mt-1.5 px-0.5">
              <StarRating rating={movie.rating} size={8} />
              <Pressable
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  toggleLike(movie.id);
                }}
              >
                <Ionicons
                  name={movie.isLiked ? 'heart' : 'heart-outline'}
                  size={12}
                  color={movie.isLiked ? '#E91E63' : '#A0AEC0'}
                />
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
                <Text className="text-[17px] font-black text-white">Filter Logs</Text>
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
                  { id: 'recent', label: 'Recent' },
                  { id: 'rating', label: 'Rating' },
                  { id: 'year', label: 'Year' },
                  { id: 'title', label: 'Title' },
                ] as { id: LogsSortMode; label: string }[]).map((option) => (
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={logsSort === option.id}
                    onPress={() => setLogsSort(option.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Rating">
                {([
                  { id: 'all', label: 'All ratings' },
                  { id: 'high', label: '4+ stars' },
                  { id: 'unrated', label: 'Unrated' },
                ] as { id: RatingFilter; label: string }[]).map((option) => (
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={logsRatingFilter === option.id}
                    onPress={() => setLogsRatingFilter(option.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Genre">
                <FilterChip label="All genres" selected={logsGenreFilter === null} onPress={() => setLogsGenreFilter(null)} />
                {logsGenres.map((genre) => (
                  <FilterChip
                    key={genre.id}
                    label={`${genre.name} ${genre.count}`}
                    selected={logsGenreFilter === genre.id}
                    onPress={() => setLogsGenreFilter(logsGenreFilter === genre.id ? null : genre.id)}
                  />
                ))}
              </FilterSection>
            </ScrollView>

            <View className="mt-4 flex-row gap-3">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                onPress={() => {
                  setLogsSort('recent');
                  setLogsRatingFilter('all');
                  setLogsGenreFilter(null);
                  setLogsSearch('');
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
    </View>
  );
}
