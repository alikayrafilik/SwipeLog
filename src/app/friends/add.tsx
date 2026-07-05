import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthState } from '@/context/AuthContext';
import { useMovieState } from '@/context/MovieContext';
import { useUserProfile } from '@/hooks/use-user-profile';
import {
  buildPublicProfile,
  createProfileShareUrl,
  PublicProfile,
  socialService,
} from '@/services/social';

export default function AddFriendScreen() {
  const { session } = useAuthState();
  const { diaryEntries, movies } = useMovieState();
  const { profile } = useUserProfile();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userId = session?.user.id;
  const currentPublicProfile = userId ? buildPublicProfile(userId, profile, movies, diaryEntries) : null;
  const profileUrl = profile.username ? createProfileShareUrl(profile.username) : '';

  const handleShareProfile = async () => {
    if (!currentPublicProfile || !profile.username) {
      setMessage('Choose a username before sharing your profile.');
      return;
    }
    try {
      await socialService.publishPublicProfile(currentPublicProfile);
      await Share.share({
        title: 'Join me on SwipeLog',
        message: `Join me on SwipeLog!\n\n${profileUrl}`,
        url: profileUrl,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the share sheet.');
    }
  };

  const handleSearch = async () => {
    if (!userId || query.trim().length < 2) return;
    setIsSearching(true);
    setMessage(null);
    try {
      const nextResults = await socialService.searchPublicProfiles(query, userId);
      setResults(nextResults);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not search profiles.');
    } finally {
      setIsSearching(false);
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
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center gap-3">
          <Pressable className="h-10 w-10 items-center justify-center rounded-xl bg-white/8" onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[24px] font-black text-white">Add Friend</Text>
            <Text className="mt-1 text-[11px] font-semibold text-brand-grayText">
              Share your profile first. Search is here when you need it.
            </Text>
          </View>
        </View>

        {message ? (
          <View className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2">
            <Text className="text-[11px] font-semibold text-red-100">{message}</Text>
          </View>
        ) : null}

        <Pressable
          className="overflow-hidden rounded-3xl border border-brand-yellow/30 bg-brand-yellow p-5"
          onPress={handleShareProfile}
          accessibilityLabel="Share my profile"
        >
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy">
              <Ionicons name="share-social" size={25} color="#F9C80E" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[18px] font-black text-brand-navy">Share My Profile</Text>
              <Text numberOfLines={2} className="mt-1 text-[11px] font-bold leading-4 text-brand-navy/75">
                Send your SwipeLog profile through WhatsApp, Discord, Telegram, or DM.
              </Text>
              {profileUrl ? (
                <Text numberOfLines={1} className="mt-3 text-[10px] font-black text-brand-navy/70">
                  {profileUrl}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#073445" />
          </View>
        </Pressable>

        <View className="gap-3">
          <Pressable className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-[#073746] p-4">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/8">
              <Ionicons name="qr-code-outline" size={22} color="#F9C80E" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-black text-white">Scan QR Code</Text>
              <Text className="mt-1 text-[10px] font-semibold text-brand-grayText">Coming soon. It will use the same profile link.</Text>
            </View>
            <Text className="text-[9px] font-black uppercase text-brand-yellow">Soon</Text>
          </Pressable>

          <View className="rounded-2xl border border-white/10 bg-[#073746] p-4">
            <View className="mb-3 flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/8">
                <Ionicons name="search-outline" size={22} color="#A0AEC0" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-black text-white">Search Username</Text>
                <Text className="mt-1 text-[10px] font-semibold text-brand-grayText">Fallback for exact names or partial search.</Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="@username or display name"
                placeholderTextColor="#728391"
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-brand-navy px-3 text-[12px] font-bold text-white"
                returnKeyType="search"
              />
              <Pressable className="h-11 w-12 items-center justify-center rounded-xl bg-brand-yellow" onPress={handleSearch}>
                {isSearching ? <ActivityIndicator size="small" color="#051E2A" /> : <Ionicons name="search" size={17} color="#051E2A" />}
              </Pressable>
            </View>
          </View>
        </View>

        {results.length > 0 ? (
          <View className="gap-3">
            <Text className="text-[16px] font-black text-white">Results</Text>
            {results.map((item) => (
              <Pressable
                key={item.userId}
                className="rounded-2xl border border-white/10 bg-[#073746] p-3"
                onPress={() => router.push({ pathname: '/u/[username]', params: { username: item.username } } as never)}
              >
                <View className="flex-row items-center gap-3">
                  <Avatar uri={item.avatarUrl} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[14px] font-black text-white">{item.displayName}</Text>
                    <Text className="mt-1 text-[10px] font-bold text-brand-grayText">@{item.username}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-full bg-brand-yellow/12 px-3 py-2">
                    <Text className="text-[9px] font-black uppercase text-brand-yellow">View Profile</Text>
                    <Ionicons name="chevron-forward" size={14} color="#F9C80E" />
                  </View>
                </View>
                {item.favoriteMovies.length > 0 ? (
                  <View className="mt-3 flex-row gap-1.5">
                    {item.favoriteMovies.slice(0, 4).map((movie) => (
                      <View key={movie.id} className="h-12 w-8 overflow-hidden rounded-md bg-slate-800">
                        {movie.image ? <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" /> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Avatar({ uri }: { uri: string }) {
  return (
    <View className="h-12 w-12 overflow-hidden rounded-2xl bg-brand-yellow/15">
      {uri ? (
        <Image source={{ uri }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <Ionicons name="person" size={20} color="#F9C80E" />
        </View>
      )}
    </View>
  );
}
