import axios from "axios";
import { getToken } from "../utils/token_store";

export const backendAxios = axios.create({
  baseURL: "http://192.168.1.10:5141",
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
