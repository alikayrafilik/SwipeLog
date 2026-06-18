import React, { useEffect } from 'react';
import { Modal, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FeedbackToastProps {
  message: string | null;
  onDismiss: () => void;
}

export default function FeedbackToast({ message, onDismiss }: FeedbackToastProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(onDismiss, 3200);
    return () => clearTimeout(timeout);
  }, [message, onDismiss]);

  return (
    <Modal visible={Boolean(message)} transparent animationType="fade" statusBarTranslucent>
      <View pointerEvents="none" className="flex-1 justify-end px-4" style={{ paddingBottom: Math.max(insets.bottom + 88, 104) }}>
        <View
          className="flex-row items-center gap-3 rounded-2xl border border-brand-yellow/35 bg-[#073746] px-4 py-4"
          style={{ boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)' }}
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-yellow">
            <Ionicons name="checkmark" size={21} color="#073445" />
          </View>
          <Text numberOfLines={2} className="min-w-0 flex-1 text-[14px] font-black leading-5 text-white">
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
