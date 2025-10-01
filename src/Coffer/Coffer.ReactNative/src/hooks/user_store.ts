import { create } from "zustand";
import { UserStore } from "../types/helpers/data_store";

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
