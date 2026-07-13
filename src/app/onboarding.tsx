import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { trackEvent } from '@/services/analytics';
import { normalizeUsername, socialService } from '@/services/social';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const MIN_GENRE_SELECTION = 3;
const MAX_GENRE_SELECTION = 5;

const INTRO_STEPS = [
  {
    title: 'SwipeLog’a hoş geldin',
    body: 'İzlediğin filmleri kaydet, izlemek istediklerini listele ve film zevkini tek yerde büyüt.',
    icon: 'film-outline',
  },
  {
    title: 'Zevkine göre keşfet',
    body: 'Browse ve Discover ekranları seçimlerinden öğrenir; sana daha yakın filmler öne çıkar.',
    icon: 'sparkles-outline',
  },
  {
    title: 'Profilin film kimliğin',
    body: 'Arkadaşların seni kullanıcı adınla bulur, listelerini ve favorilerini profilinden görür.',
    icon: 'people-outline',
  },
] as const;

const GENRE_OPTIONS = [
  { id: 28, name: 'Action', icon: 'flash-outline' },
  { id: 12, name: 'Adventure', icon: 'compass-outline' },
  { id: 16, name: 'Animation', icon: 'color-palette-outline' },
  { id: 35, name: 'Comedy', icon: 'happy-outline' },
  { id: 80, name: 'Crime', icon: 'finger-print-outline' },
  { id: 99, name: 'Documentary', icon: 'reader-outline' },
  { id: 18, name: 'Drama', icon: 'heart-outline' },
  { id: 14, name: 'Fantasy', icon: 'sparkles-outline' },
  { id: 27, name: 'Horror', icon: 'skull-outline' },
  { id: 10749, name: 'Romance', icon: 'rose-outline' },
  { id: 878, name: 'Sci-Fi', icon: 'planet-outline' },
  { id: 53, name: 'Thriller', icon: 'pulse-outline' },
] as const;

const AVATAR_ICONS = [
  'film-outline',
  'ticket-outline',
  'star-outline',
  'videocam-outline',
  'planet-outline',
  'heart-outline',
  'flash-outline',
  'skull-outline',
  'sparkles-outline',
] as const;

const AVATAR_COLORS = ['#F9C80E', '#38BDF8', '#FB7185', '#A78BFA', '#34D399', '#F97316'];

type OnboardingStep = 'intro' | 'genres' | 'avatar' | 'profile';

const getUsernameError = (username: string) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return 'Profilini oluşturmak için bir kullanıcı adı seç.';
  if (normalized.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı.';
  if (normalized.length > 20) return 'Kullanıcı adı en fazla 20 karakter olabilir.';
  if (!USERNAME_PATTERN.test(normalized)) return 'Sadece küçük harf, sayı ve alt çizgi kullan.';
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
  const [favoriteGenreIds, setFavoriteGenreIds] = useState<number[]>(
    profile.favoriteGenreIds.slice(0, MAX_GENRE_SELECTION)
  );
  const [avatarIcon, setAvatarIcon] = useState(profile.avatarIcon);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);
  const [introIndex, setIntroIndex] = useState(0);
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const onboardingStartedAtRef = React.useRef(0);
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameError = getUsernameError(username);
  const stepIndex = step === 'intro' ? introIndex : step === 'genres' ? 3 : step === 'avatar' ? 4 : 5;
  const totalSteps = INTRO_STEPS.length + 3;
  const selectedGenresLabel = `${favoriteGenreIds.length}/${MAX_GENRE_SELECTION}`;

  React.useEffect(() => {
    onboardingStartedAtRef.current = Date.now();
    void trackEvent('onboarding_started');
  }, []);

  React.useEffect(() => {
    void trackEvent('onboarding_step_viewed', {
      step,
      intro_index: step === 'intro' ? introIndex : undefined,
    });
  }, [introIndex, step]);

  const toggleGenre = (genreId: number) => {
    setError(null);
    setFavoriteGenreIds((current) => {
      if (current.includes(genreId)) return current.filter((id) => id !== genreId);
      if (current.length >= MAX_GENRE_SELECTION) return current;
      return [...current, genreId];
    });
  };

  const goNext = () => {
    setError(null);
    if (step === 'intro') {
      if (introIndex < INTRO_STEPS.length - 1) {
        setIntroIndex((current) => current + 1);
        return;
      }
      setStep('genres');
      return;
    }
    if (step === 'genres') {
      if (favoriteGenreIds.length < MIN_GENRE_SELECTION) {
        setError(`SwipeLog önerileri kişiselleştirsin diye en az ${MIN_GENRE_SELECTION} tür seç.`);
        return;
      }
      void trackEvent('onboarding_genres_selected', {
        genre_count: favoriteGenreIds.length,
      });
      setStep('avatar');
      return;
    }
    if (step === 'avatar') {
      setStep('profile');
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 'profile') {
      setStep('avatar');
      return;
    }
    if (step === 'avatar') {
      setStep('genres');
      return;
    }
    if (step === 'genres') {
      setStep('intro');
      setIntroIndex(INTRO_STEPS.length - 1);
      return;
    }
    setIntroIndex((current) => Math.max(current - 1, 0));
  };

  const handleSave = async () => {
    const nextUsernameError = getUsernameError(username);
    if (nextUsernameError) {
      setError(nextUsernameError);
      return;
    }

    if (favoriteGenreIds.length < MIN_GENRE_SELECTION) {
      setStep('genres');
      setError(`SwipeLog önerileri kişiselleştirsin diye en az ${MIN_GENRE_SELECTION} tür seç.`);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const existingProfile = await socialService.getPublicProfileByUsername(normalizedUsername);
      if (existingProfile && existingProfile.userId !== session?.user.id) {
        setError('Bu kullanıcı adı alınmış.');
        return;
      }

      await saveProfile({
        ...defaultUserProfile,
        ...profile,
        name: name.trim() || normalizedUsername,
        username: normalizedUsername,
        bio: bio.trim(),
        avatarIcon,
        avatarColor,
        favoriteGenreIds,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      void trackEvent('onboarding_completed', {
        genre_count: favoriteGenreIds.length,
        avatar_type: 'icon',
        duration_bucket: (() => {
          const seconds = onboardingStartedAtRef.current > 0
            ? Math.floor((Date.now() - onboardingStartedAtRef.current) / 1000)
            : 0;
          if (seconds < 60) return 'under_1m';
          if (seconds < 180) return '1_3m';
          if (seconds < 300) return '3_5m';
          return '5m_plus';
        })(),
      });
      router.replace('/(tabs)');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Profil kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderProgress = () => (
    <View className="mt-2 flex-row items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          className={`h-2 flex-1 rounded-full ${index <= stepIndex ? 'bg-brand-yellow' : 'bg-white/12'}`}
        />
      ))}
    </View>
  );

  const renderIntro = () => {
    const activeStep = INTRO_STEPS[introIndex];

    return (
      <View className="flex-1 gap-7">
        <View className="mt-4 gap-5">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-brand-yellow">
            <Ionicons name={activeStep.icon} size={31} color="#073445" />
          </View>
          <View className="gap-3">
            <Text className="text-[38px] font-black leading-[44px] text-white">{activeStep.title}</Text>
            <Text className="text-[16px] font-semibold leading-7 text-brand-grayText">
              {activeStep.body}
            </Text>
          </View>
        </View>

        <View className="overflow-hidden rounded-[28px] border border-white/10 bg-white/8">
          <LinearGradient colors={['rgba(249,200,14,0.22)', 'rgba(13,22,45,0.84)']} className="p-5">
            <View className="gap-4">
              {[
                ['Browse önerileri', 'search-outline'],
                ['Discover swipe akışı', 'albums-outline'],
                ['Library ve watchlist', 'bookmark-outline'],
              ].map(([label, icon]) => (
                <View key={label} className="flex-row items-center gap-3 rounded-2xl bg-black/18 p-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={19} color="#F9C80E" />
                  </View>
                  <Text className="text-sm font-black text-white">{label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const renderGenres = () => (
    <View className="flex-1 gap-5">
      <View className="gap-3">
        <Text className="text-[34px] font-black leading-10 text-white">Sevdiğin türleri seç</Text>
        <Text className="text-[14px] font-semibold leading-6 text-brand-grayText">
          {MIN_GENRE_SELECTION}–{MAX_GENRE_SELECTION} tür seç. Browse ve Discover ilk önerilerini bu zevk profiline göre hazırlar.
        </Text>
      </View>

      <View className="flex-row items-center justify-between rounded-2xl border border-brand-yellow/25 bg-brand-yellow/10 px-4 py-3">
          <Text className="text-xs font-black uppercase text-brand-yellow">Zevk profili</Text>
        <Text className="text-xs font-black text-white">{selectedGenresLabel}</Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {GENRE_OPTIONS.map((genre) => {
          const selected = favoriteGenreIds.includes(genre.id);
          const disabled = !selected && favoriteGenreIds.length >= MAX_GENRE_SELECTION;
          return (
            <Pressable
              key={genre.id}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              className={`min-h-12 flex-row items-center gap-2 rounded-2xl border px-3 py-2 ${
                selected ? 'border-brand-yellow bg-brand-yellow' : 'border-white/10 bg-[#073746]'
              } ${disabled ? 'opacity-40' : ''}`}
              onPress={() => toggleGenre(genre.id)}
            >
              <Ionicons
                name={genre.icon as keyof typeof Ionicons.glyphMap}
                size={17}
                color={selected ? '#073445' : '#F9C80E'}
              />
              <Text className={`text-xs font-black ${selected ? 'text-brand-navy' : 'text-white'}`}>
                {genre.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderAvatar = () => (
    <View className="flex-1 gap-5">
      <View className="gap-3">
        <Text className="text-[34px] font-black leading-10 text-white">Profil ikonunu seç</Text>
        <Text className="text-[14px] font-semibold leading-6 text-brand-grayText">
          Fotoğraf ve banner yerine hızlı, temiz bir ikon avatar kullanıyoruz. İstersen profilinden sonra değiştirebilirsin.
        </Text>
      </View>

      <View className="items-center rounded-3xl border border-white/10 bg-[#073746] p-5">
        <View className="h-28 w-28 items-center justify-center rounded-full border-4 border-[#002B3A]" style={{ backgroundColor: avatarColor }}>
          <Ionicons name={avatarIcon as keyof typeof Ionicons.glyphMap} size={48} color="#073445" />
        </View>
        <Text className="mt-3 text-[16px] font-black text-white">
          {name.trim() || normalizedUsername || 'Film dostu'}
        </Text>
        <Text className="text-[12px] font-bold text-brand-yellow">@{normalizedUsername || 'kullaniciadi'}</Text>
      </View>

      <View className="gap-3">
        <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">İkon</Text>
        <View className="flex-row flex-wrap gap-3">
          {AVATAR_ICONS.map((icon) => {
            const selected = avatarIcon === icon;
            return (
              <Pressable
                key={icon}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`h-14 w-14 items-center justify-center rounded-2xl border ${
                  selected ? 'border-brand-yellow bg-brand-yellow' : 'border-white/10 bg-[#073746]'
                }`}
                onPress={() => setAvatarIcon(icon)}
              >
                <Ionicons name={icon} size={24} color={selected ? '#073445' : '#F9C80E'} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">Renk</Text>
        <View className="flex-row flex-wrap gap-3">
          {AVATAR_COLORS.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityState={{ selected: avatarColor === color }}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
              onPress={() => setAvatarColor(color)}
            >
              {avatarColor === color ? <Ionicons name="checkmark" size={20} color="#073445" /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const renderProfile = () => (
    <View className="flex-1 gap-5">
      <View className="gap-3">
        <Text className="text-[34px] font-black leading-10 text-white">Profilini oluştur</Text>
        <Text className="text-[14px] font-semibold leading-6 text-brand-grayText">
          Kullanıcı adın arkadaşların seni bulsun diye gerekli. Bio’yu kısa tutabilirsin.
        </Text>
      </View>

      <View className="overflow-hidden rounded-3xl border border-white/10 bg-[#073746] p-4">
        <View className="items-center gap-3 py-3">
          <View className="h-24 w-24 items-center justify-center rounded-full border-4 border-[#002B3A]" style={{ backgroundColor: avatarColor }}>
            <Ionicons name={avatarIcon as keyof typeof Ionicons.glyphMap} size={40} color="#073445" />
          </View>
          <View className="items-center gap-1">
            <Text className="text-[18px] font-black text-white">
              {name.trim() || normalizedUsername || 'Film dostu'}
            </Text>
            <Text className="text-[12px] font-bold text-brand-yellow">@{normalizedUsername || 'kullaniciadi'}</Text>
          </View>
        </View>

        <View className="mt-3 gap-4">
          <View className="gap-2">
            <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">Görünen ad</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Adın"
              placeholderTextColor="#728391"
              className="h-12 rounded-xl border border-white/10 bg-[#002B3A] px-3 text-[14px] font-bold text-white"
              returnKeyType="next"
            />
          </View>

          <View className="gap-2">
            <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">Kullanıcı adı</Text>
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
              placeholder="kullaniciadi"
                placeholderTextColor="#728391"
                autoCapitalize="none"
                autoCorrect={false}
                className="min-w-0 flex-1 px-1 text-[14px] font-bold text-white"
                returnKeyType="next"
              />
            </View>
            <Text className={`text-[10px] font-semibold ${error || usernameError ? 'text-red-200' : 'text-brand-grayText'}`}>
              {error ?? usernameError ?? 'Arkadaşların seni bu kullanıcı adıyla bulabilir.'}
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Ne tür filmleri sevdiğini anlat..."
              placeholderTextColor="#728391"
              multiline
              maxLength={160}
              className="min-h-[92px] rounded-xl border border-white/10 bg-[#002B3A] px-3 py-3 text-[13px] font-semibold leading-5 text-white"
              style={{ textAlignVertical: 'top' }}
            />
            <Text className="text-right text-[10px] font-semibold text-brand-grayText">{bio.length}/160</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      <LinearGradient
        pointerEvents="none"
        colors={['#062D3B', '#050814', '#031E2A']}
        locations={[0, 0.54, 1]}
        className="absolute inset-0"
      />
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
          {renderProgress()}
          {step === 'intro' ? renderIntro() : null}
          {step === 'genres' ? renderGenres() : null}
          {step === 'avatar' ? renderAvatar() : null}
          {step === 'profile' ? renderProfile() : null}

          {error && step !== 'profile' ? (
            <Text className="text-center text-[11px] font-semibold leading-5 text-red-200">{error}</Text>
          ) : null}

          <View className="mt-auto gap-3">
            <View className="flex-row gap-3">
              {stepIndex > 0 ? (
                <Pressable
                accessibilityLabel="Geri"
                  className="h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/8"
                  disabled={isSaving}
                  onPress={goBack}
                >
                  <Ionicons name="arrow-back" size={20} color="#F9C80E" />
                </Pressable>
              ) : null}

              <Pressable
                accessibilityLabel={step === 'profile' ? 'Profili kaydet ve SwipeLog’a başla' : 'Onboarding’e devam et'}
                className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${
                  step === 'profile' && usernameError ? 'bg-brand-yellow/40' : 'bg-brand-yellow'
                }`}
                disabled={isSaving || (step === 'profile' && Boolean(usernameError))}
                onPress={step === 'profile' ? handleSave : goNext}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#073445" />
                ) : (
                  <>
                    <Text className="text-sm font-black text-brand-navy">
                      {step === 'profile' ? 'SwipeLog’a başla' : 'Devam et'}
                    </Text>
                    <Ionicons name={step === 'profile' ? 'checkmark' : 'arrow-forward'} size={19} color="#073445" />
                  </>
                )}
              </Pressable>
            </View>

            {step === 'intro' ? (
              <Pressable accessibilityLabel="Tanıtımı geç" className="h-10 items-center justify-center" onPress={() => setStep('genres')}>
                <Text className="text-xs font-black text-brand-grayText">Tanıtımı geç</Text>
              </Pressable>
            ) : (
              <Text className="text-center text-[11px] font-semibold leading-5 text-brand-grayText">
                Türlerin ve ikon avatarın önerilerini kişiselleştirmek için profilinde saklanır.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
