import { NativeModules } from 'react-native';

type AnalyticsParamValue = string | number | boolean;
type NoParams = Record<never, never>;

export type AnalyticsResult = 'success' | 'failed' | 'cancelled';
export type CountBucket = '0' | '1' | '2_5' | '6_20' | '21_plus';
export type PositionBucket = '1' | '2_5' | '6_10' | '11_plus';
export type ReleaseStatus = 'released' | 'upcoming' | 'unknown';

type AttributionParams = {
  source: string;
  surface?: string;
  reason_source?: string;
  position_bucket?: PositionBucket;
  algorithm_version?: string;
};

export interface AnalyticsEventMap {
  screen_view: { screen_name: string; screen_class: string };
  login: { method: 'email'; result: AnalyticsResult };
  sign_up: { method: 'email'; result: AnalyticsResult };
  onboarding_started: NoParams;
  onboarding_step_viewed: { step: string; step_index?: number; intro_index?: number };
  onboarding_genres_selected: { genre_count: number };
  onboarding_completed: { genre_count: number; avatar_type: 'icon' | 'photo'; duration_bucket: string };
  search: { surface: string; query_length_bucket: string; result_count_bucket: CountBucket; result: AnalyticsResult };
  search_result_opened: AttributionParams & { position_bucket: PositionBucket };
  search_filter_changed: { surface: string; filter: string };
  search_abandoned: { surface: string; query_length_bucket: string };
  recommendation_impression: AttributionParams & { position_bucket: PositionBucket };
  browse_section_viewed: { section: string };
  browse_section_item_opened: AttributionParams & { section: string };
  trending_window_changed: { window: 'day' | 'week' };
  tonight_pick_opened: AttributionParams;
  discover_session_started: { has_taste_profile: boolean };
  discover_card_viewed: AttributionParams & { position_bucket: PositionBucket };
  discover_card_action: AttributionParams & { action: string };
  discover_movie_opened: AttributionParams;
  discover_review_opened: { item_count_bucket: CountBucket };
  discover_session_completed: { card_count_bucket: CountBucket; positive_action_bucket: CountBucket };
  movie_opened: AttributionParams & { release_status: ReleaseStatus; has_rating: boolean };
  movie_detail_section_viewed: { section: string; release_status: ReleaseStatus };
  trailer_opened: AttributionParams;
  watch_provider_opened: AttributionParams & { provider_type: string };
  similar_movie_opened: AttributionParams & { position_bucket: PositionBucket };
  watchlist_added: AttributionParams & { release_status: ReleaseStatus };
  watchlist_removed: AttributionParams & { days_in_watchlist_bucket: string };
  watchlist_viewed: { source: string; item_count_bucket: CountBucket };
  watchlist_filter_changed: { filter: string };
  watchlist_movie_logged: { days_in_watchlist_bucket: string; source: string };
  movie_log_started: AttributionParams & { is_rewatch: boolean };
  movie_logged: AttributionParams & { rating_bucket: string; has_note: boolean; is_rewatch: boolean; date_type: string };
  movie_log_edited: { rating_bucket: string; has_note: boolean; date_changed: boolean };
  movie_log_deleted: { source: string; is_rewatch: boolean };
  favorite_changed: AttributionParams & { action: 'added' | 'removed' };
  library_tab_viewed: { tab: 'logs' | 'diary' | 'lists' };
  custom_list_created: { source: string; item_count_bucket: CountBucket };
  custom_list_opened: { source: string; item_count_bucket: CountBucket };
  custom_list_movie_added: { source: string };
  custom_list_movie_removed: { source: string };
  custom_list_deleted: { item_count_bucket: CountBucket };
  tier_list_opened: { source: string; has_existing_list: boolean };
  tier_list_created: { source: string; movie_count_bucket: CountBucket; tier_count_bucket: CountBucket };
  tier_list_edited: { action: string; movie_count_bucket: CountBucket };
  tier_list_completed: { movie_count_bucket: CountBucket; tier_count_bucket: CountBucket };
  tier_list_shared: { method: string; movie_count_bucket: CountBucket };
  profile_stats_viewed: { source: string; profile_owner: 'self' | 'friend'; visible_sections: string };
  profile_stat_opened: { stat_type: string; profile_owner: 'self' | 'friend' };
  profile_section_viewed: { section: string; profile_owner: 'self' | 'friend' };
  profile_edit_started: NoParams;
  profile_edit_saved: { avatar_changed: boolean; language_changed: boolean };
  profile_edit_abandoned: { had_changes: boolean };
  favorite_four_changed: { action: string; count_bucket: CountBucket };
  avatar_changed: { avatar_type: 'icon' | 'photo'; source: string };
  language_previewed: { locale: string };
  language_changed: { previous_locale: string; locale: string };
  friend_search_started: NoParams;
  friend_profile_opened: { source: string };
  friend_request_sent: { source: string };
  friend_request_accepted: { source: string; age_bucket: string };
  friend_request_declined: { source: string };
  friend_removed: { source: string };
  shared_watchlist_opened: { source: string; member_count_bucket: CountBucket };
  shared_watchlist_created: { source: string; member_count_bucket: CountBucket };
  shared_watchlist_joined: { source: string; member_count_bucket: CountBucket };
  shared_watchlist_movie_added: { source: string; member_count_bucket: CountBucket };
  shared_watchlist_movie_removed: { source: string; member_count_bucket: CountBucket };
  shared_watchlist_left: { source: string; member_count_bucket: CountBucket };
  activity_opened: { unread_count_bucket: CountBucket };
  activity_item_opened: { activity_type: string };
  activity_action_completed: { activity_type: string; action: string; result: AnalyticsResult };
  notification_permission_result: { result: 'granted' | 'denied' | 'unsupported' };
  notification_preference_changed: { enabled: boolean; day_before_enabled: boolean };
  release_notification_opened: { release_timing: 'day_before' | 'release_day' | 'unknown'; release_status: ReleaseStatus };
  notification_test_sent: { result: AnalyticsResult };
  letterboxd_import_started: { file_type: string };
  letterboxd_import_previewed: { matched_count_bucket: CountBucket; file_count_bucket: CountBucket };
  letterboxd_import_completed: { matched_count_bucket: CountBucket; result: AnalyticsResult };
  letterboxd_import_failed: { failure_reason: string };
  data_export_completed: { result: AnalyticsResult };
  cloud_sync_check_completed: { result: AnalyticsResult };
  profile_reset_completed: { result: AnalyticsResult };
  movie_data_clear_completed: { result: AnalyticsResult };
  account_deletion_started: NoParams;
  account_deletion_completed: { result: AnalyticsResult };
  share: { content_type: string; method: string; result: AnalyticsResult };
}

export interface AnalyticsUserPropertyMap {
  onboarding_completed: 'true' | 'false';
  favorite_genre_count: string;
  has_logged_movie: 'true' | 'false';
  has_watchlist_item: 'true' | 'false';
  locale: string;
  account_age_bucket: string;
  watched_count_bucket: CountBucket;
  watchlist_count_bucket: CountBucket;
  discovery_usage_bucket: CountBucket;
  social_usage_bucket: CountBucket;
  notifications_enabled: 'true' | 'false';
  has_shared_watchlist: 'true' | 'false';
}

type EventName = keyof AnalyticsEventMap;
type EmptyEventName = {
  [K in EventName]: keyof AnalyticsEventMap[K] extends never ? K : never;
}[EventName];

const ANALYTICS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false';
const SCHEMA_VERSION = 1;
const FORBIDDEN_PARAM_NAMES = new Set([
  'bio', 'display_name', 'email', 'friend_id', 'list_name', 'name', 'note', 'query',
  'review', 'title', 'url', 'user_id', 'username',
]);
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u;

let analyticsInstancePromise: Promise<any | null> | null = null;

const getAnalyticsInstance = async () => {
  if (!ANALYTICS_ENABLED || !NativeModules.RNFBAppModule) return null;
  analyticsInstancePromise ??= Promise.all([
    import('@react-native-firebase/app'),
    import('@react-native-firebase/analytics'),
  ])
    .then(([appModule, analyticsModule]) =>
      analyticsModule.getAnalytics(appModule.getApp())
    )
    .catch((error) => {
      if (__DEV__) console.warn('[Analytics] Firebase Analytics is unavailable:', error);
      return null;
    });
  return analyticsInstancePromise;
};

export const sanitizeAnalyticsParams = (
  params?: Record<string, AnalyticsParamValue | null | undefined>
) => {
  const entries = Object.entries(params ?? {}).filter(([key, value]) => {
    if (value === undefined || value === null) return false;
    const invalidName =
      key.length > 40 ||
      !/^[a-z][a-z0-9_]*$/u.test(key) ||
      key.startsWith('firebase_') ||
      key.startsWith('google_') ||
      key.startsWith('ga_') ||
      FORBIDDEN_PARAM_NAMES.has(key);
    const invalidValue = typeof value === 'string' && (value.length > 100 || EMAIL_PATTERN.test(value));
    if (__DEV__ && (invalidName || invalidValue)) {
      console.warn(`[Analytics] Dropped unsafe parameter: ${key}`);
    }
    return !invalidName && !invalidValue;
  });
  return Object.fromEntries(entries.slice(0, 24)) as Record<string, AnalyticsParamValue>;
};

export function trackEvent<K extends EmptyEventName>(name: K): Promise<void>;
export function trackEvent<K extends EventName>(name: K, params: AnalyticsEventMap[K]): Promise<void>;
export async function trackEvent(
  name: EventName,
  params?: Record<string, AnalyticsParamValue | null | undefined>
) {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const { logEvent } = await import('@react-native-firebase/analytics');
    await logEvent(analytics, name as any, {
      ...sanitizeAnalyticsParams(params),
      schema_version: SCHEMA_VERSION,
    });
  } catch (error) {
    if (__DEV__) console.warn(`[Analytics] Failed to track ${name}:`, error);
  }
}

export const trackScreenView = (screenName: string, screenClass = screenName) =>
  trackEvent('screen_view', { screen_name: screenName, screen_class: screenClass });

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

export const setAnalyticsUserProperties = async (
  properties: Partial<AnalyticsUserPropertyMap>
) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const { setUserProperty } = await import('@react-native-firebase/analytics');
    await Promise.all(
      Object.entries(properties).map(([key, value]) => setUserProperty(analytics, key, value ?? null))
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

export const getCountBucket = (count: number): CountBucket => {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2_5';
  if (count <= 20) return '6_20';
  return '21_plus';
};

export const getPositionBucket = (position: number): PositionBucket => {
  if (position <= 1) return '1';
  if (position <= 5) return '2_5';
  if (position <= 10) return '6_10';
  return '11_plus';
};

export const getGenreCountBucket = (count: number) => {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count === 2) return '2';
  return '3+';
};

export const getReleaseStatus = (releaseDate?: string): ReleaseStatus => {
  if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/u.test(releaseDate)) return 'unknown';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return releaseDate > today ? 'upcoming' : 'released';
};

export const getDaysBucket = (from?: string, to = new Date()) => {
  if (!from) return 'unknown';
  const timestamp = new Date(from).getTime();
  if (!Number.isFinite(timestamp)) return 'unknown';
  const days = Math.max(0, Math.floor((to.getTime() - timestamp) / 86400000));
  if (days === 0) return 'same_day';
  if (days <= 7) return '1_7';
  if (days <= 30) return '8_30';
  if (days <= 90) return '31_90';
  return '91_plus';
};
