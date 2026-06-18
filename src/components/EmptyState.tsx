import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-7 py-12">
      <View className="h-16 w-16 items-center justify-center rounded-2xl border border-brand-yellow/15 bg-brand-yellow/10">
        <Ionicons name={icon} size={29} color="#F9C80E" />
      </View>
      <Text selectable className="mt-4 text-center text-[16px] font-black text-white">
        {title}
      </Text>
      <Text selectable className="mt-2 max-w-[260px] text-center text-[11px] font-semibold leading-5 text-brand-grayText">
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          className="mt-5 flex-row items-center gap-2 rounded-xl bg-brand-yellow px-4 py-3"
          onPress={onAction}
        >
          <Text className="text-[11px] font-black text-brand-navy">{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color="#050814" />
        </Pressable>
      ) : null}
    </View>
  );
}
