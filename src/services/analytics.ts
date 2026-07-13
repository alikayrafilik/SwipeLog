import { NativeModules } from 'react-native';

type AnalyticsParamValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsParamValue>;
type UserProperties = Record<string, string | null>;

const ANALYTICS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false';

let analyticsInstancePromise: Promise<any | null> | null = null;

const getAnalyticsInstance = async () => {
  if (!ANALYTICS_ENABLED) return null;
  if (!NativeModules.RNFBAppModule) return null;

  analyticsInstancePromise ??= Promise.all([
    import('@react-native-firebase/app'),
    import('@react-native-firebase/analytics'),
  ])
    .then(([appModule, analyticsModule]) => {
      const app = appModule.getApp();
      return analyticsModule.getAnalytics(app);
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn('[Analytics] Firebase Analytics is unavailable:', error);
      }
      return null;
    });

  return analyticsInstancePromise;
};

const cleanParams = (params?: AnalyticsParams) => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  ) as Record<string, string | number | boolean>;
};

export const trackEvent = async (name: string, params?: AnalyticsParams) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const { logEvent } = await import('@react-native-firebase/analytics');
    await logEvent(analytics, name, cleanParams(params));
  } catch (error) {
    if (__DEV__) console.warn(`[Analytics] Failed to track ${name}:`, error);
  }
};

export const trackScreenView = async (screenName: string, screenClass = screenName) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const { logEvent } = await import('@react-native-firebase/analytics');
    await logEvent(analytics, 'screen_view', {
      screen_name: screenName,
      screen_class: screenClass,
    });
  } catch (error) {
    if (__DEV__) console.warn(`[Analytics] Failed to track screen ${screenName}:`, error);
  }
};

export const setAnalyticsUser = async (userId: string | null) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const { setUserId } = await import('@react-native-firebase/analytics');
    await setUserId(analytics, userId);
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] Failed to set user id:', error);
  }
};

export const setAnalyticsUserProperties = async (properties: UserProperties) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const { setUserProperty } = await import('@react-native-firebase/analytics');
    await Promise.all(
      Object.entries(properties).map(([key, value]) => setUserProperty(analytics, key, value))
    );
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] Failed to set user properties:', error);
  }
};

export const getRatingBucket = (rating: number) => {
  if (!rating) return 'none';
  if (rating < 2.5) return 'low';
  if (rating < 4) return 'mid';
  return 'high';
};

export const getGenreCountBucket = (count: number) => {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count === 2) return '2';
  return '3+';
};
