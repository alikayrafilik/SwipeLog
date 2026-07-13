import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMovieActions, useMovieState } from '@/context/MovieContext';
import { getBottomSheetPadding } from '@/constants/layout';
import { trackEvent } from '@/services/analytics';

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatMinutes = (minutes: number) => {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
};

const toDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
};

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { movies, watchHistory } = useMovieState();

  useEffect(() => {
    void trackEvent('profile_stats_viewed', {
      source: 'profile',
      profile_owner: 'self',
      visible_sections: 'overview_genres_ratings_time_patterns',
    });
  }, []);
  const { refreshMovieMetadata } = useMovieActions();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stats = useMemo(() => {
    const movieById = new Map(movies.map((movie) => [movie.id, movie]));
    const ratedEntries = watchHistory.filter((entry) => entry.rating > 0);
    const uniqueWatchedIds = [...new Set(watchHistory.map((entry) => entry.movieId))];
    const watchedMovies = uniqueWatchedIds
      .map((id) => movieById.get(id))
      .filter((movie): movie is NonNullable<typeof movie> => Boolean(movie));
    const totalMinutes = watchHistory.reduce(
      (total, entry) => total + (movieById.get(entry.movieId)?.runtimeMinutes ?? 0),
      0
    );
    const currentYear = new Date().getFullYear();
    const thisYearEntries = watchHistory.filter((entry) => new Date(entry.watchedAt).getFullYear() === currentYear);
    const averageRating = ratedEntries.length
      ? ratedEntries.reduce((total, entry) => total + entry.rating, 0) / ratedEntries.length
      : 0;

    const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
      label: `${rating}`,
      count: ratedEntries.filter((entry) => Math.round(entry.rating) === rating).length,
    }));

    const genreCounts = new Map<number, number>();
    watchedMovies.forEach((movie) =>
      movie.genreIds?.forEach((genreId) => genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + 1))
    );
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count, name: GENRE_NAMES[id] ?? 'Other' }));

    const months = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - offset));
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        count: 0,
      };
    });
    watchHistory.forEach((entry) => {
      const date = new Date(entry.watchedAt);
      const month = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
      if (month) month.count += 1;
    });

    const dayCounts = Array(7).fill(0) as number[];
    watchHistory.forEach((entry) => {
      const date = new Date(entry.watchedAt);
      if (!Number.isNaN(date.getTime())) dayCounts[date.getDay()] += 1;
    });
    const favoriteDayIndex = dayCounts.indexOf(Math.max(...dayCounts));

    const dateKeys = [...new Set(watchHistory.map((entry) => toDateKey(entry.watchedAt)).filter(Boolean))]
      .map((key) => new Date(`${key}T12:00:00`).getTime())
      .sort((a, b) => a - b);
    let longestStreak = dateKeys.length ? 1 : 0;
    let streak = longestStreak;
    for (let index = 1; index < dateKeys.length; index += 1) {
      streak = Math.round((dateKeys[index] - dateKeys[index - 1]) / 86400000) === 1 ? streak + 1 : 1;
      longestStreak = Math.max(longestStreak, streak);
    }

    const watchCounts = new Map<string, number>();
    watchHistory.forEach((entry) => watchCounts.set(entry.movieId, (watchCounts.get(entry.movieId) ?? 0) + 1));
    const mostRewatched = [...watchCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => ({ movie: movieById.get(id), count }))
      .filter((item): item is { movie: NonNullable<typeof item.movie>; count: number } => Boolean(item.movie));

    const topRated = [...watchedMovies]
      .filter((movie) => movie.rating > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    return {
      averageRating,
      favoriteDay: watchHistory.length ? DAY_NAMES[favoriteDayIndex] : '-',
      likedCount: movies.filter((movie) => movie.isLiked).length,
      longestStreak,
      months,
      mostRewatched,
      ratingDistribution,
      reviewCount: watchHistory.filter((entry) => Boolean(entry.note?.trim())).length,
      thisYearCount: thisYearEntries.length,
      topGenres,
      topRated,
      totalMinutes,
      uniqueCount: uniqueWatchedIds.length,
    };
  }, [movies, watchHistory]);

  const maxMonthCount = Math.max(1, ...stats.months.map((month) => month.count));
  const maxRatingCount = Math.max(1, ...stats.ratingDistribution.map((item) => item.count));

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshMovieMetadata([...new Set(watchHistory.map((entry) => entry.movieId))]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openMovie = (movie: (typeof movies)[number]) => {
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: movie.id,
        title: movie.title,
        year: movie.date?.match(/\d{4}/)?.[0] ?? '',
        image: movie.image,
        overview: movie.overview ?? '',
        rating: `${movie.rating}`,
      },
    } as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      <View className="h-14 flex-row items-center gap-3 border-b border-white/5 px-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View>
          <Text className="text-lg font-black text-white">Your statistics</Text>
          <Text className="text-[9px] font-bold uppercase tracking-widest text-brand-grayText">All-time activity</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: getBottomSheetPadding(insets.bottom, 40), gap: 18 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#F9C80E']}
            progressBackgroundColor="#0D162D"
            tintColor="#F9C80E"
          />
        }
      >
        <LinearGradient
          colors={['#27355C', '#111A35', '#0D162D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="overflow-hidden rounded-3xl border border-white/10 p-5"
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-widest text-brand-yellow">
                Time spent watching
              </Text>
              <Text className="mt-2 text-3xl font-black text-white">{formatMinutes(stats.totalMinutes)}</Text>
              <Text className="mt-1 text-[10px] font-semibold text-brand-grayText">
                Across {watchHistory.length} diary {watchHistory.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-yellow/15">
              <Ionicons name="time-outline" size={31} color="#F9C80E" />
            </View>
          </View>
        </LinearGradient>

        <View className="flex-row flex-wrap gap-3">
          {[
            { icon: 'film-outline', label: 'Watched films', value: stats.uniqueCount },
            { icon: 'calendar-outline', label: 'This year', value: stats.thisYearCount },
            { icon: 'star-outline', label: 'Average', value: stats.averageRating ? stats.averageRating.toFixed(1) : '-' },
            { icon: 'chatbubble-outline', label: 'Reviews', value: stats.reviewCount },
          ].map((item) => (
            <View key={item.label} className="min-w-[46%] flex-1 rounded-2xl border border-white/5 bg-brand-navyLight p-4">
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={17} color="#F9C80E" />
              <Text className="mt-3 text-2xl font-black text-white">{item.value}</Text>
              <Text className="mt-1 text-[9px] font-black uppercase tracking-wider text-brand-grayText">{item.label}</Text>
            </View>
          ))}
        </View>

        {watchHistory.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-white/15 bg-brand-navyLight px-5 py-10">
            <Ionicons name="bar-chart-outline" size={34} color="#F9C80E" />
            <Text className="mt-4 text-base font-black text-white">Your stats will appear here</Text>
            <Text className="mt-2 text-center text-[11px] font-semibold leading-5 text-brand-grayText">
              Log your first film to start building your viewing history.
            </Text>
          </View>
        ) : (
          <>
            <View className="rounded-2xl border border-white/5 bg-brand-navyLight p-4">
              <Text className="text-base font-black text-white">Last 6 months</Text>
              <Text className="mt-1 text-[10px] font-semibold text-brand-grayText">Diary entries by month</Text>
              <View className="mt-5 h-32 flex-row items-end gap-2">
                {stats.months.map((month) => (
                  <View key={month.key} className="flex-1 items-center justify-end gap-2">
                    <Text className="text-[9px] font-black text-white">{month.count || ''}</Text>
                    <View className="h-24 w-full justify-end overflow-hidden rounded-t-lg bg-white/5">
                      <View
                        className="w-full rounded-t-lg bg-brand-yellow"
                        style={{ height: `${Math.max(5, (month.count / maxMonthCount) * 100)}%` }}
                      />
                    </View>
                    <Text className="text-[8px] font-bold uppercase text-brand-grayText">{month.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="rounded-2xl border border-white/5 bg-brand-navyLight p-4">
              <Text className="text-base font-black text-white">Rating distribution</Text>
              <View className="mt-4 gap-3">
                {stats.ratingDistribution.map((item) => (
                  <View key={item.label} className="flex-row items-center gap-3">
                    <View className="w-7 flex-row items-center gap-1">
                      <Text className="text-[10px] font-black text-brand-yellow">{item.label}</Text>
                      <Ionicons name="star" size={9} color="#F9C80E" />
                    </View>
                    <View className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <View
                        className="h-full rounded-full bg-brand-yellow"
                        style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
                      />
                    </View>
                    <Text className="w-6 text-right text-[10px] font-black text-brand-grayText">{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View>
              <Text className="mb-3 text-base font-black text-white">Viewing habits</Text>
              <View className="flex-row flex-wrap gap-3">
                {[
                  { icon: 'flame-outline', label: 'Longest streak', value: `${stats.longestStreak} days` },
                  { icon: 'heart-outline', label: 'Liked films', value: `${stats.likedCount}` },
                  { icon: 'today-outline', label: 'Favorite day', value: stats.favoriteDay },
                  { icon: 'repeat-outline', label: 'Rewatched', value: `${stats.mostRewatched.length} films` },
                ].map((item) => (
                  <View key={item.label} className="min-w-[46%] flex-1 rounded-2xl border border-white/5 bg-brand-navyLight p-4">
                    <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color="#F9C80E" />
                    <Text className="mt-3 text-sm font-black text-white">{item.value}</Text>
                    <Text className="mt-1 text-[8px] font-black uppercase tracking-wider text-brand-grayText">{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {stats.topGenres.length > 0 ? (
              <View className="rounded-2xl border border-white/5 bg-brand-navyLight p-4">
                <Text className="text-base font-black text-white">Top genres</Text>
                <View className="mt-4 gap-3">
                  {stats.topGenres.map((genre, index) => (
                    <View key={genre.id} className="flex-row items-center gap-3">
                      <Text className="w-5 text-[10px] font-black text-brand-yellow">#{index + 1}</Text>
                      <Text className="flex-1 text-[11px] font-bold text-white">{genre.name}</Text>
                      <Text className="text-[10px] font-black text-brand-grayText">{genre.count} films</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {stats.topRated.length > 0 ? (
              <View>
                <Text className="mb-3 text-base font-black text-white">Your highest rated</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {stats.topRated.map((movie) => (
                    <TouchableOpacity
                      key={movie.id}
                      className="w-24"
                      activeOpacity={0.8}
                      onPress={() => openMovie(movie)}
                      accessibilityLabel={`Open ${movie.title}`}
                    >
                      <Image source={{ uri: movie.image }} className="aspect-[2/3] w-24 rounded-xl bg-brand-navyLight" />
                      <Text numberOfLines={2} className="mt-2 text-[10px] font-black leading-3 text-white">{movie.title}</Text>
                      <View className="mt-1 flex-row items-center gap-1">
                        <Ionicons name="star" size={10} color="#F9C80E" />
                        <Text className="text-[9px] font-black text-brand-yellow">{movie.rating.toFixed(1)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {stats.mostRewatched.length > 0 ? (
              <View>
                <Text className="mb-3 text-base font-black text-white">Most rewatched</Text>
                <View className="gap-2">
                  {stats.mostRewatched.map(({ movie, count }) => (
                    <TouchableOpacity
                      key={movie.id}
                      className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-brand-navyLight p-3"
                      activeOpacity={0.8}
                      onPress={() => openMovie(movie)}
                    >
                      <Image source={{ uri: movie.image }} className="h-16 w-11 rounded-lg bg-brand-navy" />
                      <Text numberOfLines={2} className="flex-1 text-[12px] font-black leading-4 text-white">{movie.title}</Text>
                      <View className="flex-row items-center gap-1 rounded-full bg-brand-yellow/10 px-3 py-2">
                        <Ionicons name="repeat" size={12} color="#F9C80E" />
                        <Text className="text-[10px] font-black text-brand-yellow">{count}x</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
