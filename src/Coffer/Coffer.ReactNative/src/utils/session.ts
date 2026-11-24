import axios from "axios";
import { env } from "../const/env";
import { useUserStore } from "../hooks/user_store";
import { GoogleSignin } from "./google_signin";
import { queryClient } from "./query_client";
import { clearSession, getAccessToken, getRefreshToken, saveSession, StoredSession } from "./token_store";

// Plain axios on purpose: these calls must never go through backendAxios's refresh-on-401 interceptor.
const AUTH_REFRESH = "api/auth/refresh";
const AUTH_LOGOUT = "api/auth/logout";
const url = (path: string) => `${env.backendUrl}/${path}`;

/** Keeps the tokens of a fresh sign-in or refresh. */
export async function signInWith(tokens: StoredSession): Promise<void> {
  await saveSession(tokens);
  useUserStore.getState().setToken(tokens.accessToken);
}

/** Trades the stored refresh token for a new pair; throws when the session is over. */
export async function refreshSession(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  const { data } = await axios.post<StoredSession>(url(AUTH_REFRESH), { refreshToken }, { timeout: 30000 });
  await signInWith(data);
  return data.accessToken;
}

let signingOut = false;

/**
 * Signs out on this device: ends the server session (best effort), forgets the tokens, empties the cached API data
 * and ends the Google session. Many failing requests can trigger it at once; only the first call does anything.
 */
export async function signOut({ callServer }: { callServer: boolean }): Promise<void> {
  if (signingOut) return;
  signingOut = true;
  try {
    if (callServer) {
      const [refreshToken, accessToken] = await Promise.all([getRefreshToken(), getAccessToken()]);
      await axios
        .post(url(AUTH_LOGOUT), { refreshToken }, {
          timeout: 10000,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        })
        .catch(() => undefined);
    }
    await clearSession();
    queryClient.clear();
    useUserStore.getState().setToken(null);
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // Not signed in with Google, or already signed out.
    }
  } finally {
    signingOut = false;
  }
}
