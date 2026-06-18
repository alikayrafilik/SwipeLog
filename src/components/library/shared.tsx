import React from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HalfStarRating from '@/components/HalfStarRating';

export const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const paddingHorizontal = 16;
export const gridGap = 12;
export const listContentStyle = { paddingHorizontal, paddingTop: 16, paddingBottom: 100, flexGrow: 1 };
export const virtualizedListProps = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 12,
  windowSize: 7,
  updateCellsBatchingPeriod: 40,
  removeClippedSubviews: true,
};
// 4 columns responsive layout
export const COLUMN_WIDTH = (SCREEN_WIDTH - (paddingHorizontal * 2) - (gridGap * 3)) / 4;
export const POSTER_HEIGHT = COLUMN_WIDTH * 1.5;

export const getYear = (date?: string) => date?.match(/\d{4}/)?.[0] ?? date ?? '';

export const StarRating = ({ rating, size = 9 }: { rating: number; size?: number }) => {
  return <HalfStarRating rating={rating} size={size} />;
};

export function FilterSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View className="mb-5 gap-2">
      <Text selectable className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

export function FilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
        selected ? 'border-brand-yellow bg-brand-yellow' : 'border-white/10 bg-white/5'
      }`}
      onPress={onPress}
    >
      {selected ? <Ionicons name="checkmark" size={12} color="#073445" /> : null}
      <Text selectable className={`text-[9px] font-black ${selected ? 'text-brand-navy' : 'text-white/65'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
