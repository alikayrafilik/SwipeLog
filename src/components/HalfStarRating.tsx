import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface HalfStarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  showValue?: boolean;
  activeColor?: string;
  inactiveColor?: string;
}

interface AnimatedStarProps {
  color: string;
  iconName: 'star' | 'star-half' | 'star-outline';
  size: number;
}

const MAX_RATING = 5;
const RATING_STEP = 0.5;

function AnimatedStar({ color, iconName, size }: AnimatedStarProps) {
  const scale = useSharedValue(1);
  const previousIcon = useRef(iconName);

  useEffect(() => {
    if (previousIcon.current === iconName) return;

    previousIcon.current = iconName;
    scale.value = withSequence(
      withTiming(0.88, { duration: 55 }),
      withSpring(1, { damping: 11, stiffness: 330, mass: 0.45 }),
    );
  }, [iconName, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      className="items-center justify-center"
      style={[{ height: size + 10, width: size + 6 }, animatedStyle]}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </Animated.View>
  );
}

export default function HalfStarRating({
  rating,
  onChange,
  size = 24,
  showValue = false,
  activeColor = '#F9C80E',
  inactiveColor = '#C6D1D8',
}: HalfStarRatingProps) {
  const [trackWidth, setTrackWidth] = useState((size + 6) * MAX_RATING);

  const emitRatingAtPosition = useCallback(
    (positionX: number) => {
      if (!onChange || trackWidth <= 0) return;

      const clampedX = Math.max(0, Math.min(positionX, trackWidth));
      const nextRating = Math.max(
        RATING_STEP,
        Math.min(MAX_RATING, Math.ceil((clampedX / trackWidth) * MAX_RATING * 2) / 2),
      );

      if (nextRating === rating) return;
      onChange(nextRating);
    },
    [onChange, rating, trackWidth],
  );

  const ratingPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(onChange),
        onStartShouldSetPanResponderCapture: () => Boolean(onChange),
        onMoveShouldSetPanResponder: () => Boolean(onChange),
        onPanResponderGrant: (event) => emitRatingAtPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => emitRatingAtPosition(event.nativeEvent.locationX),
        onPanResponderTerminationRequest: () => false,
      }),
    [emitRatingAtPosition, onChange],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const handleAccessibilityAction = useCallback(
    (actionName?: string) => {
      if (!onChange) return;

      if (actionName === 'increment') {
        onChange(Math.min(MAX_RATING, rating + RATING_STEP));
      } else if (actionName === 'decrement') {
        onChange(Math.max(RATING_STEP, rating - RATING_STEP));
      }
    },
    [onChange, rating],
  );

  const stars = (
    <View
      className="flex-row items-center"
      {...(onChange ? ratingPanResponder.panHandlers : {})}
      onLayout={onChange ? handleLayout : undefined}
      accessible={Boolean(onChange)}
      accessibilityRole={onChange ? 'adjustable' : undefined}
      accessibilityLabel={onChange ? 'Movie rating' : undefined}
      accessibilityValue={onChange ? { min: 0.5, max: 5, now: rating, text: `${rating} stars` } : undefined}
      accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={
        onChange ? (event) => handleAccessibilityAction(event.nativeEvent.actionName) : undefined
      }
    >
      {Array.from({ length: MAX_RATING }).map((_, index) => {
        const fullValue = index + 1;
        const halfValue = index + 0.5;
        const iconName =
          rating >= fullValue ? 'star' : rating >= halfValue ? 'star-half' : 'star-outline';
        const active = rating >= halfValue;

        return (
          <AnimatedStar
            key={fullValue}
            iconName={iconName}
            size={size}
            color={active ? activeColor : inactiveColor}
          />
        );
      })}
    </View>
  );

  return (
    <View className="flex-row items-center">
      {stars}
      {showValue ? (
        <Text selectable className="ml-2 text-[11px] font-black text-brand-yellow">
          {rating > 0 ? rating.toFixed(1) : '-'}
        </Text>
      ) : null}
    </View>
  );
}
