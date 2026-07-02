import { getApp, getApps, initializeApp } from 'firebase/app';
// @ts-expect-error - React Native persistence is exported at runtime but not declared in all Firebase type maps.
import { initializeAuth, getReactNativePersistence, getAuth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED } from '@/constants/features';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const requiredFirebaseKeys = Object.entries(firebaseConfig).filter(([, value]) => !value);
const fallbackFirebaseConfig = {
  apiKey: 'disabled',
  authDomain: 'disabled.firebaseapp.com',
  projectId: 'disabled',
  storageBucket: 'disabled.firebasestorage.app',
  messagingSenderId: '0',
  appId: 'disabled',
};
const firebaseEmulatorEnabled = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
const defaultFirebaseEmulatorHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const firebaseEmulatorHost =
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || defaultFirebaseEmulatorHost;
const firebaseAuthEmulatorPort = Number(process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || 9099);
const firestoreEmulatorPort = Number(process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);

if ((AUTH_ENABLED || CLOUD_SYNC_ENABLED) && requiredFirebaseKeys.length > 0) {
  throw new Error(
    `Firebase environment variables are missing: ${requiredFirebaseKeys
      .map(([key]) => key)
      .join(', ')}`
  );
}

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(requiredFirebaseKeys.length > 0 ? fallbackFirebaseConfig : firebaseConfig);

let auth;
try {
  auth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(firebaseApp);
}
export const firebaseAuth = auth;

export const firestore = getFirestore(firebaseApp);

const globalForFirebase = globalThis as typeof globalThis & {
  __SWIPELOG_FIREBASE_EMULATORS_CONNECTED__?: boolean;
};

if (firebaseEmulatorEnabled && !globalForFirebase.__SWIPELOG_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(firebaseAuth, `http://${firebaseEmulatorHost}:${firebaseAuthEmulatorPort}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, firebaseEmulatorHost, firestoreEmulatorPort);
  globalForFirebase.__SWIPELOG_FIREBASE_EMULATORS_CONNECTED__ = true;
}
