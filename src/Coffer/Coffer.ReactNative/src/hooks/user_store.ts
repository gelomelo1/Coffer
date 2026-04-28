import { create } from "zustand";
import { UserStore } from "../types/helpers/data_store";

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
}));
