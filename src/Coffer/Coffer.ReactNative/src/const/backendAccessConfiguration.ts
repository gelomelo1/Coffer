import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import { env } from "./env";
import { useConnectionStore } from "../hooks/connection_store";
import i18n from "../i18n";
import { useSuspensionStore } from "../hooks/suspension_store";
import { classifyFailure, isDeviceOffline } from "../utils/connectivity";
import { getToken } from "../utils/token_store";
import { ACCOUNT_DELETED_CODE, signOutDeletedAccount } from "../utils/account_deleted";

// EXPO_PUBLIC_BACKEND_URL from Coffer.ReactNative/.env (required; https:// outside development).
export const backendAxios = axios.create({
  baseURL: env.backendUrl,
  // Without a timeout an unreachable server leaves requests (and spinners) pending forever; 30 s leaves room for
  // image uploads on slow connections. Timeouts surface as errors:timeout (see utils/api_error).
  timeout: 30000,
});

backendAxios.interceptors.request.use(
  async (config) => {
    const token = await getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // The API answers reference names (collection types, attributes, option labels) in this language when it
    // has a translation, otherwise in English.
    config.headers["Accept-Language"] = i18n.language || "en";

    return config;
  },

  (error) => Promise.reject(error),
);

// A suspended account gets 403 { code: "account_suspended", reason, endsAt } from every endpoint (enforced by the
// backend); the SuspendedScreen explains it and clears it via "Check again" (GET api/Account/Suspension).
backendAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    // No answer at all: open the "no internet" or "Coffer unavailable" page (see utils/connectivity).
    if (axios.isAxiosError(error)) {
      let offline = false;
      if (!error.response) {
        try {
          offline = isDeviceOffline(await NetInfo.fetch());
        } catch {}
      }
      const problem = classifyFailure(error, offline);
      if (problem) useConnectionStore.getState().setProblem(problem);
    }

    const data = error?.response?.data;
    // The account was deleted (here or on another device): its token is useless, so sign out.
    if (error?.response?.status === 401 && data?.code === ACCOUNT_DELETED_CODE) {
      void signOutDeletedAccount();
    }
    if (error?.response?.status === 403 && data?.code === "account_suspended") {
      useSuspensionStore.getState().setSuspension({ message: data.message, reason: data.reason, startsAt: data.startsAt, endsAt: data.endsAt });
    }
    return Promise.reject(error);
  },
);
