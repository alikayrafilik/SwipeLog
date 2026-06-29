import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HalfStarRating from '@/components/HalfStarRating';
import { DiaryEntry, useMovieActions, useMovieState } from '@/context/MovieContext';
import { getBottomSheetPadding } from '@/constants/layout';

type ReviewSort = 'newest' | 'oldest' | 'highest';

const SORT_OPTIONS: { id: ReviewSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'highest', label: 'Highest rated' },
];

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function ReviewsScreen() {
  const { diaryEntries } = useMovieState();
  const { refreshMovieMetadata, updateWatchEntry } = useMovieActions();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftRating, setDraftRating] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const reviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = diaryEntries.filter(
      (entry) =>
        Boolean(entry.note?.trim()) &&
        (!normalizedQuery ||
          entry.movie.title.toLowerCase().includes(normalizedQuery) ||
          entry.note?.toLowerCase().includes(normalizedQuery))
    );

    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return a.watchedAt.localeCompare(b.watchedAt);
      if (sort === 'highest') {
        return b.rating - a.rating || b.watchedAt.localeCompare(a.watchedAt);
      }
      return b.watchedAt.localeCompare(a.watchedAt);
    });
  }, [diaryEntries, query, sort]);

  const openMovie = (entry: DiaryEntry) => {
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: entry.movie.id,
        title: entry.movie.title,
        year: entry.movie.date?.match(/\d{4}/)?.[0] ?? '',
        image: entry.movie.image,
        overview: entry.movie.overview ?? '',
        rating: `${entry.rating}`,
      },
    } as never);
  };

  const startEditing = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setDraftNote(entry.note ?? '');
    setDraftRating(entry.rating);
  };

  const closeEditor = () => {
    setEditingEntry(null);
    setDraftNote('');
    setDraftRating(0);
  };

  const saveReview = () => {
    if (!editingEntry) return;
    if (!draftNote.trim()) {
      Alert.alert('Review is empty', 'Write something before saving your review.');
      return;
    }
    updateWatchEntry(editingEntry.id, {
      rating: draftRating,
      watchedAt: editingEntry.watchedAt,
      note: draftNote.trim(),
    });
    closeEditor();
  };

  const confirmDelete = (entry: DiaryEntry) => {
    Alert.alert(
      'Delete review?',
      `This removes your written review for ${entry.movie.title}. Your diary log and rating will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            updateWatchEntry(entry.id, {
              rating: entry.rating,
              watchedAt: entry.watchedAt,
              note: '',
            }),
        },
      ]
    );
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshMovieMetadata(reviews.map((entry) => entry.movieId));
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleExpanded = (entryId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 border-b border-white/10 px-4 pb-3 pt-2">
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-navyLight"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[20px] font-black text-white">Your Reviews</Text>
          <Text className="text-[10px] font-bold text-brand-grayText">
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(entry) => entry.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: getBottomSheetPadding(insets.bottom, 40), gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#F9C80E']}
            progressBackgroundColor="#073445"
            tintColor="#F9C80E"
          />
        }
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <View className="h-11 flex-row items-center gap-2 rounded-xl border border-white/10 bg-brand-navyLight px-3">
              <Ionicons name="search-outline" size={17} color="#A0AEC0" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                className="flex-1 text-[12px] font-semibold text-white"
                placeholder="Search films or reviews..."
                placeholderTextColor="#64748B"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={17} color="#A0AEC0" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              {SORT_OPTIONS.map((option) => {
                const selected = sort === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    className={`rounded-full border px-3 py-2 ${
                      selected
                        ? 'border-brand-yellow bg-brand-yellow'
                        : 'border-white/10 bg-brand-navyLight'
                    }`}
                    onPress={() => setSort(option.id)}
                    accessibilityLabel={`Sort reviews by ${option.label}`}
                  >
                    <Text
                      className={`text-[9px] font-black ${
                        selected ? 'text-brand-navy' : 'text-brand-grayText'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="mt-16 items-center rounded-2xl border border-dashed border-white/15 bg-brand-navyLight px-6 py-10">
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#F9C80E" />
            <Text className="mt-3 text-[14px] font-black text-white">
              {query ? 'No matching reviews' : 'No reviews yet'}
            </Text>
            <Text className="mt-1 text-center text-[10px] font-semibold leading-4 text-brand-grayText">
              {query
                ? 'Try searching for another film or phrase.'
                : 'Add a note while logging a movie and it will appear here.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const expanded = expandedIds.has(item.id);
          return (
            <View className="overflow-hidden rounded-2xl border border-white/10 bg-brand-navyLight">
              <Pressable
                className="flex-row gap-3 p-3"
                onPress={() => openMovie(item)}
                accessibilityLabel={`Open ${item.movie.title}`}
              >
                <View className="w-[72px] overflow-hidden rounded-lg bg-slate-800" style={{ aspectRatio: 2 / 3 }}>
                  {item.movie.image ? (
                    <Image source={{ uri: item.movie.image }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Ionicons name="film-outline" size={22} color="#A0AEC0" />
                    </View>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={2} className="text-[14px] font-black text-white">
                    {item.movie.title}
                  </Text>
                  <Text className="mt-1 text-[9px] font-bold text-brand-grayText">
                    {formatReviewDate(item.watchedAt)}
                  </Text>
                  <View className="mt-1">
                    <HalfStarRating rating={item.rating} size={12} showValue />
                  </View>
                  <Pressable onPress={() => toggleExpanded(item.id)} hitSlop={8}>
                    <Text
                      className="mt-2 text-[11px] font-medium leading-5 text-slate-300"
                      numberOfLines={expanded ? undefined : 4}
                    >
                      {item.note}
                    </Text>
                    <Text className="mt-1 text-[9px] font-black text-brand-yellow">
                      {expanded ? 'Show less' : 'Read more'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
              <View className="flex-row border-t border-white/10">
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                  onPress={() => startEditing(item)}
                  accessibilityLabel={`Edit review for ${item.movie.title}`}
                >
                  <Ionicons name="create-outline" size={15} color="#F9C80E" />
                  <Text className="text-[9px] font-black text-brand-yellow">Edit</Text>
                </TouchableOpacity>
                <View className="w-px bg-white/10" />
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                  onPress={() => confirmDelete(item)}
                  accessibilityLabel={`Delete review for ${item.movie.title}`}
                >
                  <Ionicons name="trash-outline" size={15} color="#FCA5A5" />
                  <Text className="text-[9px] font-black text-red-300">Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={Boolean(editingEntry)} transparent animationType="fade" onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/70"
        >
        <Pressable className="flex-1 justify-end" onPress={closeEditor}>
          <Pressable
            className="rounded-t-3xl border-t border-white/10 bg-brand-navyLight px-4 pt-5"
            style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 16) }}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <View className="min-w-0 flex-1 pr-3">
                <Text className="text-[10px] font-black uppercase tracking-wider text-brand-yellow">
                  Edit review
                </Text>
                <Text numberOfLines={2} className="mt-1 text-[16px] font-black leading-5 text-white">
                  {editingEntry?.movie.title}
                </Text>
              </View>
              <TouchableOpacity
                className="h-9 w-9 items-center justify-center rounded-full bg-brand-navy"
                onPress={closeEditor}
                accessibilityLabel="Close review editor"
              >
                <Ionicons name="close" size={19} color="white" />
              </TouchableOpacity>
            </View>

            <Text className="mb-1 text-[9px] font-black uppercase tracking-wider text-brand-grayText">
              Rating
            </Text>
            <HalfStarRating rating={draftRating} onChange={setDraftRating} size={26} showValue />

            <Text className="mb-2 mt-4 text-[9px] font-black uppercase tracking-wider text-brand-grayText">
              Review
            </Text>
            <TextInput
              value={draftNote}
              onChangeText={setDraftNote}
              multiline
              autoFocus
              placeholder="What did you think?"
              placeholderTextColor="#64748B"
              className="min-h-[130px] rounded-2xl border border-white/10 bg-brand-navy px-4 py-3 text-[12px] font-semibold leading-5 text-white"
              style={{ textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              className="mt-4 h-12 items-center justify-center rounded-xl bg-brand-yellow"
              onPress={saveReview}
              accessibilityLabel="Save review changes"
            >
              <Text className="text-[11px] font-black text-brand-navy">Save changes</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
