export const AUTH_ENABLED = process.env.EXPO_PUBLIC_ENABLE_AUTH === 'true';
export const CLOUD_SYNC_ENABLED =
  AUTH_ENABLED && process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true';

export const LOCAL_USER_ID = 'local-user';
