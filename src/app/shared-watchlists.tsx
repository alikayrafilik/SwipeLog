import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import { useSharedWatchlists } from '@/context/SharedWatchlistContext';

export default function SharedWatchlistsScreen() {
  const { createList, error, isLoaded, joinList, lists, refreshLists } = useSharedWatchlists();
  const [newListName, setNewListName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasLists = lists.length > 0;

  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [lists]
  );

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setMessage(null);
    try {
      const list = await createList(newListName || 'Movie Night');
      setNewListName('');
      router.push({ pathname: '/shared-watchlist/[id]', params: { id: list.id } } as never);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not create the list.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (isJoining || inviteCode.trim().length === 0) return;
    setIsJoining(true);
    setMessage(null);
    try {
      const list = await joinList(inviteCode);
      setInviteCode('');
      router.push({ pathname: '/shared-watchlist/[id]', params: { id: list.id } } as never);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not join that list.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        contentContainerStyle={{ gap: 18, padding: 16, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-xl bg-white/8"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text selectable className="text-[24px] font-black text-white">
              Shared Lists
            </Text>
            <Text selectable className="mt-1 text-[11px] font-semibold text-brand-grayText">
              Build simple movie lists with friends.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh shared watchlists"
            className="h-10 w-10 items-center justify-center rounded-xl bg-white/8"
            onPress={() => void refreshLists()}
          >
            <Ionicons name="refresh" size={18} color="#F9C80E" />
          </Pressable>
        </View>

        <View className="gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
          <Text selectable className="text-[14px] font-black text-white">
            Start a shared list
          </Text>
          <TextInput
            value={newListName}
            onChangeText={setNewListName}
            placeholder="Friday Movie Night"
            placeholderTextColor="#728391"
            className="h-12 rounded-xl border border-white/10 bg-[#002B3A] px-3 text-[14px] font-bold text-white"
            selectionColor="#F9C80E"
          />
          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
            onPress={handleCreate}
          >
            {isCreating ? <ActivityIndicator size="small" color="#051E2A" /> : <Ionicons name="add" size={18} color="#051E2A" />}
            <Text className="text-[12px] font-black uppercase text-brand-navy">Create list</Text>
          </Pressable>
        </View>

        <View className="gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
          <Text selectable className="text-[14px] font-black text-white">
            Join with invite code
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              value={inviteCode}
              onChangeText={(value) => setInviteCode(value.toUpperCase())}
              placeholder="ABC1234"
              placeholderTextColor="#728391"
              autoCapitalize="characters"
              className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#002B3A] px-3 text-[14px] font-black tracking-widest text-white"
              selectionColor="#F9C80E"
            />
            <Pressable
              className="h-12 w-24 items-center justify-center rounded-xl border border-brand-yellow/40 bg-brand-yellow/10"
              onPress={handleJoin}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#F9C80E" />
              ) : (
                <Text className="text-[11px] font-black uppercase text-brand-yellow">Join</Text>
              )}
            </Pressable>
          </View>
        </View>

        {message || error ? (
          <View className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2">
            <Text selectable className="text-[11px] font-semibold text-red-100">
              {message ?? error}
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          <Text selectable className="text-[15px] font-black text-white">
            Shared with you
          </Text>
          {!isLoaded ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color="#F9C80E" />
            </View>
          ) : hasLists ? (
            sortedLists.map((list) => (
              <Pressable
                key={list.id}
                className="rounded-2xl border border-white/10 bg-[#073746] p-4"
                onPress={() => router.push({ pathname: '/shared-watchlist/[id]', params: { id: list.id } } as never)}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text selectable numberOfLines={1} className="text-[17px] font-black text-white">
                      {list.name}
                    </Text>
                    <Text selectable className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-grayText">
                      {list.members.length} members - code {list.inviteCode}
                    </Text>
                  </View>
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow">
                    <Ionicons name="people" size={17} color="#051E2A" />
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState
              icon="people-outline"
              title="No shared lists yet"
            description="Create a shared movie list with friends or join one with an invite code."
              actionLabel="Create one"
              onAction={handleCreate}
            />
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
