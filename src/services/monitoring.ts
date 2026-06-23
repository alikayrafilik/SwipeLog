import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import type React from 'react';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production');
const SENTRY_TRACES_SAMPLE_RATE = Number.parseFloat(
  process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? (__DEV__ ? '1.0' : '0.1')
);

let isMonitoringInitialized = false;

export const initializeMonitoring = () => {
  if (isMonitoringInitialized) return;

  Sentry.init({
    dsn: SENTRY_DSN || undefined,
    enabled: Boolean(SENTRY_DSN),
    environment: SENTRY_ENVIRONMENT,
    release: `${Constants.expoConfig?.slug ?? 'swipelog'}@${Constants.expoConfig?.version ?? '0.0.0'}`,
    tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0.1,
    attachStacktrace: true,
    beforeSend: (event) => {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });

  isMonitoringInitialized = true;
};

export const setMonitoringUser = (userId: string | null) => {
  if (!isMonitoringInitialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
};

export const captureMonitoringException = (error: unknown) => {
  if (!isMonitoringInitialized) return;
  Sentry.captureException(error);
};

export const wrapWithMonitoring = (Component: React.ComponentType<Record<string, unknown>>) =>
  Sentry.wrap(Component);

initializeMonitoring();
