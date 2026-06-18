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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMovies, DiaryEntry } from '@/context/MovieContext';
import HalfStarRating from '@/components/HalfStarRating';
import EmptyState from '@/components/EmptyState';
import {
  listContentStyle,
  virtualizedListProps,
  getYear,
  StarRating,
} from './shared';
import { toWatchDateTime, validateWatchDate, WATCH_DATE_HELP_TEXT } from '@/utils/watch-date';

type DiaryListItem =
  | { id: string; kind: 'header'; title: string }
  | { entry: DiaryEntry; id: string; kind: 'entry' };

export default function DiaryTab() {
  const {
    movies,
    refreshMovieMetadata,
    diaryEntries,
    updateWatchEntry,
    deleteWatchEntry,
  } = useMovies();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const editDateValidation = useMemo(() => validateWatchDate(editDate), [editDate]);

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

  const diaryListItems = useMemo<DiaryListItem[]>(() => {
    const items: DiaryListItem[] = [];
    let currentGroup = '';
    diaryEntries.forEach((entry) => {
      const date = new Date(entry.watchedAt);
      const key = Number.isNaN(date.getTime())
        ? 'Other Logs'
        : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (key !== currentGroup) {
        currentGroup = key;
        items.push({ id: `header-${key}`, kind: 'header', title: key });
      }
      items.push({ id: entry.id, kind: 'entry', entry });
    });
    return items;
  }, [diaryEntries]);

  const diaryEntryWatchNumbers = useMemo(() => {
    const watchNumbers = new Map<string, number>();
    const countsByMovieId = new Map<string, number>();
    [...diaryEntries].reverse().forEach((entry) => {
      const nextCount = (countsByMovieId.get(entry.movieId) ?? 0) + 1;
      countsByMovieId.set(entry.movieId, nextCount);
      watchNumbers.set(entry.id, nextCount);
    });
    return watchNumbers;
  }, [diaryEntries]);

  const openEntryEditor = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setEditRating(entry.rating || movieById.get(entry.movieId)?.rating || 0);
    setEditNote(entry.note ?? '');
    setEditDate(entry.watchedAt.slice(0, 10));
  };

  const handleSaveEntry = () => {
    if (!editingEntry || editDateValidation.error) return;
    updateWatchEntry(editingEntry.id, {
      rating: editRating,
      note: editNote,
      watchedAt: toWatchDateTime(editDateValidation.dateKey),
    });
    setEditingEntry(null);
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
        key="diary-list"
        data={diaryListItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={listContentStyle}
        refreshControl={libraryRefreshControl}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <View className="py-8">
            <EmptyState
              icon="calendar-outline"
              title="Your diary is empty"
              description="Every watch, including rewatches, appears here as a separate entry."
            />
          </View>
        }
        ListHeaderComponent={
          <View className="mb-4 gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-black text-white">Diary entries</Text>
              <Text className="text-[9px] font-black uppercase text-brand-grayText">
                {diaryEntries.length} entries
              </Text>
            </View>
            <Text className="text-[10px] font-semibold text-brand-grayText">
              Rewatches are kept as separate diary entries.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
            <Text className="text-white text-base font-extrabold mb-3 tracking-wide border-l-2 border-brand-yellow pl-2">
                {item.title}
            </Text>
            );
          }

          const { entry } = item;
          const displayRating = entry.rating || movieById.get(entry.movieId)?.rating || 0;
          return (
              <Pressable
                key={entry.id}
                className="flex-row items-center bg-brand-navyLight border border-slate-800/80 rounded-xl p-2.5 mb-2.5"
                onPress={() => navigateToMovie({ ...entry.movie, rating: displayRating })}
              >
                <View className="w-11 h-[66px] rounded bg-slate-800 overflow-hidden border border-slate-700/40">
                  {entry.movie.image ? (
                    <Image source={{ uri: entry.movie.image }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Ionicons name="film-outline" size={14} color="#A0AEC0" />
                    </View>
                  )}
                </View>
                <View className="flex-1 ml-3 justify-center">
                  <Text numberOfLines={1} className="text-white text-[15px] font-bold">
                    {entry.movie.title}
                  </Text>
                  <Text className="text-brand-grayText text-xs mt-0.5 font-medium">
                    {entry.movie.date || 'N/A'}
                  </Text>
                  <View className="mt-1">
                    <View className="flex-row items-center gap-2">
                      <StarRating rating={displayRating} size={10} />
                      <Text className="text-[10px] font-black text-brand-yellow">
                        {displayRating > 0 ? displayRating.toFixed(1) : 'Not rated'}
                      </Text>
                      {movieById.get(entry.movieId)?.isLiked ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-pink-500/10 px-2 py-1">
                          <Ionicons name="heart" size={10} color="#F472B6" />
                          <Text className="text-[8px] font-black uppercase text-pink-300">Favorite</Text>
                        </View>
                      ) : null}
                      {(diaryEntryWatchNumbers.get(entry.id) ?? 1) > 1 ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-brand-yellow/10 px-2 py-1">
                          <Ionicons name="repeat" size={10} color="#F9C80E" />
                          <Text className="text-[8px] font-black uppercase text-brand-yellow">
                            Rewatch #{diaryEntryWatchNumbers.get(entry.id)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {entry.note ? (
                    <Text selectable numberOfLines={2} className="mt-1.5 text-[11px] leading-4 text-white/65">
                      {entry.note}
                    </Text>
                  ) : null}
                </View>
                <View className="ml-2 pr-1 items-end">
                  <Text className="text-brand-grayText text-[11px] font-bold">
                    {new Date(entry.watchedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Pressable
                    accessibilityLabel="Edit diary entry"
                    className="mt-2 h-8 w-8 items-center justify-center rounded-full bg-white/8"
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      openEntryEditor(entry);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color="#F9C80E" />
                  </Pressable>
                </View>
              </Pressable>
          );
        }}
        {...virtualizedListProps}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setEditingEntry(null)}
        statusBarTranslucent
        transparent
        visible={editingEntry !== null}
      >
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <Pressable className="absolute inset-0" onPress={() => setEditingEntry(null)} />
          <View
            className="w-full max-w-[360px] gap-4 rounded-2xl border border-white/10 bg-[#0D162D] p-4"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <Text selectable numberOfLines={1} className="text-[16px] font-black text-white">
                  Edit Diary Entry
                </Text>
                <Text selectable numberOfLines={1} className="mt-0.5 text-[11px] font-semibold text-brand-grayText">
                  {editingEntry?.movie.title}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close diary editor"
                className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                onPress={() => setEditingEntry(null)}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <View className="gap-2">
              <Text selectable className="text-[10px] font-extrabold uppercase text-brand-grayText">
                Watched Date
              </Text>
              <TextInput
                value={editDate}
                onChangeText={setEditDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0AEC0"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                className={`h-11 rounded-xl border px-3 text-[13px] font-bold text-white ${
                  editDateValidation.error ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-white/5'
                }`}
              />
              <Text selectable className={`text-[9px] font-bold ${editDateValidation.error ? 'text-red-200' : 'text-brand-grayText'}`}>
                {editDateValidation.error ?? WATCH_DATE_HELP_TEXT}
              </Text>
            </View>

            <View className="gap-2">
              <Text selectable className="text-[10px] font-extrabold uppercase text-brand-grayText">
                Rating
              </Text>
              <HalfStarRating
                rating={editRating}
                onChange={(value) => setEditRating(editRating === value ? 0 : value)}
                size={25}
                showValue
              />
              <Text className="text-[9px] font-semibold text-brand-grayText">Tap the left half for .5</Text>
            </View>

            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Write a note..."
              placeholderTextColor="#A0AEC0"
              multiline
              maxLength={280}
              className="min-h-[96px] rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] font-medium text-white"
              style={{ textAlignVertical: 'top' }}
            />

            <View className="flex-row gap-3">
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10"
                onPress={() => {
                  if (editingEntry) deleteWatchEntry(editingEntry.id);
                  setEditingEntry(null);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                <Text selectable className="text-[12px] font-black text-red-200">
                  Delete
                </Text>
              </Pressable>
              <Pressable
                className={`h-11 flex-1 items-center justify-center rounded-xl ${
                  editDateValidation.error ? 'bg-brand-yellow/40' : 'bg-brand-yellow'
                }`}
                disabled={Boolean(editDateValidation.error)}
                onPress={handleSaveEntry}
              >
                <Text selectable className="text-[12px] font-black text-brand-navy">
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
