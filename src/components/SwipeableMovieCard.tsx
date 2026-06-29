/* eslint-disable react-hooks/immutability */
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MovieItem } from '@/services/tmdb';

export interface SwipeableMovieCardProps {
  activeMovieId: string | null;
  disableSwipeActions?: boolean;
  movie: MovieItem;
  onPressMovie: (movie: MovieItem) => void;
  onSwipeActive: (movie: MovieItem) => void;
}

const SWIPE_RESTING_OFFSET = -96;
const SWIPE_THRESHOLD = -72;

const getYear = (date?: string) => {
  if (!date) return '';
  return date.match(/\d{4}/)?.[0] ?? date;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SwipeableMovieCard({
  activeMovieId,
  disableSwipeActions = false,
  movie,
  onPressMovie,
  onSwipeActive,
}: SwipeableMovieCardProps) {
  const translateX = useSharedValue(0);
  const isActive = activeMovieId === movie.id;
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.35);
  const elevation = useSharedValue(8);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350 });
    scale.value = withSpring(1, { damping: 14, stiffness: 200 });
  }, [opacity, scale]);

  useEffect(() => {
    if (disableSwipeActions || !isActive) {
      translateX.value = withSpring(0, { damping: 18, stiffness: 170 });
    }
  }, [disableSwipeActions, isActive, translateX]);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
    shadowOpacity.value = withTiming(0.1, { duration: 150 });
    elevation.value = withTiming(2, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 300 });
    shadowOpacity.value = withTiming(0.35, { duration: 150 });
    elevation.value = withTiming(8, { duration: 150 });
  };

  const panGesture = Gesture.Pan()
    .enabled(!disableSwipeActions)
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onStart(() => {
      // If we start panning, immediately reset scale so it doesn't conflict
      scale.value = withSpring(1, { damping: 14, stiffness: 300 });
    })
    .onUpdate((event) => {
      translateX.value = Math.max(SWIPE_RESTING_OFFSET, Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      if (translateX.value <= SWIPE_THRESHOLD || event.velocityX < -700) {
        translateX.value = withSpring(SWIPE_RESTING_OFFSET, { damping: 18, stiffness: 170 });
        runOnJS(onSwipeActive)(movie);
        return;
      }

      translateX.value = withSpring(0, { damping: 18, stiffness: 170 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { scale: scale.value }
    ],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: elevation.value },
    shadowOpacity: shadowOpacity.value,
    shadowRadius: elevation.value * 1.5,
    elevation: elevation.value,
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [SWIPE_RESTING_OFFSET, 0],
      [opacity.value, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [SWIPE_RESTING_OFFSET, 0],
          [1, 0.92],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const year = getYear(movie.date);

  return (
    <View className="relative mb-2.5 min-h-[105px] w-full">
      {!disableSwipeActions ? (
        <Animated.View
          className="absolute inset-y-0 right-0 w-28 items-center justify-center rounded-xl bg-[#FFB300]"
          style={[{ borderCurve: 'continuous' }, actionStyle]}
        >
          <Ionicons name="sparkles" size={24} color="#051E2A" />
          <Text selectable className="mt-1 text-xs font-extrabold uppercase text-[#051E2A]">
            Action
          </Text>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => onPressMovie(movie)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className="flex-row items-center gap-3.5 rounded-xl border border-white/5 p-2"
          style={[{ backgroundColor: '#073445', borderCurve: 'continuous' }, cardStyle]}
        >
          <View
            className="h-[105px] w-[70px] overflow-hidden rounded-lg bg-[#051E2A]"
            style={{ borderCurve: 'continuous' }}
          >
            {movie.image ? (
              <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center px-1">
                <Ionicons name="film" size={24} color="#A0AEC0" />
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1 justify-center pr-2 py-1">
            <Text selectable numberOfLines={2} className="text-[17px] font-black leading-5 text-white">
              {movie.title}
            </Text>
            
            {year || movie.rating ? (
              <View className="mt-1 flex-row items-center gap-1.5">
                {year ? (
                  <Text selectable className="text-[11px] font-bold text-white/55">
                    {year}
                  </Text>
                ) : null}
                {year && movie.rating ? (
                  <View className="h-0.5 w-0.5 rounded-full bg-white/30" />
                ) : null}
                {movie.rating ? (
                  <View className="flex-row items-center gap-0.5">
                    <Ionicons name="star" size={10} color="#F9C80E" />
                    <Text selectable className="text-[11px] font-bold text-white/55">
                      {movie.rating.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text
              selectable
              numberOfLines={2}
              ellipsizeMode="tail"
              className="mt-2 text-[12px] font-medium leading-[16px] text-white/40"
            >
              {movie.overview || 'No overview is available for this movie yet.'}
            </Text>
          </View>
        </AnimatedPressable>
      </GestureDetector>
    </View>
  );
}
