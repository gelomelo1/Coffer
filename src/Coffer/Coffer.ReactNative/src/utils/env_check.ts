/** The app's configuration from Coffer.ReactNative/.env (inlined at bundle time). Every value is required. */
export type AppEnv = {
  /** Never ends with "/" (endpoints append "/api/..."). */
  backendUrl: string;
  googleWebClientId: string;
  facebookAppId: string;
  discordAppId: string;
  authScheme: string;
};

export type RawAppEnv = {
  EXPO_PUBLIC_BACKEND_URL: string | undefined;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string | undefined;
  EXPO_PUBLIC_FACEBOOK_APP_ID: string | undefined;
  EXPO_PUBLIC_DISCORD_APP_ID: string | undefined;
  EXPO_PUBLIC_AUTH_SCHEME: string | undefined;
};

const ORDER: (keyof RawAppEnv)[] = [
  "EXPO_PUBLIC_BACKEND_URL",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_FACEBOOK_APP_ID",
  "EXPO_PUBLIC_DISCORD_APP_ID",
  "EXPO_PUBLIC_AUTH_SCHEME",
];

/**
 * Fails loudly on a missing value instead of falling back to a default, and refuses a plain-HTTP backend outside
 * development builds (release builds talk to the API over HTTPS only).
 */
export function checkEnv(raw: RawAppEnv, isDev: boolean): AppEnv {
  for (const key of ORDER) {
    if (!raw[key]?.trim()) throw new Error(`Missing ${key} in Coffer.ReactNative/.env`);
  }
  const backendUrl = raw.EXPO_PUBLIC_BACKEND_URL!.trim();
  if (!/^https?:\/\//i.test(backendUrl)) throw new Error("EXPO_PUBLIC_BACKEND_URL must start with https:// (or http:// in development)");
  if (!isDev && !/^https:\/\//i.test(backendUrl)) throw new Error("EXPO_PUBLIC_BACKEND_URL must use https:// outside development");

  return {
    backendUrl: backendUrl.replace(/\/+$/, ""),
    googleWebClientId: raw.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!.trim(),
    facebookAppId: raw.EXPO_PUBLIC_FACEBOOK_APP_ID!.trim(),
    discordAppId: raw.EXPO_PUBLIC_DISCORD_APP_ID!.trim(),
    authScheme: raw.EXPO_PUBLIC_AUTH_SCHEME!.trim(),
  };
}
