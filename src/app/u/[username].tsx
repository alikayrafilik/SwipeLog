import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useAuthState } from '@/context/AuthContext';
import { useMovieState } from '@/context/MovieContext';
import { useSharedWatchlists } from '@/context/SharedWatchlistContext';
import { useUserProfile } from '@/hooks/use-user-profile';
import {
  buildPublicProfile,
  PublicProfile,
  PublicProfileMovie,
  RelationshipSummary,
  socialService,
} from '@/services/social';
import { trackEvent } from '@/services/analytics';

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const { session } = useAuthState();
  const insets = useSafeAreaInsets();
  const { diaryEntries, movies } = useMovieState();
  const { createListWithFriend } = useSharedWatchlists();
  const { profile } = useUserProfile();
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipSummary>({ state: 'none', request: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreatingSharedList, setIsCreatingSharedList] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userId = session?.user.id;
  const currentPublicProfile = userId ? buildPublicProfile(userId, profile, movies, diaryEntries) : null;

  useEffect(() => {
    const timeout = setTimeout(() => {
      void (async () => {
        if (!username || !userId) return;
        setIsLoading(true);
        try {
          const currentProfile = buildPublicProfile(userId, profile, movies, diaryEntries);
          await socialService.publishPublicProfile(currentProfile);
          const nextProfile = await socialService.getPublicProfileByUsername(username);
          setPublicProfile(nextProfile);
          if (nextProfile) {
            void trackEvent('friend_profile_opened', { source: 'profile_link_or_list' });
            void trackEvent('profile_stats_viewed', {
              source: 'public_profile',
              profile_owner: 'friend',
              visible_sections: 'summary_favorites_recent_activity',
            });
            setRelationship(await socialService.getRelationship(userId, nextProfile.userId));
          }
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Could not load this profile.');
        } finally {
          setIsLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(timeout);
  }, [diaryEntries, movies, profile, userId, username]);

  const handleFriendAction = async () => {
    if (!currentPublicProfile || !publicProfile || isUpdating) return;
    setIsUpdating(true);
    setMessage(null);
    try {
      if (relationship.state === 'incoming' && relationship.request) {
        await socialService.acceptFriendRequest(relationship.request);
        void trackEvent('friend_request_accepted', { source: 'public_profile', age_bucket: 'unknown' });
      } else if (relationship.state === 'none') {
        await socialService.sendFriendRequest(currentPublicProfile, publicProfile);
        void trackEvent('friend_request_sent', { source: 'public_profile' });
      }
      setRelationship(await socialService.getRelationship(currentPublicProfile.userId, publicProfile.userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update friendship.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateSharedList = async () => {
    if (!publicProfile || relationship.state !== 'friends' || isCreatingSharedList) return;
    setIsCreatingSharedList(true);
    setMessage(null);
    try {
      const list = await createListWithFriend({
        userId: publicProfile.userId,
        displayName: publicProfile.displayName,
        username: publicProfile.username,
        avatarUrl: publicProfile.avatarUrl,
        avatarIcon: publicProfile.avatarIcon,
        avatarColor: publicProfile.avatarColor,
        createdAt: new Date().toISOString(),
      });
      router.push({ pathname: '/shared-watchlist/[id]', params: { id: list.id } } as never);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create a shared list.');
    } finally {
      setIsCreatingSharedList(false);
    }
  };

  const actionLabel =
    relationship.state === 'self'
      ? 'Your Profile'
      : relationship.state === 'friends'
        ? 'Friends'
        : relationship.state === 'sent'
          ? 'Request Sent'
          : relationship.state === 'incoming'
            ? 'Accept Request'
            : 'Add Friend';
  const actionDisabled = relationship.state === 'self' || relationship.state === 'friends' || relationship.state === 'sent';

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-navy">
        <ActivityIndicator size="large" color="#F9C80E" />
      </SafeAreaView>
    );
  }

  if (!publicProfile) {
    return (
      <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            icon="person-circle-outline"
            title="Profile not found"
            description="This link may be old, or the user has not published a profile yet."
            actionLabel="Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const favoriteMovies = normalizePublicMovies(publicProfile.favoriteMovies);
  const favoriteFilms = normalizePublicMovies(publicProfile.favoriteFilms);
  const recentDiaryEntries = normalizePublicMovies(publicProfile.recentDiaryEntries);
  const recentReviews = normalizePublicMovies(publicProfile.recentReviews);
  const watchedCount = publicProfile.stats.watched ?? 0;
  const watchlistCount = publicProfile.stats.watchlist ?? 0;
  const averageRating = publicProfile.stats.averageRating;

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['bottom', 'left', 'right']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
        <View className="relative">
          {publicProfile.coverUrl ? (
            <Image source={{ uri: publicProfile.coverUrl }} className="h-44 w-full" contentFit="cover" />
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
          <Pressable
            className="absolute left-4 h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-brand-navy/60"
            style={{ top: insets.top > 0 ? insets.top + 8 : 16 }}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View className="relative border-b border-slate-800/30 bg-brand-navyLight px-4 pb-3 pt-4">
          <View className="absolute left-4 -top-14 z-20 h-32 w-32 overflow-hidden rounded-full border-4 border-brand-navyLight bg-slate-700">
            {publicProfile.avatarUrl ? (
              <Image source={{ uri: publicProfile.avatarUrl }} className="h-full w-full" contentFit="cover" />
            ) : (
              <ProfileAvatar
                icon={publicProfile.avatarIcon}
                color={publicProfile.avatarColor}
                size={120}
                roundedClassName="rounded-full"
              />
            )}
          </View>

          <View className="min-h-[84px] pl-[138px]">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-xl font-bold tracking-wide text-white">
                  {publicProfile.displayName}
                </Text>
                <Text numberOfLines={1} className="mt-0.5 text-xs font-semibold text-brand-grayText">
                  @{publicProfile.username}
                </Text>
              </View>
              <Pressable
                className={`mt-0.5 rounded-md px-3 py-1.5 ${actionDisabled ? 'border border-white/10 bg-white/5' : 'bg-brand-yellow'}`}
                disabled={actionDisabled || isUpdating}
                onPress={handleFriendAction}
                accessibilityLabel={actionLabel}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#073445" />
                ) : (
                  <Text className={`text-[10px] font-black ${actionDisabled ? 'text-white/60' : 'text-brand-navy'}`}>
                    {actionLabel}
                  </Text>
                )}
              </Pressable>
            </View>
            <Text
              selectable={Boolean(publicProfile.bio)}
              numberOfLines={2}
              className="mt-2 text-[11px] font-medium leading-4 text-brand-grayText"
            >
              {publicProfile.bio || 'No bio yet.'}
            </Text>
          </View>

          {message ? (
            <View className="mt-4 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2">
              <Text className="text-[11px] font-semibold text-red-100">{message}</Text>
            </View>
          ) : null}
        </View>

        {relationship.state === 'friends' ? (
          <View className="px-4 pt-4">
            <Pressable
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
              onPress={() => void handleCreateSharedList()}
              disabled={isCreatingSharedList}
              accessibilityLabel="Create shared list with this friend"
            >
              {isCreatingSharedList ? (
                <ActivityIndicator size="small" color="#073445" />
              ) : (
                <Ionicons name="people" size={16} color="#073445" />
              )}
              <Text className="text-[11px] font-black uppercase text-brand-navy">Create Shared List</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-2 px-4">
          <Text className="mb-3 text-[17px] font-bold tracking-wide text-white">Favorite four</Text>
            {favoriteMovies.length > 0 ? (
              <View className="flex-row gap-2">
                {favoriteMovies.map((movie, index) => (
                  <View key={`${movie.id}-favorite-${index}`} className="min-w-0 flex-1">
                    <View className="aspect-[2/3] overflow-hidden rounded-xl bg-slate-800">
                      {movie.image ? <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" /> : null}
                    </View>
                    <Text numberOfLines={2} className="mt-2 text-[10px] font-bold leading-3 text-white">{movie.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center justify-center rounded-xl border border-dashed border-white/15 bg-brand-navyLight px-4 py-7">
                <Ionicons name="heart-outline" size={26} color="#F9C80E" />
                <Text className="mt-2 text-[11px] font-black text-white">No favorite four yet</Text>
              </View>
            )}
        </View>

        <View className="mt-4 gap-3 px-4">
          <View className="flex-row gap-3">
            <Stat icon="film-outline" label="Watched" value={`${watchedCount}`} subtitle="Movies" />
            <Stat icon="book-outline" label="Diary" value={`${recentDiaryEntries.length}`} subtitle="Entries" />
          </View>
          <View className="flex-row gap-3">
            <Stat icon="bookmark-outline" label="Watchlist" value={`${watchlistCount}`} subtitle="Movies" />
            <Stat icon="star-outline" label="Average" value={averageRating ? averageRating.toFixed(1) : '-'} subtitle="Out of 5" />
          </View>
        </View>

        <View className="mt-6 px-4">
          <Text className="mb-3 text-[17px] font-bold tracking-wide text-white">Your activity</Text>
          <View className="rounded-xl border border-slate-800/80 bg-brand-navyLight p-4">
            <View className="mb-4 flex-row items-end justify-between">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-brand-grayText">Profile snapshot</Text>
                <Text className="mt-1 text-xl font-black text-white">{watchedCount} watched</Text>
              </View>
              <Text className="text-[9px] font-semibold text-brand-grayText">
                {recentReviews.length} reviews shared
              </Text>
            </View>
            <Text className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-grayText">Taste preview</Text>
            <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <View
                className="h-full rounded-full bg-brand-yellow"
                style={{ width: `${Math.min(100, Math.max(12, (favoriteFilms.length / 8) * 100))}%` }}
              />
            </View>
          </View>
        </View>

        <PublicMovieStrip
          title="Favorite films"
          emptyText="No favorites marked yet."
          movies={favoriteFilms}
        />

        <PublicMovieStrip
          title="Recent diary entries"
          emptyText="No diary entries yet."
          movies={recentDiaryEntries}
        />

        <View className="mt-6 px-4">
          <Text className="mb-3 text-[17px] font-bold tracking-wide text-white">Recent Reviews</Text>
            {recentReviews.length > 0 ? (
              <View className="gap-3">
                {recentReviews.map((movie, index) => (
                  <Pressable
                    key={`${movie.id}-review-${index}`}
                    className="flex-row rounded-xl border border-slate-800/80 bg-brand-navyLight p-4"
                    onPress={() => router.push({
                      pathname: '/movie/[id]',
                      params: {
                        id: movie.id,
                        title: movie.title,
                        year: movie.date?.match(/\d{4}/)?.[0] ?? '',
                        image: movie.image,
                        overview: '',
                        rating: `${movie.rating ?? 0}`,
                      },
                    } as never)}
                  >
                    <View className="h-28 w-20 overflow-hidden rounded-xl bg-slate-800">
                      {movie.image ? <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" /> : null}
                    </View>
                    <View className="min-w-0 flex-1 pl-3">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="star" size={12} color="#F9C80E" />
                        <Text className="text-[10px] font-black text-brand-yellow">{movie.rating ? movie.rating.toFixed(1) : '-'}</Text>
                      </View>
                      <Text numberOfLines={2} className="mt-1 text-[13px] font-black leading-5 text-white">{movie.title}</Text>
                      {movie.overview ? (
                        <Text numberOfLines={4} className="mt-2 text-[11px] font-semibold leading-4 text-brand-grayText">{movie.overview}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-xs italic text-brand-grayText">{publicProfile.displayName} has not shared reviews yet.</Text>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PublicMovieStrip({
  emptyText,
  movies,
  title,
}: {
  emptyText: string;
  movies: PublicProfile['favoriteFilms'];
  title: string;
}) {
  const visibleMovies = normalizePublicMovies(movies);

  return (
    <View className="mt-6 px-4">
      <Text className="mb-3 text-[17px] font-bold tracking-wide text-white">{title}</Text>
      {visibleMovies.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {visibleMovies.map((movie, index) => (
            <Pressable
              key={`${movie.id}-${index}`}
              className="w-28"
              onPress={() => router.push({
                pathname: '/movie/[id]',
                params: {
                  id: movie.id,
                  title: movie.title,
                  year: movie.date?.match(/\d{4}/)?.[0] ?? '',
                  image: movie.image,
                  overview: movie.overview ?? '',
                  rating: `${movie.rating ?? 0}`,
                },
              } as never)}
            >
              <View className="aspect-[2/3] overflow-hidden rounded-xl bg-slate-800">
                {movie.image ? <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" /> : null}
              </View>
              <Text numberOfLines={2} className="mt-2 text-[10px] font-bold leading-3 text-white">{movie.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text className="text-xs italic text-brand-grayText">{emptyText}</Text>
      )}
    </View>
  );
}

function normalizePublicMovies(movies: PublicProfileMovie[] | undefined) {
  if (!Array.isArray(movies)) return [];
  return movies
    .map((movie, index) => ({
      id: typeof movie?.id === 'string' && movie.id ? movie.id : `public-movie-${index}`,
      title: typeof movie?.title === 'string' && movie.title ? movie.title : 'Untitled movie',
      image: typeof movie?.image === 'string' ? movie.image : '',
      date: typeof movie?.date === 'string' ? movie.date : undefined,
      rating: typeof movie?.rating === 'number' ? movie.rating : undefined,
      overview: typeof movie?.overview === 'string' ? movie.overview : undefined,
    }))
    .filter((movie) => movie.id && movie.title);
}

function Stat({
  icon,
  label,
  subtitle,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  value: string;
}) {
  return (
    <View className="h-[104px] flex-1 rounded-2xl border border-slate-800/80 bg-brand-navyLight px-3.5 py-3">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={13} color="#A0AEC0" />
        <Text className="text-[9px] font-black uppercase tracking-wider text-brand-grayText">{label}</Text>
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-center text-[26px] font-black text-white">{value}</Text>
      </View>
      <Text className="text-center text-[9px] font-bold uppercase tracking-wider text-brand-grayText">{subtitle}</Text>
    </View>
  );
}
