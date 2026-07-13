import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { LoggedMovie } from '@/context/MovieContext';
import {
  buildActivityItems,
  loadActivityReadIds,
} from '@/services/activity';
import { socialService } from '@/services/social';
import { AUTH_ENABLED } from '@/constants/features';
import { useI18n } from '@/i18n';

interface ActivityButtonProps {
  movies: LoggedMovie[];
  userId?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export default function ActivityButton({ className, movies, style, userId }: ActivityButtonProps) {
  const { t } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (AUTH_ENABLED && !userId) {
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const readIds = await loadActivityReadIds(userId ?? 'local-user');
      const friends = userId ? await socialService.listFriends(userId) : [];
      const requests = userId
        ? await socialService.listFriendRequests(userId)
        : { incoming: [], outgoing: [] };
      const activityItems = buildActivityItems({
        friends,
        incomingRequests: requests.incoming,
        movies,
        readIds,
      });
      setUnreadCount(activityItems.filter((item) => item.isUnread).length);
    } catch (error) {
      console.error('[ActivityButton] Failed to load unread count:', error);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [movies, userId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refreshUnreadCount();
    }, 0);
    return () => clearTimeout(timeout);
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  return (
    <Pressable
      accessibilityLabel={unreadCount > 0 ? t('activity.unreadA11y', { count: unreadCount }) : t('activity.open')}
      className={`relative h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-brand-navy/65 ${className ?? ''}`}
      onPress={() => router.push('/activity' as never)}
      style={style}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#F9C80E" />
      ) : (
        <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={19} color="#FFFFFF" />
      )}
      {unreadCount > 0 ? (
        <View className="absolute -right-1 -top-1 min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1.5 py-0.5">
          <Text className="text-[9px] font-black text-brand-navy" style={{ fontVariant: ['tabular-nums'] }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
