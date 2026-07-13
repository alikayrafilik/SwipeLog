import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReleaseStatus, trackEvent } from '@/services/analytics';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { parseReleaseDate } from '@/utils/release-date';

export interface SmartNotificationPreferences {
  enabled: boolean;
  dayBeforeRelease: boolean;
}

interface WatchlistNotificationMovie {
  id: string;
  title: string;
  date?: string;
  releaseDate?: string;
  image?: string;
  overview?: string;
  rating?: number;
  isWatchlist: boolean;
}

type ScheduledReleaseNotifications = Record<
  string,
  {
    releaseDate: string;
    releaseDayId?: string;
    dayBeforeId?: string;
  }
>;

const PREFERENCES_KEY = '@swipelog_notification_preferences_v1';
const SCHEDULED_KEY = '@swipelog_scheduled_release_notifications_v1';
const RELEASE_CHANNEL_ID = 'watchlist-releases';
let syncQueue: Promise<number> = Promise.resolve(0);

const parseScheduledNotifications = (stored: string | null): ScheduledReleaseNotifications => {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed as ScheduledReleaseNotifications : {};
  } catch {
    return {};
  }
};

export const isSmartNotificationsSupported = !(
  Platform.OS === 'web' || (Platform.OS === 'android' && isRunningInExpoGo())
);

const getNotifications = async () => {
  if (!isSmartNotificationsSupported) return null;
  return await import('expo-notifications');
};

export const defaultSmartNotificationPreferences: SmartNotificationPreferences = {
  enabled: false,
  dayBeforeRelease: true,
};

const createMovieUrl = (movie: WatchlistNotificationMovie) => {
  const params = new URLSearchParams({
    title: movie.title,
    year: movie.date?.match(/\d{4}/)?.[0] ?? '',
    image: movie.image ?? '',
    overview: movie.overview ?? '',
    rating: `${movie.rating ?? 0}`,
  });
  return `/movie/${movie.id}?${params.toString()}`;
};

const ensureReleaseChannel = async () => {
  const Notifications = await getNotifications();
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(RELEASE_CHANNEL_ID, {
    name: 'Watchlist releases',
    description: 'Release reminders for films saved to your watchlist.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#F9C80E',
  });
};

const cancelScheduledEntry = async (entry?: ScheduledReleaseNotifications[string]) => {
  if (!entry) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Promise.all(
    [entry.releaseDayId, entry.dayBeforeId]
      .filter((id): id is string => Boolean(id))
      .map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined))
  );
};

export const loadSmartNotificationPreferences = async () => {
  const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
  if (!stored) return defaultSmartNotificationPreferences;
  try {
    return {
      ...defaultSmartNotificationPreferences,
      ...(JSON.parse(stored) as Partial<SmartNotificationPreferences>),
    };
  } catch {
    return defaultSmartNotificationPreferences;
  }
};

export const saveSmartNotificationPreferences = async (
  preferences: SmartNotificationPreferences
) => {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

export const requestSmartNotificationPermission = async () => {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  await ensureReleaseChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

export const clearSmartNotifications = async () => {
  const stored = await AsyncStorage.getItem(SCHEDULED_KEY);
  const scheduled = parseScheduledNotifications(stored);
  await Promise.all(Object.values(scheduled).map(cancelScheduledEntry));
  await AsyncStorage.removeItem(SCHEDULED_KEY);
};

export const getScheduledSmartNotificationCount = async () => {
  const stored = await AsyncStorage.getItem(SCHEDULED_KEY);
  if (!stored) return 0;
  const scheduled = parseScheduledNotifications(stored);
  return Object.values(scheduled).reduce(
    (total, entry) =>
      total + Number(Boolean(entry.releaseDayId)) + Number(Boolean(entry.dayBeforeId)),
    0
  );
};

export const sendSmartNotificationTest = async (movies: WatchlistNotificationMovie[]) => {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  await ensureReleaseChannel();
  const movie = movies.find((item) => item.isWatchlist);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: movie ? `${movie.title} release reminder` : 'SwipeLog reminders are ready',
      body: movie
        ? 'This is how a watchlist release notification will look.'
        : 'Add a future release to your watchlist to receive smart reminders.',
      data: movie ? { url: createMovieUrl(movie), movieId: movie.id } : {},
      sound: 'default',
    },
    trigger: null,
  });
  return true;
};

const performSmartNotificationSync = async (
  movies: WatchlistNotificationMovie[],
  providedPreferences?: SmartNotificationPreferences
) => {
  const preferences = providedPreferences ?? (await loadSmartNotificationPreferences());
  if (!preferences.enabled) {
    await clearSmartNotifications();
    return 0;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return 0;
  await ensureReleaseChannel();
  const stored = await AsyncStorage.getItem(SCHEDULED_KEY);
  const previous = parseScheduledNotifications(stored);
  const next: ScheduledReleaseNotifications = {};
  const now = new Date();
  const watchlistMovies = movies.filter((movie) => movie.isWatchlist);

  for (const movie of watchlistMovies) {
    const releaseDate = parseReleaseDate(movie.releaseDate, 10);
    if (!releaseDate || releaseDate <= now) continue;
    const releaseDateKey = releaseDate.toISOString();
    const existing = previous[movie.id];

    if (
      existing?.releaseDate === releaseDateKey &&
      existing.releaseDayId &&
      (preferences.dayBeforeRelease ? Boolean(existing.dayBeforeId) : !existing.dayBeforeId)
    ) {
      next[movie.id] = existing;
      continue;
    }

    await cancelScheduledEntry(existing);
    const url = createMovieUrl(movie);
    const releaseDayId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${movie.title} is out today`,
        body: 'A film from your watchlist is now playing. Tap to view its details.',
        data: { url, movieId: movie.id, releaseTiming: 'release_day', releaseDate: movie.releaseDate },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: releaseDate,
        channelId: RELEASE_CHANNEL_ID,
      },
    });

    let dayBeforeId: string | undefined;
    if (preferences.dayBeforeRelease) {
      const dayBefore = new Date(releaseDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(18, 0, 0, 0);
      if (dayBefore > now) {
        dayBeforeId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${movie.title} arrives tomorrow`,
            body: 'It is saved in your watchlist. Ready for movie night?',
            data: { url, movieId: movie.id, releaseTiming: 'day_before', releaseDate: movie.releaseDate },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dayBefore,
            channelId: RELEASE_CHANNEL_ID,
          },
        });
      }
    }

    next[movie.id] = { releaseDate: releaseDateKey, releaseDayId, dayBeforeId };
  }

  await Promise.all(
    Object.entries(previous)
      .filter(([movieId]) => !next[movieId])
      .map(([, entry]) => cancelScheduledEntry(entry))
  );
  await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(next));
  return Object.values(next).reduce(
    (total, entry) => total + Number(Boolean(entry.releaseDayId)) + Number(Boolean(entry.dayBeforeId)),
    0
  );
};

export const syncSmartNotifications = (
  movies: WatchlistNotificationMovie[],
  providedPreferences?: SmartNotificationPreferences
) => {
  if (!isSmartNotificationsSupported) return Promise.resolve(0);

  syncQueue = syncQueue
    .catch(() => 0)
    .then(() => performSmartNotificationSync(movies, providedPreferences));
  return syncQueue;
};

export const configureSmartNotificationHandler = async () => {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};

export const subscribeToSmartNotificationResponses = async (
  onUrl: (url: string) => void
) => {
  const Notifications = await getNotifications();
  if (!Notifications) return () => undefined;

  const redirect = (notification: import('expo-notifications').Notification) => {
    const url = notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/movie/')) {
      const timing = notification.request.content.data?.releaseTiming;
      const releaseDate = notification.request.content.data?.releaseDate;
      void trackEvent('release_notification_opened', {
        release_timing:
          timing === 'day_before' || timing === 'release_day' ? timing : 'unknown',
        release_status: getReleaseStatus(typeof releaseDate === 'string' ? releaseDate : undefined),
      });
      onUrl(url);
    }
  };

  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse?.notification) redirect(lastResponse.notification);
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    redirect(response.notification);
  });
  return () => subscription.remove();
};
