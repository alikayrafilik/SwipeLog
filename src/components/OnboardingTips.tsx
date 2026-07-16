import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomSheetPadding } from '@/constants/layout';

interface OnboardingTipsProps {
  enabled: boolean;
}

interface TipStep {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  actionLabel: string;
  route: '/(tabs)' | '/(tabs)/discover' | '/(tabs)/library' | '/(tabs)/profile' | '/tier-lists';
}

const STORAGE_KEY = '@swipelog_onboarding_tips_v1';

export const resetOnboardingTips = () => AsyncStorage.removeItem(STORAGE_KEY);

const TIP_STEPS: TipStep[] = [
  {
    title: 'Find your next film',
    body: 'Browse search, trending rows, upcoming releases, and quick actions from the movie cards.',
    icon: 'search-outline',
    actionLabel: 'Open Browse',
    route: '/(tabs)',
  },
  {
    title: 'Train Discover',
    body: 'Swipe through recommendations so SwipeLog learns what you like, skip, watch, or save.',
    icon: 'sparkles-outline',
    actionLabel: 'Open Discover',
    route: '/(tabs)/discover',
  },
  {
    title: 'Keep your library tidy',
    body: 'Diary, watchlist, favorites, and custom lists all live together in Library.',
    icon: 'list-outline',
    actionLabel: 'Open Library',
    route: '/(tabs)/library',
  },
  {
    title: 'Bring your history in',
    body: 'Profile settings include Letterboxd import, data reset, cloud sync, and account controls.',
    icon: 'person-outline',
    actionLabel: 'Open Profile',
    route: '/(tabs)/profile',
  },
  {
    title: 'Rank films for sharing',
    body: 'Create tier lists from your saved films, then share a ranked image when it is ready.',
    icon: 'stats-chart-outline',
    actionLabel: 'Open Tier Lists',
    route: '/tier-lists',
  },
];

export default function OnboardingTips({ enabled }: OnboardingTipsProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTip = TIP_STEPS[activeIndex];
  const isLastStep = activeIndex === TIP_STEPS.length - 1;
  const progressLabel = useMemo(() => `${activeIndex + 1}/${TIP_STEPS.length}`, [activeIndex]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled) setIsVisible(stored !== 'done');
      })
      .catch(() => {
        if (!cancelled) setIsVisible(true);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const completeTips = async () => {
    setIsVisible(false);
    await AsyncStorage.setItem(STORAGE_KEY, 'done');
  };

  const handleNext = () => {
    if (isLastStep) {
      void completeTips();
      return;
    }
    setActiveIndex((current) => current + 1);
  };

  const handleOpen = () => {
    router.push(activeTip.route as never);
    void completeTips();
  };

  if (!enabled || !isReady || !activeTip) return null;

  return (
    <Modal animationType="fade" transparent visible={isVisible} onRequestClose={() => void completeTips()}>
      <View
        className="flex-1 justify-end bg-black/60 px-4"
        style={{ paddingBottom: getBottomSheetPadding(insets.bottom, 24) }}
      >
        <View className="overflow-hidden rounded-3xl border border-white/10 bg-brand-navyLight">
          <View className="gap-5 p-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-yellow">
                <Ionicons name={activeTip.icon} size={25} color="#073445" />
              </View>

              <View className="items-end gap-2">
                <Text className="text-[11px] font-black text-brand-yellow">{progressLabel}</Text>
                <Pressable
                  accessibilityLabel="Skip tips"
                  hitSlop={10}
                  onPress={() => void completeTips()}
                >
                  <Ionicons name="close" size={22} color="#A0AEC0" />
                </Pressable>
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-2xl font-black text-white">{activeTip.title}</Text>
              <Text className="text-sm font-semibold leading-6 text-brand-grayText">{activeTip.body}</Text>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                accessibilityLabel={activeTip.actionLabel}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10"
                onPress={handleOpen}
              >
                <Ionicons name="navigate-outline" size={18} color="#F9C80E" />
                <Text className="text-xs font-black text-brand-yellow">{activeTip.actionLabel}</Text>
              </Pressable>

              <Pressable
                accessibilityLabel={isLastStep ? 'Finish tips' : 'Next tip'}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-yellow"
                onPress={handleNext}
              >
                <Text className="text-xs font-black text-brand-navy">
                  {isLastStep ? 'Finish' : 'Next'}
                </Text>
                <Ionicons
                  name={isLastStep ? 'checkmark' : 'arrow-forward'}
                  size={18}
                  color="#073445"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
