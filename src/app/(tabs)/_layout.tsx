import React, { useState } from 'react';
import { View, Pressable, type PressableProps } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import MorePopover from '@/components/MorePopover';
import AnimatedTabItem from '@/components/AnimatedTabItem';
import { TAB_BAR_BASE_HEIGHT, TAB_BAR_FLOATING_OFFSET } from '@/constants/layout';
import { useI18n } from '@/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabBarButton(props: PressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[props.style, animatedStyle]}
      onPressIn={(e) => {
        scale.set(withSpring(0.85, { damping: 14, stiffness: 300 }));
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 12, stiffness: 200 }));
        props.onPressOut?.(e);
      }}
    />
  );
}

export default function TabLayout() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

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
          sceneStyle: { backgroundColor: '#002B3A' },
          tabBarShowLabel: false,
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarStyle: {
            backgroundColor: '#0D162D',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 1,
            height: TAB_BAR_BASE_HEIGHT + insets.bottom,
            paddingBottom: 10 + insets.bottom,
            paddingTop: 9,
            marginHorizontal: 10,
            marginBottom: TAB_BAR_FLOATING_OFFSET,
            borderRadius: 22,
            position: 'absolute',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.browse'),
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="search"
                iconOutlineName="search-outline"
                title={t('tabs.browse')}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: t('tabs.discover'),
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="sparkles"
                iconOutlineName="sparkles-outline"
                title={t('tabs.discover')}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: t('tabs.library'),
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="list"
                iconOutlineName="list-outline"
                title={t('tabs.library')}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ focused }) => (
              <AnimatedTabItem
                focused={focused}
                iconName="person"
                iconOutlineName="person-outline"
                title={t('tabs.profile')}
              />
            ),
          }}
        />
      </Tabs>

      <MorePopover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        bottomOffset={TAB_BAR_BASE_HEIGHT + insets.bottom + TAB_BAR_FLOATING_OFFSET}
      />
    </View>
  );
}
