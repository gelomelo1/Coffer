import { checkEnv } from "../utils/env_check";

/**
 * Coffer.ReactNative/.env, checked once when the app starts: a missing value stops the app with the variable's name.
 * Each value must be read as a literal `process.env.EXPO_PUBLIC_…` — that is what Expo inlines at bundle time.
 */
export const env = checkEnv(
  {
    EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    EXPO_PUBLIC_FACEBOOK_APP_ID: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
    EXPO_PUBLIC_AUTH_SCHEME: process.env.EXPO_PUBLIC_AUTH_SCHEME,
  },
  __DEV__,
);
