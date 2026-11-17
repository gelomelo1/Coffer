import axios from "axios";
import i18n from "../i18n";
import { useSuspensionStore } from "../hooks/suspension_store";
import { getToken } from "../utils/token_store";

// EXPO_PUBLIC_BACKEND_URL overrides the default at bundle time, e.g. http://10.0.2.2:5141 for the Android emulator.
export const backendAxios = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL || "http://192.168.1.10:5141",
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
  (error) => {
    const data = error?.response?.data;
    if (error?.response?.status === 403 && data?.code === "account_suspended") {
      useSuspensionStore.getState().setSuspension({ message: data.message, reason: data.reason, startsAt: data.startsAt, endsAt: data.endsAt });
    }
    return Promise.reject(error);
  },
);
