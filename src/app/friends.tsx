import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthState } from '@/context/AuthContext';
import { useSharedWatchlists } from '@/context/SharedWatchlistContext';
import { FriendRequest, FriendSummary, socialService } from '@/services/social';
import ProfileAvatar from '@/components/ProfileAvatar';

export default function FriendsScreen() {
  const { session } = useAuthState();
  const { createListWithFriend } = useSharedWatchlists();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingListFor, setCreatingListFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const userId = session?.user.id;

  const loadFriends = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [nextFriends, requests] = await Promise.all([
        socialService.listFriends(userId),
        socialService.listFriendRequests(userId),
      ]);
      setFriends(nextFriends);
      setIncoming(requests.incoming);
      setOutgoing(requests.outgoing);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load friends.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadFriends();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadFriends]);

  const handleAccept = async (request: FriendRequest) => {
    try {
      await socialService.acceptFriendRequest(request);
      await loadFriends();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not accept friend request.');
    }
  };

  const handleDecline = async (request: FriendRequest) => {
    try {
      await socialService.declineFriendRequest(request);
      await loadFriends();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not decline friend request.');
    }
  };

  const handleCreateSharedList = async (friend: FriendSummary) => {
    if (creatingListFor) return;
    setCreatingListFor(friend.userId);
    setMessage(null);
    try {
      const list = await createListWithFriend(friend);
      router.push({ pathname: '/shared-watchlist/[id]', params: { id: list.id } } as never);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create a shared list.');
    } finally {
      setCreatingListFor(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1" contentContainerStyle={{ gap: 18, padding: 16, paddingBottom: 36 }}>
        <View className="flex-row items-center gap-3">
          <Pressable className="h-10 w-10 items-center justify-center rounded-xl bg-white/8" onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[24px] font-black text-white">Friends</Text>
            <Text className="mt-1 text-[11px] font-semibold text-brand-grayText">
              Share profiles, accept requests, and open friends quickly.
            </Text>
          </View>
          <Pressable className="h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow" onPress={() => router.push('/friends/add' as never)}>
            <Ionicons name="person-add" size={18} color="#051E2A" />
          </Pressable>
        </View>

        {message ? (
          <View className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2">
            <Text className="text-[11px] font-semibold text-red-100">{message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#F9C80E" />
          </View>
        ) : (
          <>
            {incoming.length > 0 ? (
              <View className="gap-3">
                <Text className="text-[16px] font-black text-white">Friend Requests</Text>
                {incoming.map((request) => (
                  <View key={request.id} className="rounded-2xl border border-white/10 bg-[#073746] p-3">
                    <View className="flex-row items-center gap-3">
                      <ProfileAvatar
                        uri={request.fromAvatarUrl}
                        icon={request.fromAvatarIcon}
                        color={request.fromAvatarColor}
                      />
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-[14px] font-black text-white">{request.fromDisplayName}</Text>
                        <Text className="mt-1 text-[10px] font-bold text-brand-grayText">@{request.fromUsername}</Text>
                      </View>
                    </View>
                    <View className="mt-3 flex-row gap-2">
                      <Pressable className="h-10 flex-1 items-center justify-center rounded-xl bg-brand-yellow" onPress={() => void handleAccept(request)}>
                        <Text className="text-[10px] font-black uppercase text-brand-navy">Accept</Text>
                      </Pressable>
                      <Pressable className="h-10 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5" onPress={() => void handleDecline(request)}>
                        <Text className="text-[10px] font-black uppercase text-white/70">Decline</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="gap-3">
              <Text className="text-[16px] font-black text-white">Your Friends</Text>
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <Pressable
                    key={friend.userId}
                    className="rounded-2xl border border-white/10 bg-[#073746] p-3"
                    onPress={() => router.push({ pathname: '/u/[username]', params: { username: friend.username } } as never)}
                  >
                    <View className="flex-row items-center gap-3">
                      <ProfileAvatar uri={friend.avatarUrl} icon={friend.avatarIcon} color={friend.avatarColor} />
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-[14px] font-black text-white">{friend.displayName}</Text>
                        <Text className="mt-1 text-[10px] font-bold text-brand-grayText">@{friend.username}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={17} color="#A0AEC0" />
                    </View>
                    <Pressable
                      className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleCreateSharedList(friend);
                      }}
                    >
                      {creatingListFor === friend.userId ? (
                        <ActivityIndicator size="small" color="#073445" />
                      ) : (
                        <Ionicons name="people" size={15} color="#073445" />
                      )}
                      <Text className="text-[10px] font-black uppercase text-brand-navy">Create Shared List</Text>
                    </Pressable>
                  </Pressable>
                ))
              ) : (
                <View className="items-center rounded-2xl border border-dashed border-white/12 bg-white/5 px-5 py-8">
                  <Ionicons name="people-outline" size={30} color="#F9C80E" />
                  <Text className="mt-3 text-center text-[14px] font-black text-white">No friends yet</Text>
                  <Text className="mt-2 text-center text-[10px] font-semibold leading-4 text-brand-grayText">
                    Share your profile link or search for a username to send a request.
                  </Text>
                  <Pressable className="mt-5 rounded-xl bg-brand-yellow px-4 py-3" onPress={() => router.push('/friends/add' as never)}>
                    <Text className="text-[10px] font-black uppercase text-brand-navy">Add Friend</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {outgoing.length > 0 ? (
              <View className="gap-3">
                <Text className="text-[16px] font-black text-white">Request Sent</Text>
                {outgoing.map((request) => (
                  <View key={request.id} className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <ProfileAvatar
                      uri={request.toAvatarUrl}
                      icon={request.toAvatarIcon}
                      color={request.toAvatarColor}
                    />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-[13px] font-black text-white">{request.toDisplayName}</Text>
                      <Text className="mt-1 text-[10px] font-bold text-brand-grayText">@{request.toUsername}</Text>
                    </View>
                    <Text className="text-[9px] font-black uppercase text-brand-yellow">Pending</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
