import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnalyticsVisibility from '@/components/AnalyticsVisibility';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
  analyticsSection?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  eyebrow,
  actionLabel,
  onAction,
  analyticsSection,
}: SectionHeaderProps) {
  const content = (
    <>
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text className="mb-1 text-[9px] font-black uppercase tracking-[2px] text-brand-yellow">
            {eyebrow}
          </Text>
        ) : null}
        <Text selectable className="text-[21px] font-black tracking-tight text-white">{title}</Text>
        {subtitle ? (
          <Text selectable numberOfLines={2} className="mt-1 text-[10px] font-semibold leading-4 text-brand-grayText">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable className="flex-row items-center gap-1 rounded-full bg-white/5 px-3 py-2" onPress={onAction}>
          <Text className="text-[9px] font-black uppercase text-brand-yellow">{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color="#F9C80E" />
        </Pressable>
      ) : null}
    </>
  );
  return analyticsSection ? (
    <AnalyticsVisibility
      className="mb-4 flex-row items-end justify-between gap-4"
      event="browse_section_viewed"
      params={{ section: analyticsSection }}
    >
      {content}
    </AnalyticsVisibility>
  ) : (
    <View className="mb-4 flex-row items-end justify-between gap-4">{content}</View>
  );
}
