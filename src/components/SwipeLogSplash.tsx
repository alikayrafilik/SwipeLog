import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface SwipeLogSplashProps {
  onAnimationComplete?: () => void;
}

const SPLASH_HOLD_DURATION = 1000;
const SPLASH_EXIT_DURATION = 250;

export default function SwipeLogSplash({ onAnimationComplete }: SwipeLogSplashProps) {
  const [visible, setVisible] = useState(true);
  const overlayOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.72);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(8);

  const finish = useCallback(() => {
    setVisible(false);
    onAnimationComplete?.();
  }, [onAnimationComplete]);

  useEffect(() => {
    logoOpacity.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }));
    logoScale.set(withSpring(1, { damping: 14, stiffness: 150, mass: 0.8 }));

    glowOpacity.set(
      withDelay(170, withTiming(0.24, { duration: 260, easing: Easing.out(Easing.quad) })),
    );
    glowScale.set(
      withDelay(170, withTiming(1.35, { duration: 480, easing: Easing.out(Easing.cubic) })),
    );

    wordmarkOpacity.set(withDelay(160, withTiming(1, { duration: 280 })));
    wordmarkTranslateY.set(
      withDelay(160, withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) })),
    );

    overlayOpacity.set(
      withDelay(
        SPLASH_HOLD_DURATION,
        withTiming(0, { duration: SPLASH_EXIT_DURATION, easing: Easing.inOut(Easing.quad) }, (finished) => {
          if (finished) runOnJS(finish)();
        }),
      ),
    );
  }, [finish, glowOpacity, glowScale, logoOpacity, logoScale, overlayOpacity, wordmarkOpacity, wordmarkTranslateY]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          inset: 0,
          zIndex: 10000,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#071B2B',
        },
        overlayStyle,
      ]}
    >
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View style={{ height: 132, width: 132, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                height: 116,
                width: 116,
                borderRadius: 38,
                backgroundColor: '#F9C80E',
              },
              glowStyle,
            ]}
          />
          <Animated.View style={logoStyle}>
            <Image
              source={require('../../assets/images/swipelog-logo-concept3-hero-v2.png')}
              style={{ height: 128, width: 128 }}
              contentFit="contain"
              transition={0}
            />
          </Animated.View>
        </View>

        <Animated.View style={wordmarkStyle}>
          <Text
            selectable
            style={{
              color: '#FFFFFF',
              fontSize: 25,
              fontWeight: '900',
              letterSpacing: 4.5,
            }}
          >
            SWIPELOG
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
