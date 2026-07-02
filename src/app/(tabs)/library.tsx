import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import LogsTab from '@/components/library/LogsTab';
import DiaryTab from '@/components/library/DiaryTab';
import ListsTab from '@/components/library/ListsTab';

type LibraryTab = 'Logs' | 'Diary' | 'Lists';
const LIBRARY_TABS: LibraryTab[] = ['Logs', 'Diary', 'Lists'];

const getLibraryTab = (value?: string | string[]): LibraryTab => {
  const tab = Array.isArray(value) ? value[0] : value;
  return LIBRARY_TABS.includes(tab as LibraryTab) ? (tab as LibraryTab) : 'Logs';
};

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[]; view?: string | string[] }>();
  const activeTab = getLibraryTab(params.tab);
  const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;

  const activeTabContent = useMemo(() => {
    switch (activeTab) {
      case 'Logs':
        return <LogsTab />;
      case 'Diary':
        return <DiaryTab />;
      case 'Lists':
        return <ListsTab initialView={requestedView === 'watchlist' ? 'watchlist' : undefined} />;
      default:
        return null;
    }
  }, [activeTab, requestedView]);

  return (
    <SafeAreaView className="flex-1 bg-brand-navy" edges={['top', 'left', 'right']}>
      {/* Fixed top tab bar */}
      <View className="mx-3 mt-2 h-[54px] flex-row rounded-2xl border border-white/8 bg-brand-navyLight p-1">
        {LIBRARY_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              className={`flex-1 items-center justify-center rounded-xl ${isActive ? 'bg-brand-yellow' : ''}`}
              onPress={() => router.setParams({ tab })}
            >
              <Text className={`text-[11px] font-black ${isActive ? 'text-brand-navy' : 'text-white/65'}`}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTabContent}
    </SafeAreaView>
  );
}
