import React, { useEffect, useState } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.32;

export default function MovieSkeleton() {
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={{ width: CARD_WIDTH }} className="mr-3 mb-2">
      {/* Poster Placeholder */}
      <Animated.View 
        style={{ opacity }}
        className="aspect-[2/3] w-full rounded-xl bg-slate-800/70 border border-slate-800/30"
      />
      
      {/* Title Placeholder */}
      <Animated.View 
        style={{ opacity }}
        className="h-3.5 w-[85%] rounded bg-slate-800/70 mt-2.5"
      />
      
      {/* Date Placeholder */}
      <Animated.View 
        style={{ opacity }}
        className="h-2.5 w-[50%] rounded bg-slate-800/70 mt-1.5"
      />
      
      {/* Stars Placeholder */}
      <Animated.View 
        style={{ opacity }}
        className="h-3 w-[65%] rounded bg-slate-800/70 mt-1.5"
      />
    </View>
  );
}
