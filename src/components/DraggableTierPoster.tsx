import React from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { LoggedMovie } from '@/context/MovieContext';

interface DraggableTierPosterProps {
  movie: LoggedMovie;
  onDrop: (movieId: string, absoluteY: number) => void;
  onDragStart: () => void;
  onPress: () => void;
}

export default function DraggableTierPoster({
  movie,
  onDrop,
  onDragStart,
  onPress,
}: DraggableTierPosterProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const dragging = useSharedValue(false);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(260)
    .onStart(() => {
      dragging.value = true;
      scale.value = withSpring(1.12);
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(onDrop)(movie.id, event.absoluteY);
    })
    .onFinalize(() => {
      dragging.value = false;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    });
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onPress)();
  });

  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: dragging.value ? 100 : 1,
    opacity: dragging.value ? 0.92 : 1,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(gesture, tapGesture)}>
      <Animated.View style={animatedStyle} className="w-[62px]">
        <Animated.View
          className="overflow-hidden rounded-lg border border-white/10 bg-slate-800"
          style={{ aspectRatio: 2 / 3 }}
        >
          {movie.image ? (
            <Image source={{ uri: movie.image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="film-outline" size={20} color="#A0AEC0" />
            </View>
          )}
        </Animated.View>
        <Text numberOfLines={1} className="mt-1 text-[7px] font-bold text-white/70">
          {movie.title}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}
