// Firebase web config for both apps: Expo inlines EXPO_PUBLIC_*, Next inlines NEXT_PUBLIC_*.
// Each var is referenced literally so the bundlers can substitute it at build time.
// Side-effect free, so callers that need their own app instance can import it alone.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
