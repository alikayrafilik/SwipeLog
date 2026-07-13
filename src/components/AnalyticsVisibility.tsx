import React, { useEffect, useRef } from 'react';
import { Dimensions, type LayoutChangeEvent, View, type ViewProps } from 'react-native';
import { type AnalyticsEventMap, trackEvent } from '@/services/analytics';

type VisibilityEventName = {
  [K in keyof AnalyticsEventMap]: K extends `${string}_viewed` | 'recommendation_impression'
    ? K
    : never;
}[keyof AnalyticsEventMap];

interface AnalyticsVisibilityProps<K extends VisibilityEventName> extends ViewProps {
  event: K;
  params: AnalyticsEventMap[K];
  minVisibleRatio?: number;
  minimumViewTimeMs?: number;
}

export default function AnalyticsVisibility<K extends VisibilityEventName>({
  children,
  event,
  params,
  minVisibleRatio = 0.5,
  minimumViewTimeMs = 500,
  onLayout,
  ...viewProps
}: AnalyticsVisibilityProps<K>) {
  const viewRef = useRef<View>(null);
  const trackedRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const checkVisibility = () => {
      if (cancelled || trackedRef.current) return;
      viewRef.current?.measureInWindow((x, y, width, height) => {
        if (cancelled || trackedRef.current || width <= 0 || height <= 0) return;
        const { height: viewportHeight, width: viewportWidth } = Dimensions.get('window');
        const visibleWidth = Math.max(0, Math.min(x + width, viewportWidth) - Math.max(x, 0));
        const visibleHeight = Math.max(0, Math.min(y + height, viewportHeight) - Math.max(y, 0));
        const visibleRatio = (visibleWidth * visibleHeight) / (width * height);
        const now = Date.now();

        if (visibleRatio >= minVisibleRatio) {
          visibleSinceRef.current ??= now;
          if (now - visibleSinceRef.current >= minimumViewTimeMs) {
            trackedRef.current = true;
            void trackEvent(event, paramsRef.current);
            return;
          }
        } else {
          visibleSinceRef.current = null;
        }
        timeout = setTimeout(checkVisibility, 250);
      });
    };

    timeout = setTimeout(checkVisibility, 100);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [event, minVisibleRatio, minimumViewTimeMs]);

  const handleLayout = (layoutEvent: LayoutChangeEvent) => {
    onLayout?.(layoutEvent);
  };

  return (
    <View ref={viewRef} collapsable={false} onLayout={handleLayout} {...viewProps}>
      {children}
    </View>
  );
}
