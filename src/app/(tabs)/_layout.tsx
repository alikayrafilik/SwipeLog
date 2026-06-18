import React, { useState } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MorePopover from '@/components/MorePopover';

export default function TabLayout() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-brand-navy">
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          transitionSpec: {
            animation: 'timing',
            config: { duration: 190 },
          },
          tabBarActiveTintColor: '#F9C80E',
          tabBarInactiveTintColor: '#A0AEC0',
          tabBarStyle: {
            backgroundColor: '#0D162D',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 1,
            height: 68 + insets.bottom,
            paddingBottom: 10 + insets.bottom,
            paddingTop: 9,
            marginHorizontal: 10,
            marginBottom: 8,
            borderRadius: 22,
            position: 'absolute',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          },
          tabBarItemStyle: { borderRadius: 16 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '800' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Browse',
            tabBarIcon: ({ color, focused }) => (
              <View className={`h-8 w-12 items-center justify-center rounded-xl ${focused ? 'bg-brand-yellow/15' : ''}`}>
                <Ionicons name={focused ? 'search' : 'search-outline'} size={21} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, focused }) => (
              <View className={`h-8 w-12 items-center justify-center rounded-xl ${focused ? 'bg-brand-yellow/15' : ''}`}>
                <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={21} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, focused }) => (
              <View className={`h-8 w-12 items-center justify-center rounded-xl ${focused ? 'bg-brand-yellow/15' : ''}`}>
                <Ionicons name={focused ? 'list' : 'list-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <View className={`h-8 w-12 items-center justify-center rounded-xl ${focused ? 'bg-brand-yellow/15' : ''}`}>
                <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>

      <MorePopover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        bottomOffset={60 + insets.bottom + 10}
      />
    </View>
  );
}
