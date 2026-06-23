import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserProfile } from '@/hooks/use-user-profile';

interface OnboardingStep {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Film yolculugunu tek yerde tut.',
    body: 'Izlediklerini kaydet, puanla, watchlist olustur ve yeni filmler kesfet.',
    icon: 'film-outline',
  },
  {
    title: 'Izlediklerini kaydet.',
    body: "Filmleri puanla, favorilerine ekle ve izleme gecmisini Library'de takip et.",
    icon: 'star-outline',
  },
  {
    title: 'Yeni filmler kesfet.',
    body: "Discover'da onerilere goz at, ilgini cekenleri watchlist'e ekle.",
    icon: 'sparkles-outline',
  },
  {
    title: 'Listelerini yaninda tasi.',
    body: "Watchlist'in, kayitlarin ve tier list'lerin hesabinla buluta kaydedilir.",
    icon: 'cloud-done-outline',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, saveProfile } = useUserProfile();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const activeStep = ONBOARDING_STEPS[activeIndex];
  const isLastStep = activeIndex === ONBOARDING_STEPS.length - 1;
  const progressLabel = useMemo(
    () => `${activeIndex + 1}/${ONBOARDING_STEPS.length}`,
    [activeIndex]
  );

  const handleContinue = async () => {
    if (!isLastStep) {
      setActiveIndex((current) => current + 1);
      return;
    }

    try {
      setIsSaving(true);
      await saveProfile({
        ...profile,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      router.replace('/(tabs)');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between',
          padding: 24,
          gap: 28,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-7">
          <View className="flex-row items-center justify-between">
            <View className="flex-row gap-2">
              {ONBOARDING_STEPS.map((step, index) => (
                <View
                  key={step.title}
                  className={`h-2 rounded-full ${
                    index <= activeIndex ? 'w-8 bg-brand-yellow' : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </View>

            <Text className="text-xs font-black text-brand-yellow">{progressLabel}</Text>
          </View>

          <View className="min-h-[360px] justify-center gap-8">
            <View className="items-center gap-6">
              <View className="h-32 w-32 items-center justify-center rounded-[32px] border border-brand-yellow/30 bg-brand-yellow/10">
                <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-brand-yellow">
                  <Ionicons name={activeStep.icon} size={48} color="#073445" />
                </View>
              </View>

              <View className="gap-4">
                <Text className="text-center text-3xl font-black leading-10 text-white">
                  {activeStep.title}
                </Text>
                <Text className="text-center text-base font-semibold leading-7 text-brand-grayText">
                  {activeStep.body}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="gap-4">
          <Pressable
            accessibilityLabel={isLastStep ? 'Start SwipeLog' : 'Continue'}
            className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-yellow"
            disabled={isSaving}
            onPress={handleContinue}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#073445" />
            ) : (
              <Text className="text-sm font-black text-brand-navy">
                {isLastStep ? 'Start SwipeLog' : 'Continue'}
              </Text>
            )}
            {!isSaving ? (
              <Ionicons
                name={isLastStep ? 'checkmark' : 'arrow-forward'}
                size={20}
                color="#073445"
              />
            ) : null}
          </Pressable>

          <Text className="text-center text-xs font-semibold leading-5 text-brand-grayText">
            Kisa kurulumdan sonra tum ozelliklere Profile ve Library uzerinden ulasabilirsin.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
