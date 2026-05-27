import { getApps, initializeApp } from 'firebase/app';
// firebase/auth resolves to the React Native build in Metro (which exports
// getReactNativePersistence). TypeScript uses the browser typings (which don't
// include it), so we cast auth module to any for the RN-only symbol.
import * as firebaseAuthModule from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { getAuth } = firebaseAuthModule;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { getReactNativePersistence } = firebaseAuthModule as any;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Set AsyncStorage persistence. getAuth(app) may already be initialized by
// bk-shared/firebase.ts so we use the existing instance and update its
// persistence rather than calling initializeAuth (which would throw).
const auth = getAuth(app);
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
auth.setPersistence(getReactNativePersistence(AsyncStorage)).catch(() => {});
