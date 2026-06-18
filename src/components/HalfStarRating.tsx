import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HalfStarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  showValue?: boolean;
  activeColor?: string;
  inactiveColor?: string;
}

export default function HalfStarRating({
  rating,
  onChange,
  size = 24,
  showValue = false,
  activeColor = '#F9C80E',
  inactiveColor = '#C6D1D8',
}: HalfStarRatingProps) {
  return (
    <View className="flex-row items-center">
      {Array.from({ length: 5 }).map((_, index) => {
        const fullValue = index + 1;
        const halfValue = index + 0.5;
        const iconName =
          rating >= fullValue ? 'star' : rating >= halfValue ? 'star-half' : 'star-outline';

        return (
          <View
            key={fullValue}
            className="relative items-center justify-center"
            style={{ height: size + 10, width: size + 6 }}
          >
            <Ionicons
              name={iconName}
              size={size}
              color={rating >= halfValue ? activeColor : inactiveColor}
            />
            {onChange ? (
              <>
                <Pressable
                  accessibilityLabel={`Rate ${halfValue} stars`}
                  className="absolute bottom-0 left-0 top-0"
                  style={{ width: '50%' }}
                  onPress={() => onChange(halfValue)}
                />
                <Pressable
                  accessibilityLabel={`Rate ${fullValue} stars`}
                  className="absolute bottom-0 right-0 top-0"
                  style={{ width: '50%' }}
                  onPress={() => onChange(fullValue)}
                />
              </>
            ) : null}
          </View>
        );
      })}
      {showValue ? (
        <Text selectable className="ml-2 text-[11px] font-black text-brand-yellow">
          {rating > 0 ? rating.toFixed(1) : '-'}
        </Text>
      ) : null}
    </View>
  );
}
