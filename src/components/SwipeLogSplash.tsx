import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Polygon, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface SwipeLogSplashProps {
  onAnimationComplete?: () => void;
}

export default function SwipeLogSplash({ onAnimationComplete }: SwipeLogSplashProps) {
  const bgOpacity = useSharedValue(0);
  const bookmarkPoints = useSharedValue(0);
  const maskHeight = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const containerScale = useSharedValue(1);
  const containerOpacity = useSharedValue(1);

  const letterS = useSharedValue(0);
  const letterW = useSharedValue(0);
  const letterI = useSharedValue(0);
  const letterP = useSharedValue(0);
  const letterE = useSharedValue(0);
  const letterL = useSharedValue(0);
  const letterO = useSharedValue(0);
  const letterG = useSharedValue(0);
  const letterValues = useMemo(
    () => [letterS, letterW, letterI, letterP, letterE, letterL, letterO, letterG],
    [letterE, letterG, letterI, letterL, letterO, letterP, letterS, letterW]
  );
  const [isFinished, setIsFinished] = useState(false);
  const didCompleteRef = useRef(false);

  const triggerComplete = useCallback(() => {
    if (didCompleteRef.current) return;
    didCompleteRef.current = true;
    setIsFinished(true);
    if (onAnimationComplete) onAnimationComplete();
  }, [onAnimationComplete]);

  useEffect(() => {
    import('expo-splash-screen').then((SplashScreen) => {
      SplashScreen.hideAsync().catch(() => {});
    });

    bgOpacity.value = withDelay(100, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    bookmarkPoints.value = withDelay(150, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
    maskHeight.value = withDelay(450, withTiming(160, { duration: 450, easing: Easing.inOut(Easing.quad) }));
    
    logoScale.value = withDelay(850, withSequence(
      withTiming(0.97, { duration: 50, easing: Easing.out(Easing.sin) }),
      withTiming(1.02, { duration: 50, easing: Easing.inOut(Easing.sin) }),
      withTiming(1.00, { duration: 50, easing: Easing.out(Easing.sin) })
    ));
    
    glowOpacity.value = withDelay(1050, withSequence(
      withTiming(0.15, { duration: 400, easing: Easing.out(Easing.quad) }),
      withRepeat(withTiming(0.05, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true)
    ));
    
    letterValues.forEach((sv, i) => {
      sv.value = withDelay(1150 + i * 20, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    });
    
    containerScale.value = withDelay(1950, withTiming(0.95, { duration: 400, easing: Easing.inOut(Easing.quad) }));
    containerOpacity.value = withDelay(1950, withTiming(0, { duration: 400, easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) runOnJS(triggerComplete)();
    }));
  }, [
    bgOpacity,
    bookmarkPoints,
    containerOpacity,
    containerScale,
    glowOpacity,
    letterValues,
    logoScale,
    maskHeight,
    triggerComplete,
  ]);

  const animatedBookmarkProps = useAnimatedProps(() => {
    const p = bookmarkPoints.value;
    const tlX = interpolate(p, [0, 1], [191, 179]);
    const tlY = interpolate(p, [0, 1], [416, 396]);
    const trX = interpolate(p, [0, 1], [199, 211]);
    const trY = interpolate(p, [0, 1], [416, 396]);
    const brX = interpolate(p, [0, 1], [199, 211]);
    const brY = interpolate(p, [0, 1], [424, 444]);
    const bcX = interpolate(p, [0, 1], [195, 195]);
    const bcY = interpolate(p, [0, 1], [424, 432]);
    const blX = interpolate(p, [0, 1], [191, 179]);
    const blY = interpolate(p, [0, 1], [424, 444]);
    
    return { points: `${tlX},${tlY} ${trX},${trY} ${brX},${brY} ${bcX},${bcY} ${blX},${blY}` };
  });

  const logoBgProps = useAnimatedProps(() => ({ opacity: bgOpacity.value }));
  const glowProps = useAnimatedProps(() => ({ opacity: glowOpacity.value }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }]
  }));
  
  const logoGroupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }]
  }));

  const maskStyle = useAnimatedStyle(() => ({
    height: maskHeight.value
  }));

  if (isFinished) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: 115, top: 300, width: 160, height: 160 }, logoGroupStyle]}>
        <View style={StyleSheet.absoluteFill}>
          <Svg viewBox="115 300 160 160" width="100%" height="100%">
            <Defs>
              <RadialGradient id="glow-grad" cx="195" cy="420" r="60" gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor="#F4C51C" stopOpacity="1" />
                <Stop offset="100%" stopColor="#F4C51C" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <AnimatedRect x="115" y="300" width="160" height="160" rx="36" fill="#10182C" animatedProps={logoBgProps} />
            <AnimatedEllipse cx="195" cy="420" rx="60" ry="60" fill="url(#glow-grad)" animatedProps={glowProps} />
            <AnimatedPolygon fill="#F4C51C" animatedProps={animatedBookmarkProps} />
          </Svg>
        </View>

        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 80, overflow: 'hidden' }, maskStyle]}>
          <Svg viewBox="115 300 80 160" width="80" height="160">
            <Path d="M 231 328 L 183 328 A 24 24 0 0 0 159 352 A 24 24 0 0 0 183 376 L 207 376 A 24 24 0 0 1 231 400 L 231 444" stroke="#FFFFFF" strokeWidth="24" strokeLinecap="butt" fill="none" />
            <Path d="M 159 408 L 159 444" stroke="#FFFFFF" strokeWidth="24" strokeLinecap="butt" fill="none" />
          </Svg>
        </Animated.View>

        <Animated.View style={[{ position: 'absolute', left: 80, top: 0, width: 80, overflow: 'hidden' }, maskStyle]}>
          <Svg viewBox="195 300 80 160" width="80" height="160">
            <Path d="M 231 328 L 183 328 A 24 24 0 0 0 159 352 A 24 24 0 0 0 183 376 L 207 376 A 24 24 0 0 1 231 400 L 231 444" stroke="#FFFFFF" strokeWidth="24" strokeLinecap="butt" fill="none" />
            <Path d="M 159 408 L 159 444" stroke="#FFFFFF" strokeWidth="24" strokeLinecap="butt" fill="none" />
          </Svg>
        </Animated.View>
      </Animated.View>

      <View style={styles.wordmarkContainer}>
        <View style={styles.wordRow}>
          {['S', 'W', 'I', 'P', 'E'].map((char, index) => (
            <AnimatedLetter key={index} char={char} sv={letterValues[index]} isLog={false} />
          ))}
          {['L', 'O', 'G'].map((char, index) => (
            <AnimatedLetter key={index + 5} char={char} sv={letterValues[index + 5]} isLog={true} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const AnimatedLetter = ({ char, sv, isLog }: { char: string; sv: SharedValue<number>; isLog: boolean }) => {
  const style = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ translateY: interpolate(sv.value, [0, 1], [8, 0]) }]
  }));
  return (
    <Animated.Text style={[styles.letter, isLog && styles.letterYellow, style]}>
      {char}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#05060E',
    zIndex: 9999,
  },
  wordmarkContainer: {
    position: 'absolute',
    top: 510,
    width: '100%',
    alignItems: 'center',
  },
  wordRow: { flexDirection: 'row' },
  letter: {
    fontWeight: '700',
    fontSize: 26,
    letterSpacing: 4,
    color: '#FFFFFF',
    marginHorizontal: 1,
  },
  letterYellow: { color: '#F4C51C' }
});
