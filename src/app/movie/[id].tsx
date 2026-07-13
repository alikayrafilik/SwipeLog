import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMovieActions, useMovieState } from '@/context/MovieContext';
import { useSharedWatchlists } from '@/context/SharedWatchlistContext';
import FeedbackToast from '@/components/FeedbackToast';
import HalfStarRating from '@/components/HalfStarRating';
import WatchedDatePicker from '@/components/WatchedDatePicker';
import { getBottomSheetPadding } from '@/constants/layout';
import {
  buildTasteProfile,
  PersonalizedCandidate,
  rankDiscoveryCandidates,
} from '@/services/discovery-ranking';
import { trackEvent } from '@/services/analytics';
import { MovieItem, tmdbService } from '@/services/tmdb';
import {
  getTodayWatchDateInput,
  toWatchDateTime,
  validateWatchDate,
  WATCH_DATE_HELP_TEXT,
} from '@/utils/watch-date';

interface CreditPerson {
  id: number;
  name: string;
  profile_path: string | null;
  character?: string;
  job?: string;
}

interface MovieVideo {
  id: string;
  key: string;
  name: string;
  official?: boolean;
  site: string;
  type: string;
}

interface MovieDetails {
  backdrop_path?: string | null;
  credits?: {
    cast?: CreditPerson[];
    crew?: CreditPerson[];
  };
  genres?: { id: number; name: string }[];
  original_language?: string;
  overview?: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  release_date?: string;
  runtime?: number;
  status?: string;
  tagline?: string;
  title?: string;
  videos?: {
    results?: MovieVideo[];
  };
  vote_average?: number;
  vote_count?: number;
}

interface WatchProvider {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

interface WatchProviderData {
  buy?: WatchProvider[];
  flatrate?: WatchProvider[];
  link?: string;
  rent?: WatchProvider[];
}

const getParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const getProfileImage = (path: string | null) =>
  path ? `https://image.tmdb.org/t/p/w185${path}` : '';

const getProviderImage = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;

const getBackdropImage = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w1280${path}` : null;

function PeopleRail({ people }: { people: CreditPerson[] }) {
  return (
    <ScrollView
      horizontal
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
      showsHorizontalScrollIndicator={false}
    >
      {people.map((person) => {
        const image = getProfileImage(person.profile_path);
        const role = person.character || person.job;

        return (
          <View key={`${person.id}-${role}`} className="w-[92px] gap-2">
            <View
              className="h-[112px] overflow-hidden rounded-lg bg-[#FFB300]"
              style={{ borderCurve: 'continuous' }}
            >
              {image ? (
                <Image source={{ uri: image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center bg-[#FFB300]">
                  <Ionicons name="person" size={36} color="#073445" />
                </View>
              )}
            </View>
            <View className="gap-0.5 pb-1">
              <Text selectable numberOfLines={2} className="text-[11px] font-extrabold text-white">
                {person.name}
              </Text>
              {role ? (
                <Text selectable numberOfLines={2} className="text-[9px] font-medium text-white/45">
                  {role}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

export default function MovieInfoScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    image?: string;
    overview?: string;
    rating?: string;
    reasonSource?: string;
    source?: string;
    title?: string;
    year?: string;
  }>();

  const { customLists, discoverySignals, movies, watchHistory } = useMovieState();
  const {
    addMovieToList,
    addWatchEntry,
    createList,
    getMovieState,
    logMovie,
    removeMovie,
    toggleLike,
    toggleMovieInList,
  } = useMovieActions();
  const { addMovieToSharedList, lists: sharedLists } = useSharedWatchlists();
  const id = getParam(params.id);
  const initialTitle = getParam(params.title) || 'Movie';
  const initialYear = getParam(params.year);
  const image = getParam(params.image);
  const initialOverview = getParam(params.overview) || 'No overview is available for this movie yet.';
  const analyticsSource = getParam(params.source) || 'unknown';
  const analyticsReasonSource = getParam(params.reasonSource);

  const savedState = getMovieState(id);
  const isWatched = savedState?.isWatched ?? false;
  const isWatchlist = savedState?.isWatchlist ?? false;
  const isLiked = savedState?.isLiked ?? false;
  const currentRating = savedState?.rating ?? 0;
  const currentMovie = movies.find((movie) => movie.id === id);
  const listCount = currentMovie?.lists.filter((listName) => listName !== 'Favorites' && listName !== 'Watchlist').length ?? 0;
  const isInAnyList = listCount > 0;
  const watchCount = watchHistory.filter((entry) => entry.movieId === id).length;

  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [watchProviders, setWatchProviders] = useState<WatchProviderData | null>(null);
  const [similarMovies, setSimilarMovies] = useState<Omit<PersonalizedCandidate, 'personalScore'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLogBoxOpen, setIsLogBoxOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftNote, setDraftNote] = useState('');
  const [draftWatchedAt, setDraftWatchedAt] = useState(getTodayWatchDateInput);
  const [isListBoxOpen, setIsListBoxOpen] = useState(false);
  const [isSharedListBoxOpen, setIsSharedListBoxOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [draftListNames, setDraftListNames] = useState<Set<string>>(() => new Set());
  const [draftNewListNames, setDraftNewListNames] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [pendingSharedListId, setPendingSharedListId] = useState<string | null>(null);
  const watchedDateValidation = useMemo(() => validateWatchDate(draftWatchedAt), [draftWatchedAt]);

  useEffect(() => {
    let isMounted = true;
    if (!id) return;

    const fetchDetails = async () => {
      setLoading(true);
      const [movieDetails, providers, recommendations] = await Promise.all([
        tmdbService.getMovieDetails(id),
        tmdbService.getWatchProviders(id),
        tmdbService.getMovieRecommendations(id),
      ]);
      if (isMounted) {
        if (movieDetails) setDetails(movieDetails);
        setWatchProviders(providers);
        const candidates = recommendations
          .filter((item) => item.id !== id)
          .map<Omit<PersonalizedCandidate, 'personalScore'>>((item) => ({
            ...item,
            reason: `Similar to ${movieDetails?.title || initialTitle}`,
            source: 'recommended',
          }));
        setSimilarMovies(candidates);
      }
      if (isMounted) setLoading(false);
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [id, initialTitle]);

  const title = details?.title || initialTitle;
  const overview = details?.overview || initialOverview;
  const year = details?.release_date?.match(/\d{4}/)?.[0] || initialYear;
  const runtime = details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '';
  const director = details?.credits?.crew?.find((person) => person.job === 'Director');
  const backdropImage = getBackdropImage(details?.backdrop_path);
  const country = details?.production_countries?.[0]?.name || '';
  const genreLabel = details?.genres?.map((genre) => genre.name).join(' - ') || '';
  const tmdbScore = details?.vote_average ?? 0;
  const tmdbScoreLabel = tmdbScore > 0 ? tmdbScore.toFixed(1) : 'N/A';
  const cast = useMemo(() => details?.credits?.cast?.slice(0, 12) ?? [], [details]);
  const crew = useMemo(() => {
    const featuredJobs = new Set([
      'Director',
      'Producer',
      'Executive Producer',
      'Screenplay',
      'Writer',
      'Director of Photography',
      'Original Music Composer',
    ]);
    return details?.credits?.crew?.filter((person) => person.job && featuredJobs.has(person.job)).slice(0, 12) ?? [];
  }, [details]);
  const trailer = useMemo(() => {
    const youtubeVideos = details?.videos?.results?.filter((video) => video.site === 'YouTube') ?? [];
    return (
      youtubeVideos.find((video) => video.type === 'Trailer' && video.official) ??
      youtubeVideos.find((video) => video.type === 'Trailer') ??
      youtubeVideos.find((video) => video.type === 'Teaser' && video.official) ??
      youtubeVideos.find((video) => video.type === 'Teaser')
    );
  }, [details]);
  const providerGroups = useMemo(() => {
    if (!watchProviders) return [];
    return [
      { label: 'Stream', providers: watchProviders.flatrate ?? [] },
      { label: 'Rent', providers: watchProviders.rent ?? [] },
      { label: 'Buy', providers: watchProviders.buy ?? [] },
    ].filter((group) => group.providers.length > 0);
  }, [watchProviders]);
  const savedMovieById = useMemo(() => new Map(movies.map((item) => [item.id, item])), [movies]);
  const tasteProfile = useMemo(
    () => buildTasteProfile(movies, discoverySignals),
    [discoverySignals, movies]
  );
  const personalizedSimilarMovies = useMemo(() => {
    return rankDiscoveryCandidates(similarMovies, tasteProfile)
      .sort((a, b) => {
        const savedA = savedMovieById.get(a.id);
        const savedB = savedMovieById.get(b.id);
        const penaltyA = savedA?.isWatched ? 20 : savedA?.isWatchlist ? -2 : 0;
        const penaltyB = savedB?.isWatched ? 20 : savedB?.isWatchlist ? -2 : 0;
        return b.personalScore - penaltyB - (a.personalScore - penaltyA);
      })
      .slice(0, 12);
  }, [savedMovieById, similarMovies, tasteProfile]);

  const movie = useMemo(
    () => ({
      id,
      title,
      image,
      date: year,
      overview,
      rating: currentRating,
      genreIds: details?.genres?.map((genre) => genre.id),
      runtimeMinutes: details?.runtime,
    }),
    [currentRating, details?.genres, details?.runtime, id, image, overview, title, year]
  );

  useEffect(() => {
    void trackEvent('movie_opened', {
      source: analyticsSource,
      reason_source: analyticsReasonSource || undefined,
      movie_year: year ? Number(year) : undefined,
      has_rating: Boolean(movie.rating),
    });
  }, [analyticsReasonSource, analyticsSource, id, movie.rating, year]);

  const openLogBox = (nextRating = currentRating) => {
    setDraftRating(nextRating);
    setDraftNote('');
    setDraftWatchedAt(getTodayWatchDateInput());
    setIsLogBoxOpen(true);
  };

  const handleWatchedPress = () => {
    openLogBox(currentRating);
  };

  const handleWatchlistPress = () => {
    if (isWatchlist && !isWatched && !isLiked && currentMovie?.lists.length === 1) {
      removeMovie(id);
      setFeedbackMessage(`${title} removed from Watchlist`);
      return;
    }
    if (!isWatchlist) {
      void trackEvent('movie_added_to_watchlist', {
        source: 'movie_detail',
      });
    }
    logMovie(movie, currentRating, isWatched, !isWatchlist);
    setFeedbackMessage(!isWatchlist ? `${title} added to Watchlist` : `${title} removed from Watchlist`);
  };

  const handleFavoritePress = () => {
    if (!currentMovie) logMovie(movie, 0, false, false, true);
    else toggleLike(id);
    setFeedbackMessage(!isLiked ? `${title} added to Favorites` : `${title} removed from Favorites`);
  };

  const handlePlayTrailer = async () => {
    if (!trailer) return;
    try {
      await Linking.openURL(`https://www.youtube.com/watch?v=${trailer.key}`);
    } catch (e) {
      console.warn('Could not open trailer', e);
    }
  };

  const navigateToMovie = (item: MovieItem) => {
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: item.id,
        title: item.title,
        year: item.date?.match(/\d{4}/)?.[0] ?? item.date ?? '',
        image: item.image,
        overview: item.overview ?? '',
        rating: `${item.rating ?? 0}`,
        source: 'movie_detail_similar',
      },
    } as never);
  };

  const handleConfirmLog = () => {
    if (watchedDateValidation.error) return;
    addWatchEntry(movie, draftRating, draftNote, toWatchDateTime(watchedDateValidation.dateKey), 'movie_detail');
    setFeedbackMessage(isWatched ? `Rewatch logged for ${title}` : `${title} logged to Diary`);
    setIsLogBoxOpen(false);
  };

  const closeLogBox = () => {
    setIsLogBoxOpen(false);
  };

  const openListBox = () => {
    setDraftListNames(new Set(currentMovie?.lists.filter((listName) => customLists.includes(listName)) ?? []));
    setDraftNewListNames([]);
    setNewListName('');
    setIsListBoxOpen(true);
  };

  const toggleDraftList = (listName: string) => {
    setDraftListNames((current) => {
      const next = new Set(current);
      if (next.has(listName)) next.delete(listName);
      else next.add(listName);
      return next;
    });
  };

  const handleCreateDraftList = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setDraftNewListNames((current) =>
      current.some((name) => name.toLowerCase() === trimmed.toLowerCase()) ? current : [...current, trimmed]
    );
    setDraftListNames((current) => new Set([...current, trimmed]));
    setNewListName('');
  };

  const handleConfirmListChanges = () => {
    const existingListNames = new Set(customLists);
    draftNewListNames.forEach((listName) => createList(listName));

    customLists.forEach((listName) => {
      const wasAdded = currentMovie?.lists.includes(listName) ?? false;
      const shouldBeAdded = draftListNames.has(listName);
      if (wasAdded && !shouldBeAdded) toggleMovieInList(movie.id, listName);
      if (!wasAdded && shouldBeAdded) addMovieToList(movie, listName, 'movie_detail');
    });

    draftNewListNames.forEach((listName) => {
      if (!existingListNames.has(listName) && draftListNames.has(listName)) addMovieToList(movie, listName, 'movie_detail');
    });

    const addedCount = [...draftListNames].length;
    setFeedbackMessage(addedCount > 0 ? `${title} saved to ${addedCount} list${addedCount === 1 ? '' : 's'}` : `${title} removed from lists`);
    setIsListBoxOpen(false);
  };

  const handleAddToSharedList = async (listId: string, listName: string) => {
    if (pendingSharedListId) return;
    setPendingSharedListId(listId);
    try {
      await addMovieToSharedList(listId, movie);
      setFeedbackMessage(`${title} added to shared list: ${listName}`);
      setIsSharedListBoxOpen(false);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Could not add to shared list');
    } finally {
      setPendingSharedListId(null);
    }
  };

  const logBox = (
    <Modal
      animationType="fade"
      onRequestClose={() => setIsLogBoxOpen(false)}
      statusBarTranslucent
      transparent
      visible={isLogBoxOpen}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/65"
        keyboardVerticalOffset={24}
      >
      <View
        className="flex-1 justify-end px-4 pt-10"
        style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 16) }}
      >
        <Pressable
          accessibilityLabel="Close log box"
          className="absolute inset-0"
          onPress={closeLogBox}
        />

        <ScrollView
          automaticallyAdjustKeyboardInsets
          className="w-full"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 24 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="w-full self-center rounded-3xl border border-white/12 bg-[#002B3A] p-4"
            style={{ borderCurve: 'continuous', boxShadow: '0 18px 42px rgba(0, 0, 0, 0.45)' }}
          >
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text selectable className="text-[17px] font-black text-white">
                  {isWatched ? 'Log rewatch' : 'Log movie'}
                </Text>
                <Text selectable className="mt-0.5 text-[10px] font-semibold text-white/45">
                  {isWatched
                    ? `Already watched ${watchCount} ${watchCount === 1 ? 'time' : 'times'}`
                    : 'Add this film to your diary'}
                </Text>
              </View>
              {isWatched ? (
                <View className="rounded-full border border-brand-yellow/25 bg-brand-yellow/10 px-2.5 py-1">
                  <Text selectable className="text-[9px] font-black uppercase text-brand-yellow">
                    Rewatch #{watchCount + 1}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityLabel="Cancel log"
                className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                hitSlop={8}
                onPress={closeLogBox}
              >
                <Ionicons name="close" size={18} color="#C8D3D7" />
              </Pressable>
            </View>

            <View className="flex-row gap-3 rounded-2xl border border-white/10 bg-[#073746] p-3">
              <View className="h-[126px] w-[84px] overflow-hidden rounded-xl bg-[#FFB300]">
                  {image ? (
                    <Image source={{ uri: image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Ionicons name="film" size={34} color="#073445" />
                    </View>
                  )}
              </View>

              <View className="min-w-0 flex-1 justify-center gap-2">
                <Text selectable numberOfLines={2} className="text-[16px] font-black leading-5 text-white">
                  {title}
                </Text>
                <Text selectable numberOfLines={1} className="text-[10px] font-bold text-white/45">
                  {[year, runtime].filter(Boolean).join('   ') || 'Movie'}
                </Text>
                <View className="self-start rounded-full border border-brand-yellow/25 bg-brand-yellow/10 px-2.5 py-1">
                  <Text selectable className="text-[9px] font-black uppercase text-brand-yellow">
                    Diary entry
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-4 gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="gap-2">
                  <Text selectable numberOfLines={1} className="text-[10px] font-extrabold uppercase text-white/45">
                    Your rating
                  </Text>
                  <View className="self-start rounded-full bg-brand-yellow/15 px-2.5 py-1">
                    <Text selectable className="text-[10px] font-black text-brand-yellow">
                      {draftRating > 0 ? draftRating.toFixed(1) : 'Not rated'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                  className={`h-10 flex-row items-center justify-center gap-2 rounded-xl px-3 ${
                    isLiked ? 'border border-brand-yellow/40 bg-brand-yellow/15' : 'border border-white/12 bg-[#0B4151]'
                  }`}
                  onPress={handleFavoritePress}
                >
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16} color={isLiked ? '#F9C80E' : '#FFFFFF'} />
                  <Text className={`text-[10px] font-black uppercase ${isLiked ? 'text-brand-yellow' : 'text-white'}`}>
                    Favorite
                  </Text>
                </Pressable>
              </View>
              <View className="items-start">
                <HalfStarRating
                  rating={draftRating}
                  size={24}
                  onChange={(value) => {
                    setDraftRating(draftRating === value ? 0 : value);
                  }}
                />
              </View>
            </View>

            <View className="mt-4 gap-3">
              <WatchedDatePicker
                error={watchedDateValidation.error}
                helperText={WATCH_DATE_HELP_TEXT}
                label="Watched date"
                onChange={setDraftWatchedAt}
                value={draftWatchedAt}
              />
              <View className="rounded-2xl border border-white/10 bg-[#073746] px-4 py-3">
                <Text selectable className="mb-2 text-[10px] font-extrabold uppercase text-brand-grayText">
                  Note
                </Text>
                <TextInput
                  value={draftNote}
                  onChangeText={setDraftNote}
                  placeholder="Write your thoughts about this watch..."
                  placeholderTextColor="#8EA1A8"
                  multiline
                  maxLength={500}
                  className="min-h-[120px] text-[13px] font-medium leading-5 text-white"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>
            </View>

            <View className="mt-4 flex-row items-center justify-between gap-3">
              <Pressable
                accessibilityLabel="Cancel movie log"
                className="h-12 flex-1 items-center justify-center rounded-xl border border-white/12 bg-[#073746]"
                onPress={closeLogBox}
              >
                <Text selectable className="text-[11px] font-black uppercase text-white/70">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Confirm movie log"
                className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${
                  watchedDateValidation.error ? 'bg-brand-yellow/40' : 'bg-[#FFB300]'
                }`}
                disabled={Boolean(watchedDateValidation.error)}
                onPress={handleConfirmLog}
              >
                <Ionicons name="checkmark" size={20} color="#073445" />
                <Text selectable className="text-[11px] font-black uppercase text-[#073445]">
                  Log
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const listBox = (
    <Modal
      animationType="fade"
      onRequestClose={() => setIsListBoxOpen(false)}
      statusBarTranslucent
      transparent
      visible={isListBoxOpen}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/65"
      >
        <Pressable className="absolute inset-0" onPress={() => setIsListBoxOpen(false)} />
        <View
          className="rounded-t-[24px] border-t border-white/10 bg-[#0D162D] px-4 pt-4"
          style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 24) }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="min-w-0 flex-1">
              <Text selectable className="text-[17px] font-black text-white">Add to list</Text>
              <Text selectable numberOfLines={2} className="mt-0.5 text-[10px] font-semibold leading-4 text-white/45">
                {title}
              </Text>
            </View>
            <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white/8" onPress={() => setIsListBoxOpen(false)}>
              <Ionicons name="close" size={19} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 280 }}
            showsVerticalScrollIndicator={false}
          >
            {[...customLists, ...draftNewListNames].map((listName) => {
              const isAdded = draftListNames.has(listName);
              return (
                <Pressable
                  key={listName}
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-3"
                  onPress={() => toggleDraftList(listName)}
                >
                  <Ionicons name={isAdded ? 'checkmark-circle' : 'add-circle-outline'} size={21} color="#F9C80E" />
                  <Text className="min-w-0 flex-1 text-[12px] font-black text-white">{listName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="New list name"
              placeholderTextColor="#8EA1A8"
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-brand-navy px-3 text-[12px] font-bold text-white"
              onSubmitEditing={handleCreateDraftList}
            />
            <Pressable className="h-11 items-center justify-center rounded-xl bg-brand-yellow px-4" onPress={handleCreateDraftList}>
              <Text className="text-[11px] font-black text-brand-navy">Add</Text>
            </Pressable>
          </View>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              className="h-12 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5"
              onPress={() => setIsListBoxOpen(false)}
            >
              <Text className="text-[11px] font-black uppercase text-white/70">Cancel</Text>
            </Pressable>
            <Pressable className="h-12 flex-1 items-center justify-center rounded-xl bg-brand-yellow" onPress={handleConfirmListChanges}>
              <Text className="text-[11px] font-black uppercase text-brand-navy">Confirm</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const sharedListBox = (
    <Modal
      animationType="fade"
      onRequestClose={() => setIsSharedListBoxOpen(false)}
      statusBarTranslucent
      transparent
      visible={isSharedListBoxOpen}
    >
      <View className="flex-1 justify-end bg-black/65">
        <Pressable className="absolute inset-0" onPress={() => setIsSharedListBoxOpen(false)} />
        <View
          className="max-h-[72%] rounded-t-[24px] border-t border-white/10 bg-[#0D162D] px-4 pt-4"
          style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 24) }}
        >
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text selectable className="text-[17px] font-black text-white">Add to Shared List</Text>
              <Text selectable numberOfLines={2} className="mt-0.5 text-[10px] font-semibold leading-4 text-white/45">
                {title}
              </Text>
            </View>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
              onPress={() => setIsSharedListBoxOpen(false)}
              accessibilityLabel="Close shared list picker"
            >
              <Ionicons name="close" size={19} color="#FFFFFF" />
            </Pressable>
          </View>

          {sharedLists.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
              {sharedLists.map((list) => (
                <Pressable
                  key={list.id}
                  className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  disabled={pendingSharedListId !== null}
                  onPress={() => void handleAddToSharedList(list.id, list.name)}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/12">
                    {pendingSharedListId === list.id ? (
                      <ActivityIndicator size="small" color="#F9C80E" />
                    ) : (
                      <Ionicons name="people" size={18} color="#F9C80E" />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[13px] font-black text-white">
                      {list.name}
                    </Text>
                    <Text className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/45">
                      {list.members.length} members - {list.itemCount ?? 0} films
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color="#F9C80E" />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View className="items-center rounded-2xl border border-dashed border-white/12 bg-white/5 px-5 py-8">
              <Ionicons name="people-outline" size={30} color="#F9C80E" />
              <Text className="mt-3 text-center text-[14px] font-black text-white">No shared lists yet</Text>
              <Text className="mt-2 text-center text-[10px] font-semibold leading-4 text-white/55">
                Create or join a shared movie list from Library &gt; Lists.
              </Text>
              <Pressable
                className="mt-5 rounded-xl bg-brand-yellow px-4 py-3"
                onPress={() => {
                  setIsSharedListBoxOpen(false);
                  router.push('/shared-watchlists' as never);
                }}
              >
                <Text className="text-[10px] font-black uppercase text-brand-navy">Open Shared Lists</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#002B3A]" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1 bg-[#002B3A]"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: getBottomSheetPadding(insets.bottom, 36),
          gap: 20,
        }}
      >
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Go back"
          className="h-9 w-9 items-center justify-center rounded-full"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.4)" />
        </Pressable>
        <Text selectable className="text-[11px] font-extrabold uppercase tracking-[2px] text-white/30">
          Movie Info
        </Text>
        <View className="h-9 w-9" />
      </View>

      <View className="gap-0" style={{ marginHorizontal: -16 }}>
        <View
          className="h-[256px] overflow-hidden rounded-b-[28px] bg-[#001B25]"
          style={{ borderCurve: 'continuous' }}
        >
          {backdropImage ? (
            <Image
              source={{ uri: backdropImage }}
              style={{ height: '100%', width: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-[#001B25]">
              <Ionicons name="film" size={44} color="rgba(255,255,255,0.18)" />
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,43,58,0)', 'rgba(0,24,34,0.18)', '#002B3A']}
            locations={[0, 0.56, 1]}
            style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
          />
        </View>

        <View className="-mt-20 px-5">
          <View className="flex-row items-end gap-4">
            <View
              className="h-[186px] w-[124px] overflow-hidden rounded-xl bg-[#FFB300]"
              style={{ borderCurve: 'continuous', boxShadow: '0 18px 34px rgba(0, 0, 0, 0.38)' }}
            >
              {image ? (
                <Image source={{ uri: image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Ionicons name="film" size={46} color="#073445" />
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1 pb-2">
              <Text selectable numberOfLines={3} className="text-[28px] font-black leading-9 text-white">
                {title}
              </Text>
              {director ? (
                <Text selectable numberOfLines={2} className="mt-2 text-[13px] font-bold leading-5 text-white/80">
                  Directed by {director.name}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-5 gap-3">
            <Text selectable className="text-[11px] font-semibold uppercase leading-[17px] tracking-[1.4px] text-white/55">
              {[year, runtime, country].filter(Boolean).join(' - ') || 'Movie'}
            </Text>
            {genreLabel ? (
              <Text selectable className="text-[12px] font-medium leading-[19px] text-white/45">
                {genreLabel}
              </Text>
            ) : null}
            <View className="self-start flex-row items-center rounded-full bg-white/10 px-4 py-2">
              <Ionicons name="star" size={16} color="#FFB300" />
              <Text selectable className="ml-2 text-[13px] font-black uppercase tracking-wide text-white">
                TMDB {tmdbScoreLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {trailer ? (
        <Pressable
          accessibilityLabel={`Play trailer: ${trailer.name}`}
          className="mt-1 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-white/5"
          onPress={handlePlayTrailer}
        >
          <Ionicons name="play" size={16} color="#F9C80E" />
          <Text className="text-[12px] font-black uppercase tracking-widest text-brand-yellow">
            Play Trailer
          </Text>
        </Pressable>
      ) : null}

      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityLabel={isWatched ? 'Log a rewatch' : 'Log this movie'}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#FFB300] px-4"
          onPress={handleWatchedPress}
        >
          <Ionicons name="create" size={18} color="#073445" />
          <Text selectable className="text-[12px] font-black uppercase tracking-widest text-brand-navy">
            {isWatched ? 'Log Rewatch' : 'Log Movie'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          className={`h-12 w-12 items-center justify-center rounded-xl ${
            isWatchlist ? 'bg-[#FFB300]' : 'border border-white/15 bg-white/10'
          }`}
          onPress={handleWatchlistPress}
        >
          <Ionicons name={isWatchlist ? 'bookmark' : 'bookmark-outline'} size={20} color={isWatchlist ? '#073445' : '#FFFFFF'} />
        </Pressable>
        <Pressable
          accessibilityLabel={isInAnyList ? `Edit ${listCount} lists` : 'Add to list'}
          className={`h-12 w-12 items-center justify-center rounded-xl ${
            isInAnyList ? 'bg-[#FFB300]' : 'border border-white/15 bg-white/10'
          }`}
          onPress={openListBox}
        >
          <Ionicons name={isInAnyList ? 'albums' : 'albums-outline'} size={20} color={isInAnyList ? '#073445' : '#FFFFFF'} />
        </Pressable>
        <Pressable
          accessibilityLabel="Add to shared list"
          className="h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10"
          onPress={() => setIsSharedListBoxOpen(true)}
        >
          <Ionicons name="people-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {loading && !details ? (
        <ActivityIndicator size="small" color="#FFB300" className="mt-6" />
      ) : (
        <View className="mt-6 gap-3">
          {details?.tagline ? (
            <Text selectable className="text-[11px] font-bold uppercase tracking-widest text-brand-yellow">
              {details.tagline}
            </Text>
          ) : null}
          <Text selectable className="text-[14px] font-medium leading-[26px] text-white/95">
            {overview}
          </Text>
        </View>
      )}



      {providerGroups.length > 0 ? (
        <View className="mt-6 gap-4">
          <View className="flex-row items-center justify-between">
            <Text selectable className="text-[16px] font-black text-white">Where to Watch</Text>
          </View>
          <ScrollView horizontal contentContainerStyle={{ gap: 16 }} showsHorizontalScrollIndicator={false}>
            {providerGroups.map((group) => (
              <View key={group.label} className="gap-2">
                <Text selectable className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {group.label}
                </Text>
                <View className="flex-row gap-2">
                  {group.providers.map((provider) => (
                    <Image
                      key={`${group.label}-${provider.provider_id}`}
                      source={{ uri: getProviderImage(provider.logo_path) }}
                      style={{ height: 42, width: 42, borderRadius: 8 }}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {cast.length > 0 ? (
        <View className="mt-6 gap-4">
          <Text selectable className="text-[16px] font-black text-white">
            Cast
          </Text>
          <PeopleRail people={cast} />
        </View>
      ) : null}

      {crew.length > 0 ? (
        <View className="mt-6 gap-4">
          <Text selectable className="text-[16px] font-black text-white">
            Crew
          </Text>
          <PeopleRail people={crew} />
        </View>
      ) : null}

      {personalizedSimilarMovies.length > 0 ? (
        <View className="mt-6 gap-3">
          <View className="gap-1">
            <Text selectable className="text-[16px] font-black text-white">
              {`Similar to ${title}`}
            </Text>
            <Text selectable className="text-[11px] font-semibold text-white/45">
              Re-ranked from similar films and your taste profile
            </Text>
          </View>
          <ScrollView
            horizontal
            contentContainerStyle={{ gap: 16, paddingRight: 8 }}
            showsHorizontalScrollIndicator={false}
          >
            {personalizedSimilarMovies.map((item) => {
              const savedMovie = savedMovieById.get(item.id);
              const isSimilarWatched = Boolean(savedMovie?.isWatched);
              const isSimilarWatchlist = Boolean(savedMovie?.isWatchlist);

              return (
              <Pressable key={item.id} className="w-[124px]" onPress={() => navigateToMovie(item)}>
                <View className="h-[186px] w-[124px] overflow-hidden rounded-xl border border-white/8 bg-brand-navyLight">
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={{ height: 186, width: 124 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-slate-800">
                      <Ionicons name="film-outline" size={24} color="#A0AEC0" />
                    </View>
                  )}
                  {isSimilarWatched || isSimilarWatchlist ? (
                    <View className="absolute right-2 top-2 flex-row gap-1">
                      {isSimilarWatched ? (
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-black/75">
                          <Ionicons name="eye" size={17} color="#F9C80E" />
                        </View>
                      ) : null}
                      {isSimilarWatchlist ? (
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-black/75">
                          <Ionicons name="bookmark" size={16} color="#F9C80E" />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} className="mt-2 text-[12px] font-bold leading-4 text-white">
                  {item.title}
                </Text>
              </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      </ScrollView>
      {logBox}
      {listBox}
      {sharedListBox}
      <FeedbackToast message={feedbackMessage} onDismiss={() => setFeedbackMessage(null)} />
    </SafeAreaView>
  );
}
