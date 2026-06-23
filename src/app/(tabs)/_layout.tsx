import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import MorePopover from '@/components/MorePopover';
import AnimatedTabItem from '@/components/AnimatedTabItem';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabBarButton(props: BottomTabBarButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[props.style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(0.85, { damping: 14, stiffness: 300 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        props.onPressOut?.(e);
      }}
    />
  );
}

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
            config: { duration: 220 },
          },
          tabBarShowLabel: false,
          tabBarButton: (props) => <TabBarButton {...props} />,
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
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Browse',
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="search"
                iconOutlineName="search-outline"
                title="Browse"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="sparkles"
                iconOutlineName="sparkles-outline"
                title="Discover"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="list"
                iconOutlineName="list-outline"
                title="Library"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="person"
                iconOutlineName="person-outline"
                title="Profile"
              />
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
