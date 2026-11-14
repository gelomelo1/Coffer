import axios from "axios";
import { getToken } from "../utils/token_store";

// EXPO_PUBLIC_BACKEND_URL overrides the default at bundle time, e.g. http://10.0.2.2:5141 for the Android emulator.
export const backendAxios = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL || "http://192.168.1.10:5141",
});

backendAxios.interceptors.request.use(
  async (config) => {
    const token = await getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => Promise.reject(error),
);
