import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MovieItem } from '@/services/tmdb';
import { useMovieActions, useMovieState } from '@/context/MovieContext';
import { useSharedWatchlists } from '@/context/SharedWatchlistContext';
import HalfStarRating from '@/components/HalfStarRating';
import FeedbackToast from '@/components/FeedbackToast';

export interface ActionModalProps {
  movie: MovieItem | null;
  onClose: () => void;
  visible: boolean;
}

const getYear = (date?: string) => {
  if (!date) return '';
  return date.match(/\d{4}/)?.[0] ?? date;
};

export default function ActionModal({ movie, onClose, visible }: ActionModalProps) {
  const { customLists, movies } = useMovieState();
  const { getMovieState, logMovie, removeMovie, toggleMovieInList, toggleLike } = useMovieActions();
  const { addMovieToSharedList, lists: sharedLists } = useSharedWatchlists();
  
  const savedState = movie ? getMovieState(movie.id) : null;
  
  const [rating, setRating] = useState(savedState ? savedState.rating : 0);
  const [isWatched, setIsWatched] = useState(savedState ? savedState.isWatched : false);
  const [isWatchlist, setIsWatchlist] = useState(savedState ? savedState.isWatchlist : false);
  const [isLiked, setIsLiked] = useState(savedState ? savedState.isLiked : false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [pendingSharedListId, setPendingSharedListId] = useState<string | null>(null);
  const [showSharedListPicker, setShowSharedListPicker] = useState(false);
  
  const translateY = useSharedValue(0);

  const currentMovieObj = movies.find(m => m.id === movie?.id);
  const movieLists = currentMovieObj?.lists ?? [];

  const handleWatchedPress = () => {
    if (!movie) return;
    const nextWatched = !isWatched;
    setIsWatched(nextWatched);

    if (nextWatched) {
      setIsWatchlist(false);
      const nextRating = rating > 0 ? rating : 3; // default rating if none set
      setRating(nextRating);
      logMovie(movie, nextRating, true, false);
      setFeedbackMessage(`${movie.title} logged`);
    } else {
      if (!isWatchlist) {
        removeMovie(movie.id);
        setFeedbackMessage(`${movie.title} removed`);
      } else {
        logMovie(movie, 0, false, true);
        setFeedbackMessage(`${movie.title} kept in Watchlist`);
      }
    }
  };

  const handleWatchlistPress = () => {
    if (!movie) return;
    const nextWatchlist = !isWatchlist;
    setIsWatchlist(nextWatchlist);

    if (nextWatchlist) {
      setIsWatched(false);
      setRating(0);
      logMovie(movie, 0, false, true);
      setFeedbackMessage(`${movie.title} added to Watchlist`);
    } else {
      if (!isWatched) {
        removeMovie(movie.id);
        setFeedbackMessage(`${movie.title} removed from Watchlist`);
      } else {
        logMovie(movie, rating, true, false);
        setFeedbackMessage(`${movie.title} removed from Watchlist`);
      }
    }
  };

  const handleRatingPress = (val: number) => {
    if (!movie) return;
    const nextRating = rating === val ? 0 : val;
    setRating(nextRating);

    if (nextRating > 0) {
      setIsWatched(true);
      setIsWatchlist(false);
      logMovie(movie, nextRating, true, false);
      setFeedbackMessage(`${movie.title} rated ${nextRating.toFixed(1)} and logged`);
    } else {
      if (isWatched) {
        logMovie(movie, 0, true, false);
        setFeedbackMessage(`${movie.title} rating cleared`);
      }
    }
  };

  const handleFavoritePress = () => {
    if (!movie) return;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    
    if (!savedState) logMovie(movie, 0, false, false, true);
    else toggleLike(movie.id);
    
    setFeedbackMessage(nextLiked ? `${movie.title} added to Favorites` : `${movie.title} removed from Favorites`);
  };

  const handleAddToSharedList = async (listId: string, listName: string) => {
    if (!movie || pendingSharedListId) return;
    setPendingSharedListId(listId);
    try {
      await addMovieToSharedList(listId, movie);
      setFeedbackMessage(`${movie.title} added to shared list: ${listName}`);
      setShowSharedListPicker(false);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Could not add to shared list');
    } finally {
      setPendingSharedListId(null);
    }
  };

  const dragGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (translateY.value > 92 || event.velocityY > 650) {
        translateY.value = withTiming(36, { duration: 120 }, () => {
          runOnJS(onClose)();
          translateY.value = 0;
        });
        return;
      }

      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!movie) return null;

  const year = getYear(movie.date);
  const titleLine = year ? `${year} - ${movie.title}` : movie.title;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-black/70 px-8">
          <Pressable accessibilityLabel="Close action modal" className="absolute inset-0" onPress={onClose} />

          <GestureDetector gesture={dragGesture}>
            <Animated.View
              className="w-full max-w-[330px] rounded-xl bg-[#061E2A] p-4"
              style={[
                {
                  borderCurve: 'continuous',
                  maxWidth: 300,
                },
                modalStyle,
              ]}
            >
              <View className="mb-3 items-center">
                <View className="h-1 w-10 rounded-full bg-white/18" />
              </View>

              <View className="flex-row gap-4">
                <View className="min-w-0 flex-1">
                  <View
                    className="h-[144px] w-[96px] overflow-hidden rounded-lg bg-[#FFB300]"
                    style={{ borderCurve: 'continuous' }}
                  >
                    {movie.image ? (
                      <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons name="film" size={34} color="#051E2A" />
                      </View>
                    )}
                  </View>

                  <Text selectable numberOfLines={2} className="mt-3 text-base font-extrabold leading-5 text-white">
                    {titleLine}
                  </Text>
                  <Text
                    selectable
                    numberOfLines={5}
                    ellipsizeMode="tail"
                    className="mt-2 text-[12px] leading-4 text-white/82"
                  >
                    {movie.overview || 'No overview is available for this movie yet.'}
                  </Text>
                </View>

                <View className="w-[180px] items-center">
                  <View className="w-full flex-row gap-2">
                    <Pressable
                      className={`min-h-16 flex-1 items-center justify-center rounded-lg border px-1 ${
                        isWatched ? 'border-[#F9C80E] bg-[#F9C80E]/18' : 'border-white/18 bg-white/5'
                      }`}
                      onPress={handleWatchedPress}
                    >
                      <Ionicons
                        name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={22}
                        color={isWatched ? '#F9C80E' : '#C6D1D8'}
                      />
                      <Text selectable numberOfLines={2} className="mt-1 text-center text-[10px] font-medium leading-3 text-white/78">
                        Watched
                      </Text>
                    </Pressable>

                    <Pressable
                      className={`min-h-16 flex-1 items-center justify-center rounded-lg border px-1 ${
                        isWatchlist ? 'border-[#F9C80E] bg-[#F9C80E]/18' : 'border-white/18 bg-white/5'
                      }`}
                      onPress={handleWatchlistPress}
                    >
                      <Ionicons
                        name={isWatchlist ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={isWatchlist ? '#F9C80E' : '#C6D1D8'}
                      />
                      <Text selectable numberOfLines={2} className="mt-1 text-center text-[10px] font-medium leading-3 text-white/78">
                        Watchlist
                      </Text>
                    </Pressable>

                    <Pressable
                      className={`min-h-16 flex-1 items-center justify-center rounded-lg border px-1 ${
                        isLiked ? 'border-[#F9C80E] bg-[#F9C80E]/18' : 'border-white/18 bg-white/5'
                      }`}
                      onPress={handleFavoritePress}
                    >
                      <Ionicons
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={22}
                        color={isLiked ? '#F9C80E' : '#C6D1D8'}
                      />
                      <Text selectable numberOfLines={2} className="mt-1 text-center text-[10px] font-medium leading-3 text-white/78">
                        Favorite
                      </Text>
                    </Pressable>
                  </View>

                  <View className="flex-1 items-center justify-center">
                    <HalfStarRating rating={rating} onChange={handleRatingPress} size={21} showValue />
                    <Text selectable className="mt-1 text-xs font-medium text-white/68">
                      Tap or slide to rate
                    </Text>
                  </View>
                </View>
              </View>

              {/* Lists Chips Section at the Bottom */}
              {customLists.length > 0 && (
                <View className="mt-4 pt-3 border-t border-white/12">
                  <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white/60 mb-2 px-0.5">
                    Add to lists
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {customLists.map((listName) => {
                      const isAdded = movieLists.includes(listName);
                      return (
                        <TouchableOpacity
                          key={listName}
                          onPress={() => {
                            if (movie) {
                              if (!currentMovieObj) {
                                // Default log if the movie has not been logged yet
                                logMovie(movie, 0, true, false);
                              }
                              toggleMovieInList(movie.id, listName);
                              setFeedbackMessage(
                                isAdded ? `${movie.title} removed from ${listName}` : `${movie.title} added to ${listName}`
                              );
                            }
                          }}
                          activeOpacity={0.7}
                          className={`px-3 py-1.5 rounded-full border ${
                            isAdded
                              ? 'border-brand-yellow bg-brand-yellow/12'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <Text
                            className={`text-[11px] font-bold ${
                              isAdded ? 'text-brand-yellow' : 'text-brand-grayText'
                            }`}
                          >
                            {listName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View className="mt-4 border-t border-white/12 pt-3">
                <Pressable
                  className="min-h-11 flex-row items-center gap-3 rounded-xl border border-brand-yellow/25 bg-brand-yellow/10 px-3 py-2"
                  onPress={() => setShowSharedListPicker(true)}
                  accessibilityLabel="Add movie to a shared list"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-brand-yellow/15">
                    <Ionicons name="people" size={16} color="#F9C80E" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-black text-white">Add to Shared List</Text>
                    <Text numberOfLines={1} className="mt-0.5 text-[9px] font-semibold text-white/55">
                      {sharedLists.length > 0
                        ? `${sharedLists.length} shared ${sharedLists.length === 1 ? 'list' : 'lists'} available`
                        : 'Create or join a shared movie list'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#F9C80E" />
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
          <FeedbackToast message={feedbackMessage} onDismiss={() => setFeedbackMessage(null)} />

          <Modal
            animationType="fade"
            onRequestClose={() => setShowSharedListPicker(false)}
            statusBarTranslucent
            transparent
            visible={showSharedListPicker}
          >
            <View className="flex-1 justify-end bg-black/70">
              <Pressable className="absolute inset-0" onPress={() => setShowSharedListPicker(false)} />
              <View className="max-h-[72%] rounded-t-[24px] border-t border-white/10 bg-[#061E2A] px-4 pb-6 pt-4">
                <View className="mb-4 flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[17px] font-black text-white">Add to Shared List</Text>
                    <Text numberOfLines={1} className="mt-1 text-[10px] font-semibold text-white/55">
                      {movie.title}
                    </Text>
                  </View>
                  <Pressable
                    className="h-9 w-9 items-center justify-center rounded-full bg-white/8"
                    onPress={() => setShowSharedListPicker(false)}
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
                        setShowSharedListPicker(false);
                        onClose();
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
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
