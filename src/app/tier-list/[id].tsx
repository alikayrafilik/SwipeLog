import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableTierPoster from '@/components/DraggableTierPoster';
import EmptyState from '@/components/EmptyState';
import { LoggedMovie, useMovies } from '@/context/MovieContext';
import { MovieTierList, useTierLists } from '@/context/TierListContext';
import { MovieItem, tmdbService } from '@/services/tmdb';

type EditorMode = 'rank' | 'board';

const getYear = (date?: string) => date?.match(/\d{4}/)?.[0] ?? '';
const TIER_COLORS = ['#F87171', '#FB923C', '#FACC15', '#4ADE80', '#60A5FA', '#A78BFA', '#F472B6'];

export default function TierListEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { movies, saveMovie } = useMovies();
  const {
    addMovies,
    addTier,
    deleteTierList,
    deleteTier,
    moveTier,
    moveMovieToTier,
    moveMovieWithinTier,
    removeMovie,
    renameTier,
    renameTierList,
    resetTierList,
    restoreTierList,
    shuffleUnranked,
    skipUnrankedMovie,
    tierLists,
    updateTierColor,
  } = useTierLists();
  const [mode, setMode] = useState<EditorMode>('rank');
  const [activeMovieId, setActiveMovieId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMovieManager, setShowMovieManager] = useState(false);
  const [movieSearch, setMovieSearch] = useState('');
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<string>>(() => new Set());
  const [selectedMoviesById, setSelectedMoviesById] = useState<Map<string, MovieItem>>(() => new Map());
  const [searchResults, setSearchResults] = useState<MovieItem[]>([]);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<MovieTierList | null>(null);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const tierRowRefs = useRef<Record<string, View | null>>({});
  const dropZones = useRef<{ tierId: string | null; top: number; bottom: number }[]>([]);
  const shareCardRef = useRef<View>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [tierDrafts, setTierDrafts] = useState<Record<string, string>>({});

  const tierList = tierLists.find((list) => list.id === id) ?? null;
  const movieById = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);
  const currentMovie = tierList
    ? tierList.unrankedMovieIds.map((movieId) => movieById.get(movieId)).find(Boolean) ?? null
    : null;
  const activeMovie = activeMovieId ? movieById.get(activeMovieId) ?? null : null;
  const rankedCount = tierList?.tiers.reduce((total, tier) => total + tier.movieIds.length, 0) ?? 0;
  const shareRows =
    tierList?.tiers.map((tier) => {
      const moviesInTier = tier.movieIds
        .map((movieId) => movieById.get(movieId))
        .filter((movie): movie is LoggedMovie => Boolean(movie));
      return {
        ...tier,
        hiddenCount: Math.max(0, moviesInTier.length - 8),
        movies: moviesInTier.slice(0, 8),
        totalCount: moviesInTier.length,
      };
    }) ?? [];
  const normalizedMovieSearch = movieSearch.trim().toLowerCase();
  const availableMovies = tierList
    ? [
        ...movies.filter(
          (movie) =>
            !tierList.sourceMovieIds.includes(movie.id) &&
            (!normalizedMovieSearch || movie.title.toLowerCase().includes(normalizedMovieSearch))
        ),
        ...searchResults.filter(
          (movie) => !tierList.sourceMovieIds.includes(movie.id) && !movieById.has(movie.id)
        ),
      ]
    : [];

  useEffect(() => {
    let isMounted = true;
    const query = movieSearch.trim();
    if (!showMovieManager || query.length < 2) {
      return;
    }
    const timeout = setTimeout(() => {
      tmdbService.searchMovies(query).then((results) => {
        if (isMounted) setSearchResults(results.slice(0, 12));
      }).finally(() => {
        if (isMounted) setIsSearchingMovies(false);
      });
    }, 300);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [movieSearch, showMovieManager]);

  const rememberForUndo = () => {
    if (tierList) setUndoSnapshot(JSON.parse(JSON.stringify(tierList)) as MovieTierList);
  };

  const performMoveToTier = (movieId: string, tierId: string | null) => {
    if (!tierList) return;
    rememberForUndo();
    moveMovieToTier(tierList.id, movieId, tierId);
  };

  const openMovieManager = () => {
    setSelectedMovieIds(new Set());
    setSelectedMoviesById(new Map());
    setMovieSearch('');
    setShowMovieManager(true);
  };

  const addSelectedMovies = () => {
    if (!tierList) return;
    if (selectedMovieIds.size > 0) {
      rememberForUndo();
      selectedMoviesById.forEach((movie) => saveMovie(movie));
      addMovies(tierList.id, [...selectedMovieIds]);
    }
    setShowMovieManager(false);
  };

  const removeMovieFromTierList = (movieId: string) => {
    if (!tierList) return;
    rememberForUndo();
    removeMovie(tierList.id, movieId);
  };

  const measureDropZones = () => {
    if (!tierList) return;
    const zones: { tierId: string | null; top: number; bottom: number }[] = [];
    const entries = [...tierList.tiers.map((tier) => tier.id), 'unranked'];
    entries.forEach((tierId) => {
      tierRowRefs.current[tierId]?.measureInWindow((_x, y, _width, height) => {
        zones.push({
          tierId: tierId === 'unranked' ? null : tierId,
          top: y,
          bottom: y + height,
        });
        dropZones.current = zones;
      });
    });
  };

  const handlePosterDrop = (movieId: string, absoluteY: number) => {
    const target = dropZones.current.find(
      (zone) => absoluteY >= zone.top && absoluteY <= zone.bottom
    );
    if (target) performMoveToTier(movieId, target.tierId);
  };

  const shareTierList = async () => {
    if (!tierList || !shareCardRef.current || isSharing) return;
    try {
      setIsSharing(true);
      if (rankedCount === 0) {
        Alert.alert('Nothing to share yet', 'Rank at least one film before sharing this tier list.');
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'File sharing is not available on this device.');
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share ${tierList.title}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('[TierLists] Failed to share:', error);
      Alert.alert('Share failed', 'The tier list image could not be created.');
    } finally {
      setIsSharing(false);
    }
  };

  const openMovie = (movie: LoggedMovie) => {
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: movie.id,
        title: movie.title,
        year: getYear(movie.date),
        image: movie.image,
        overview: movie.overview ?? '',
        rating: `${movie.rating}`,
      },
    } as never);
  };

  const openSettings = () => {
    if (!tierList) return;
    setDraftTitle(tierList.title);
    setTierDrafts(Object.fromEntries(tierList.tiers.map((tier) => [tier.id, tier.label])));
    setShowSettings(true);
  };

  const saveSettings = () => {
    if (!tierList) return;
    renameTierList(tierList.id, draftTitle);
    tierList.tiers.forEach((tier) => renameTier(tierList.id, tier.id, tierDrafts[tier.id] ?? tier.label));
    setShowSettings(false);
  };

  const confirmReset = () => {
    if (!tierList) return;
    Alert.alert('Reset ranking?', 'Every film will return to the unranked queue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => resetTierList(tierList.id) },
    ]);
  };

  const confirmDelete = () => {
    if (!tierList) return;
    Alert.alert('Delete tier list?', `${tierList.title} will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTierList(tierList.id);
          router.back();
        },
      },
    ]);
  };

  if (!tierList) {
    return (
      <SafeAreaView className="flex-1 bg-brand-navy p-4" edges={['top', 'bottom']}>
        <EmptyState
          icon="podium-outline"
          title="Tier list not found"
          description="This tier list may have been deleted."
          actionLabel="Back to Tier Lists"
          onAction={() => router.replace('/tier-lists' as never)}
        />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 border-b border-white/10 px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-navyLight"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[17px] font-black text-white">{tierList.title}</Text>
          <Text className="text-[9px] font-bold text-brand-grayText">
            {rankedCount}/{tierList.sourceMovieIds.length} ranked Â· {tierList.sourceLabel}
          </Text>
        </View>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-xl bg-brand-navyLight"
          onPress={openMovieManager}
          accessibilityLabel="Add films to tier list"
        >
          <Ionicons name="add" size={20} color="#F9C80E" />
        </Pressable>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-xl bg-brand-navyLight"
          onPress={() => setShowSharePreview(true)}
          accessibilityLabel="Share tier list"
        >
          <Ionicons name="share-outline" size={18} color="#F9C80E" />
        </Pressable>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-xl bg-brand-navyLight"
          onPress={openSettings}
          accessibilityLabel="Tier list settings"
        >
          <Ionicons name="settings-outline" size={18} color="#F9C80E" />
        </Pressable>
      </View>

      <View className="mx-4 mt-3 h-11 flex-row rounded-xl border border-white/10 bg-brand-navyLight p-1">
        {([
          { id: 'rank', label: 'Quick Rank', icon: 'layers-outline' },
          { id: 'board', label: 'Tier Board', icon: 'podium-outline' },
        ] as { id: EditorMode; label: string; icon: keyof typeof Ionicons.glyphMap }[]).map((item) => {
          const selected = mode === item.id;
          return (
            <Pressable
              key={item.id}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg ${selected ? 'bg-brand-yellow' : ''}`}
              onPress={() => setMode(item.id)}
            >
              <Ionicons name={item.icon} size={14} color={selected ? '#073445' : '#A0AEC0'} />
              <Text className={`text-[9px] font-black ${selected ? 'text-brand-navy' : 'text-brand-grayText'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'rank' ? (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {currentMovie ? (
            <>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                  Waiting to be ranked
                </Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    className="h-8 w-8 items-center justify-center rounded-lg bg-white/8"
                    onPress={() => shuffleUnranked(tierList.id)}
                    accessibilityLabel="Shuffle unranked movies"
                  >
                    <Ionicons name="shuffle" size={15} color="#F9C80E" />
                  </Pressable>
                  <Text className="text-[10px] font-black text-brand-yellow">
                    {tierList.unrankedMovieIds.length} left
                  </Text>
                </View>
              </View>
              <Pressable
                className="overflow-hidden rounded-3xl border border-white/10 bg-brand-navyLight"
                onPress={() => openMovie(currentMovie)}
                onLongPress={() => setActiveMovieId(currentMovie.id)}
                delayLongPress={300}
              >
                <View className="h-[390px] bg-slate-800">
                  {currentMovie.image ? (
                    <Image source={{ uri: currentMovie.image }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Ionicons name="film-outline" size={48} color="#A0AEC0" />
                    </View>
                  )}
                  <View className="absolute inset-x-0 bottom-0 bg-black/75 p-4">
                    <Text className="text-[22px] font-black text-white">{currentMovie.title}</Text>
                    <Text className="mt-1 text-[10px] font-bold text-white/65">
                      {getYear(currentMovie.date) || 'Unknown year'} - Long press for actions
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Text className="mb-2 mt-5 text-center text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                Choose a tier
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {tierList.tiers.map((tier) => (
                  <Pressable
                    key={tier.id}
                    className="h-14 min-w-[29%] flex-1 items-center justify-center rounded-xl"
                    style={{ backgroundColor: tier.color }}
                    onPress={() => performMoveToTier(currentMovie.id, tier.id)}
                  >
                    <Text className="text-[18px] font-black text-[#071B2B]">{tier.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5"
                onPress={() => {
                  rememberForUndo();
                  skipUnrankedMovie(tierList.id, currentMovie.id);
                }}
              >
                <Ionicons name="play-skip-forward-outline" size={16} color="#A0AEC0" />
                <Text className="text-[10px] font-black text-brand-grayText">Decide later</Text>
              </Pressable>
            </>
          ) : (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="Everything is ranked"
              description="Open the Tier Board to review, reorder, and move films between tiers."
              actionLabel="Open Tier Board"
              onAction={() => setMode('board')}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-xl border border-brand-yellow/20 bg-brand-yellow/10 px-3 py-2.5">
            <Text className="text-[9px] font-bold leading-4 text-brand-grayText">
              Long press a poster to move, unrank, remove, or view details.
            </Text>
          </View>
          {tierList.tiers.map((tier) => {
            const tierMovies = tier.movieIds
              .map((movieId) => movieById.get(movieId))
              .filter((movie): movie is LoggedMovie => Boolean(movie));
            return (
              <View
                key={tier.id}
                ref={(node) => {
                  tierRowRefs.current[tier.id] = node;
                }}
                className="min-h-[112px] flex-row rounded-2xl border border-white/10 bg-brand-navyLight"
              >
                <Pressable
                  className="w-16 items-center justify-center px-1"
                  style={{ backgroundColor: tier.color }}
                  onPress={openSettings}
                >
                  <Text numberOfLines={2} className="text-center text-[18px] font-black text-[#071B2B]">
                    {tier.label}
                  </Text>
                </Pressable>
                <View className="min-w-0 flex-1 flex-row flex-wrap content-center gap-2 p-2">
                  {tierMovies.map((movie) => (
                    <DraggableTierPoster
                      key={movie.id}
                      movie={movie}
                      onDragStart={measureDropZones}
                      onDrop={handlePosterDrop}
                      onPress={() => setActiveMovieId(movie.id)}
                    />
                  ))}
                  {tierMovies.length === 0 ? (
                    <View className="h-20 flex-1 items-center justify-center">
                      <Text className="text-[9px] font-semibold text-white/30">No films in this tier</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}

          <View
            ref={(node) => {
              tierRowRefs.current.unranked = node;
            }}
            className="mt-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-3"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[12px] font-black text-white">Unranked</Text>
              <Text className="text-[9px] font-black text-brand-yellow">{tierList.unrankedMovieIds.length}</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {tierList.unrankedMovieIds
                .map((movieId) => movieById.get(movieId))
                .filter((movie): movie is LoggedMovie => Boolean(movie))
                .map((movie) => (
                  <DraggableTierPoster
                    key={movie.id}
                    movie={movie}
                    onDragStart={measureDropZones}
                    onDrop={handlePosterDrop}
                    onPress={() => setActiveMovieId(movie.id)}
                  />
                ))}
              {tierList.unrankedMovieIds.length === 0 ? (
                <Text className="py-4 text-[9px] font-semibold text-white/30">No films waiting</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={Boolean(activeMovie)} transparent animationType="fade" onRequestClose={() => setActiveMovieId(null)}>
        <View className="flex-1 justify-end bg-black/70">
          <Pressable className="absolute inset-0" onPress={() => setActiveMovieId(null)} />
          <View className="rounded-t-3xl border-t border-white/10 bg-[#0D162D] p-4">
            <View className="mb-4 flex-row items-center gap-3">
              {activeMovie?.image ? (
                <Image source={{ uri: activeMovie.image }} className="h-[78px] w-[52px] rounded-lg" resizeMode="cover" />
              ) : null}
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-[16px] font-black text-white">{activeMovie?.title}</Text>
                <Text className="mt-1 text-[9px] font-bold text-brand-grayText">
                  Move, unrank, remove, or view details
                </Text>
              </View>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white/8" onPress={() => setActiveMovieId(null)}>
                <Ionicons name="close" size={19} color="white" />
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {tierList.tiers.map((tier) => (
                <Pressable
                  key={tier.id}
                  className="h-12 min-w-[29%] flex-1 items-center justify-center rounded-xl"
                  style={{ backgroundColor: tier.color }}
                  onPress={() => {
                    if (activeMovie) performMoveToTier(activeMovie.id, tier.id);
                    setActiveMovieId(null);
                  }}
                >
                  <Text className="text-[15px] font-black text-[#071B2B]">{tier.label}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
                onPress={() => {
                  if (activeMovie) openMovie(activeMovie);
                  setActiveMovieId(null);
                }}
              >
                <Ionicons name="information-circle-outline" size={16} color="#073445" />
                <Text className="text-[9px] font-black text-brand-navy">Details</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-white/8"
                onPress={() => {
                  if (activeMovie) {
                    rememberForUndo();
                    moveMovieWithinTier(tierList.id, activeMovie.id, -1);
                  }
                }}
              >
                <Ionicons name="arrow-back" size={16} color="#F9C80E" />
                <Text className="text-[9px] font-black text-white">Move left</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-white/8"
                onPress={() => {
                  if (activeMovie) {
                    rememberForUndo();
                    moveMovieWithinTier(tierList.id, activeMovie.id, 1);
                  }
                }}
              >
                <Text className="text-[9px] font-black text-white">Move right</Text>
                <Ionicons name="arrow-forward" size={16} color="#F9C80E" />
              </Pressable>
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-xl border border-white/10"
                onPress={() => {
                  if (activeMovie) performMoveToTier(activeMovie.id, null);
                  setActiveMovieId(null);
                }}
              >
                <Text className="text-[9px] font-black text-brand-grayText">Unrank</Text>
              </Pressable>
            </View>
            <Pressable
              className="mt-2 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10"
              onPress={() => {
                if (activeMovie) removeMovieFromTierList(activeMovie.id);
                setActiveMovieId(null);
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
              <Text className="text-[10px] font-black text-red-200">Remove from this tier list</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {undoSnapshot ? (
        <View className="absolute bottom-5 left-4 right-4 flex-row items-center gap-3 rounded-2xl border border-brand-yellow/25 bg-[#073746] p-3">
          <Ionicons name="arrow-undo" size={18} color="#F9C80E" />
          <Text className="min-w-0 flex-1 text-[10px] font-bold text-white">Tier list updated</Text>
          <Pressable
            className="rounded-lg bg-brand-yellow px-3 py-2"
            onPress={() => {
              restoreTierList(undoSnapshot);
              setUndoSnapshot(null);
            }}
          >
            <Text className="text-[9px] font-black text-brand-navy">Undo</Text>
          </Pressable>
          <Pressable onPress={() => setUndoSnapshot(null)} hitSlop={8}>
            <Ionicons name="close" size={17} color="#A0AEC0" />
          </Pressable>
        </View>
      ) : null}

      <Modal visible={showMovieManager} transparent animationType="slide" onRequestClose={() => setShowMovieManager(false)}>
        <View className="flex-1 justify-end bg-black/70">
          <Pressable className="absolute inset-0" onPress={() => setShowMovieManager(false)} />
          <View className="max-h-[88%] rounded-t-3xl border-t border-white/10 bg-[#0D162D] p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[18px] font-black text-white">Manage Films</Text>
                <Text className="mt-0.5 text-[9px] font-semibold text-brand-grayText">
                  Add more films or remove existing ones from this tier list.
                </Text>
              </View>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white/8" onPress={() => setShowMovieManager(false)}>
                <Ionicons name="close" size={19} color="white" />
              </Pressable>
            </View>

            <View className="h-11 flex-row items-center gap-2 rounded-xl border border-white/10 bg-brand-navy px-3">
              <Ionicons name="search-outline" size={16} color="#A0AEC0" />
              <TextInput
                value={movieSearch}
                onChangeText={(value) => {
                  setMovieSearch(value);
                  if (value.trim().length < 2) {
                    setSearchResults([]);
                    setIsSearchingMovies(false);
                  } else {
                    setIsSearchingMovies(true);
                  }
                }}
                placeholder="Search any film"
                placeholderTextColor="#64748B"
                className="min-w-0 flex-1 text-[11px] font-semibold text-white"
              />
              {isSearchingMovies ? <ActivityIndicator size="small" color="#F9C80E" /> : null}
            </View>

            <ScrollView className="mt-3" showsVerticalScrollIndicator={false}>
              {availableMovies.map((movie) => {
                const selected = selectedMovieIds.has(movie.id);
                const savedMovie = movieById.get(movie.id);
                return (
                  <Pressable
                    key={movie.id}
                    className="mb-2 flex-row items-center gap-3 rounded-xl border border-white/8 bg-brand-navy p-2.5"
                    onPress={() =>
                      setSelectedMovieIds((current) => {
                        const next = new Set(current);
                        setSelectedMoviesById((currentMovies) => {
                          const nextMovies = new Map(currentMovies);
                          if (next.has(movie.id)) {
                            next.delete(movie.id);
                            nextMovies.delete(movie.id);
                          } else {
                            next.add(movie.id);
                            nextMovies.set(movie.id, movie);
                          }
                          return nextMovies;
                        });
                        return next;
                      })
                    }
                  >
                    <Image source={{ uri: movie.image }} className="h-[60px] w-10 rounded-md bg-slate-800" resizeMode="cover" />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-[11px] font-black text-white">{movie.title}</Text>
                      <Text className="mt-1 text-[8px] font-bold text-brand-grayText">
                        {savedMovie?.isWatched ? 'Watched' : savedMovie?.isWatchlist ? 'Watchlist' : savedMovie ? 'Saved' : 'Search result'}
                      </Text>
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={selected ? '#F9C80E' : '#A0AEC0'} />
                  </Pressable>
                );
              })}

              <Text className="mb-2 mt-3 text-[9px] font-black uppercase tracking-wider text-brand-grayText">
                Already in this tier list
              </Text>
              {tierList.sourceMovieIds.map((movieId) => {
                const movie = movieById.get(movieId);
                if (!movie) return null;
                return (
                  <View key={movie.id} className="mb-2 flex-row items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-2.5">
                    <Image source={{ uri: movie.image }} className="h-[52px] w-9 rounded-md bg-slate-800" resizeMode="cover" />
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-[10px] font-bold text-white">{movie.title}</Text>
                    <Pressable
                      className="h-8 flex-row items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-2"
                      onPress={() => removeMovieFromTierList(movie.id)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#FCA5A5" />
                      <Text className="text-[8px] font-black uppercase text-red-200">Remove</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            <Pressable
              className={`mt-3 h-12 items-center justify-center rounded-xl ${selectedMovieIds.size ? 'bg-brand-yellow' : 'bg-white/10'}`}
              disabled={!selectedMovieIds.size}
              onPress={addSelectedMovies}
            >
              <Text className={`text-[10px] font-black ${selectedMovieIds.size ? 'text-brand-navy' : 'text-white/30'}`}>
                Add {selectedMovieIds.size} selected films
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View className="flex-1 justify-end bg-black/70">
          <Pressable className="absolute inset-0" onPress={() => setShowSettings(false)} />
          <View className="rounded-t-3xl border-t border-white/10 bg-[#0D162D] p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[18px] font-black text-white">Edit Tier List</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white/8" onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={19} color="white" />
              </Pressable>
            </View>
            <Text className="mb-2 text-[9px] font-black uppercase tracking-wider text-brand-grayText">Title</Text>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              className="h-11 rounded-xl border border-white/10 bg-brand-navy px-3 text-[12px] font-bold text-white"
            />
            <Text className="mb-2 mt-4 text-[9px] font-black uppercase tracking-wider text-brand-grayText">Tier names</Text>
            <ScrollView style={{ maxHeight: 390 }} showsVerticalScrollIndicator={false}>
              <View className="gap-2">
              {tierList.tiers.map((tier, index) => (
                <View key={tier.id} className="flex-row overflow-hidden rounded-xl border border-white/10 bg-brand-navy">
                  <View className="w-14 items-center justify-center" style={{ backgroundColor: tier.color }}>
                    <Text className="text-[13px] font-black text-[#071B2B]">{tier.label}</Text>
                  </View>
                  <View className="min-w-0 flex-1 p-2">
                    <TextInput
                      value={tierDrafts[tier.id] ?? tier.label}
                      onChangeText={(label) => setTierDrafts((current) => ({ ...current, [tier.id]: label }))}
                      maxLength={16}
                      className="h-9 rounded-lg bg-white/5 px-3 text-[11px] font-bold text-white"
                    />
                    <View className="mt-2 flex-row items-center gap-1.5">
                      {TIER_COLORS.map((color) => (
                        <Pressable
                          key={color}
                          className={`h-5 w-5 rounded-full border-2 ${tier.color === color ? 'border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                          onPress={() => {
                            rememberForUndo();
                            updateTierColor(tierList.id, tier.id, color);
                          }}
                          accessibilityLabel={`Change ${tier.label} tier color`}
                        />
                      ))}
                    </View>
                  </View>
                  <View className="justify-center gap-1.5 px-2">
                    <Pressable
                      disabled={index === 0}
                      onPress={() => {
                        rememberForUndo();
                        moveTier(tierList.id, tier.id, -1);
                      }}
                    >
                      <Ionicons name="arrow-up" size={16} color={index === 0 ? '#475569' : '#A0AEC0'} />
                    </Pressable>
                    <Pressable
                      disabled={index === tierList.tiers.length - 1}
                      onPress={() => {
                        rememberForUndo();
                        moveTier(tierList.id, tier.id, 1);
                      }}
                    >
                      <Ionicons name="arrow-down" size={16} color={index === tierList.tiers.length - 1 ? '#475569' : '#A0AEC0'} />
                    </Pressable>
                    <Pressable
                      disabled={tierList.tiers.length <= 1}
                      onPress={() => {
                        rememberForUndo();
                        deleteTier(tierList.id, tier.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color={tierList.tiers.length <= 1 ? '#475569' : '#FCA5A5'} />
                    </Pressable>
                  </View>
                </View>
              ))}
              </View>
            </ScrollView>
            <Pressable
              className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-brand-yellow/30 bg-brand-yellow/10"
              onPress={() => {
                rememberForUndo();
                addTier(tierList.id);
              }}
            >
              <Ionicons name="add" size={16} color="#F9C80E" />
              <Text className="text-[9px] font-black text-brand-yellow">Add another tier</Text>
            </Pressable>
            <Pressable className="mt-4 h-12 items-center justify-center rounded-xl bg-brand-yellow" onPress={saveSettings}>
              <Text className="text-[11px] font-black text-brand-navy">Save changes</Text>
            </Pressable>
            <View className="mt-3 flex-row gap-2">
              <Pressable className="h-11 flex-1 items-center justify-center rounded-xl border border-white/10" onPress={confirmReset}>
                <Text className="text-[9px] font-black text-brand-grayText">Reset ranking</Text>
              </Pressable>
              <Pressable className="h-11 flex-1 items-center justify-center rounded-xl border border-red-400/25 bg-red-500/10" onPress={confirmDelete}>
                <Text className="text-[9px] font-black text-red-300">Delete tier list</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSharePreview} transparent animationType="fade" onRequestClose={() => setShowSharePreview(false)}>
        <View className="flex-1 items-center justify-center bg-black/80 px-4">
          <Pressable className="absolute inset-0" onPress={() => setShowSharePreview(false)} />
          <View className="w-full max-w-[420px]">
            <View
              ref={shareCardRef}
              collapsable={false}
              className="overflow-hidden rounded-3xl bg-[#071B2B] p-4"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="mb-4 flex-row items-center justify-between">
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[20px] font-black text-white">{tierList.title}</Text>
                  <Text className="mt-1 text-[9px] font-black uppercase tracking-[2px] text-brand-yellow">
                    SwipeLog Tier List
                  </Text>
                </View>
                <Ionicons name="podium" size={27} color="#F9C80E" />
              </View>
              <View className="gap-2">
                {shareRows.map((tier) => {
                  return (
                    <View key={tier.id} className="min-h-[62px] flex-row overflow-hidden rounded-xl bg-[#0D2B3A]">
                      <View className="w-14 items-center justify-center px-1" style={{ backgroundColor: tier.color }}>
                        <Text numberOfLines={2} className="text-center text-[13px] font-black text-[#071B2B]">{tier.label}</Text>
                        <Text className="mt-0.5 text-[7px] font-black text-[#071B2B]" style={{ opacity: 0.7 }}>
                          {tier.totalCount}
                        </Text>
                      </View>
                      <View className="min-w-0 flex-1 flex-row gap-1 p-1.5">
                        {tier.movies.map((movie) => (
                          <View key={movie.id} className="w-9 overflow-hidden rounded bg-slate-800" style={{ aspectRatio: 2 / 3 }}>
                            {movie.image ? <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" /> : null}
                          </View>
                        ))}
                        {tier.totalCount === 0 ? (
                          <View className="h-[54px] flex-1 items-center justify-center rounded bg-white/5 px-2">
                            <Text className="text-[8px] font-bold text-white/35">No films ranked here</Text>
                          </View>
                        ) : null}
                        {tier.hiddenCount > 0 ? (
                          <View className="h-[54px] w-9 items-center justify-center rounded bg-white/10">
                            <Text className="text-[8px] font-black text-white">+{tier.hiddenCount}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text className="mt-4 text-center text-[8px] font-bold text-white/35">
                {rankedCount} of {tierList.sourceMovieIds.length} films ranked from {tierList.sourceLabel} - made with SwipeLog
              </Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-brand-navyLight"
                onPress={() => setShowSharePreview(false)}
              >
                <Text className="text-[10px] font-black text-white">Close</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
                onPress={() => void shareTierList()}
                disabled={isSharing}
              >
                <Ionicons name="share-outline" size={16} color="#073445" />
                <Text className="text-[10px] font-black text-brand-navy">{isSharing ? 'Creating...' : 'Share image'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
