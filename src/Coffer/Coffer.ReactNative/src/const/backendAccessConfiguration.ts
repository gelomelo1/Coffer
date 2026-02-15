import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { asyncstoragekeys } from "./async_storage_keys";

export const backendAxios = axios.create({
  baseURL: "http://192.168.1.2:5141",
});

backendAxios.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(asyncstoragekeys.jwt);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => Promise.reject(error),
);
