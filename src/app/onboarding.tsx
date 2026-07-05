import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthState } from '@/context/AuthContext';
import { defaultUserProfile, useUserProfile } from '@/hooks/use-user-profile';
import { normalizeUsername, socialService } from '@/services/social';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const getUsernameError = (username: string) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return 'Choose a username to create your profile.';
  if (normalized.length < 3) return 'Username must be at least 3 characters.';
  if (normalized.length > 20) return 'Username must be 20 characters or less.';
  if (!USERNAME_PATTERN.test(normalized)) return 'Use lowercase letters, numbers, and underscores only.';
  return null;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthState();
  const { profile, saveProfile } = useUserProfile();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameError = getUsernameError(username);

  const handleSave = async () => {
    const nextUsernameError = getUsernameError(username);
    if (nextUsernameError) {
      setError(nextUsernameError);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const existingProfile = await socialService.getPublicProfileByUsername(normalizedUsername);
      if (existingProfile && existingProfile.userId !== session?.user.id) {
        setError('This username is already taken.');
        return;
      }

      await saveProfile({
        ...defaultUserProfile,
        ...profile,
        name: name.trim() || normalizedUsername,
        username: normalizedUsername,
        bio: bio.trim(),
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      router.replace('/(tabs)');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Profile could not be saved.');
    } finally {
      setIsSaving(false);
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
          contentContainerStyle={{
            flexGrow: 1,
            gap: 22,
            padding: 20,
            paddingBottom: Math.max(36, insets.bottom + 28),
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mt-2 gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow">
              <Ionicons name="person-add" size={26} color="#073445" />
            </View>

            <View className="gap-3">
              <Text className="text-[34px] font-black leading-10 text-white">
                Create your profile
              </Text>
              <Text className="text-[14px] font-semibold leading-6 text-brand-grayText">
                Pick a username before you start. This is how friends will find you and how shared lists show your name.
              </Text>
            </View>
          </View>

          <View className="overflow-hidden rounded-3xl border border-white/10 bg-[#073746] p-4">
            <View className="items-center gap-3 py-3">
              <View className="h-24 w-24 items-center justify-center rounded-full border-4 border-[#002B3A] bg-brand-yellow/15">
                <Ionicons name="person" size={40} color="#F9C80E" />
              </View>
              <View className="items-center gap-1">
                <Text className="text-[18px] font-black text-white">
                  {name.trim() || normalizedUsername || 'Movie friend'}
                </Text>
                <Text className="text-[12px] font-bold text-brand-yellow">
                  @{normalizedUsername || 'username'}
                </Text>
              </View>
            </View>

            <View className="mt-3 gap-4">
              <View className="gap-2">
                <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                  Display name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="#728391"
                  className="h-12 rounded-xl border border-white/10 bg-[#002B3A] px-3 text-[14px] font-bold text-white"
                  returnKeyType="next"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                  Username
                </Text>
                <View
                  className={`h-12 flex-row items-center rounded-xl border bg-[#002B3A] px-3 ${
                    error || usernameError ? 'border-red-300/60' : 'border-white/10'
                  }`}
                >
                  <Text className="text-[14px] font-black text-brand-yellow">@</Text>
                  <TextInput
                    value={username}
                    onChangeText={(value) => {
                      setUsername(normalizeUsername(value));
                      setError(null);
                    }}
                    placeholder="username"
                    placeholderTextColor="#728391"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="min-w-0 flex-1 px-1 text-[14px] font-bold text-white"
                    returnKeyType="next"
                  />
                </View>
                <Text className={`text-[10px] font-semibold ${error || usernameError ? 'text-red-200' : 'text-brand-grayText'}`}>
                  {error ?? usernameError ?? 'Friends can search for this username later.'}
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                  Bio
                </Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell people what kind of films you love..."
                  placeholderTextColor="#728391"
                  multiline
                  maxLength={160}
                  className="min-h-[92px] rounded-xl border border-white/10 bg-[#002B3A] px-3 py-3 text-[13px] font-semibold leading-5 text-white"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-right text-[10px] font-semibold text-brand-grayText">
                  {bio.length}/160
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-auto gap-3">
            <Pressable
              accessibilityLabel="Save profile and start SwipeLog"
              className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl ${
                usernameError ? 'bg-brand-yellow/40' : 'bg-brand-yellow'
              }`}
              disabled={isSaving || Boolean(usernameError)}
              onPress={handleSave}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#073445" />
              ) : (
                <>
                  <Text className="text-sm font-black text-brand-navy">Start SwipeLog</Text>
                  <Ionicons name="arrow-forward" size={19} color="#073445" />
                </>
              )}
            </Pressable>
            <Text className="text-center text-[11px] font-semibold leading-5 text-brand-grayText">
              You can change your name, bio, profile picture, and banner from Profile anytime.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
