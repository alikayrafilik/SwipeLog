import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  TextInput,
  Modal,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMovies, LoggedMovie } from '@/context/MovieContext';
import FeedbackToast from '@/components/FeedbackToast';
import { MovieItem, tmdbService } from '@/services/tmdb';
import {
  COLUMN_WIDTH,
  POSTER_HEIGHT,
  gridGap,
  listContentStyle,
  virtualizedListProps,
  getYear,
} from './shared';

type ListSortMode = 'added' | 'rating' | 'year' | 'title';

interface ListCollection {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  automatic: boolean;
  movies: LoggedMovie[];
}

export default function ListsTab() {
  const insets = useSafeAreaInsets();
  const {
    movies,
    refreshMovieMetadata,
    diaryEntries,
    customLists,
    createList,
    deleteList,
    addMovieToList,
    toggleMovieInList,
  } = useMovies();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<ListSortMode>('added');
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [activeListPicker, setActiveListPicker] = useState<string | null>(null);
  const [movieAction, setMovieAction] = useState<{ movie: LoggedMovie; listName: string } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState<MovieItem[]>([]);
  const [isSearchingPicker, setIsSearchingPicker] = useState(false);
  const [pendingPickerMovies, setPendingPickerMovies] = useState<Map<string, MovieItem>>(() => new Map());
  const [pendingPickerRemovals, setPendingPickerRemovals] = useState<Set<string>>(() => new Set());
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

  const latestDiaryEntries = useMemo(() => {
    const seenMovieIds = new Set<string>();
    return diaryEntries.filter((entry) => {
      if (seenMovieIds.has(entry.movieId)) return false;
      seenMovieIds.add(entry.movieId);
      return true;
    });
  }, [diaryEntries]);

  const reviewedMovieIds = useMemo(
    () => new Set(diaryEntries.filter((entry) => Boolean(entry.note?.trim())).map((entry) => entry.movieId)),
    [diaryEntries]
  );

  const automaticLists = useMemo<ListCollection[]>(
    () => [
      {
        id: 'auto-highly-rated',
        name: 'Rated 4+',
        description: 'Films you rated four stars or higher.',
        icon: 'star',
        automatic: true,
        movies: movies.filter((movie) => movie.isWatched && movie.rating >= 4),
      },
      {
        id: 'auto-recent',
        name: 'Recently watched',
        description: 'Your latest unique diary entries.',
        icon: 'time',
        automatic: true,
        movies: latestDiaryEntries.slice(0, 20).map((entry) => {
          const saved = movieById.get(entry.movieId);
          return saved ?? { ...entry.movie, rating: entry.rating, isLiked: false, isWatched: true, isWatchlist: false, lists: [] };
        }),
      },
      {
        id: 'auto-rewatch',
        name: 'Rewatch candidates',
        description: 'Favorites and highly rated films worth revisiting.',
        icon: 'repeat',
        automatic: true,
        movies: movies.filter((movie) => movie.isWatched && (movie.isLiked || movie.rating >= 4.5)),
      },
      {
        id: 'auto-reviewed',
        name: 'Reviewed films',
        description: 'Films with a diary note or review.',
        icon: 'chatbubble-ellipses',
        automatic: true,
        movies: movies.filter((movie) => reviewedMovieIds.has(movie.id)),
      },
    ],
    [latestDiaryEntries, movieById, movies, reviewedMovieIds]
  );

  const customListCollections = useMemo<ListCollection[]>(
    () =>
      customLists.map((name) => ({
        id: `custom-${name}`,
        name,
        description: 'A custom collection curated by you.',
        icon: 'albums',
        automatic: false,
        movies: movies.filter((movie) => movie.lists.includes(name)),
      })),
    [customLists, movies]
  );

  const allListCollections = useMemo(
    () => [...automaticLists, ...customListCollections],
    [automaticLists, customListCollections]
  );

  const selectedList = allListCollections.find((list) => list.id === selectedListId) ?? null;

  const visibleSelectedListMovies = useMemo(() => {
    if (!selectedList) return [];
    const query = listSearch.trim().toLowerCase();
    const filtered = selectedList.movies.filter((movie) => movie.title.toLowerCase().includes(query));
    if (listSort === 'rating') return [...filtered].sort((a, b) => b.rating - a.rating);
    if (listSort === 'year') return [...filtered].sort((a, b) => getYear(b.date).localeCompare(getYear(a.date)));
    if (listSort === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [listSearch, listSort, selectedList]);

  const listCandidates = useMemo(
    () => (activeListPicker ? movies.filter((movie) => movie.isWatched || movie.isWatchlist) : []),
    [activeListPicker, movies]
  );
  const savedMovieById = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);
  const pickerMovies = useMemo(() => {
    const localMatches = listCandidates.filter((movie) =>
      movie.title.toLowerCase().includes(pickerSearch.trim().toLowerCase())
    );
    const remoteOnly = pickerResults.filter((movie) => !savedMovieById.has(movie.id));
    return [...localMatches, ...remoteOnly];
  }, [listCandidates, pickerResults, pickerSearch, savedMovieById]);
  const pendingPickerChangeCount = pendingPickerMovies.size + pendingPickerRemovals.size;

  React.useEffect(() => {
    let isMounted = true;
    const query = pickerSearch.trim();
    if (!activeListPicker || query.length < 2) {
      return;
    }

    const timeout = setTimeout(() => {
      tmdbService.searchMovies(query).then((results) => {
        if (isMounted) setPickerResults(results.slice(0, 12));
      }).finally(() => {
        if (isMounted) setIsSearchingPicker(false);
      });
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [activeListPicker, pickerSearch]);

  const handleCreateListSubmit = () => {
    const trimmed = newListName.trim();
    if (trimmed) {
      createList(trimmed);
      setNewListName('');
      setIsCreatingList(false);
      setActiveListPicker(trimmed);
    }
  };

  const closeListPicker = () => {
    setActiveListPicker(null);
    setPickerSearch('');
    setPickerResults([]);
    setPendingPickerMovies(new Map());
    setPendingPickerRemovals(new Set());
  };

  const togglePendingPickerMovie = (movie: MovieItem, isAlreadyAdded: boolean) => {
    if (isAlreadyAdded) {
      setPendingPickerMovies((current) => {
        const next = new Map(current);
        next.delete(movie.id);
        return next;
      });
      setPendingPickerRemovals((current) => {
        const next = new Set(current);
        if (next.has(movie.id)) next.delete(movie.id);
        else next.add(movie.id);
        return next;
      });
      return;
    }

    setPendingPickerRemovals((current) => {
      const next = new Set(current);
      next.delete(movie.id);
      return next;
    });
    setPendingPickerMovies((current) => {
      const next = new Map(current);
      if (next.has(movie.id)) next.delete(movie.id);
      else next.set(movie.id, movie);
      return next;
    });
  };

  const confirmPickerChanges = () => {
    if (!activeListPicker || pendingPickerChangeCount === 0) return;
    pendingPickerMovies.forEach((movie) => addMovieToList(movie, activeListPicker));
    pendingPickerRemovals.forEach((movieId) => toggleMovieInList(movieId, activeListPicker));
    setFeedbackMessage(
      pendingPickerMovies.size > 0
        ? `${pendingPickerMovies.size} film${pendingPickerMovies.size === 1 ? '' : 's'} added to ${activeListPicker}`
        : `${pendingPickerRemovals.size} film${pendingPickerRemovals.size === 1 ? '' : 's'} removed from ${activeListPicker}`
    );
    closeListPicker();
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

  const renderListCover = (collection: ListCollection) => (
    <View className="h-[118px] flex-row overflow-hidden rounded-2xl bg-brand-navy">
      {collection.movies.slice(0, 3).map((movie) => (
        <View key={movie.id} className="flex-1 overflow-hidden border-r border-brand-navy">
          {movie.image ? (
            <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-slate-800">
              <Ionicons name="film-outline" size={18} color="#A0AEC0" />
            </View>
          )}
        </View>
      ))}
      {collection.movies.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name={collection.icon} size={30} color="#F9C80E" />
        </View>
      ) : null}
    </View>
  );

  const renderAllLists = () => (
    <View className="flex-1">
      <Pressable
        className="mb-4 overflow-hidden rounded-3xl border border-brand-yellow/20 bg-[#073746] p-4"
        onPress={() => router.push('/tier-lists' as never)}
        accessibilityLabel="Open Tier Lists"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-yellow">
            <Ionicons name="podium" size={24} color="#073445" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-black text-white">Tier Lists</Text>
            <Text className="mt-1 text-[9px] font-semibold leading-4 text-brand-grayText">
              Rank films from your logs, watchlist, favorites, or custom lists.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#F9C80E" />
        </View>
      </Pressable>

      {/* Create List Button / Input Box */}
      <View className="mb-6">
        {!isCreatingList ? (
          <TouchableOpacity
            onPress={() => setIsCreatingList(true)}
            className="flex-row items-center justify-center border border-dashed border-slate-700 rounded-xl p-3 bg-[#0D162D]"
          >
            <Ionicons name="add" size={18} color="#F9C80E" />
            <Text className="text-brand-yellow font-extrabold text-[13px] ml-1.5">Create Custom List</Text>
          </TouchableOpacity>
        ) : (
          <View className="bg-brand-navyLight border border-slate-800 rounded-xl p-3">
            <Text className="text-white text-xs font-bold mb-2">New List Name</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={newListName}
                onChangeText={setNewListName}
                placeholder="Type list name..."
                placeholderTextColor="#A0AEC0"
                className="flex-1 text-white border border-slate-800/80 rounded-lg px-3 py-1 bg-brand-navy text-xs"
                style={{ height: 32 }}
                autoFocus
                onSubmitEditing={handleCreateListSubmit}
              />
              <TouchableOpacity
                onPress={handleCreateListSubmit}
                className="bg-brand-yellow rounded-lg px-4 items-center justify-center"
                style={{ height: 32 }}
              >
                <Text className="text-brand-navy font-black text-xs">Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsCreatingList(false);
                  setNewListName('');
                }}
                className="border border-slate-800 rounded-lg px-3 items-center justify-center bg-slate-800/30"
                style={{ height: 32 }}
              >
                <Text className="text-white text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Text className="mb-3 text-[17px] font-black text-white">Smart lists</Text>
      <View className="mb-7 flex-row flex-wrap gap-3">
        {automaticLists.map((collection) => (
          <Pressable
            key={collection.id}
            className="min-w-[46%] flex-1 rounded-2xl border border-brand-yellow/15 bg-brand-navyLight p-2"
            onPress={() => setSelectedListId(collection.id)}
          >
            {renderListCover(collection)}
            <View className="px-1 pb-1 pt-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] font-black text-white">{collection.name}</Text>
                <Text className="text-[9px] font-black text-brand-yellow">{collection.movies.length}</Text>
              </View>
              <Text numberOfLines={2} className="mt-1 text-[8px] font-semibold leading-3 text-brand-grayText">
                {collection.description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text className="mb-3 text-[17px] font-black text-white">Your lists</Text>
      <View className="gap-3">
        {customListCollections.map((collection) => (
          <Pressable
            key={collection.id}
            className="overflow-hidden rounded-2xl border border-white/8 bg-brand-navyLight p-3"
            onPress={() => setSelectedListId(collection.id)}
          >
            <View className="flex-row gap-3">
              <View className="w-32">{renderListCover(collection)}</View>
              <View className="min-w-0 flex-1 justify-center">
                <Text numberOfLines={1} className="text-[15px] font-black text-white">{collection.name}</Text>
                <Text className="mt-1 text-[10px] font-bold text-brand-yellow">{collection.movies.length} films</Text>
                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    className="flex-row items-center gap-1 rounded-lg bg-brand-yellow/10 px-2.5 py-2"
                    onPress={(event) => {
                      event.stopPropagation();
                      setActiveListPicker(collection.name);
                    }}
                  >
                    <Ionicons name="add" size={14} color="#F9C80E" />
                    <Text className="text-[9px] font-black text-brand-yellow">Add</Text>
                  </Pressable>
                  <Pressable
                    className="h-8 w-8 items-center justify-center rounded-lg bg-white/5"
                    onPress={(event) => {
                      event.stopPropagation();
                      deleteList(collection.name);
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color="#A0AEC0" />
                  </Pressable>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#A0AEC0" />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSelectedList = () => {
    if (!selectedList) return null;

    return (
      <View className="flex-1">
        <FlatList
          key={`selected-list-${selectedList.id}`}
          data={visibleSelectedListMovies}
          keyExtractor={(movie) => movie.id}
          numColumns={4}
          contentContainerStyle={listContentStyle}
          columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
          refreshControl={libraryRefreshControl}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={
            <View className="mb-5">
              <Pressable
                className="mb-4 flex-row items-center gap-2 self-start"
                onPress={() => {
                  setSelectedListId(null);
                  setListSearch('');
                }}
              >
                <Ionicons name="arrow-back" size={18} color="#F9C80E" />
                <Text className="text-[11px] font-black uppercase tracking-wider text-brand-yellow">All lists</Text>
              </Pressable>

              {renderListCover(selectedList)}
              <View className="mt-4 flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-[22px] font-black text-white">{selectedList.name}</Text>
                    {selectedList.automatic ? (
                      <View className="rounded-full bg-brand-yellow/15 px-2 py-1">
                        <Text className="text-[8px] font-black uppercase text-brand-yellow">Auto</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-[10px] font-semibold leading-4 text-brand-grayText">
                    {selectedList.description} - {selectedList.movies.length} films
                  </Text>
                </View>
                {!selectedList.automatic ? (
                  <Pressable
                    onPress={() => setActiveListPicker(selectedList.name)}
                    className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow"
                    accessibilityLabel={`Add movies to ${selectedList.name}`}
                  >
                    <Ionicons name="add" size={21} color="#0D162D" />
                  </Pressable>
                ) : null}
              </View>

              <View className="mt-4 flex-row gap-2">
                <View className="h-10 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
                  <Ionicons name="search-outline" size={16} color="#A0AEC0" />
                  <TextInput
                    value={listSearch}
                    onChangeText={setListSearch}
                    placeholder="Search this list"
                    placeholderTextColor="#A0AEC0"
                    className="min-w-0 flex-1 text-[11px] font-semibold text-white"
                  />
                </View>
                <Pressable
                  className="h-10 flex-row items-center gap-1.5 rounded-xl border border-brand-yellow/25 bg-brand-yellow/10 px-3"
                  onPress={() =>
                    setListSort((current) =>
                      current === 'added' ? 'rating' : current === 'rating' ? 'year' : current === 'year' ? 'title' : 'added'
                    )
                  }
                >
                  <Ionicons name="swap-vertical" size={15} color="#F9C80E" />
                  <Text className="text-[9px] font-black uppercase text-brand-yellow">{listSort}</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="albums-outline" size={40} color="#A0AEC0" />
              <Text className="mt-3 text-xs font-semibold text-brand-grayText">No matching films in this list.</Text>
            </View>
          }
          renderItem={({ item: movie }) => (
            <Pressable
              style={{ width: COLUMN_WIDTH }}
              onPress={() => navigateToMovie(movie)}
              onLongPress={() => {
                if (!selectedList.automatic) setMovieAction({ movie, listName: selectedList.name });
              }}
              delayLongPress={300}
            >
              <View
                style={{ width: COLUMN_WIDTH, height: POSTER_HEIGHT }}
                className="overflow-hidden rounded-lg border border-slate-800/60 bg-brand-navyLight"
              >
                {movie.image ? (
                  <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Ionicons name="film-outline" size={20} color="#A0AEC0" />
                  </View>
                )}
                {!selectedList.automatic ? (
                  <Pressable
                    className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/75"
                    onPress={(event) => {
                      event.stopPropagation();
                      setMovieAction({ movie, listName: selectedList.name });
                    }}
                    accessibilityLabel={`More actions for ${movie.title}`}
                  >
                    <Ionicons name="ellipsis-horizontal" size={14} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
              <Text numberOfLines={1} className="mt-1 text-[9px] font-bold text-white">{movie.title}</Text>
            </Pressable>
          )}
          {...virtualizedListProps}
        />

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
                {movieAction?.movie.image ? (
                  <Image source={{ uri: movieAction.movie.image }} className="h-[66px] w-11 rounded-md bg-slate-800" resizeMode="cover" />
                ) : (
                  <View className="h-[66px] w-11 items-center justify-center rounded-md bg-slate-800">
                    <Ionicons name="film-outline" size={18} color="#A0AEC0" />
                  </View>
                )}
                <View className="min-w-0 flex-1">
                  <Text selectable numberOfLines={1} className="text-[16px] font-black text-white">
                    {movieAction?.movie.title}
                  </Text>
                  <Text selectable className="mt-1 text-[10px] font-semibold text-brand-grayText">
                    Actions in {movieAction?.listName}
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
                    if (movieAction) navigateToMovie(movieAction.movie);
                    setMovieAction(null);
                  }}
                >
                  <Ionicons name="information-circle-outline" size={19} color="#F9C80E" />
                  <Text className="text-[12px] font-black text-white">View details</Text>
                </Pressable>
                <Pressable
                  className="h-12 flex-row items-center gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3"
                onPress={() => {
                    if (movieAction) {
                      toggleMovieInList(movieAction.movie.id, movieAction.listName);
                      setFeedbackMessage(`${movieAction.movie.title} removed from ${movieAction.listName}`);
                    }
                    setMovieAction(null);
                  }}
                >
                  <Ionicons name="trash-outline" size={19} color="#FCA5A5" />
                  <Text className="text-[12px] font-black text-red-200">Remove from this list</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const libraryRefreshControlElement = (
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
      {!selectedList ? (
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(128, insets.bottom + 96) }}
          refreshControl={libraryRefreshControlElement}
          showsVerticalScrollIndicator={false}
        >
          {renderAllLists()}
        </ScrollView>
      ) : (
        renderSelectedList()
      )}

      <Modal
        animationType="fade"
        onRequestClose={closeListPicker}
        statusBarTranslucent
        transparent
        visible={activeListPicker !== null}
      >
        <View className="flex-1 justify-end bg-black/65">
          <Pressable className="absolute inset-0" onPress={closeListPicker} />
          <View
            className="max-h-[72%] rounded-t-[24px] border-t border-white/10 bg-[#0D162D] px-4 pb-8 pt-4"
            style={{ borderCurve: 'continuous', paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View className="gap-0.5">
                <Text className="text-[17px] font-black text-white">Add Movies</Text>
                <Text className="text-[11px] font-semibold text-brand-grayText">
                  Search your saved films or find new ones
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close movie picker"
                className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                onPress={closeListPicker}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <View className="mb-3 h-11 flex-row items-center gap-2 rounded-xl border border-white/10 bg-brand-navy px-3">
              <Ionicons name="search-outline" size={16} color="#A0AEC0" />
              <TextInput
                value={pickerSearch}
                onChangeText={(value) => {
                  setPickerSearch(value);
                  if (value.trim().length < 2) {
                    setPickerResults([]);
                    setIsSearchingPicker(false);
                  } else {
                    setIsSearchingPicker(true);
                  }
                }}
                placeholder="Search any film"
                placeholderTextColor="#64748B"
                className="min-w-0 flex-1 text-[11px] font-semibold text-white"
              />
              {isSearchingPicker ? <ActivityIndicator size="small" color="#F9C80E" /> : null}
            </View>

            <FlatList
              data={pickerMovies}
              keyExtractor={(movie) => movie.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8, flexGrow: 1 }}
              ListEmptyComponent={
                <View className="items-center gap-3 py-14">
                  <Ionicons name="film-outline" size={40} color="#A0AEC0" />
                  <Text className="text-center text-xs font-semibold text-brand-grayText">
                    Search for any film, or log/watchlist films first.
                  </Text>
                </View>
              }
              renderItem={({ item: movie }) => {
                const savedMovie = savedMovieById.get(movie.id);
                const isAdded = activeListPicker ? savedMovie?.lists.includes(activeListPicker) ?? false : false;
                const pendingAdd = pendingPickerMovies.has(movie.id);
                const pendingRemove = pendingPickerRemovals.has(movie.id);
                const visuallySelected = pendingAdd || (isAdded && !pendingRemove);
                return (
                  <Pressable
                    key={movie.id}
                    className="mb-2 flex-row items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-2.5"
                    onPress={() => togglePendingPickerMovie(movie, isAdded)}
                  >
                    <View className="h-[66px] w-11 overflow-hidden rounded-md bg-slate-800">
                      {movie.image ? (
                        <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
                      ) : (
                        <View className="h-full w-full items-center justify-center">
                          <Ionicons name="film-outline" size={18} color="#A0AEC0" />
                        </View>
                      )}
                    </View>
                    <View className="min-w-0 flex-1 gap-1">
                      <Text numberOfLines={1} className="text-[13px] font-extrabold text-white">
                        {movie.title}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        {savedMovie?.isWatched ? (
                          <Text className="text-[9px] font-bold uppercase text-brand-yellow">
                            Logged
                          </Text>
                        ) : null}
                        {savedMovie?.isWatchlist ? (
                          <Text className="text-[9px] font-bold uppercase text-brand-grayText">
                            Watchlist
                          </Text>
                        ) : null}
                        {!savedMovie ? (
                          <Text className="text-[9px] font-bold uppercase text-brand-grayText">
                            Search result
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons
                      name={visuallySelected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={24}
                      color={visuallySelected ? '#F9C80E' : '#A0AEC0'}
                    />
                  </Pressable>
                );
              }}
              {...virtualizedListProps}
            />
            {pendingPickerChangeCount > 0 ? (
              <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-brand-yellow/25 bg-brand-yellow/10 p-3">
                <Text className="min-w-0 flex-1 text-[11px] font-black text-white">
                  {pendingPickerChangeCount} change{pendingPickerChangeCount === 1 ? '' : 's'} selected
                </Text>
                <Pressable className="h-10 items-center justify-center rounded-xl bg-brand-yellow px-4" onPress={confirmPickerChanges}>
                  <Text className="text-[10px] font-black uppercase text-brand-navy">Confirm</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
      <FeedbackToast message={feedbackMessage} onDismiss={() => setFeedbackMessage(null)} />
    </View>
  );
}
