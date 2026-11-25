/** The app's configuration from Coffer.ReactNative/.env (inlined at bundle time). */
export type AppEnv = {
  /** Never ends with "/" (endpoints append "/api/..."). */
  backendUrl: string;
  /** Sign-in ids: null = that sign-in is off (debug builds only; release builds require them). */
  googleWebClientId: string | null;
  facebookAppId: string | null;
  discordAppId: string | null;
  authScheme: string;
};

export type RawAppEnv = {
  EXPO_PUBLIC_BACKEND_URL: string | undefined;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string | undefined;
  EXPO_PUBLIC_FACEBOOK_APP_ID: string | undefined;
  EXPO_PUBLIC_DISCORD_APP_ID: string | undefined;
  EXPO_PUBLIC_AUTH_SCHEME: string | undefined;
};

/** Always required, in every build. */
const ALWAYS: (keyof RawAppEnv)[] = ["EXPO_PUBLIC_BACKEND_URL", "EXPO_PUBLIC_AUTH_SCHEME"];
/** Required in release builds; in debug builds a missing one only switches that sign-in off. */
const SIGN_IN: (keyof RawAppEnv)[] = ["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "EXPO_PUBLIC_FACEBOOK_APP_ID", "EXPO_PUBLIC_DISCORD_APP_ID"];

/** The placeholders of .env.example (change-me…, your-…). */
export function isPlaceholder(value: string): boolean {
  return /change-me/i.test(value) || /^your-/i.test(value);
}

/**
 * Fails loudly instead of falling back to a default. Release builds need every value and an https:// backend; debug
 * builds may leave sign-in ids out (or as placeholders) while the apps are being set up — those sign-ins are off.
 */
export function checkEnv(raw: RawAppEnv, isDev: boolean): AppEnv {
  for (const key of [...ALWAYS.slice(0, 1), ...SIGN_IN, ...ALWAYS.slice(1)]) {
    const value = raw[key]?.trim();
    const optional = isDev && SIGN_IN.includes(key);
    if (!value) {
      if (optional) continue;
      throw new Error(`Missing ${key} in Coffer.ReactNative/.env`);
    }
    if (!optional && SIGN_IN.includes(key) && isPlaceholder(value)) {
      throw new Error(`${key} in Coffer.ReactNative/.env is still a placeholder`);
    }
  }
  const backendUrl = raw.EXPO_PUBLIC_BACKEND_URL!.trim();
  if (!/^https?:\/\//i.test(backendUrl)) throw new Error("EXPO_PUBLIC_BACKEND_URL must start with https:// (or http:// in development)");
  if (!isDev && !/^https:\/\//i.test(backendUrl)) throw new Error("EXPO_PUBLIC_BACKEND_URL must use https:// outside development");

  const signIn = (key: keyof RawAppEnv): string | null => {
    const value = raw[key]?.trim();
    return value && !isPlaceholder(value) ? value : null;
  };
  return {
    backendUrl: backendUrl.replace(/\/+$/, ""),
    googleWebClientId: signIn("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
    facebookAppId: signIn("EXPO_PUBLIC_FACEBOOK_APP_ID"),
    discordAppId: signIn("EXPO_PUBLIC_DISCORD_APP_ID"),
    authScheme: raw.EXPO_PUBLIC_AUTH_SCHEME!.trim(),
  };
}
