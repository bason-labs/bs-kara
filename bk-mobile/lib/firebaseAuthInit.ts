import { getApps, initializeApp } from 'firebase/app';
import { getAuth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// getReactNativePersistence only exists in the RN bundle of firebase/auth.
// The browser typings don't include it so we access it via dynamic require.
// Metro resolves firebase/auth to the RN build at runtime, so this works.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js');
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const rnPersistence: Persistence = getReactNativePersistence(AsyncStorage) as Persistence;

const auth = getAuth(app);
auth.setPersistence(rnPersistence).catch(() => {});
