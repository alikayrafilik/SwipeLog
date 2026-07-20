import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

interface FeedbackToastProps {
  duration?: number;
  message: string | null;
  onDismiss: () => void;
  title?: string;
  tone?: FeedbackTone;
}

const toneStyles: Record<FeedbackTone, { accent: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { accent: '#34D399', border: 'rgba(52, 211, 153, 0.38)', icon: 'checkmark' },
  error: { accent: '#FCA5A5', border: 'rgba(248, 113, 113, 0.4)', icon: 'alert-circle-outline' },
  warning: { accent: '#F9C80E', border: 'rgba(249, 200, 14, 0.38)', icon: 'warning-outline' },
  info: { accent: '#7DD3FC', border: 'rgba(125, 211, 252, 0.38)', icon: 'information-circle-outline' },
};

export default function FeedbackToast({
  duration = 3600,
  message,
  onDismiss,
  title,
  tone = 'success',
}: FeedbackToastProps) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(onDismiss, duration);
    return () => clearTimeout(timeout);
  }, [duration, message, onDismiss]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!message) return null;
  const appearance = toneStyles[tone];

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : Math.max(insets.bottom + 18, 30) }}
    >
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center gap-3 rounded-2xl bg-[#073746] px-4 py-3"
        style={{ borderColor: appearance.border, borderWidth: 1, boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)' }}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: appearance.accent }}>
          <Ionicons name={appearance.icon} size={21} color="#073445" />
        </View>
        <View className="min-w-0 flex-1">
          {title ? <Text selectable className="text-[13px] font-black text-white">{title}</Text> : null}
          <Text selectable numberOfLines={3} className="text-[12px] font-semibold leading-5 text-white/80">
            {message}
          </Text>
        </View>
        <Pressable accessibilityLabel="Dismiss message" hitSlop={10} onPress={onDismiss}>
          <Ionicons name="close" size={19} color="#C6D1D8" />
        </Pressable>
      </View>
    </View>
  );
}
