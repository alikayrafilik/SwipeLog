import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface AnimatedTabItemProps {
  focused: boolean;
  iconName: IconName;
  iconOutlineName: IconName;
  title: string;
}

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

export default function AnimatedTabItem({
  focused,
  iconName,
  iconOutlineName,
  title,
}: AnimatedTabItemProps) {
  const progress = useSharedValue(focused ? 1 : 0);
  const scale = useSharedValue(focused ? 1 : 0.85);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 200 });
    scale.value = withSpring(focused ? 1 : 0.85, {
      damping: 14,
      stiffness: 250,
      mass: 0.8,
    });
  }, [focused, progress, scale]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['transparent', 'rgba(249, 200, 14, 0.15)'] // bg-brand-yellow/15
      ),
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1], Extrapolation.CLAMP) }],
    position: 'absolute',
  }));

  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.8], Extrapolation.CLAMP) }],
    position: 'absolute',
  }));

  const labelStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [4, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View className="items-center justify-center w-16" style={{ height: 48 }}>
      <Animated.View
        className="h-8 w-12 items-center justify-center rounded-xl"
        style={containerStyle}
      >
        <Animated.View style={iconStyle} className="items-center justify-center w-full h-full">
          <Animated.View style={inactiveIconStyle}>
            <Ionicons name={iconOutlineName} size={21} color="#A0AEC0" />
          </Animated.View>
          <Animated.View style={activeIconStyle}>
            <Ionicons name={iconName} size={21} color="#F9C80E" />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <View className="h-4 mt-0.5 overflow-hidden items-center justify-start">
        <Animated.View style={labelStyle}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#F9C80E',
            }}
          >
            {title}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
