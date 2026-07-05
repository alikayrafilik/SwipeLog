import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import { useAuthState } from '@/context/AuthContext';
import { useSharedWatchlists } from '@/context/SharedWatchlistContext';
import { useMovieState } from '@/context/MovieContext';
import { AUTH_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { MovieItem, tmdbService } from '@/services/tmdb';
import type {
  SharedWatchlistDetail,
  SharedWatchlistItem,
} from '@/services/shared-watchlists';

const toMovieItem = (item: SharedWatchlistItem): MovieItem => ({
  id: item.movieId,
  title: item.title,
  image: item.image,
  date: item.date,
  overview: item.overview,
});

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

export default function SharedWatchlistDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const listId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuthState();
  const {
    addMovieToSharedList,
    archiveList,
    getListDetail,
    renameList,
    removeMovieFromSharedList,
    markSeenBy,
    removeSeenBy,
  } = useSharedWatchlists();
  const { movies, watchHistory } = useMovieState();
  const [list, setList] = useState<SharedWatchlistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [query, setQuery] = useState('');
  const [draftName, setDraftName] = useState('');
  const [results, setResults] = useState<MovieItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;
  const isOwner = Boolean(userId && list?.ownerId === userId);
  const isArchived = list?.status === 'archived';

  const loadDetail = useCallback(async () => {
    if (!listId) return;
    setIsLoading(true);
    try {
          const detail = await getListDetail(listId);
          setList(detail);
          setDraftName(detail?.name ?? '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the shared watchlist.');
    } finally {
      setIsLoading(false);
    }
  }, [getListDetail, listId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadDetail]);

  useEffect(() => {
    if (!listId || !list || !userId || isArchived) return;

    let changed = false;
    const syncSeenBy = async () => {
      for (const item of list.items) {
        const userWatched = movies.find((m) => m.id === item.movieId)?.isWatched ?? false;
        const alreadySeen = item.seenBy?.some((s) => s.userId === userId) ?? false;

        if (userWatched && !alreadySeen) {
          try {
            const watchEntry = watchHistory.find((w) => w.movieId === item.movieId);
            await markSeenBy(listId, item.movieId, watchEntry?.watchedAt);
            changed = true;
          } catch (err) {
            console.error('[SharedWatchlist] Failed to mark movie seenBy:', err);
          }
        } else if (!userWatched && alreadySeen) {
          try {
            await removeSeenBy(listId, item.movieId);
            changed = true;
          } catch (err) {
            console.error('[SharedWatchlist] Failed to remove movie seenBy:', err);
          }
        }
      }

      if (changed) {
        const detail = await getListDetail(listId);
        if (detail) setList(detail);
      }
    };

    void syncSeenBy();
  }, [listId, list, movies, watchHistory, userId, isArchived, markSeenBy, removeSeenBy, getListDetail]);

  const listItems = useMemo(() => {
    return [...(list?.items ?? [])].sort((a, b) => {
      return b.addedAt.localeCompare(a.addedAt);
    });
  }, [list?.items]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (isArchived) {
      setMessage('This shared watchlist is archived.');
      return;
    }
    setIsSearching(true);
    setMessage(null);
    try {
      const movies = await tmdbService.searchMovies(trimmed);
      setResults(movies.slice(0, 8));
    } catch {
      setMessage('Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMovie = async (movie: MovieItem) => {
    if (!listId) return;
    if (isArchived) {
      setMessage('This shared watchlist is archived.');
      return;
    }
    setMessage(null);
    try {
      await addMovieToSharedList(listId, movie);
      const detail = await getListDetail(listId);
      setList(detail);
      setResults([]);
      setQuery('');
      setMessage(`${movie.title} added to ${list?.name ?? 'the shared list'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the movie.');
    }
  };

  const handleRemoveMovie = async (item: SharedWatchlistItem) => {
    if (!listId || isArchived) return;
    try {
      await removeMovieFromSharedList(listId, item.movieId);
      const detail = await getListDetail(listId);
      setList(detail);
      setMessage(`${item.title} removed from ${list?.name ?? 'the shared list'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove this movie.');
    }
  };

  const handleShareInvite = async () => {
    if (!list || isArchived) return;
    try {
      await Share.share({
        title: `${list.name} invite`,
        message: `Join "${list.name}" on SwipeLog with invite code ${list.inviteCode}.`,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the share sheet.');
    }
  };

  const handleRename = async () => {
    if (!listId || !isOwner || isArchived || isRenaming) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setMessage('Shared list name cannot be empty.');
      return;
    }
    if (trimmed === list?.name) return;
    setIsRenaming(true);
    setMessage(null);
    try {
      await renameList(listId, trimmed);
      const detail = await getListDetail(listId);
      setList(detail);
      setDraftName(detail?.name ?? trimmed);
      setMessage('Shared list renamed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not rename this list.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleArchive = async () => {
    if (!listId || !isOwner || isArchived) return;
    Alert.alert(
      'Archive shared watchlist?',
      'This closes the invite code and prevents new movies or edits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await archiveList(listId);
                router.replace('/shared-watchlists' as never);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Could not archive this list.');
              }
            })();
          },
        },
      ]
    );
  };

  const renderMovieRow = (item: SharedWatchlistItem) => {
    const canRemoveMovie = !isArchived && (isOwner || item.addedBy === userId);

    const seenByList = item.seenBy ?? [];
    let watchedText = '';
    if (seenByList.length > 0) {
      const names = seenByList.map((s) => (s.userId === userId ? 'You' : s.displayName));
      if (names.length === 1) {
        watchedText = `${names[0]} watched`;
      } else if (names.length === 2) {
        watchedText = `${names[0]} and ${names[1]} watched`;
      } else {
        watchedText = `${names[0]}, ${names[1]} and ${names.length - 2} more watched`;
      }
    }

    return (
      <View key={item.id} className="gap-3 rounded-2xl border border-white/10 bg-[#073746] p-3">
        <View className="flex-row gap-3">
          <Pressable
            className="h-[108px] w-[72px] overflow-hidden rounded-xl bg-slate-800"
            onPress={() => router.push({ pathname: '/movie/[id]', params: { ...toMovieItem(item), id: item.movieId } } as never)}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="film-outline" size={24} color="#A0AEC0" />
              </View>
            )}
          </Pressable>
          <View className="min-w-0 flex-1 justify-center">
            <Text selectable numberOfLines={2} className="text-[16px] font-black leading-5 text-white">
              {item.title}
            </Text>
            <Text selectable className="mt-1 text-[10px] font-semibold text-brand-grayText">
              Added by {item.addedByName}
            </Text>
            {watchedText ? (
              <View className="mt-1 flex-row items-center gap-1">
                <Ionicons name="eye" size={12} color="#F9C80E" />
                <Text selectable className="text-[10px] font-bold text-brand-yellow">
                  {watchedText}
                </Text>
              </View>
            ) : null}
            <View className="mt-3 flex-row flex-wrap gap-2">
              {item.date ? (
                <View className="rounded-full bg-white/8 px-2 py-1">
                  <Text className="text-[10px] font-bold text-white/70">{item.date.match(/\d{4}/)?.[0] ?? item.date}</Text>
                </View>
              ) : null}
              <View className="rounded-full bg-brand-yellow/12 px-2 py-1">
                <Text className="text-[10px] font-black uppercase text-brand-yellow">Shared List</Text>
              </View>
            </View>
          </View>
        </View>

        {!isArchived && canRemoveMovie ? (
          <View className="flex-row gap-2">
            <Pressable
              className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-3"
              onPress={() => void handleRemoveMovie(item)}
            >
              <Ionicons name="trash-outline" size={15} color="#FCA5A5" />
              <Text className="text-[10px] font-black uppercase text-red-200">Remove</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderMovieList = () => (
    <View className="gap-3">
      <View>
        <Text selectable className="text-[16px] font-black text-white">
          Movies
        </Text>
        <Text selectable className="mt-1 text-[10px] font-semibold text-brand-grayText">
          {listItems.length} {listItems.length === 1 ? 'movie' : 'movies'} added by this list&apos;s members.
        </Text>
      </View>
      {listItems.length > 0 ? (
        listItems.map(renderMovieRow)
      ) : (
        <View className="rounded-2xl border border-dashed border-white/12 bg-white/5 px-4 py-7">
          <EmptyState
            icon="film-outline"
            title="No movies yet"
            description={isArchived ? 'This archived shared list has no movies.' : 'Search above to add the first movie.'}
          />
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-navy">
        <ActivityIndicator size="large" color="#F9C80E" />
      </SafeAreaView>
    );
  }

  if (!list) {
    return (
      <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            icon="alert-circle-outline"
            title="Shared list not found"
            description="The invite may have expired or you may not have access to this watchlist."
            actionLabel="Back to lists"
            onAction={() => router.replace('/shared-watchlists' as never)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 16, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-xl bg-white/8"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text selectable numberOfLines={1} className="text-[23px] font-black text-white">
              {list.name}
            </Text>
            <Text selectable className="mt-1 text-[10px] font-black uppercase tracking-wider text-brand-grayText">
              {list.members.length} members - {list.items.length} movies - invite {list.inviteCode}
            </Text>
          </View>
          {isOwner && !isArchived ? (
            <Pressable
              accessibilityLabel="Edit shared list name"
              className="h-10 w-10 items-center justify-center rounded-xl bg-white/8"
              onPress={() => setDraftName(list.name)}
            >
              <Ionicons name="create-outline" size={18} color="#F9C80E" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Share invite code"
            accessibilityState={{ disabled: isArchived }}
            className={`h-10 w-10 items-center justify-center rounded-xl ${
              isArchived ? 'bg-white/8' : 'bg-brand-yellow'
            }`}
            disabled={isArchived}
            onPress={handleShareInvite}
          >
            <Ionicons name="share-social" size={18} color={isArchived ? '#728391' : '#051E2A'} />
          </Pressable>
        </View>

        {isOwner && !isArchived ? (
          <View className="gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="create-outline" size={16} color="#F9C80E" />
              <Text selectable className="text-[14px] font-black text-white">
                Rename shared list
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Movie Night"
                placeholderTextColor="#728391"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#002B3A] px-3 text-[14px] font-bold text-white"
                selectionColor="#F9C80E"
                returnKeyType="done"
                onSubmitEditing={() => void handleRename()}
              />
              <Pressable
                className={`h-12 w-24 items-center justify-center rounded-xl ${
                  isRenaming || draftName.trim() === list.name ? 'bg-white/10' : 'bg-brand-yellow'
                }`}
                disabled={isRenaming || draftName.trim() === list.name}
                onPress={() => void handleRename()}
              >
                {isRenaming ? (
                  <ActivityIndicator size="small" color="#051E2A" />
                ) : (
                  <Text
                    className={`text-[11px] font-black uppercase ${
                      draftName.trim() === list.name ? 'text-white/50' : 'text-brand-navy'
                    }`}
                  >
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View>
              <Text selectable className="text-[14px] font-black text-white">
                Members
              </Text>
              <Text selectable className="mt-1 text-[10px] font-semibold text-brand-grayText">
                Everyone here can add films.
              </Text>
            </View>
            <Text className="text-[10px] font-black uppercase text-brand-yellow">{list.members.length}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {list.members.map((member) => (
              <View key={member.userId} className="flex-row items-center gap-2 rounded-full bg-white/8 px-2.5 py-2">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-yellow">
                  <Text className="text-[10px] font-black text-brand-navy">{getInitials(member.displayName)}</Text>
                </View>
                <Text numberOfLines={1} className="max-w-[120px] text-[11px] font-bold text-white">
                  {member.displayName}
                </Text>
                {member.role === 'owner' ? (
                  <Ionicons name="star" size={11} color="#F9C80E" />
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View className="rounded-2xl border border-brand-yellow/25 bg-brand-yellow/10 p-4">
          <Text selectable className="text-[12px] font-black uppercase tracking-wider text-brand-yellow">
            {isArchived ? 'Archived shared list' : 'Shared movie list'}
          </Text>
          <Text selectable className="mt-2 text-[14px] font-semibold leading-5 text-white/82">
            {isArchived
              ? 'This shared list is read-only. Invite codes and movie changes are closed.'
              : 'Add films with friends. Each movie keeps who added it, without votes or status steps.'}
          </Text>
        </View>

        {isOwner ? (
          !isArchived ? (
            <Pressable
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10"
              onPress={handleArchive}
            >
              <Ionicons name="archive-outline" size={16} color="#FCA5A5" />
              <Text className="text-[10px] font-black uppercase text-red-200">Archive list</Text>
            </Pressable>
          ) : null
        ) : null}

        {!isArchived ? (
          <View className="gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
            <Text selectable className="text-[15px] font-black text-white">
              Add a movie
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="Search TMDB"
                placeholderTextColor="#728391"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#002B3A] px-3 text-[14px] font-bold text-white"
                selectionColor="#F9C80E"
                returnKeyType="search"
              />
              <Pressable
                className="h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow"
                onPress={handleSearch}
              >
                {isSearching ? <ActivityIndicator size="small" color="#051E2A" /> : <Ionicons name="search" size={18} color="#051E2A" />}
              </Pressable>
            </View>
            {results.length > 0 ? (
              <View className="gap-2">
                {results.map((movie) => (
                  <Pressable
                    key={movie.id}
                    className="flex-row items-center gap-3 rounded-xl border border-white/8 bg-[#002B3A] p-2"
                    onPress={() => void handleAddMovie(movie)}
                  >
                    <View className="h-[66px] w-[44px] overflow-hidden rounded-lg bg-slate-800">
                      {movie.image ? (
                        <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
                      ) : (
                        <View className="h-full w-full items-center justify-center">
                          <Ionicons name="film-outline" size={18} color="#A0AEC0" />
                        </View>
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text selectable numberOfLines={1} className="text-[13px] font-black text-white">
                        {movie.title}
                      </Text>
                      <Text selectable numberOfLines={1} className="mt-1 text-[10px] font-semibold text-brand-grayText">
                        {movie.date || 'Release date TBA'}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#F9C80E" />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {message ? (
          <View className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Text selectable className="text-[11px] font-semibold text-white/80">
              {message}
            </Text>
          </View>
        ) : null}

        {renderMovieList()}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
