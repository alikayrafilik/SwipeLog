import React, { useEffect } from 'react';
import { View, Text, Image, ImageSourcePropType, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

export interface MovieCardProps {
  badgeLabel?: string;
  image: string | ImageSourcePropType;
  title: string;
  date?: string;
  rating?: number; // 0 to 5 scale
  onPress?: () => void;
  index?: number;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.32; // standard responsive width for 3 cards on screen
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MovieCard({ badgeLabel, image, title, date, rating, onPress, index = 0 }: MovieCardProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.35);
  const elevation = useSharedValue(8);

  useEffect(() => {
    const delay = index * 40; // Staggered entry
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 200 }));
  }, [index, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation.value },
      shadowOpacity: shadowOpacity.value,
      shadowRadius: elevation.value * 1.5,
      elevation: elevation.value,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    shadowOpacity.value = withTiming(0.15, { duration: 150 });
    elevation.value = withTiming(2, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    shadowOpacity.value = withTiming(0.35, { duration: 150 });
    elevation.value = withTiming(8, { duration: 150 });
  };

  // Helper to render rating stars
  const renderStars = (score: number) => {
    const stars = [];
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Ionicons key={i} name="star" size={11} color="#F9C80E" />);
      } else if (i === fullStars + 1 && hasHalf) {
        stars.push(<Ionicons key={i} name="star-half" size={11} color="#F9C80E" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={11} color="#F9C80E" />);
      }
    }
    return stars;
  };

  const hasImage = typeof image === 'string' ? !!image.trim() : !!image;

  return (
    <AnimatedPressable
      style={[{ width: CARD_WIDTH }, animatedStyle]}
      className="mr-3 mb-2"
      onPress={onPress}
      onPressIn={onPress ? handlePressIn : undefined}
      onPressOut={onPress ? handlePressOut : undefined}
      disabled={!onPress}
    >
      {/* Movie Poster Wrapper */}
      <View className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-brand-navyLight border border-slate-800/80 items-center justify-center">
        {hasImage ? (
          <Image
            source={typeof image === 'string' ? { uri: image } : image}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center justify-center p-3 w-full h-full bg-brand-navyLight">
            <Ionicons name="film-outline" size={28} color="#A0AEC0" />
            <Text 
              className="text-brand-grayText text-[10px] font-semibold text-center mt-2" 
              numberOfLines={3}
            >
              {title}
            </Text>
          </View>
        )}
        {badgeLabel ? (
          <View className="absolute left-2 top-2 rounded-full bg-brand-yellow px-2 py-1">
            <Text className="text-[8px] font-black uppercase text-brand-navy">
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Movie Meta Information */}
      <View className="mt-2 px-1">
        <Text 
          numberOfLines={1} 
          className="text-white text-sm font-semibold tracking-wide"
        >
          {title}
        </Text>
        
        {date && (
          <Text className="text-brand-grayText text-[11px] mt-0.5 font-medium">
            {date}
          </Text>
        )}

        {rating !== undefined && (
          <View className="flex-row items-center mt-1 space-x-0.5">
            {renderStars(rating)}
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}
