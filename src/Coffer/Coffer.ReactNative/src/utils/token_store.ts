import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { asyncstoragekeys } from "../const/async_storage_keys";

/** What a sign-in or refresh returns. The refresh token is the long-lived secret: it never leaves SecureStore. */
export type StoredSession = { accessToken: string; refreshToken: string; accessTokenExpiresAt: string };

// Android Keystore / iOS Keychain only. There is deliberately no plain-storage fallback: without secure storage the
// person simply signs in again next time.
const KEYS = {
  access: "coffer_access_token",
  refresh: "coffer_refresh_token",
  expires: "coffer_access_expires",
};
/** The one-year token of older app versions: no longer accepted by the backend, only deleted. */
const LEGACY_SECURE_KEY = "coffer_jwt";

async function dropLegacyToken(): Promise<void> {
  await Promise.allSettled([SecureStore.deleteItemAsync(LEGACY_SECURE_KEY), AsyncStorage.removeItem(asyncstoragekeys.jwt)]);
}

export async function getAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(KEYS.access);
  if (!token) await dropLegacyToken();
  return token;
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.refresh);
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEYS.refresh, session.refreshToken);
  await SecureStore.setItemAsync(KEYS.access, session.accessToken);
  await SecureStore.setItemAsync(KEYS.expires, session.accessTokenExpiresAt);
}

export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(KEYS.access),
    SecureStore.deleteItemAsync(KEYS.refresh),
    SecureStore.deleteItemAsync(KEYS.expires),
  ]);
  await dropLegacyToken();
}
