import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import { getBottomSheetPadding } from '@/constants/layout';
import { LoggedMovie, useMovieState } from '@/context/MovieContext';
import { MovieTierList, useTierListActions, useTierListState } from '@/context/TierListContext';
import { trackEvent } from '@/services/analytics';
import { useFeedback } from '@/context/FeedbackContext';

interface TierSource {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  movies: LoggedMovie[];
}

export default function TierListsScreen() {
  const { confirm, notify } = useFeedback();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { movies, customLists } = useMovieState();
  const { tierLists } = useTierListState();
  const { createTierList, deleteTierList, renameTierList } = useTierListActions();
  const [showCreator, setShowCreator] = useState(false);
  const [title, setTitle] = useState('');
  const [sourceId, setSourceId] = useState('watched');
  const [renamingList, setRenamingList] = useState<MovieTierList | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const trackedOpenRef = React.useRef(false);

  const movieById = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);
  const sources = useMemo<TierSource[]>(
    () => [
      {
        id: 'watched',
        label: 'Watched Movies',
        description: 'Rank every film you have logged.',
        icon: 'eye-outline',
        movies: movies.filter((movie) => movie.isWatched),
      },
      {
        id: 'watchlist',
        label: 'Watchlist',
        description: 'Prioritize what you want to watch next.',
        icon: 'bookmark-outline',
        movies: movies.filter((movie) => movie.isWatchlist),
      },
      {
        id: 'favorites',
        label: 'Favorites',
        description: 'Put your favorite films against each other.',
        icon: 'heart-outline',
        movies: movies.filter((movie) => movie.isLiked),
      },
      ...customLists.map((name) => ({
        id: `custom-${name}`,
        label: name,
        description: 'Rank films from this custom list.',
        icon: 'albums-outline' as const,
        movies: movies.filter((movie) => movie.lists.includes(name)),
      })),
    ],
    [customLists, movies]
  );
  const selectedSource = sources.find((source) => source.id === sourceId) ?? sources[0];
  const sourceListMaxHeight = Math.min(360, Math.max(180, height * 0.38));

  useEffect(() => {
    if (trackedOpenRef.current) return;
    trackedOpenRef.current = true;
    void trackEvent('tier_list_opened', {
      source: 'tier_list_hub',
      has_existing_list: tierLists.length > 0,
    });
  }, [tierLists.length]);

  const openCreator = () => {
    setTitle('');
    setSourceId(sources.find((source) => source.movies.length > 0)?.id ?? 'watched');
    setShowCreator(true);
  };

  const createList = () => {
    const source = sources.find((item) => item.id === sourceId);
    if (!source || source.movies.length === 0) {
      notify({ tone: 'warning', title: 'No films available', message: 'Choose a source that contains at least one film.' });
      return;
    }
    const id = createTierList(
      title.trim() || `${source.label} Ranked`,
      source.label,
      source.movies.map((movie) => movie.id)
    );
    setShowCreator(false);
    router.push({ pathname: '/tier-list/[id]', params: { id } } as never);
  };

  const confirmDelete = async (list: MovieTierList) => {
    const approved = await confirm({ title: 'Delete tier list?', message: `${list.title} will be permanently removed.`, confirmLabel: 'Delete', tone: 'danger' });
    if (approved) deleteTierList(list.id);
  };

  const openRename = (list: MovieTierList) => {
    setRenamingList(list);
    setRenameTitle(list.title);
  };

  const saveRename = () => {
    if (!renamingList) return;
    renameTierList(renamingList.id, renameTitle);
    setRenamingList(null);
    setRenameTitle('');
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 border-b border-white/10 px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-navyLight"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="text-[20px] font-black text-white">Tier Lists</Text>
          <Text className="text-[10px] font-bold text-brand-grayText">
            Turn your library into definitive rankings
          </Text>
        </View>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow"
          onPress={openCreator}
          accessibilityLabel="Create tier list"
        >
          <Ionicons name="add" size={22} color="#073445" />
        </Pressable>
      </View>

      <FlatList
        data={tierLists}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: getBottomSheetPadding(insets.bottom, 40), gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          tierLists.length === 0 ? (
            <View className="mb-2 overflow-hidden rounded-3xl border border-brand-yellow/20 bg-[#073746] p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-yellow">
                  <Ionicons name="podium" size={25} color="#073445" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[16px] font-black text-white">Rank your movie universe</Text>
                  <Text className="mt-1 text-[10px] font-semibold leading-4 text-brand-grayText">
                    Start from watched films, your watchlist, favorites, or a custom list.
                  </Text>
                </View>
              </View>
              <Pressable
                className="mt-4 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
                onPress={openCreator}
              >
                <Ionicons name="sparkles" size={17} color="#073445" />
                <Text className="text-[11px] font-black text-brand-navy">Create a Tier List</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="podium-outline"
            title="No tier lists yet"
            description="Choose a film source and start ranking cards into tiers."
            actionLabel="Create your first tier list"
            onAction={openCreator}
          />
        }
        renderItem={({ item }) => {
          const rankedCount = item.tiers.reduce((total, tier) => total + tier.movieIds.length, 0);
          const progress = item.sourceMovieIds.length
            ? Math.round((rankedCount / item.sourceMovieIds.length) * 100)
            : 0;
          const coverIds = item.tiers.flatMap((tier) => tier.movieIds).slice(0, 4);
          const fallbackIds = item.unrankedMovieIds.slice(0, Math.max(0, 4 - coverIds.length));
          const coverMovies = [...coverIds, ...fallbackIds]
            .map((id) => movieById.get(id))
            .filter((movie): movie is LoggedMovie => Boolean(movie));
          return (
            <Pressable
              className="overflow-hidden rounded-2xl border border-white/10 bg-brand-navyLight"
              onPress={() => router.push({ pathname: '/tier-list/[id]', params: { id: item.id } } as never)}
              accessibilityLabel={`Open ${item.title}`}
            >
              <View className="h-32 flex-row bg-brand-navy">
                {coverMovies.map((movie) => (
                  <View key={movie.id} className="flex-1 overflow-hidden border-r border-brand-navy">
                    {movie.image ? (
                      <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons name="film-outline" size={18} color="#A0AEC0" />
                      </View>
                    )}
                  </View>
                ))}
                {coverMovies.length === 0 ? (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="podium-outline" size={34} color="#F9C80E" />
                  </View>
                ) : null}
              </View>
              <View className="p-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={2} className="text-[15px] font-black leading-5 text-white">
                      {item.title}
                    </Text>
                    <Text className="mt-1 text-[9px] font-bold text-brand-grayText">
                      {item.sourceLabel} - {rankedCount}/{item.sourceMovieIds.length} ranked
                    </Text>
                  </View>
                  <View className="items-end gap-2">
                    <Text className="text-[12px] font-black text-brand-yellow">{progress}%</Text>
                    <Pressable
                      className="h-8 w-8 items-center justify-center rounded-lg bg-white/5"
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        openRename(item);
                      }}
                      accessibilityLabel={`Rename ${item.title}`}
                    >
                      <Ionicons name="create-outline" size={15} color="#F9C80E" />
                    </Pressable>
                  </View>
                </View>
                <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <View className="h-full rounded-full bg-brand-yellow" style={{ width: `${progress}%` }} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal visible={showCreator} transparent animationType="slide" onRequestClose={() => setShowCreator(false)}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/70"
        >
          <Pressable className="absolute inset-0" onPress={() => setShowCreator(false)} />
          <View
            className="max-h-[90%] rounded-t-3xl border-t border-white/10 bg-[#0D162D] px-4 pt-4"
            style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 16) }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[18px] font-black text-white">New Tier List</Text>
                <Text className="mt-0.5 text-[10px] font-semibold text-brand-grayText">
                  Choose where the waiting film cards come from.
                </Text>
              </View>
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                onPress={() => setShowCreator(false)}
              >
                <Ionicons name="close" size={19} color="white" />
              </Pressable>
            </View>

            <Text className="mb-2 text-[9px] font-black uppercase tracking-wider text-brand-grayText">Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={selectedSource ? `${selectedSource.label} Ranked` : 'My Tier List'}
              placeholderTextColor="#64748B"
              className="h-11 rounded-xl border border-white/10 bg-brand-navy px-3 text-[12px] font-bold text-white"
            />

            <Text className="mb-2 mt-4 text-[9px] font-black uppercase tracking-wider text-brand-grayText">
              Movie source
            </Text>
            <FlatList
              automaticallyAdjustKeyboardInsets
              data={sources}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: sourceListMaxHeight }}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.id === sourceId;
                return (
                  <Pressable
                    className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                      selected
                        ? 'border-brand-yellow bg-brand-yellow/10'
                        : 'border-white/10 bg-brand-navy'
                    }`}
                    onPress={() => setSourceId(item.id)}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                      <Ionicons name={item.icon} size={19} color={selected ? '#F9C80E' : '#A0AEC0'} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[12px] font-black text-white">{item.label}</Text>
                      <Text numberOfLines={2} className="mt-0.5 text-[9px] font-semibold leading-3 text-brand-grayText">
                        {item.description}
                      </Text>
                    </View>
                    <Text className="text-[11px] font-black text-brand-yellow">{item.movies.length}</Text>
                  </Pressable>
                );
              }}
            />

            <Pressable
              className={`mt-4 h-12 items-center justify-center rounded-xl ${
                selectedSource?.movies.length ? 'bg-brand-yellow' : 'bg-white/10'
              }`}
              disabled={!selectedSource?.movies.length}
              onPress={createList}
            >
              <Text
                className={`text-[11px] font-black ${
                  selectedSource?.movies.length ? 'text-brand-navy' : 'text-white/35'
                }`}
              >
                Create with {selectedSource?.movies.length ?? 0} films
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={renamingList !== null} transparent animationType="fade" onRequestClose={() => setRenamingList(null)}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/70"
        >
          <Pressable className="absolute inset-0" onPress={() => setRenamingList(null)} />
          <View
            className="rounded-t-3xl border-t border-white/10 bg-[#0D162D] px-4 pt-4"
            style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 16) }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <Text className="text-[18px] font-black text-white">Edit Tier List</Text>
                <Text numberOfLines={2} className="mt-0.5 text-[10px] font-semibold leading-4 text-brand-grayText">
                  {renamingList?.sourceLabel}
                </Text>
              </View>
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                onPress={() => setRenamingList(null)}
                accessibilityLabel="Close rename tier list"
              >
                <Ionicons name="close" size={19} color="white" />
              </Pressable>
            </View>

            <Text className="mb-2 text-[9px] font-black uppercase tracking-wider text-brand-grayText">Name</Text>
            <TextInput
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder="Tier list name"
              placeholderTextColor="#64748B"
              className="h-11 rounded-xl border border-white/10 bg-brand-navy px-3 text-[12px] font-bold text-white"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveRename}
            />

            <Pressable
              className="mt-4 flex-row items-center gap-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3"
              onPress={() => {
                const list = renamingList;
                setRenamingList(null);
                if (list) confirmDelete(list);
              }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
                <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] font-black text-red-100">Delete tier list</Text>
                <Text className="mt-0.5 text-[9px] font-semibold text-red-100/55">
                  Permanently remove this ranking.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
            </Pressable>

            <View className="mt-4 flex-row gap-3">
              <Pressable
                className="h-12 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                onPress={() => setRenamingList(null)}
              >
                <Text className="text-[11px] font-black text-white/70">Cancel</Text>
              </Pressable>
              <Pressable className="h-12 flex-1 items-center justify-center rounded-xl bg-brand-yellow" onPress={saveRename}>
                <Text className="text-[11px] font-black text-brand-navy">Save name</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
