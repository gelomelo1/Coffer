import AsyncStorage from "@react-native-async-storage/async-storage";
import { asyncstoragekeys } from "../const/async_storage_keys";

// The JWT is stored with expo-secure-store (Android Keystore / iOS Keychain) instead of plain
// AsyncStorage, which is unencrypted and included in Android backups.
// If the native module is not available (e.g. an old development build), AsyncStorage is used as before.
type SecureStoreModule = typeof import("expo-secure-store");

let secureStore: SecureStoreModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  secureStore = require("expo-secure-store");
} catch {
  secureStore = null;
}

const SECURE_JWT_KEY = "coffer_jwt";

export async function getToken(): Promise<string | null> {
  if (secureStore) {
    try {
      const token = await secureStore.getItemAsync(SECURE_JWT_KEY);
      if (token) {
        return token;
      }

      // One-time migration of a token saved by an older app version.
      const legacyToken = await AsyncStorage.getItem(asyncstoragekeys.jwt);
      if (legacyToken) {
        await secureStore.setItemAsync(SECURE_JWT_KEY, legacyToken);
        await AsyncStorage.removeItem(asyncstoragekeys.jwt);
      }
      return legacyToken;
    } catch (error) {
      console.error("Secure token storage unavailable:", error);
    }
  }

  return AsyncStorage.getItem(asyncstoragekeys.jwt);
}

export async function setToken(token: string): Promise<void> {
  if (secureStore) {
    try {
      await secureStore.setItemAsync(SECURE_JWT_KEY, token);
      await AsyncStorage.removeItem(asyncstoragekeys.jwt);
      return;
    } catch (error) {
      console.error("Secure token storage unavailable:", error);
    }
  }

  await AsyncStorage.setItem(asyncstoragekeys.jwt, token);
}

export async function removeToken(): Promise<void> {
  if (secureStore) {
    try {
      await secureStore.deleteItemAsync(SECURE_JWT_KEY);
    } catch (error) {
      console.error("Secure token storage unavailable:", error);
    }
  }

  await AsyncStorage.removeItem(asyncstoragekeys.jwt);
}
