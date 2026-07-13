import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthState } from '@/context/AuthContext';
import { useMovieState } from '@/context/MovieContext';
import EmptyState from '@/components/EmptyState';
import ProfileAvatar from '@/components/ProfileAvatar';
import {
  ActivityItem,
  buildActivityItems,
  loadActivityReadIds,
  markActivityItemsRead,
} from '@/services/activity';
import { FriendRequest, socialService } from '@/services/social';
import { AUTH_ENABLED } from '@/constants/features';
import { getTabScreenBottomInset } from '@/constants/layout';
import { useI18n } from '@/i18n';

const getYear = (date?: string) => date?.match(/\d{4}/)?.[0] ?? '';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { formatDate: formatLocalizedDate, t } = useI18n();
  const { session } = useAuthState();
  const { movies } = useMovieState();
  const userId = session?.user.id;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const isSignedOut = AUTH_ENABLED && !userId;

  const unreadCount = useMemo(() => items.filter((item) => item.isUnread).length, [items]);

  const loadActivity = useCallback(async (markRead = false) => {
    if (isSignedOut) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setMessage(null);
    try {
      const readIds = await loadActivityReadIds(userId ?? 'local-user');
      const [friends, requests] = userId
        ? await Promise.all([
            socialService.listFriends(userId),
            socialService.listFriendRequests(userId),
          ])
        : [[], { incoming: [], outgoing: [] }];
      const nextItems = buildActivityItems({
        friends,
        incomingRequests: requests.incoming,
        movies,
        readIds,
      });
      setItems(nextItems);
      if (markRead && nextItems.length > 0) {
        const nextReadIds = await markActivityItemsRead(userId ?? 'local-user', nextItems.map((item) => item.id));
        setItems(buildActivityItems({
          friends,
          incomingRequests: requests.incoming,
          movies,
          readIds: nextReadIds,
        }));
      }
    } catch (error) {
      console.error('[Activity] Failed to load inbox:', error);
      setMessage(error instanceof Error ? error.message : 'Could not load activity.');
    } finally {
      setIsLoading(false);
    }
  }, [isSignedOut, movies, userId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadActivity(true);
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadActivity]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadActivity(false);
    setIsRefreshing(false);
  };

  const handleAccept = async (request: FriendRequest) => {
    setUpdatingRequestId(request.id);
    try {
      await socialService.acceptFriendRequest(request);
      await loadActivity(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not accept friend request.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleDecline = async (request: FriendRequest) => {
    setUpdatingRequestId(request.id);
    try {
      await socialService.declineFriendRequest(request);
      await loadActivity(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not decline friend request.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const openMovie = (item: Extract<ActivityItem, { kind: 'release' }>) => {
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: item.movie.id,
        title: item.movie.title,
        year: getYear(item.movie.date),
        image: item.movie.image,
        overview: item.movie.overview ?? '',
        rating: `${item.movie.rating ?? 0}`,
      },
    } as never);
  };

  const renderItem = (item: ActivityItem) => {
    if (item.kind === 'friend-request') {
      const isUpdating = updatingRequestId === item.request.id;
      return (
        <View key={item.id} className="rounded-2xl border border-brand-yellow/25 bg-[#073746] p-3">
          <ActivityHeader icon="person-add" item={item} />
          <View className="mt-3 flex-row gap-2">
            <Pressable
              className="h-10 flex-1 items-center justify-center rounded-xl bg-brand-yellow"
              disabled={isUpdating}
              onPress={() => void handleAccept(item.request)}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#073445" />
              ) : (
                <Text className="text-[10px] font-black uppercase text-brand-navy">{t('activity.accept')}</Text>
              )}
            </Pressable>
            <Pressable
              className="h-10 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5"
              disabled={isUpdating}
              onPress={() => void handleDecline(item.request)}
            >
              <Text className="text-[10px] font-black uppercase text-white/70">{t('activity.decline')}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (item.kind === 'friendship') {
      return (
        <Pressable
          key={item.id}
          className="rounded-2xl border border-white/10 bg-[#073746] p-3"
          onPress={() => router.push({ pathname: '/u/[username]', params: { username: item.friend.username } } as never)}
        >
          <ActivityHeader icon="people" item={item} />
          <View className="mt-3 flex-row items-center gap-2">
            <ProfileAvatar
              uri={item.friend.avatarUrl}
              icon={item.friend.avatarIcon}
              color={item.friend.avatarColor}
              size={40}
              roundedClassName="rounded-xl"
            />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[13px] font-black text-white">{item.friend.displayName}</Text>
              <Text className="mt-0.5 text-[10px] font-bold text-brand-grayText">@{item.friend.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#F9C80E" />
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable key={item.id} className="rounded-2xl border border-white/10 bg-[#073746] p-3" onPress={() => openMovie(item)}>
        <ActivityHeader icon="film" item={item} />
        <View className="mt-3 flex-row gap-3">
          <View className="h-[90px] w-[60px] overflow-hidden rounded-lg bg-slate-800">
            {item.movie.image ? (
              <Image source={{ uri: item.movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name="film-outline" size={18} color="#A0AEC0" />
              </View>
            )}
          </View>
          <View className="min-w-0 flex-1 justify-center">
            <Text numberOfLines={2} className="text-[15px] font-black leading-5 text-white">{item.movie.title}</Text>
            <Text className="mt-1 text-[10px] font-semibold text-brand-grayText">
              {t('activity.releasedDate', {
                date: formatLocalizedDate(item.releaseDate, { month: 'short', day: 'numeric' }),
              })}
            </Text>
            <View className="mt-3 flex-row items-center gap-1.5">
              <Ionicons name="bookmark" size={13} color="#F9C80E" />
              <Text className="text-[10px] font-black uppercase text-brand-yellow">
                {t('browse.fromWatchlist')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: getTabScreenBottomInset(insets.bottom) }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#F9C80E']}
            progressBackgroundColor="#073445"
            tintColor="#F9C80E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <Pressable className="h-10 w-10 items-center justify-center rounded-xl bg-white/8" onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[24px] font-black text-white">{t('activity.title')}</Text>
            <Text className="mt-1 text-[11px] font-semibold text-brand-grayText">
              {unreadCount > 0 ? t('activity.unread', { count: unreadCount }) : t('activity.subtitle')}
            </Text>
          </View>
        </View>

        {message ? (
          <View className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2">
            <Text selectable className="text-[11px] font-semibold text-red-100">{message}</Text>
          </View>
        ) : null}

        {isSignedOut ? (
          <View className="py-16">
            <EmptyState
              icon="notifications-outline"
              title={t('activity.signInTitle')}
              description={t('activity.signInDescription')}
              actionLabel={t('common.signIn')}
              onAction={() => router.push('/auth' as never)}
            />
          </View>
        ) : isLoading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#F9C80E" />
          </View>
        ) : items.length > 0 ? (
          <View className="gap-3">
            {items.map(renderItem)}
          </View>
        ) : (
          <View className="py-16">
            <EmptyState
              icon="notifications-outline"
              title={t('activity.emptyTitle')}
              description={t('activity.emptyDescription')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityHeader({ icon, item }: { icon: keyof typeof Ionicons.glyphMap; item: ActivityItem }) {
  const { formatDate: formatLocalizedDate, t } = useI18n();
  const title =
    item.kind === 'friend-request'
      ? t('activity.newFriendRequest')
      : item.kind === 'friendship'
        ? t('activity.nowFriends')
        : t('activity.movieReleased', { title: item.movie.title });
  const body =
    item.kind === 'friend-request'
      ? t('activity.friendRequestBody', { name: item.request.fromDisplayName })
      : item.kind === 'friendship'
        ? t('activity.nowFriendsBody', { username: item.friend.username })
        : t('activity.movieReleasedBody', {
            date: formatLocalizedDate(item.releaseDate, { month: 'short', day: 'numeric', year: 'numeric' }),
          });
  return (
    <View className="flex-row items-start gap-3">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${item.isUnread ? 'bg-brand-yellow' : 'bg-white/8'}`}>
        <Ionicons name={icon} size={18} color={item.isUnread ? '#073445' : '#F9C80E'} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] font-black text-white">{title}</Text>
          {item.isUnread ? <View className="h-2 w-2 rounded-full bg-brand-yellow" /> : null}
        </View>
        <Text numberOfLines={2} className="mt-1 text-[10px] font-semibold leading-4 text-brand-grayText">{body}</Text>
      </View>
      <Text className="text-[9px] font-black uppercase text-brand-grayText">
        {formatLocalizedDate(item.createdAt, { month: 'short', day: 'numeric' })}
      </Text>
    </View>
  );
}
